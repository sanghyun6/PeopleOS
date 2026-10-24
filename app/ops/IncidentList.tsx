import type { Doc, Id } from "@/convex/_generated/dataModel";
import { PriorityBadge, StatusPill } from "@/components/ui/badges";
import { label, timeAgo } from "@/components/ui/format";

type Props = {
  incidents: Doc<"incidents">[] | undefined;
  selectedId: Id<"incidents"> | null;
  onSelect: (id: Id<"incidents">) => void;
  zones?: Doc<"zones">[];
};

/** Active incidents, newest first, with status color + report count (step 7). */
export function IncidentList({ incidents, selectedId, onSelect, zones }: Props) {
  const zoneName = new Map(zones?.map((z) => [z._id, z.name]));
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        Incidents{incidents ? ` · ${incidents.length} active` : ""}
      </h2>
      {incidents === undefined && <p className="text-sm text-neutral-500">Loading…</p>}
      {incidents?.length === 0 && <p className="text-sm text-neutral-500">All clear.</p>}
      <ul className="space-y-1.5">
        {incidents?.map((i) => (
          <li key={i._id}>
            <button
              onClick={() => onSelect(i._id)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                i._id === selectedId ? "border-neutral-500 bg-neutral-800" : "border-neutral-800 bg-neutral-900 hover:bg-neutral-800/60"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium capitalize">{label(i.category)}</span>
                <span className="flex items-center gap-1.5">
                  {i.reportCount > 1 && (
                    <span className="rounded bg-neutral-700 px-1.5 text-xs font-semibold">×{i.reportCount}</span>
                  )}
                  <PriorityBadge priority={i.priority} />
                </span>
              </div>
              <p className="truncate text-neutral-400">{i.description}</p>
              <div className="mt-1 flex items-center justify-between text-xs text-neutral-500">
                <StatusPill status={i.status} />
                <span suppressHydrationWarning>
                  {zoneName.get(i.zoneId) ?? ""} · {timeAgo(i._creationTime)}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
