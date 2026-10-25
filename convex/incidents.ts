import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type ActionCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { incidentCategory, incidentSource, priority, type IncidentStatus } from "./lib/validators";
import { detectEmergency } from "./lib/emergency";
import { resolveLocation } from "./locations";
import { dedupCandidate, findDedupCandidates, judgeDuplicate, type DedupCandidate } from "./dedup";
import { applyBlockage } from "./blockages";
import { cancelOpenAssignments, dispatchToBest } from "./dispatch";

const ACTIVE_STATUSES: IncidentStatus[] = ["open", "assigned", "acknowledged", "escalated", "pending_review"];
const MAX_ROWS = 500;
/** Resolved incidents stay on the map (green marker) this long before dropping off. */

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

/**
 * Live list for the ops dashboard and 3D markers: active incidents only. A resolved or
 * cancelled incident drops out of this list, so its marker disappears right away.
 */
export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const lists = await Promise.all(
      ACTIVE_STATUSES.map((status) =>
        ctx.db
          .query("incidents")
          .withIndex("by_status", (q) => q.eq("status", status))
          .take(MAX_ROWS),
      ),
    );
    return lists.flat().sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const get = query({
  args: { incidentId: v.id("incidents") },
  handler: async (ctx, { incidentId }) => ctx.db.get("incidents", incidentId),
});

/** Step 1 (read-only): resolve the location, apply the emergency rule, gather dedup candidates. */
export const prepareReport = internalQuery({
  args: { ...reportArgs, now: v.number() },
  returns: v.object({
    location: v.union(
      v.object({ locationId: v.id("locations"), label: v.string(), zoneId: v.id("zones") }),
      v.null(),
    ),
    emergency: v.array(v.string()), // matched keywords/categories; empty = not an emergency
    candidates: v.array(dedupCandidate),
  }),
  handler: async (ctx, args) => {
    const location = await resolveLocation(ctx, args.location);
    if (!location) return { location: null, emergency: [], candidates: [] };
    const { matched } = detectEmergency(args);
    // Never fold an emergency into an older report: every one reaches a human.
    const rows = matched.length
      ? []
      : await findDedupCandidates(ctx, { zoneId: location.zoneId, category: args.category, now: args.now });
    const candidates: DedupCandidate[] = [];
    for (const row of rows) {
      const loc = await ctx.db.get("locations", row.locationId);
      candidates.push({
        incidentId: row._id,
        description: row.description,
        locationLabel: loc?.label ?? "unknown",
        sameLocation: row.locationId === location._id,
      });
    }
    return {
      location: { locationId: location._id, label: location.label, zoneId: location.zoneId },
      emergency: matched,
      candidates,
    };
  },
});

/** Step 2a: the report repeats an open incident. */
export const recordDuplicate = internalMutation({
  args: { incidentId: v.id("incidents"), transcript: v.optional(v.string()) },
  returns: reportOutcome,
  handler: async (ctx, { incidentId, transcript }): Promise<ReportOutcome> => {
    const incident = await ctx.db.get("incidents", incidentId);
    if (!incident) throw new Error(`Incident not found: ${incidentId}`);
    const reportCount = incident.reportCount + 1;
    await ctx.db.patch("incidents", incidentId, {
      reportCount,
      lastReportedAt: Date.now(),
      transcript: transcript ? [incident.transcript, transcript].filter(Boolean).join("\n---\n") : incident.transcript,
    });
    const location = await ctx.db.get("locations", incident.locationId);
    return {
      incidentId,
      outcome: "duplicate",
      message: `That problem at ${location?.label ?? "that location"} was already reported and is being handled. This report was added to it (${reportCount} reports so far).`,
    };
  },
});

/**
 * Step 2b: a new incident. Blockages apply immediately (edges closed, tasks rerouted);
 * emergencies go straight to a human (escalated); everything else is auto-dispatched.
 */
export const insertReport = internalMutation({
  args: { ...reportArgs, locationId: v.id("locations"), emergency: v.array(v.string()) },
  returns: reportOutcome,
  handler: async (ctx, args): Promise<ReportOutcome> => {
    const location = await ctx.db.get("locations", args.locationId);
    if (!location) throw new Error(`Location not found: ${args.locationId}`);
    const isEmergency = args.emergency.length > 0;
    const status: IncidentStatus = isEmergency ? "escalated" : "open"; // blockages stay open until applied below
    const now = Date.now();
    const incidentId = await ctx.db.insert("incidents", {
      category: args.category,
      description: args.description,
      priority: isEmergency ? "critical" : args.priority,
      status,
      source: args.source,
      locationId: location._id,
      zoneId: location.zoneId,
      level: location.level,
      at: location.at,
      reportCount: 1,
      transcript: args.transcript,
      callId: args.callId,
      escalationReason: isEmergency ? `Emergency rule: ${args.emergency.join(", ")}` : undefined,
      lastReportedAt: now,
    });
    // One-line staff instruction from Bitdeer, generated after the call (never inline).
    await ctx.scheduler.runAfter(0, internal.bitdeer.generateBrief, { incidentId });

    if (status === "escalated") {
      return {
        incidentId,
        outcome: "escalated",
        message: "A human operator has been alerted. Help is coming; if anyone's life is in danger, call 911 now.",
      };
    }
    const incident = (await ctx.db.get("incidents", incidentId))!;
    if (args.category === "blockage") {
      const { rerouted } = await applyBlockage(ctx, incident);
      return {
        incidentId,
        outcome: "created",
        message: `Blockage at ${location.label} is logged and applied. ${
          rerouted ? `${rerouted} task${rerouted === 1 ? " is" : "s are"} being routed around it now.` : "Staff are being routed around it now."
        }`,
      };
    }

    const assignmentId = await dispatchToBest(ctx, incident);
    if (!assignmentId) {
      return {
        incidentId,
        outcome: "escalated",
        message: `Logged at ${location.label}. No staff member is free right now, so an operator has been alerted.`,
      };
    }
    const staff = await ctx.db.get("staff", (await ctx.db.get("assignments", assignmentId))!.staffId);
    return {
      incidentId,
      outcome: "created",
      message: `Logged at ${location.label}. ${staff?.name ?? "A staff member"} has been notified and is being sent there.`,
    };
  },
});

