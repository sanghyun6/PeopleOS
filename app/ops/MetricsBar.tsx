"use client";

import type { ReactNode } from "react";
import { Brand } from "@/components/ui/Brand";
import { formatDuration } from "@/components/ui/format";
import { useBitdeerStats, useRetrievalStats, useStats } from "@/components/ui/hooks";

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

function Stat({ title, value, sub, hint, tone }: { title: string; value: string; sub?: string; hint?: string; tone?: "red" }) {
  return (
    <div title={hint} className="min-w-0 px-4 first:pl-0">
      <div className="truncate text-xs text-muted">{title}</div>
      <div className={`mt-1 text-2xl font-semibold leading-none tracking-tight tabular-nums ${tone === "red" ? "text-red" : ""}`}>
        <Value text={value} />
      </div>
      {sub && <div className="mt-1 truncate text-[11px] text-faint">{sub}</div>}
    </div>
  );
}

/** Top bar: open incidents, avg time-to-acknowledge (incidents.stats, step 7). */
export function MetricsBar({ zoneCount, edgeCount, children }: { zoneCount?: number; edgeCount?: number; children?: ReactNode }) {
  const stats = useStats();
  const retrieval = useRetrievalStats();
  const bitdeer = useBitdeerStats();
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
        <div className="ml-4 flex divide-x divide-line rounded-xl bg-surface py-2 pr-2 pl-4 ring-1 ring-inset ring-line">
          <Stat
            title="Location lookup (Moss)"
            value={retrieval ? (retrieval.avgMs === null ? "–" : `${retrieval.avgMs}ms`) : "…"}
            sub={retrieval ? `${retrieval.count} lookups` : undefined}
            hint={
              retrieval && retrieval.count > 0
                ? `${retrieval.count} lookups, ${retrieval.fallbacks} fallbacks`
                : undefined
            }
          />
          <Stat
            title="Bitdeer AI"
            value={bitdeer ? (bitdeer.avgMs === null ? "–" : `${bitdeer.avgMs}ms`) : "…"}
            sub={bitdeer ? `${bitdeer.count} calls${bitdeer.failed > 0 ? `, ${bitdeer.failed} fell back` : ""}` : undefined}
            hint={bitdeer && bitdeer.failed > 0 ? `${bitdeer.failed} failed (fell back)` : "avg latency of successful calls"}
          />
        </div>
      </div>
    </header>
  );
}
