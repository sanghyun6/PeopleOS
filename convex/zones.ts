import { query } from "./_generated/server";

/** Zones + edges for the 3D view and routing (small: ~20 zones, ~30 edges). */
export const graph = query({
  args: {},
  handler: async (ctx) => {
    const zones = await ctx.db.query("zones").collect();
    const edges = await ctx.db.query("edges").collect();
    return { zones, edges };
  },
});
