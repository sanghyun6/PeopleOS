import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Avatar, CategoryTag, CategoryTile, PriorityBadge, StatusPill } from "@/components/ui/badges";
import { timeAgo } from "@/components/ui/format";
import { displayBrief } from "@/convex/lib/bitdeer";

type Props = {
  incidents: Doc<"incidents">[] | undefined;
  selectedId: Id<"incidents"> | null;
  onSelect: (id: Id<"incidents">) => void;
  zones?: Doc<"zones">[];
  staff?: Doc<"staff">[];
};

/** Active incidents, newest first, with status color + report count (step 7). */
export function IncidentList({ incidents, selectedId, onSelect, zones, staff }: Props) {
  const zoneName = new Map(zones?.map((z) => [z._id, z.name]));
  const staffById = new Map(staff?.map((s) => [s._id, s]));
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-medium">
        Incidents
        {incidents && (
          <span className="rounded-full bg-raised px-2 text-xs font-medium tabular-nums text-muted">{incidents.length}</span>
        )}
      </h2>
      {incidents === undefined && <p className="text-sm text-muted">Loading…</p>}
      {incidents?.length === 0 && (
        <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">
          All clear. New calls show up here.
        </p>
      )}
      <ul className="space-y-2">
        {incidents?.map((i) => {
          const assignee = i.assigneeId ? staffById.get(i.assigneeId) : undefined;
          const selected = i._id === selectedId;
          return (
            <li key={i._id}>
              <button
                onClick={() => onSelect(i._id)}
                aria-pressed={selected}
                className={`flex w-full gap-3 rounded-xl p-3 text-left ring-1 ring-inset transition ${
                  selected ? "bg-raised ring-accent/60" : "bg-surface ring-line hover:bg-raised hover:ring-line-strong"
                }`}
              >
                <CategoryTile category={i.category} status={i.status} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{displayBrief(i)}</span>
                    <PriorityBadge priority={i.priority} />
                  </span>
                  <span className="mt-1 flex items-center gap-2 text-xs text-muted">
                    <StatusPill status={i.status} />
                    <CategoryTag category={i.category} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-faint" suppressHydrationWarning>
                      {zoneName.get(i.zoneId) ?? ""}, {timeAgo(i._creationTime)}
                    </span>
                    {i.reportCount > 1 && (
                      <span
                        title={`${i.reportCount} callers reported this`}
                        className="shrink-0 rounded-md bg-raised px-1.5 font-medium tabular-nums text-fg ring-1 ring-inset ring-line-strong"
                      >
                        ×{i.reportCount}
                      </span>
                    )}
                    {assignee && <Avatar staff={assignee} size={20} />}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
