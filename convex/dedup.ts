// Duplicate detection: same zone + same category within 15 minutes -> ask Claude
// whether it is the same problem -> bump reportCount instead of creating a task.
import Anthropic from "@anthropic-ai/sdk";
import { v, type Infer } from "convex/values";
import { internalAction, internalQuery, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
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

const MODEL = "claude-opus-5-5";

const SYSTEM = `You deduplicate problem reports phoned in at a hackathon venue. A new report and earlier open reports from the same area and category are given. Decide whether the new report describes the same underlying problem as one of the earlier ones (same physical thing broken or needed, same spot), so staff should not be sent twice. Different tables or booths with independent problems are different problems; the same outage described in other words is the same problem.`;

/**
 * Claude judges "same problem?". Without ANTHROPIC_API_KEY, or if the call fails or
 * is refused, falls back to "same table/booth = same problem".
 */
export async function judgeDuplicate(description: string, candidates: DedupCandidate[]): Promise<Id<"incidents"> | null> {
  if (candidates.length === 0) return null;
  const fallback = () => candidates.find((c) => c.sameLocation)?.incidentId ?? null;
  if (!process.env.ANTHROPIC_API_KEY) return fallback();

  try {
    // Voice callers are waiting on this: fail fast and fall back.
    const client = new Anthropic({ timeout: 8_000, maxRetries: 0 });
    const list = candidates
      .map((c, i) => `${i + 1}. [${c.locationLabel}] ${c.description}`)
      .join("\n");
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 1024,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              same_as: { type: "integer", description: "Number of the matching earlier report, or 0 if none match." },
            },
            required: ["same_as"],
            additionalProperties: false,
          },
        },
      },
      system: SYSTEM,
      messages: [{ role: "user", content: `New report: ${description}\n\nEarlier open reports:\n${list}` }],
    });
    if (response.stop_reason === "refusal") return fallback();
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return fallback();
    const { same_as } = JSON.parse(text.text) as { same_as: number };
    return candidates[same_as - 1]?.incidentId ?? null;
  } catch (error) {
    console.error("[dedup] Claude judgment failed, using same-location fallback", error);
    return fallback();
  }
}

/** Claude judges "same problem?"; returns the matching incident or null. */
export const judgeSameProblem = internalAction({
  args: { description: v.string(), candidates: v.array(dedupCandidate) },
  returns: v.union(v.id("incidents"), v.null()),
  handler: async (_ctx, { description, candidates }): Promise<Id<"incidents"> | null> =>
    judgeDuplicate(description, candidates),
});
