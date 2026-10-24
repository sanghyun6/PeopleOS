"use client";

import { formatDuration } from "@/components/ui/format";
import { useStats } from "@/components/ui/hooks";

function Card({ title, value, accent }: { title: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-28 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">{title}</div>
      <div className={`text-lg font-semibold tabular-nums ${accent ? "text-yellow-400" : ""}`}>{value}</div>
    </div>
  );
}

/** Top bar: open incidents, avg time-to-acknowledge (incidents.stats, step 7). */
export function MetricsBar({ zoneCount, edgeCount }: { zoneCount?: number; edgeCount?: number }) {
  const stats = useStats();
  return (
    <header className="flex flex-wrap items-center gap-4 border-b border-neutral-800 px-4 py-2 text-sm">
      <div>
        <div className="font-semibold">PeopleOS · Ops</div>
        <div className="text-xs text-neutral-500">
          {zoneCount ?? "…"} zones · {edgeCount ?? "…"} edges
        </div>
      </div>
      <div className="ml-auto flex gap-2">
        <Card title="Open" value={stats ? String(stats.open) : "…"} />
        <Card title="Resolved" value={stats ? String(stats.resolved) : "…"} />
        <Card title="Avg time-to-ack" value={stats ? formatDuration(stats.avgAckMs) : "…"} accent />
        <Card title="Avg time-to-resolve" value={stats ? formatDuration(stats.avgResolveMs) : "…"} />
      </div>
    </header>
  );
}
