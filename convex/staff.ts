import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { staffStatus } from "./lib/validators";
import { todo } from "./lib/todo";

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
  handler: async () => todo("staff.setStatus"),
});

/** Update a staff member's zone (e.g. after completing a task at the incident location). */
export const moveTo = mutation({
  args: { staffId: v.id("staff"), zoneId: v.id("zones") },
  returns: v.null(),
  handler: async () => todo("staff.moveTo"),
});
