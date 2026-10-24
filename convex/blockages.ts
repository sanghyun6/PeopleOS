// Blockage-aware rerouting: a reported blockage only changes the graph after an
// operator confirms it. Then routes are recomputed and staff may be reassigned.
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { todo } from "./lib/todo";

/** Operator confirms a pending_review blockage report and picks the edges to close. */
export const confirm = mutation({
  args: { incidentId: v.id("incidents"), edgeIds: v.array(v.id("edges")) },
  returns: v.object({ blockedEdges: v.number(), reassigned: v.number() }),
  handler: async () => todo("blockages.confirm"),
});

/** Reopen edges once the hallway is clear. */
export const clear = mutation({
  args: { incidentId: v.id("incidents") },
  returns: v.object({ reopenedEdges: v.number(), reassigned: v.number() }),
  handler: async () => todo("blockages.clear"),
});
