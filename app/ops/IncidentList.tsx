import type { Doc, Id } from "@/convex/_generated/dataModel";

type Props = {
  incidents: Doc<"incidents">[] | undefined;
  selectedId: Id<"incidents"> | null;
  onSelect: (id: Id<"incidents">) => void;
};

/** Active incidents, newest first, with status color + report count (step 7). */
export function IncidentList({ incidents }: Props) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Incidents</h2>
      <p className="text-sm text-neutral-500">
        {incidents === undefined ? "Loading…" : `${incidents.length} active`}
      </p>
    </section>
  );
}
