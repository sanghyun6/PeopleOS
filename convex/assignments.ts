// Staff phone actions. Each one updates the incident status the dashboard shows.
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { todo } from "./lib/todo";

/** Current offered/accepted assignments for a staff member, with incident + route. */
export const forStaff = query({
  args: { staffId: v.id("staff") },
  handler: async () => todo("assignments.forStaff"),
});

/** Active assignments with routes, for drawing route lines on the 3D view. */
export const listActive = query({
  args: {},
  handler: async () => todo("assignments.listActive"),
});

/** offered -> accepted; sets incident.acknowledgedAt (time-to-acknowledge metric). */
export const accept = mutation({
  args: { assignmentId: v.id("assignments") },
  returns: v.null(),
  handler: async () => todo("assignments.accept"),
});

/** offered -> declined; re-dispatches to the next candidate. */
export const decline = mutation({
  args: { assignmentId: v.id("assignments"), reason: v.optional(v.string()) },
  returns: v.null(),
  handler: async () => todo("assignments.decline"),
});

/** accepted -> completed; incident -> resolved (marker turns green). */
export const complete = mutation({
  args: { assignmentId: v.id("assignments") },
  returns: v.null(),
  handler: async () => todo("assignments.complete"),
});
