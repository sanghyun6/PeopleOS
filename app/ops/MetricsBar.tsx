/** Top bar: open incidents, avg time-to-acknowledge (incidents.stats, step 7). */
export function MetricsBar({ zoneCount, edgeCount }: { zoneCount?: number; edgeCount?: number }) {
  return (
    <header className="flex items-center gap-6 border-b border-neutral-800 px-4 py-2 text-sm">
      <span className="font-semibold">PeopleOS · Ops</span>
      <span className="text-neutral-400">
        {zoneCount ?? "…"} zones · {edgeCount ?? "…"} edges
      </span>
      <span className="text-neutral-500">avg time-to-acknowledge: —</span>
    </header>
  );
}
