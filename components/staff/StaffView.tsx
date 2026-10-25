"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { Avatar, RoleChip, StaffStatusPill } from "@/components/ui/badges";
import { CheckIcon } from "@/components/ui/icons";
import { displayBrief } from "@/convex/lib/bitdeer";
import { SwitchUser } from "@/components/ui/SwitchUser";
import { EXPIRED_PATH, clearIdentity } from "@/components/ui/identity";
import { useStaff, useStaffAssignments } from "@/components/ui/hooks";
import { AssignmentCard } from "./AssignmentCard";
import { useAssignmentAlert } from "./useAssignmentAlert";

/** One staff member's phone screen. `embedded` fills its parent (phone frames) instead of the page. */
export function StaffView({ staffId, embedded = false }: { staffId: Id<"staff">; embedded?: boolean }) {
  const router = useRouter();
  const staff = useStaff(staffId);
  const { assignments, actions } = useStaffAssignments(staffId);
  const [completed, setCompleted] = useState<string | null>(null);

  // Same actions, plus a short confirmation once a task is marked complete (the card itself disappears).
  const shownActions = useMemo(
    () => ({
      ...actions,
      complete: async (id: Id<"assignments">) => {
        const brief = assignments?.find((a) => a.assignment._id === id);
        await actions.complete(id);
        setCompleted(brief ? displayBrief(brief.incident) : "Task");
      },
    }),
    [actions, assignments],
  );
  useEffect(() => {
    if (!completed) return;
    const t = setTimeout(() => setCompleted(null), 5000);
    return () => clearTimeout(t);
  }, [completed]);

  const latestOffered = assignments?.filter((a) => a.assignment.status === "offered").at(-1);
  useAssignmentAlert(assignments === undefined ? undefined : (latestOffered?.assignment._id ?? null));

  // The id no longer exists (e.g. after a reseed): forget it and let them pick again.
  const missing = staff === null;
  useEffect(() => {
    if (!missing || embedded) return;
    clearIdentity();
    router.replace(EXPIRED_PATH);
  }, [missing, embedded, router]);

  if (staff === undefined) return <main className="p-6 text-muted">Loading…</main>;
  if (staff === null) return <main className="p-6 text-muted">Unknown staff member.</main>;

  // Offered first: that is what needs a response.
  const sorted = [...(assignments ?? [])].sort(
    (a, b) => Number(b.assignment.status === "offered") - Number(a.assignment.status === "offered"),
  );

  return (
    <main
      className={`mx-auto w-full max-w-md bg-ink px-4 pb-8 text-fg ${embedded ? "h-full overflow-y-auto pt-4" : "min-h-dvh pt-6"}`}
    >
      <header className="mb-6 flex items-center gap-3">
        <Avatar staff={staff} size={44} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold leading-tight">{staff.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <RoleChip role={staff.role} />
            {!embedded && <SwitchUser />}
          </div>
        </div>
        <StaffStatusPill status={staff.status} />
      </header>
      {completed && (
        <p
          role="status"
          className="mb-4 flex items-center gap-3 rounded-xl bg-green/10 px-4 py-3 text-sm ring-1 ring-inset ring-green/30"
        >
          <CheckIcon size={18} className="shrink-0 text-green" />
          <span className="min-w-0">
            <span className="block font-medium text-green">Marked complete</span>
            <span className="block truncate text-muted">{completed}</span>
          </span>
        </p>
      )}
      {assignments === undefined ? (
        <p className="text-muted">Loading…</p>
      ) : sorted.length === 0 ? (
        <AssignmentCard assignment={null} />
      ) : (
        <div className="space-y-4">
          {sorted.map((a) => (
            <AssignmentCard key={a.assignment._id} assignment={a} actions={shownActions} />
          ))}
        </div>
      )}
    </main>
  );
}
