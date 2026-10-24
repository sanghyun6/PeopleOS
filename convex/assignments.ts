// Staff phone actions. Each one updates the incident status the dashboard shows.
import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { dispatchToBest, syncStaffStatus } from "./dispatch";

const MAX_ROWS = 100;

async function loadAssignment(ctx: MutationCtx, assignmentId: Id<"assignments">, status: Doc<"assignments">["status"]) {
  const assignment = await ctx.db.get("assignments", assignmentId);
  if (!assignment) throw new Error("Assignment not found");
  if (assignment.status !== status) {
    throw new Error(`This assignment is ${assignment.status}, not ${status}`);
  }
  const incident = await ctx.db.get("incidents", assignment.incidentId);
  if (!incident) throw new Error("Incident not found");
  return { assignment, incident };
}

/** Current offered/accepted assignments for a staff member, as AssignmentView rows. */
export const forStaff = query({
  args: { staffId: v.id("staff") },
  handler: async (ctx, { staffId }) => {
    const rows = (
      await Promise.all(
        (["offered", "accepted"] as const).map((status) =>
          ctx.db
            .query("assignments")
            .withIndex("by_staff_status", (q) => q.eq("staffId", staffId).eq("status", status))
            .take(MAX_ROWS),
        ),
      )
    )
      .flat()
      .sort((a, b) => a._creationTime - b._creationTime);

    const views = [];
    for (const assignment of rows) {
      const incident = await ctx.db.get("incidents", assignment.incidentId);
      if (!incident) continue;
      const location = await ctx.db.get("locations", incident.locationId);
      const zones = await Promise.all(assignment.route.zoneIds.map((id) => ctx.db.get("zones", id)));
      views.push({
        assignment,
        incident,
        locationLabel: location?.label ?? "Unknown location",
        routeZoneNames: zones.map((z) => z?.name.split(" (")[0] ?? "?"),
      });
    }
    return views;
  },
});

/** Offered + accepted assignments with routes, for drawing route lines on the 3D view. */
export const listActive = query({
  args: {},
  handler: async (ctx) =>
    (
      await Promise.all(
        (["offered", "accepted"] as const).map((status) =>
          ctx.db
            .query("assignments")
            .withIndex("by_status", (q) => q.eq("status", status))
            .take(500),
        ),
      )
    ).flat(),
});

/** offered -> accepted; sets incident.acknowledgedAt (time-to-acknowledge metric). */
export const accept = mutation({
  args: { assignmentId: v.id("assignments") },
  returns: v.null(),
  handler: async (ctx, { assignmentId }) => {
    const { assignment, incident } = await loadAssignment(ctx, assignmentId, "offered");
    const now = Date.now();
    await ctx.db.patch("assignments", assignmentId, { status: "accepted", respondedAt: now });
    // Keep the first acknowledgement if the incident was reassigned after one.
    await ctx.db.patch("incidents", incident._id, {
      status: "acknowledged",
      acknowledgedAt: incident.acknowledgedAt ?? now,
    });
    await syncStaffStatus(ctx, assignment.staffId);
    return null;
  },
});

/** offered -> declined; re-dispatches to the next candidate (or escalates). */
export const decline = mutation({
  args: { assignmentId: v.id("assignments"), reason: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { assignmentId, reason }) => {
    const { incident } = await loadAssignment(ctx, assignmentId, "offered");
    await ctx.db.patch("assignments", assignmentId, {
      status: "declined",
      respondedAt: Date.now(),
      reason: reason ?? "declined",
    });
    await ctx.db.patch("incidents", incident._id, { status: "open", assigneeId: undefined });
    await dispatchToBest(ctx, { ...incident, status: "open", assigneeId: undefined }, "re-dispatched after decline");
    return null;
  },
});

/** accepted -> completed; incident -> resolved (marker turns green); staff is now at the incident zone. */
export const complete = mutation({
  args: { assignmentId: v.id("assignments") },
  returns: v.null(),
  handler: async (ctx, { assignmentId }) => {
    const { assignment, incident } = await loadAssignment(ctx, assignmentId, "accepted");
    const now = Date.now();
    await ctx.db.patch("assignments", assignmentId, { status: "completed", completedAt: now });
    await ctx.db.patch("incidents", incident._id, { status: "resolved", resolvedAt: now });
    await ctx.db.patch("staff", assignment.staffId, { zoneId: incident.zoneId });
    await syncStaffStatus(ctx, assignment.staffId);
    return null;
  },
});
