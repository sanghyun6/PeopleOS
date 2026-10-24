import type { Id } from "@/convex/_generated/dataModel";

/** Transcript, status, assignee, route; blockage confirm button for pending_review (steps 5/8). */
export function IncidentDetail({ incidentId }: { incidentId: Id<"incidents"> | null }) {
  if (!incidentId) return null;
  return null;
}
