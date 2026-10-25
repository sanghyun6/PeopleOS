"use client";

import { useState } from "react";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { CategoryTag, PriorityBadge, StatusPill } from "@/components/ui/badges";
import { formatDuration, timeAgo } from "@/components/ui/format";
import { CheckIcon, ChevronIcon, ClockIcon, PinIcon, RouteIcon } from "@/components/ui/icons";
import { displayBrief } from "@/convex/lib/bitdeer";

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

const btn =
  "inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl text-lg font-semibold transition active:scale-[0.98] disabled:opacity-50";

/** Disclosure row: label on the left, chevron that turns when open. */
function Expand({ summary, children }: { summary: React.ReactNode; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg text-sm text-muted transition hover:text-fg">
        {summary}
        <ChevronIcon size={16} className="ml-auto shrink-0 transition group-open:rotate-90" />
      </summary>
      <div className="pb-2">{children}</div>
    </details>
  );
}

/** Accept / Decline (offered) and Complete (accepted) buttons (step 6). */
export function AssignmentCard({ assignment, actions }: { assignment: AssignmentView | null; actions?: Actions }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!assignment) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-green/10 text-green ring-1 ring-inset ring-green/30">
          <CheckIcon size={22} />
        </span>
        <p className="mt-4 font-medium">You&apos;re all caught up</p>
        <p className="mt-1 max-w-64 text-sm text-muted">New tasks show up here with a sound and a buzz.</p>
      </div>
    );
  }

  const { assignment: a, incident, locationLabel, routeZoneNames } = assignment;
  const offered = a.status === "offered";
  const distance = Math.round(a.route.distance);
  const first = routeZoneNames[0];
  const last = routeZoneNames[routeZoneNames.length - 1];

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
      className={`rounded-2xl bg-surface p-4 ring-1 ring-inset ${offered ? "ring-amber/60 shadow-[0_0_0_4px_rgba(242,178,62,0.08)]" : "ring-line"}`}
    >
      <div className="flex items-center gap-2">
        <StatusPill status={offered ? "assigned" : "acknowledged"} />
        <span className="text-xs text-muted">{offered ? "New assignment" : "In progress"}</span>
        <span className="ml-auto flex items-center gap-1 text-xs text-faint" suppressHydrationWarning>
          <ClockIcon size={12} />
          {timeAgo(a._creationTime)}
        </span>
      </div>

      <h2 className="mt-4 line-clamp-2 text-xl font-semibold leading-snug tracking-tight">{displayBrief(incident)}</h2>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-fg">
          <PinIcon size={14} className="text-accent" />
          {locationLabel}
        </span>
        <CategoryTag category={incident.category} />
        <PriorityBadge priority={incident.priority} />
      </div>

      {a.reason && a.reason !== "auto-dispatch" && (
        <p className="mt-4 line-clamp-2 rounded-lg bg-amber/10 px-3 py-2 text-sm text-amber ring-1 ring-inset ring-amber/30">
          {a.reason}
        </p>
      )}

      <div className="mt-4 divide-y divide-line border-y border-line">
        {routeZoneNames.length > 0 && (
          <Expand
            summary={
              <>
                <RouteIcon size={16} className="shrink-0 text-accent" />
                <span className="min-w-0 truncate text-fg">
                  {routeZoneNames.length > 1 ? `${first} to ${last}` : `In ${first}`}
                  <span className="text-muted">, {distance} m</span>
                </span>
                <span className="shrink-0 text-xs">View route</span>
              </>
            }
          >
            <ol className="relative ml-2 space-y-2 border-l border-line-strong pl-4 text-sm">
              {routeZoneNames.map((name, i) => (
                <li key={`${name}-${i}`} className="relative">
                  <span
                    className={`absolute top-1.5 -left-[21px] size-2.5 rounded-full ring-2 ring-surface ${
                      i === routeZoneNames.length - 1 ? "bg-accent" : "bg-line-strong"
                    }`}
                  />
                  <span className={i === routeZoneNames.length - 1 ? "font-medium text-fg" : "text-muted"}>{name}</span>
                </li>
              ))}
              <li className="relative text-fg">
                <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-accent ring-2 ring-surface" />
                <span className="font-medium">{locationLabel}</span>
                <span className="text-muted">, {distance} m total</span>
              </li>
            </ol>
          </Expand>
        )}
        <Expand summary={<span className="text-fg">Details</span>}>
          <p className="text-sm text-muted">{incident.description}</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            <dt className="text-faint">Reports</dt>
            <dd className="tabular-nums">{incident.reportCount}</dd>
            {a.respondedAt && (
              <>
                <dt className="text-faint">Response</dt>
                <dd className="tabular-nums">{formatDuration(a.respondedAt - a._creationTime)}</dd>
              </>
            )}
          </dl>
        </Expand>
      </div>

      <div className="mt-4 flex gap-2">
        {offered ? (
          <>
            <button
              className={`${btn} bg-transparent text-fg ring-1 ring-inset ring-line-strong hover:bg-raised`}
              disabled={busy}
              onClick={() => run(actions?.decline)}
            >
              Decline
            </button>
            <button
              className={`${btn} flex-[2] bg-accent text-accent-ink hover:brightness-110`}
              disabled={busy}
              onClick={() => run(actions?.accept)}
            >
              Accept
            </button>
          </>
        ) : (
          <button className={`${btn} bg-green text-[#06281a] hover:brightness-110`} disabled={busy} onClick={() => run(actions?.complete)}>
            <CheckIcon size={20} />
            Mark complete
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red">{error}</p>}
    </article>
  );
}
