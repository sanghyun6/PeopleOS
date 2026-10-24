import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { incidentCategory, incidentSource, priority, type IncidentStatus } from "./lib/validators";
import { todo } from "./lib/todo";

const ACTIVE_STATUSES: IncidentStatus[] = ["open", "assigned", "acknowledged", "escalated", "pending_review"];

/** Everything a report needs, whatever the channel (voice tool call, SMS, web form). */
export const reportArgs = {
  location: v.string(), // caller's words or a location key; resolved via locations.resolve
  category: incidentCategory,
  description: v.string(),
  priority,
  source: incidentSource,
  transcript: v.optional(v.string()),
  callId: v.optional(v.string()),
};

export type ReportOutcome = {
  incidentId: Id<"incidents"> | null;
  outcome: "created" | "duplicate" | "escalated" | "unknown_location";
  message: string; // spoken back to the caller by the agent
};

const reportOutcome = v.object({
  incidentId: v.union(v.id("incidents"), v.null()),
  outcome: v.union(
    v.literal("created"),
    v.literal("duplicate"),
    v.literal("escalated"),
    v.literal("unknown_location"),
  ),
  message: v.string(),
});

/** Live list for the ops dashboard and 3D markers. */
export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const lists = await Promise.all(
      ACTIVE_STATUSES.map((status) =>
        ctx.db
          .query("incidents")
          .withIndex("by_status", (q) => q.eq("status", status))
          .collect(),
      ),
    );
    return lists.flat().sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const get = query({
  args: { incidentId: v.id("incidents") },
  handler: async (ctx, { incidentId }) => ctx.db.get("incidents", incidentId),
});

/**
 * Single entry point for new reports:
 * resolve location -> emergency rule -> dedup (same zone + category, last 15 min)
 * -> insert incident -> schedule dispatch.
 */
export const createFromReport = internalMutation({
  args: reportArgs,
  returns: reportOutcome,
  handler: async (): Promise<ReportOutcome> => todo("incidents.createFromReport"),
});

/** Web/SMS fallback when the phone line is down (same pipeline as voice). */
export const reportFromWeb = mutation({
  args: reportArgs,
  returns: reportOutcome,
  handler: async (): Promise<ReportOutcome> => todo("incidents.reportFromWeb"),
});

/** Hand an incident to a human operator; never auto-dispatched afterwards. */
export const escalate = internalMutation({
  args: { incidentId: v.id("incidents"), reason: v.string() },
  returns: v.null(),
  handler: async () => todo("incidents.escalate"),
});

/** Operator closes an incident without staff (false alarm, duplicate missed by dedup). */
export const cancel = mutation({
  args: { incidentId: v.id("incidents") },
  returns: v.null(),
  handler: async () => todo("incidents.cancel"),
});

/** Dashboard numbers: open count, avg time-to-acknowledge, avg time-to-resolve. */
export const stats = query({
  args: {},
  returns: v.object({
    open: v.number(),
    resolved: v.number(),
    avgAckMs: v.union(v.number(), v.null()),
    avgResolveMs: v.union(v.number(), v.null()),
  }),
  handler: async () => todo("incidents.stats"),
});
