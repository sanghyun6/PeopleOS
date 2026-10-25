import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

const STATS_WINDOW = 200;

/** Log one venue_search retrieval (called from the cartesia webhook). */
export const record = internalMutation({
  args: {
    outcome: v.union(v.literal("found"), v.literal("no_match"), v.literal("fallback")),
    latencyMs: v.number(),
    cold: v.optional(v.boolean()),
    callId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("retrievals", args);
    return null;
  },
});

/** Ops dashboard: average Moss retrieval latency over the last 200 calls (fallbacks excluded). */
export const stats = query({
  args: {},
  returns: v.object({
    count: v.number(),
    avgMs: v.union(v.number(), v.null()),
    avgWarmMs: v.union(v.number(), v.null()),
    fallbacks: v.number(),
  }),
  handler: async (ctx) => {
    const rows = await ctx.db.query("retrievals").order("desc").take(STATS_WINDOW);
    const moss = rows.filter((r) => r.outcome !== "fallback");
    const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
    return {
      count: moss.length,
      avgMs: avg(moss.map((r) => r.latencyMs)),
      avgWarmMs: avg(moss.filter((r) => !r.cold).map((r) => r.latencyMs)),
      fallbacks: rows.length - moss.length,
    };
  },
});