type ReportInput = {
  location: string;
  category: Doc<"incidents">["category"];
  description: string;
  priority: Doc<"incidents">["priority"];
  source: Doc<"incidents">["source"];
  transcript?: string;
  callId?: string;
};

/** The report pipeline. An action, because the dedup judgment calls Bitdeer. */
async function runReport(ctx: ActionCtx, args: ReportInput): Promise<ReportOutcome> {
  const prep = await ctx.runQuery(internal.incidents.prepareReport, { ...args, now: Date.now() });
  if (!prep.location) {
    return {
      incidentId: null,
      outcome: "unknown_location",
      message: `"${args.location}" did not match a venue location. Ask for the nearest table number or booth name.`,
    };
  }
  const duplicateOf = await judgeDuplicate(ctx, { description: args.description, locationLabel: prep.location.label }, prep.candidates);
  if (duplicateOf) {
    return await ctx.runMutation(internal.incidents.recordDuplicate, { incidentId: duplicateOf, transcript: args.transcript });
  }
  return await ctx.runMutation(internal.incidents.insertReport, {
    ...args,
    locationId: prep.location.locationId,
    emergency: prep.emergency,
  });
}

/**
 * Single entry point for new reports:
 * resolve location -> emergency rule -> dedup (same zone + category, last 15 min,
 * Bitdeer judges) -> insert incident -> dispatch.
 */
export const createFromReport = internalAction({
  args: reportArgs,
  returns: reportOutcome,
  handler: async (ctx, args): Promise<ReportOutcome> => runReport(ctx, args),
});

/** Web/SMS fallback when the phone line is down (same pipeline as voice). */
export const reportFromWeb = action({
  args: reportArgs,
  returns: reportOutcome,
  handler: async (ctx, args): Promise<ReportOutcome> => runReport(ctx, args),
});

/** Hand an incident to a human operator; never auto-dispatched afterwards. */
export const escalate = internalMutation({
  args: { incidentId: v.id("incidents"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, { incidentId, reason }) => {
    await cancelOpenAssignments(ctx, incidentId);
    await ctx.db.patch("incidents", incidentId, { status: "escalated", assigneeId: undefined, escalationReason: reason });
    return null;
  },
});

/** Operator closes an incident without staff (false alarm, duplicate missed by dedup). */
export const cancel = mutation({
  args: { incidentId: v.id("incidents") },
  returns: v.null(),
  handler: async (ctx, { incidentId }) => {
    await cancelOpenAssignments(ctx, incidentId);
    await ctx.db.patch("incidents", incidentId, { status: "cancelled", assigneeId: undefined });
    return null;
  },
});

const average = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);

/**
 * Dashboard numbers: open count, avg time-to-acknowledge, avg time-to-resolve.
 * Blockages are excluded from the averages: no staff is sent.
 */
export const stats = query({
  args: {},
  returns: v.object({
    open: v.number(),
    resolved: v.number(),
    avgAckMs: v.union(v.number(), v.null()),
    avgResolveMs: v.union(v.number(), v.null()),
  }),
  handler: async (ctx) => {
    const byStatus = (status: IncidentStatus) =>
      ctx.db
        .query("incidents")
        .withIndex("by_status", (q) => q.eq("status", status))
        .take(MAX_ROWS);
    const active = (await Promise.all(ACTIVE_STATUSES.map(byStatus))).flat();
    const resolved = await byStatus("resolved");
    const dispatched = [...active, ...resolved].filter((i) => i.category !== "blockage");
    return {
      open: active.length,
      resolved: resolved.length,
      avgAckMs: average(dispatched.flatMap((i) => (i.acknowledgedAt ? [i.acknowledgedAt - i._creationTime] : []))),
      avgResolveMs: average(
        resolved.filter((i) => i.category !== "blockage" && i.resolvedAt).map((i) => i.resolvedAt! - i._creationTime),
      ),
    };
  },
});
