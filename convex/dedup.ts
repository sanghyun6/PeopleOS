// Duplicate detection: same zone + same category within 15 minutes -> Bitdeer judges
// whether it is the same problem -> bump reportCount instead of creating a task.
import { v, type Infer } from "convex/values";
import { internalAction, internalQuery, type ActionCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { withBitdeer } from "./bitdeer";
import {
  DEDUP_TOTAL_MS,
  dedupDeadline,
  judgeDuplicateWithBitdeer,
  sameLocationDuplicate,
  withTotalTimeout,
} from "./lib/bitdeer";
import { filterDedupCandidates } from "./lib/dedup";
import { incidentCategory, type IncidentCategory } from "./lib/validators";

export { DEDUP_WINDOW_MS } from "./lib/dedup";

export const dedupCandidate = v.object({
  incidentId: v.id("incidents"),
  description: v.string(),
  locationLabel: v.string(),
  sameLocation: v.boolean(), // same table/booth as the new report
});
export type DedupCandidate = Infer<typeof dedupCandidate>;

/** Active incidents in the same zone + category reported within the window, newest first. */
export async function findDedupCandidates(
  ctx: QueryCtx,
  report: { zoneId: Id<"zones">; category: IncidentCategory; now: number },
): Promise<Doc<"incidents">[]> {
  const rows = await ctx.db
    .query("incidents")
    .withIndex("by_zone_category", (q) => q.eq("zoneId", report.zoneId).eq("category", report.category))
    .order("desc")
    .take(50);
  return filterDedupCandidates(rows, report).slice(0, 5);
}

export const findCandidates = internalQuery({
  args: { zoneId: v.id("zones"), category: incidentCategory, now: v.number() },
  handler: async (ctx, args) => findDedupCandidates(ctx, args),
});

/**
 * "Same problem?" Bitdeer ranks the candidates (bge-m3) and a chat model rules on the top
 * one. The whole judgment, Bitdeer included, is capped at DEDUP_TOTAL_MS (voice callers are
 * waiting). No BITDEER_API_KEY, a Bitdeer failure, or a timeout all fall back to the simple
 * "same zone and same table/booth" heuristic; there is no second model call.
 */
export async function judgeDuplicate(
  ctx: ActionCtx,
  report: { description: string; locationLabel?: string },
  candidates: DedupCandidate[],
): Promise<Id<"incidents"> | null> {
  const heuristic = () => sameLocationDuplicate(candidates.map((c) => ({ id: c.incidentId, sameLocation: c.sameLocation })));
  const judged = withBitdeer(ctx, dedupDeadline(), (client) =>
    judgeDuplicateWithBitdeer(
      client,
      { text: report.description, locationLabel: report.locationLabel },
      candidates.map((c) => ({ id: c.incidentId, text: c.description, locationLabel: c.locationLabel })),
      async () => heuristic(),
    ),
  ).catch(() => heuristic());
  return withTotalTimeout(judged, DEDUP_TOTAL_MS, heuristic);
}

/** "Same problem?"; returns the matching incident or null. */
export const judgeSameProblem = internalAction({
  args: { description: v.string(), locationLabel: v.optional(v.string()), candidates: v.array(dedupCandidate) },
  returns: v.union(v.id("incidents"), v.null()),
  handler: async (ctx, { description, locationLabel, candidates }): Promise<Id<"incidents"> | null> =>
    judgeDuplicate(ctx, { description, locationLabel }, candidates),
});
