"use client";

import type { Doc, Id } from "@/convex/_generated/dataModel";
import { PriorityBadge, StatusPill } from "@/components/ui/badges";
import { formatDuration, label, timeAgo } from "@/components/ui/format";
import { useIncident } from "@/components/ui/hooks";

type Props = {
  incidentId: Id<"incidents"> | null;
  staff?: Doc<"staff">[];
  graph?: { zones: Doc<"zones">[]; edges: Doc<"edges">[] };
};

/** Transcript, status, assignee, route. */
export function IncidentDetail({ incidentId, staff, graph }: Props) {
  const incident = useIncident(incidentId);

  if (!incidentId || !incident) return null;

  const assignee = staff?.find((s) => s._id === incident.assigneeId);
  const zone = graph?.zones.find((z) => z._id === incident.zoneId);
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold capitalize">{label(incident.category)}</h2>
        <PriorityBadge priority={incident.priority} />
      </div>
      <p className="mt-1 text-neutral-300">{incident.description}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-neutral-400">
        <dt>Status</dt>
        <dd><StatusPill status={incident.status} /></dd>
        <dt>Location</dt>
        <dd className="text-neutral-200">{zone?.name ?? "—"} · {incident.level}</dd>
        <dt>Assignee</dt>
        <dd className="text-neutral-200">{assignee ? `${assignee.name} (${label(assignee.role)})` : "—"}</dd>
        <dt>Reports</dt>
        <dd className="text-neutral-200">{incident.reportCount}</dd>
        <dt>Reported</dt>
        <dd className="text-neutral-200" suppressHydrationWarning>{timeAgo(incident._creationTime)} via {incident.source}</dd>
        <dt>Time to ack</dt>
        <dd className="text-neutral-200">
          {incident.acknowledgedAt ? formatDuration(incident.acknowledgedAt - incident._creationTime) : "—"}
        </dd>
        {incident.escalationReason && (
          <>
            <dt>Escalated</dt>
            <dd className="text-red-300">{incident.escalationReason}</dd>
          </>
        )}
      </dl>
      {incident.transcript && (
        <pre className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap rounded bg-neutral-950 p-2 text-xs text-neutral-300">
          {incident.transcript}
        </pre>
      )}
    </section>
  );
}
