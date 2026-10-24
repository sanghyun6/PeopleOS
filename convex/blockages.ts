// Blockage-aware rerouting. A blockage report applies immediately: close every edge
// touching the blocked zone, then re-evaluate open assignments (keep with a new
// route, or reassign). No operator confirmation step; ops can Undo from the banner.
import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { rerouteAll } from "./dispatch";

const MAX_ROWS = 100;

async function edgesTouching(ctx: MutationCtx, zoneId: Id<"zones">): Promise<Doc<"edges">[]> {
  const [from, to] = await Promise.all([
    ctx.db
      .query("edges")
      .withIndex("by_from", (q) => q.eq("from", zoneId))
      .take(MAX_ROWS),
    ctx.db
      .query("edges")
      .withIndex("by_to", (q) => q.eq("to", zoneId))
      .take(MAX_ROWS),
  ]);
  return [...from, ...to];
}

/**
 * Close every edge touching the incident's zone, mark the incident acknowledged, and
 * reroute open assignments. Called from the report pipeline in the same transaction.
 */
export async function applyBlockage(
  ctx: MutationCtx,
  incident: Doc<"incidents">,
): Promise<{ blockedEdges: number; rerouted: number; reassigned: number }> {
  const edges = await edgesTouching(ctx, incident.zoneId);
  let blockedEdges = 0;
  for (const edge of edges) {
    if (edge.blocked) continue; // already closed, possibly by another blockage that owns it
    await ctx.db.patch("edges", edge._id, { blocked: true, blockedByIncidentId: incident._id });
    blockedEdges++;
  }
  const zone = await ctx.db.get("zones", incident.zoneId);
  const { rerouted, reassigned } = await rerouteAll(ctx, `blockage at ${zone?.name.split(" (")[0] ?? "a hallway"}`);
  await ctx.db.patch("incidents", incident._id, {
    status: "acknowledged",
    acknowledgedAt: Date.now(),
    reroutedCount: rerouted,
  });
  return { blockedEdges, rerouted, reassigned };
}

/** Reopen the edges this blockage closed and reroute. Idempotent. */
async function release(ctx: MutationCtx, incidentId: Id<"incidents">, status: "cancelled" | "resolved", reason: string) {
  const incident = await ctx.db.get("incidents", incidentId);
  if (!incident) throw new Error("Blockage not found");
  if (incident.category !== "blockage") throw new Error(`Not a blockage (${incident.category})`);
  if (incident.status === "cancelled" || incident.status === "resolved") return { reopenedEdges: 0, rerouted: 0, reassigned: 0 };
  let reopenedEdges = 0;
  for (const edge of await edgesTouching(ctx, incident.zoneId)) {
    if (edge.blockedByIncidentId !== incidentId) continue;
    await ctx.db.patch("edges", edge._id, { blocked: false, blockedByIncidentId: undefined });
    reopenedEdges++;
  }
  await ctx.db.patch("incidents", incidentId, { status, resolvedAt: Date.now() });
  const { rerouted, reassigned } = await rerouteAll(ctx, reason);
  return { reopenedEdges, rerouted, reassigned };
}

const releaseResult = v.object({ reopenedEdges: v.number(), rerouted: v.number(), reassigned: v.number() });

/** Ops pressed Undo on a blockage banner: unblock the edges and re-plan. */
export const undo = mutation({
  args: { blockageId: v.id("incidents") },
  returns: releaseResult,
  handler: async (ctx, { blockageId }) => release(ctx, blockageId, "cancelled", "blockage undone"),
});

/** The hallway is clear again (resolved, as opposed to reported by mistake). */
export const clear = mutation({
  args: { blockageId: v.id("incidents") },
  returns: releaseResult,
  handler: async (ctx, { blockageId }) => release(ctx, blockageId, "resolved", "hallway cleared"),
});

/** Applied (still active) blockages for the ops banner, newest first. */
export const listApplied = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("incidents")
      .withIndex("by_status", (q) => q.eq("status", "acknowledged"))
      .order("desc")
      .take(MAX_ROWS);
    const out = [];
    for (const incident of rows) {
      if (incident.category !== "blockage") continue;
      const location = await ctx.db.get("locations", incident.locationId);
      out.push({
        _id: incident._id,
        _creationTime: incident._creationTime,
        label: location?.label ?? "Unknown location",
        reroutedCount: incident.reroutedCount ?? 0,
      });
    }
    return out;
  },
});
