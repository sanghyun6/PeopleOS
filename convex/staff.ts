import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { staffStatus } from "./lib/validators";
import { syncStaffStatus } from "./dispatch";

export const list = query({
  args: {},
  handler: async (ctx) => ctx.db.query("staff").collect(),
});

export const get = query({
  args: { staffId: v.id("staff") },
  handler: async (ctx, { staffId }) => ctx.db.get("staff", staffId),
});

/** Staff toggles available / off duty from their phone. */
export const setStatus = mutation({
  args: { staffId: v.id("staff"), status: staffStatus },
  returns: v.null(),
  handler: async (ctx, { staffId, status }) => {
    await ctx.db.patch("staff", staffId, { status });
    // "available" while holding an accepted task is really "busy".
    if (status === "available") await syncStaffStatus(ctx, staffId);
    return null;
  },
});

/** Update a staff member's zone (e.g. after completing a task at the incident location). */
export const moveTo = mutation({
  args: { staffId: v.id("staff"), zoneId: v.id("zones") },
  returns: v.null(),
  handler: async (ctx, { staffId, zoneId }) => {
    await ctx.db.patch("staff", staffId, { zoneId });
    return null;
  },
});
