// Blockage-aware rerouting: a reported blockage only changes the graph after an
// operator confirms it. Policy: close every edge touching the blocked zone, then
// re-evaluate open assignments (keep with a new route, or reassign).
import { v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { rerouteAll } from "./dispatch";

async function edgesTouching(ctx: MutationCtx, zoneId: Id<"zones">): Promise<Doc<"edges">[]> {
  const [from, to] = await Promise.all([
    ctx.db
      .query("edges")
      .withIndex("by_from", (q) => q.eq("from", zoneId))
      .take(100),
    ctx.db
      .query("edges")
      .withIndex("by_to", (q) => q.eq("to", zoneId))
      .take(100),
  ]);
  return [...from, ...to];
}

/**
 * Operator confirms a pending_review blockage report. Closes every edge touching the
 * blocked zone (or `edgeIds`, if the operator picked specific ones) and reroutes.
 */
export const confirm = mutation({
  args: { incidentId: v.id("incidents"), edgeIds: v.optional(v.array(v.id("edges"))) },
  returns: v.object({ blockedEdges: v.number(), reassigned: v.number() }),
  handler: async (ctx, { incidentId, edgeIds }) => {
    const incident = await ctx.db.get("incidents", incidentId);
    if (!incident) throw new Error("Incident not found");
    if (incident.category !== "blockage" || incident.status !== "pending_review") {
      throw new Error(`Only pending blockage reports can be confirmed (this one is ${incident.category}/${incident.status})`);
    }
    const edges = edgeIds?.length
      ? (await Promise.all(edgeIds.map((id) => ctx.db.get("edges", id)))).filter((e): e is Doc<"edges"> => e !== null)
      : await edgesTouching(ctx, incident.zoneId);
    for (const edge of edges) {
      await ctx.db.patch("edges", edge._id, { blocked: true, blockedByIncidentId: incidentId });
    }
    await ctx.db.patch("incidents", incidentId, { status: "acknowledged", acknowledgedAt: Date.now() });

    const zone = await ctx.db.get("zones", incident.zoneId);
    const reassigned = await rerouteAll(ctx, `blockage at ${zone?.name.split(" (")[0] ?? "a hallway"}`);
    return { blockedEdges: edges.length, reassigned };
  },
});

/** Reopen the edges a blockage closed once the hallway is clear, and reroute. */
export const clear = mutation({
  args: { incidentId: v.id("incidents") },
  returns: v.object({ reopenedEdges: v.number(), reassigned: v.number() }),
  handler: async (ctx, { incidentId }) => {
    const incident = await ctx.db.get("incidents", incidentId);
    if (!incident) throw new Error("Incident not found");
    const edges = await edgesTouching(ctx, incident.zoneId);
    let reopenedEdges = 0;
    for (const edge of edges) {
      if (edge.blockedByIncidentId !== incidentId) continue;
      await ctx.db.patch("edges", edge._id, { blocked: false, blockedByIncidentId: undefined });
      reopenedEdges++;
    }
    await ctx.db.patch("incidents", incidentId, { status: "resolved", resolvedAt: Date.now() });
    const reassigned = await rerouteAll(ctx, "hallway cleared");
    return { reopenedEdges, reassigned };
  },
});
