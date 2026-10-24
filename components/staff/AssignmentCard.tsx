"use client";

import { useState } from "react";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { PriorityBadge } from "@/components/ui/badges";
import { formatDuration, label, timeAgo } from "@/components/ui/format";

export type AssignmentView = {
  assignment: Doc<"assignments">;
  incident: Doc<"incidents">;
  locationLabel: string;
  routeZoneNames: string[];
};

type Actions = {
  accept: (id: Id<"assignments">) => Promise<void>;
  decline: (id: Id<"assignments">) => Promise<void>;
  complete: (id: Id<"assignments">) => Promise<void>;
};

const btn = "min-h-14 flex-1 rounded-xl text-lg font-semibold active:scale-[0.98] disabled:opacity-50";

/** Accept / Decline (offered) and Complete (accepted) buttons (step 6). */
export function AssignmentCard({ assignment, actions }: { assignment: AssignmentView | null; actions?: Actions }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!assignment) {
    return <p className="rounded-lg border border-dashed p-6 text-center text-neutral-500">No assignments.</p>;
  }

  const { assignment: a, incident, locationLabel, routeZoneNames } = assignment;
  const offered = a.status === "offered";

  const run = async (fn?: (id: Id<"assignments">) => Promise<void>) => {
    if (!fn) return;
    setBusy(true);
    setError(null);
    try {
      await fn(a._id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article
      className={`rounded-2xl border p-4 ${offered ? "border-yellow-500 bg-yellow-500/10" : "border-neutral-700 bg-neutral-900"}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          {offered ? "New assignment" : "In progress"}
        </span>
        <PriorityBadge priority={incident.priority} />
      </div>
      <h2 className="text-2xl font-bold">{locationLabel}</h2>
      <p className="mt-1 text-neutral-300">
        <span className="capitalize">{label(incident.category)}</span> — {incident.description}
      </p>
      <dl className="mt-3 space-y-1 text-sm text-neutral-400">
        {routeZoneNames.length > 0 && (
          <div className="flex gap-2">
            <dt className="shrink-0">Route</dt>
            <dd className="text-neutral-200">
              {routeZoneNames.join(" → ")} · {Math.round(a.route.distance)} m
            </dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt>Reports</dt>
          <dd className="text-neutral-200">{incident.reportCount}</dd>
        </div>
        <div className="flex gap-2">
          <dt>Offered</dt>
          <dd className="text-neutral-200" suppressHydrationWarning>{timeAgo(a._creationTime)}</dd>
        </div>
        {a.respondedAt && (
          <div className="flex gap-2">
            <dt>Response</dt>
            <dd className="text-neutral-200">{formatDuration(a.respondedAt - a._creationTime)}</dd>
          </div>
        )}
        {a.reason && a.reason !== "auto-dispatch" && <p className="text-yellow-300">{a.reason}</p>}
      </dl>

      <div className="mt-4 flex gap-3">
        {offered ? (
          <>
            <button className={`${btn} bg-neutral-700 text-neutral-100`} disabled={busy} onClick={() => run(actions?.decline)}>
              Decline
            </button>
            <button className={`${btn} flex-[2] bg-green-600 text-white`} disabled={busy} onClick={() => run(actions?.accept)}>
              Accept
            </button>
          </>
        ) : (
          <button className={`${btn} bg-green-600 text-white`} disabled={busy} onClick={() => run(actions?.complete)}>
            Complete
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </article>
  );
}
