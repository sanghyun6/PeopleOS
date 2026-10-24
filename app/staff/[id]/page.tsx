"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AssignmentCard } from "./AssignmentCard";
import { useAssignmentAlert } from "./useAssignmentAlert";

export default function StaffPage() {
  const { id } = useParams<{ id: string }>();
  const staffId = id as Id<"staff">;
  const staff = useQuery(api.staff.get, { staffId });
  useAssignmentAlert(null);

  if (staff === undefined) return <main className="p-6">Loading…</main>;
  if (staff === null) return <main className="p-6">Unknown staff member.</main>;

  return (
    <main className="mx-auto w-full max-w-md p-6">
      <h1 className="text-xl font-semibold">{staff.name}</h1>
      <p className="mb-6 text-neutral-500">
        {staff.role} · {staff.status}
      </p>
      {/* step 6: api.assignments.forStaff -> one card per offered/accepted assignment */}
      <AssignmentCard assignment={null} />
    </main>
  );
}
