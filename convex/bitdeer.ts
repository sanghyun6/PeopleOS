// Bitdeer AI Model Studio glue: per-call log + ops stat, the withBitdeer() helper that
// gives actions a logged client, and the scheduled staff-brief action.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery, query, type ActionCtx } from "./_generated/server";
import { briefDeadline, buildStaffBrief, createBitdeerClient, type BitdeerCall, type BitdeerClient } from "./lib/bitdeer";

const STATS_WINDOW = 200;

export const bitdeerCall = v.object({
  kind: v.union(v.literal("embedding"), v.literal("judge"), v.literal("brief")),
  model: v.string(),
  latencyMs: v.number(),
  ok: v.boolean(),
});

export const recordCalls = internalMutation({
  args: { calls: v.array(bitdeerCall) },
  returns: v.null(),
  handler: async (ctx, { calls }) => {
    for (const call of calls) await ctx.db.insert("bitdeerCalls", call);
    return null;
  },
});

/** Ops dashboard: Bitdeer calls over the last 200 and their average latency (successful calls only). */
export const stats = query({
  args: {},
  returns: v.object({ count: v.number(), avgMs: v.union(v.number(), v.null()), failed: v.number() }),
  handler: async (ctx) => {
    const rows = await ctx.db.query("bitdeerCalls").order("desc").take(STATS_WINDOW);
    const ok = rows.filter((r) => r.ok);
    return {
      count: rows.length,
      avgMs: ok.length ? Math.round(ok.reduce((sum, r) => sum + r.latencyMs, 0) / ok.length) : null,
      failed: rows.length - ok.length,
    };
  },
});

/**
 * Run `work` with a Bitdeer client that shares one `deadline` and logs every call.
 * The client is null when BITDEER_API_KEY is not set. Logging never throws.
 */
export async function withBitdeer<T>(
  ctx: ActionCtx,
  deadline: number,
  work: (client: BitdeerClient | null) => Promise<T>,
): Promise<T> {
  const apiKey = process.env.BITDEER_API_KEY;
  if (!apiKey) return work(null);
  const calls: BitdeerCall[] = [];
  const client = createBitdeerClient({
    apiKey,
    chatModel: process.env.BITDEER_CHAT_MODEL,
    deadline,
    onCall: (call) => calls.push(call),
  });
  try {
    return await work(client);
  } finally {
    if (calls.length > 0) {
      try {
        await ctx.runMutation(internal.bitdeer.recordCalls, { calls });
      } catch (error) {
        console.error("[bitdeer] could not log calls", error);
      }
    }
  }
}

export const incidentForBrief = internalQuery({
  args: { incidentId: v.id("incidents") },
  returns: v.union(
    v.object({ locationLabel: v.string(), category: v.string(), description: v.string(), hasBrief: v.boolean() }),
    v.null(),
  ),
  handler: async (ctx, { incidentId }) => {
    const incident = await ctx.db.get("incidents", incidentId);
    if (!incident) return null;
    const location = await ctx.db.get("locations", incident.locationId);
    return {
      locationLabel: location?.label ?? "unknown location",
      category: incident.category,
      description: incident.description,
      hasBrief: incident.staffBrief !== undefined,
    };
  },
});

export const setBrief = internalMutation({
  args: { incidentId: v.id("incidents"), staffBrief: v.string() },
  returns: v.null(),
  handler: async (ctx, { incidentId, staffBrief }) => {
    if (await ctx.db.get("incidents", incidentId)) await ctx.db.patch("incidents", incidentId, { staffBrief });
    return null;
  },
});

/**
 * Scheduled right after an incident is created (never inside the phone call): turns the
 * caller's description into a one-line staff instruction. On any failure nothing is stored
 * and the UI keeps showing the original description.
 */
export const generateBrief = internalAction({
  args: { incidentId: v.id("incidents") },
  returns: v.null(),
  handler: async (ctx, { incidentId }) => {
    const incident = await ctx.runQuery(internal.bitdeer.incidentForBrief, { incidentId });
    if (!incident || incident.hasBrief) return null;
    const brief = await withBitdeer(ctx, briefDeadline(), (client) =>
      buildStaffBrief(client, {
        locationLabel: incident.locationLabel,
        category: incident.category,
        description: incident.description,
      }),
    );
    if (brief) await ctx.runMutation(internal.bitdeer.setBrief, { incidentId, staffBrief: brief });
    return null;
  },
});
