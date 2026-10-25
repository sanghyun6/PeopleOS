import type { Doc } from "@/convex/_generated/dataModel";
import { Avatar, STAFF_DOT_HEX } from "@/components/ui/badges";
import { label } from "@/components/ui/format";

type Props = {
  staff: Doc<"staff">[] | undefined;
  zones: Doc<"zones">[] | undefined;
  incidents?: Doc<"incidents">[];
};

/** Staff roster: role, status, current zone, workload (step 7). */
export function StaffPanel({ staff, zones, incidents }: Props) {
  const zoneName = new Map(zones?.map((z) => [z._id, z.name]));
  const workload = new Map<string, number>();
  for (const i of incidents ?? []) {
    if (i.assigneeId) workload.set(i.assigneeId, (workload.get(i.assigneeId) ?? 0) + 1);
  }
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium">Staff</h2>
      {staff === undefined && <p className="text-sm text-muted">Loading…</p>}
      <ul className="divide-y divide-line rounded-xl bg-surface ring-1 ring-inset ring-line">
        {staff?.map((s) => {
          const tasks = workload.get(s._id) ?? 0;
          const off = s.status === "off_duty";
          return (
            <li key={s._id} className={`flex items-center gap-3 px-3 py-2 ${off ? "opacity-50" : ""}`}>
              <span className="relative">
                <Avatar staff={s} size={28} />
                <span
                  className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-surface"
                  style={{ background: STAFF_DOT_HEX[s.status] }}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{s.name}</span>
                <span className="block truncate text-xs capitalize text-faint">{label(s.role)}</span>
              </span>
              <span className="min-w-0 max-w-[45%] text-right">
                <span className="block truncate text-xs text-muted">{off ? "Off duty" : (zoneName.get(s.zoneId) ?? "")}</span>
                {tasks > 0 && (
                  <span className="block text-[11px] font-medium text-amber tabular-nums">
                    {tasks} task{tasks === 1 ? "" : "s"}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
