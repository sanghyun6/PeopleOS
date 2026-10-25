// Duplicate-candidate filter: same zone + same category + reported within 15 minutes.
// Bitdeer then judges "same problem?" among these (convex/dedup.ts).
import type { Doc, Id } from "../_generated/dataModel";
import type { IncidentCategory, IncidentStatus } from "./validators";

export const DEDUP_WINDOW_MS = 15 * 60 * 1000;

/** Incidents still being worked on. Resolved/cancelled ones never absorb new reports. */
export const DEDUP_ACTIVE_STATUSES: ReadonlySet<IncidentStatus> = new Set<IncidentStatus>([
  "open",
  "assigned",
  "acknowledged",
  "escalated",
  "pending_review",
]);

/**
 * Candidates a new report may duplicate, most recently reported first. The window is
 * measured from `lastReportedAt`, so an incident that keeps getting reports stays open
 * to dedup.
 */
export function filterDedupCandidates(
  incidents: Doc<"incidents">[],
  report: { zoneId: Id<"zones">; category: IncidentCategory; now: number },
): Doc<"incidents">[] {
  return incidents
    .filter(
      (i) =>
        i.zoneId === report.zoneId &&
        i.category === report.category &&
        DEDUP_ACTIVE_STATUSES.has(i.status) &&
        report.now - i.lastReportedAt <= DEDUP_WINDOW_MS &&
        i.lastReportedAt <= report.now,
    )
    .sort((a, b) => b.lastReportedAt - a.lastReportedAt);
}
