import type { Doc } from "@/convex/_generated/dataModel";

type Props = {
  staff: Doc<"staff">[] | undefined;
  zones: Doc<"zones">[] | undefined;
};

/** Staff roster: role, status, current zone, workload (step 7). */
export function StaffPanel({ staff, zones }: Props) {
  const zoneName = new Map(zones?.map((z) => [z._id, z.name]));
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Staff</h2>
      <ul className="space-y-1 text-sm">
        {staff?.map((s) => (
          <li key={s._id} className="flex justify-between gap-2">
            <span>
              {s.name} <span className="text-neutral-500">· {s.role}</span>
            </span>
            <span className="truncate text-neutral-500">
              {s.status === "available" ? zoneName.get(s.zoneId) : s.status}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
