// Auto dispatch: role match -> availability -> current workload -> path distance.
// Pure ranking lives in lib/dispatch.ts; this file reads/writes the database.
import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { buildGraph, type Graph } from "./lib/graph";
import { countRerouted, planReroute, rankCandidates, type OpenAssignment } from "./lib/dispatch";

export { rankCandidates, type Candidate } from "./lib/dispatch";

const OPEN_ASSIGNMENT_STATUSES = ["offered", "accepted"] as const;
const MAX_ROWS = 500;

/** Every edge, with blocked ones left out of the graph. */
export async function loadGraph(ctx: MutationCtx): Promise<Graph> {
  return buildGraph(await ctx.db.query("edges").take(MAX_ROWS));
}

/** Offered + accepted assignments (the ones a staff member is carrying). */
export async function loadOpenAssignments(ctx: MutationCtx): Promise<Doc<"assignments">[]> {
  const lists = await Promise.all(
    OPEN_ASSIGNMENT_STATUSES.map((status) =>
      ctx.db
        .query("assignments")
        .withIndex("by_status", (q) => q.eq("status", status))
        .take(MAX_ROWS),
    ),
  );
  return lists.flat();
}

function countWorkloads(open: Doc<"assignments">[]): Map<Id<"staff">, number> {
  const workloads = new Map<Id<"staff">, number>();
  for (const a of open) workloads.set(a.staffId, (workloads.get(a.staffId) ?? 0) + 1);
  return workloads;
}

async function declinedFor(ctx: MutationCtx, incidentId: Id<"incidents">): Promise<Set<Id<"staff">>> {
  const rows = await ctx.db
    .query("assignments")
    .withIndex("by_incident", (q) => q.eq("incidentId", incidentId))
    .take(MAX_ROWS);
  return new Set(rows.filter((a) => a.status === "declined").map((a) => a.staffId));
}

/** busy while holding an accepted assignment, otherwise available. Off duty is left alone. */
export async function syncStaffStatus(ctx: MutationCtx, staffId: Id<"staff">): Promise<void> {
  const staff = await ctx.db.get("staff", staffId);
  if (!staff || staff.status === "off_duty") return;
  const accepted = await ctx.db
    .query("assignments")
    .withIndex("by_staff_status", (q) => q.eq("staffId", staffId).eq("status", "accepted"))
    .first();
  const status = accepted ? "busy" : "available";
  if (staff.status !== status) await ctx.db.patch("staff", staffId, { status });
}

/** Cancel every open assignment of an incident (escalation, cancel) and free the staff. */
export async function cancelOpenAssignments(ctx: MutationCtx, incidentId: Id<"incidents">): Promise<number> {
  const rows = await ctx.db
    .query("assignments")
    .withIndex("by_incident", (q) => q.eq("incidentId", incidentId))
    .take(MAX_ROWS);
  let cancelled = 0;
  for (const a of rows) {
    if (a.status !== "offered" && a.status !== "accepted") continue;
    await ctx.db.patch("assignments", a._id, { status: "cancelled", respondedAt: a.respondedAt ?? Date.now() });
    await syncStaffStatus(ctx, a.staffId);
    cancelled++;
  }
  return cancelled;
}

/**
 * Offer the incident to the best candidate. Escalates to a human when nobody
 * eligible is available or reachable. Returns the new assignment id, or null.
 */
export async function dispatchToBest(
  ctx: MutationCtx,
  incident: Doc<"incidents">,
  reason = "auto-dispatch",
): Promise<Id<"assignments"> | null> {
  const [staff, graph, open, declinedBy] = await Promise.all([
    ctx.db.query("staff").take(MAX_ROWS),
    loadGraph(ctx),
    loadOpenAssignments(ctx),
    declinedFor(ctx, incident._id),
  ]);
  const [best] = rankCandidates({ incident, staff, workloads: countWorkloads(open), declinedBy, graph });
  if (!best) {
    await ctx.db.patch("incidents", incident._id, {
      status: "escalated",
      assigneeId: undefined,
      escalationReason: "No eligible staff available or reachable",
    });
    return null;
  }
  const assignmentId = await ctx.db.insert("assignments", {
    incidentId: incident._id,
    staffId: best.staff._id,
    status: "offered",
    route: best.route,
    reason,
  });
  await ctx.db.patch("incidents", incident._id, { status: "assigned", assigneeId: best.staff._id });
  return assignmentId;
}

