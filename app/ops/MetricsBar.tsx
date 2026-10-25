"use client";

import type { ReactNode } from "react";
import { Brand } from "@/components/ui/Brand";
import { formatDuration } from "@/components/ui/format";
import { useStats } from "@/components/ui/hooks";

/** "1m 34s" -> big digits, small muted units. */
function Value({ text }: { text: string }) {
  const parts = text.match(/\d+(?:\.\d+)?|[^\d]+/g) ?? [text];
  return (
    <>
      {parts.map((p, i) =>
        /^\d/.test(p) ? (
          <span key={i}>{p}</span>
        ) : (
          <span key={i} className="ml-0.5 mr-1 text-[0.55em] font-medium text-muted last:mr-0">
            {p.trim()}
          </span>
        ),
      )}
    </>
  );
}

function Stat({ title, value, tone }: { title: string; value: string; tone?: "red" }) {
  return (
    <div className="min-w-0 px-4 first:pl-0">
      <div className="truncate text-xs text-muted">{title}</div>
      <div className={`mt-1 text-2xl font-semibold leading-none tracking-tight tabular-nums ${tone === "red" ? "text-red" : ""}`}>
        <Value text={value} />
      </div>
    </div>
  );
}

/** Top bar: open incidents, avg time-to-acknowledge (incidents.stats, step 7). */
export function MetricsBar({ zoneCount, edgeCount, children }: { zoneCount?: number; edgeCount?: number; children?: ReactNode }) {
  const stats = useStats();
  return (
    <header className="flex flex-wrap items-center gap-x-8 gap-y-4 border-b border-line px-4 py-4 lg:px-6">
      <div className="min-w-0">
        <Brand suffix="Ops" />
        <div className="mt-1 flex items-center gap-4 text-xs text-faint">
          <span className="tabular-nums">
            {zoneCount ?? "…"} zones, {edgeCount ?? "…"} paths
          </span>
          {children}
        </div>
      </div>
      <div className="ml-auto flex flex-wrap items-start gap-y-4">
        <div className="flex divide-x divide-line">
          <Stat title="Open" value={stats ? String(stats.open) : "…"} tone={stats && stats.open > 0 ? "red" : undefined} />
          <Stat title="Resolved" value={stats ? String(stats.resolved) : "…"} />
          <Stat title="Avg time to acknowledge" value={stats ? formatDuration(stats.avgAckMs) : "…"} />
          <Stat title="Avg time to resolve" value={stats ? formatDuration(stats.avgResolveMs) : "…"} />
        </div>
      </div>
    </header>
  );
}
