import type { Doc } from "@/convex/_generated/dataModel";

export type AssignmentView = {
  assignment: Doc<"assignments">;
  incident: Doc<"incidents">;
  locationLabel: string;
  routeZoneNames: string[];
};

/** Accept / Decline (offered) and Complete (accepted) buttons (step 6). */
export function AssignmentCard({ assignment }: { assignment: AssignmentView | null }) {
  if (!assignment) {
    return <p className="rounded-lg border border-dashed p-6 text-center text-neutral-500">No assignments.</p>;
  }
  return null;
}