/**
 * After the graph changes (blockage applied/undone): re-rank every open
 * assignment, store recomputed routes, and reassign when someone else is now
 * strictly better. Returns how many tasks were rerouted (new route, assignee, or
 * escalated) and how many of those changed assignee.
 */
export async function rerouteAll(ctx: MutationCtx, reason: string): Promise<{ rerouted: number; reassigned: number }> {
  const [staff, graph, openRows] = await Promise.all([
    ctx.db.query("staff").take(MAX_ROWS),
    loadGraph(ctx),
    loadOpenAssignments(ctx),
  ]);
  const open: OpenAssignment[] = [];
  const declinedBy = new Map<Id<"incidents">, Set<Id<"staff">>>();
  // Oldest first, so earlier incidents get first pick of newly-closer staff.
  for (const assignment of [...openRows].sort((a, b) => a._creationTime - b._creationTime)) {
    const incident = await ctx.db.get("incidents", assignment.incidentId);
    if (!incident) continue;
    open.push({ assignment, incident });
    declinedBy.set(incident._id, await declinedFor(ctx, incident._id));
  }

  const decisions = planReroute({ open, staff, workloads: countWorkloads(openRows), declinedBy, graph });
  const now = Date.now();
  for (const d of decisions) {
    const old = open.find((o) => o.assignment._id === d.assignmentId)!.assignment;
    if (d.kind === "keep") {
      if (d.routeChanged) await ctx.db.patch("assignments", d.assignmentId, { route: d.route, reason: `route updated: ${reason}` });
    } else if (d.kind === "reassign") {
      await ctx.db.patch("assignments", d.assignmentId, { status: "superseded", respondedAt: old.respondedAt ?? now });
      await ctx.db.insert("assignments", {
        incidentId: d.incidentId,
        staffId: d.to.staff._id,
        status: "offered",
        route: d.to.route,
        reason: `reassigned: ${reason}`,
      });
      await ctx.db.patch("incidents", d.incidentId, { status: "assigned", assigneeId: d.to.staff._id });
      await syncStaffStatus(ctx, d.from);
    } else {
      await ctx.db.patch("assignments", d.assignmentId, { status: "cancelled", respondedAt: old.respondedAt ?? now });
      await ctx.db.patch("incidents", d.incidentId, {
        status: "escalated",
        assigneeId: undefined,
        escalationReason: `Unreachable after ${reason}`,
      });
      await syncStaffStatus(ctx, old.staffId);
    }
  }
  return countRerouted(decisions);
}

/** Offer the incident to the best candidate. Escalates when nobody is eligible. */
export const dispatchIncident = internalMutation({
  args: { incidentId: v.id("incidents"), reason: v.optional(v.string()) },
  returns: v.union(v.id("assignments"), v.null()),
  handler: async (ctx, { incidentId, reason }): Promise<Id<"assignments"> | null> => {
    const incident = await ctx.db.get("incidents", incidentId);
    if (!incident) throw new Error(`Incident not found: ${incidentId}`);
    return dispatchToBest(ctx, incident, reason);
  },
});

/** Recompute routes for every open assignment and reassign where someone is now closer. */
export const rerouteOpenAssignments = internalMutation({
  args: { reason: v.string() },
  returns: v.number(),
  handler: async (ctx, { reason }): Promise<number> => (await rerouteAll(ctx, reason)).reassigned,
});
