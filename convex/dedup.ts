// Duplicate detection: same zone + same category within 15 minutes -> ask Claude
// whether it is the same problem -> bump reportCount instead of creating a task.
import { v } from "convex/values";
import { internalAction, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { incidentCategory } from "./lib/validators";
import { todo } from "./lib/todo";

export const DEDUP_WINDOW_MS = 15 * 60 * 1000;

/** Active incidents in the same zone + category reported within the window. */
export const findCandidates = internalQuery({
  args: { zoneId: v.id("zones"), category: incidentCategory, now: v.number() },
  handler: async () => todo("dedup.findCandidates"),
});

/** Claude judges "same problem?"; returns the matching incident or null. */
export const judgeSameProblem = internalAction({
  args: {
    description: v.string(),
    candidates: v.array(v.object({ incidentId: v.id("incidents"), description: v.string(), locationLabel: v.string() })),
  },
  returns: v.union(v.id("incidents"), v.null()),
  handler: async (): Promise<Id<"incidents"> | null> => todo("dedup.judgeSameProblem"),
});
