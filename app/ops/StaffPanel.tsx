import type { Doc } from "@/convex/_generated/dataModel";
import { label } from "@/components/ui/format";

type Props = {
  staff: Doc<"staff">[] | undefined;
  zones: Doc<"zones">[] | undefined;
  incidents?: Doc<"incidents">[];
};

const STATUS_DOT = { available: "bg-green-500", busy: "bg-yellow-500", off_duty: "bg-neutral-600" } as const;

/** Staff roster: role, status, current zone, workload (step 7). */
export function StaffPanel({ staff, zones, incidents }: Props) {
  const zoneName = new Map(zones?.map((z) => [z._id, z.name]));
  const workload = new Map<string, number>();
  for (const i of incidents ?? []) {
    if (i.assigneeId) workload.set(i.assigneeId, (workload.get(i.assigneeId) ?? 0) + 1);
  }
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Staff</h2>
      {staff === undefined && <p className="text-sm text-neutral-500">Loading…</p>}
      <ul className="space-y-1.5 text-sm">
        {staff?.map((s) => (
          <li key={s._id} className="flex items-center gap-2">
            <span className={`size-2 shrink-0 rounded-full ${STATUS_DOT[s.status]}`} />
            <span className="flex-1 truncate">
              {s.name} <span className="text-neutral-500">· {label(s.role)}</span>
            </span>
            <span className="truncate text-xs text-neutral-500">
              {s.status === "off_duty" ? "off duty" : (zoneName.get(s.zoneId) ?? "")}
              {(workload.get(s._id) ?? 0) > 0 && ` · ${workload.get(s._id)} task${workload.get(s._id) === 1 ? "" : "s"}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
