import type { Id } from "@/convex/_generated/dataModel";

/** Beep + navigator.vibrate when a new offered assignment id appears (step 6). */
export function useAssignmentAlert(_latestOfferedId: Id<"assignments"> | null): void {}
