"use client";

import { useParams } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { label } from "@/components/ui/format";
import { useStaff, useStaffAssignments } from "@/components/ui/hooks";
import { AssignmentCard } from "./AssignmentCard";
import { useAssignmentAlert } from "./useAssignmentAlert";

export default function StaffPage() {
  const { id } = useParams<{ id: string }>();
  const staffId = id as Id<"staff">;
  const staff = useStaff(staffId);
  const { assignments, actions } = useStaffAssignments(staffId);

  const latestOffered = assignments?.filter((a) => a.assignment.status === "offered").at(-1);
  useAssignmentAlert(assignments === undefined ? undefined : (latestOffered?.assignment._id ?? null));

  if (staff === undefined) return <main className="p-6">Loading…</main>;
  if (staff === null) return <main className="p-6">Unknown staff member.</main>;

  // Offered first: that is what needs a response.
  const sorted = [...(assignments ?? [])].sort(
    (a, b) => Number(b.assignment.status === "offered") - Number(a.assignment.status === "offered"),
  );

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md bg-neutral-950 p-4 text-neutral-100">
      <header className="mb-5 flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-semibold">{staff.name}</h1>
          <p className="text-sm capitalize text-neutral-400">{label(staff.role)}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
            staff.status === "available" ? "bg-green-900 text-green-300" : "bg-neutral-800 text-neutral-300"
          }`}
        >
          {label(staff.status)}
        </span>
      </header>
      {assignments === undefined ? (
        <p className="text-neutral-500">Loading…</p>
      ) : sorted.length === 0 ? (
        <AssignmentCard assignment={null} />
      ) : (
        <div className="space-y-4">
          {sorted.map((a) => (
            <AssignmentCard key={a.assignment._id} assignment={a} actions={actions} />
          ))}
        </div>
      )}
    </main>
  );
}
