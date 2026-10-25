"use client";

import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Avatar, CategoryTag, CategoryTile, PriorityBadge, StatusPill } from "@/components/ui/badges";
import { formatDuration, label, timeAgo } from "@/components/ui/format";
import { ChevronIcon } from "@/components/ui/icons";
import { useIncident } from "@/components/ui/hooks";
import { displayBrief } from "@/convex/lib/bitdeer";

type Props = {
  incidentId: Id<"incidents"> | null;
  staff?: Doc<"staff">[];
  graph?: { zones: Doc<"zones">[]; edges: Doc<"edges">[] };
};

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-faint">{term}</dt>
      <dd className="min-w-0 text-fg">{children}</dd>
    </>
  );
}

/** Transcript, status, assignee, route. */
export function IncidentDetail({ incidentId, staff, graph }: Props) {
  const incident = useIncident(incidentId);

  if (!incidentId || !incident) return null;

  const assignee = staff?.find((s) => s._id === incident.assigneeId);
  const zone = graph?.zones.find((z) => z._id === incident.zoneId);
  return (
    <section className="rounded-xl bg-surface p-4 ring-1 ring-inset ring-accent/40">
      <div className="flex items-start gap-3">
        <CategoryTile category={incident.category} status={incident.status} />
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 font-medium leading-snug">{displayBrief(incident)}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusPill status={incident.status} />
            <PriorityBadge priority={incident.priority} />
            <CategoryTag category={incident.category} />
          </div>
        </div>
      </div>
      {incident.staffBrief && (
        <p className="mt-3 line-clamp-2 text-sm text-muted" title={incident.description}>
          Caller said: {incident.description}
        </p>
      )}
      {incident.escalationReason && (
        <p className="mt-3 rounded-lg bg-red/10 px-3 py-2 text-sm text-red ring-1 ring-inset ring-red/30">
          {incident.escalationReason}
        </p>
      )}
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
        <Row term="Location">
          {zone?.name ?? "—"} <span className="text-faint">({incident.level === "mezz" ? "mezzanine" : "main floor"})</span>
        </Row>
        <Row term="Assignee">
          {assignee ? (
            <span className="inline-flex items-center gap-2">
              <Avatar staff={assignee} size={18} />
              {assignee.name}
              <span className="capitalize text-faint">{label(assignee.role)}</span>
            </span>
          ) : (
            "—"
          )}
        </Row>
        <Row term="Reports">
          <span className="tabular-nums">{incident.reportCount}</span>
        </Row>
        <Row term="Reported">
          <span suppressHydrationWarning>
            {timeAgo(incident._creationTime)} by {incident.source}
          </span>
        </Row>
        <Row term="Time to ack">
          <span className="tabular-nums">
            {incident.acknowledgedAt ? formatDuration(incident.acknowledgedAt - incident._creationTime) : "—"}
          </span>
        </Row>
      </dl>
      {incident.transcript && (
        <details className="group mt-4 border-t border-line pt-2">
          <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md py-1 text-xs font-medium text-muted transition hover:text-fg">
            <ChevronIcon size={14} className="transition group-open:rotate-90" />
            Call transcript
          </summary>
          <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-ink p-3 font-sans text-xs leading-relaxed text-muted">
            {incident.transcript}
          </pre>
        </details>
      )}
    </section>
  );
}
