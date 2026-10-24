"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { PriorityBadge, StatusPill } from "@/components/ui/badges";
import { formatDuration, label, timeAgo } from "@/components/ui/format";
import { useIncident } from "@/components/ui/hooks";
import { LIVE } from "@/components/ui/live";

type Props = {
  incidentId: Id<"incidents"> | null;
  staff?: Doc<"staff">[];
  graph?: { zones: Doc<"zones">[]; edges: Doc<"edges">[] };
};

/** Transcript, status, assignee, route; blockage confirm button for pending_review (steps 5/8). */
export function IncidentDetail({ incidentId, staff, graph }: Props) {
  const incident = useIncident(incidentId);
  const confirm = useMutation(api.blockages.confirm);
  const [note, setNote] = useState<string | null>(null);

  if (!incidentId || !incident) return null;

  const assignee = staff?.find((s) => s._id === incident.assigneeId);
  const zone = graph?.zones.find((z) => z._id === incident.zoneId);
  // Edges touching the incident's zone are the candidates to close.
  const edgeIds = (graph?.edges ?? []).filter((e) => e.from === incident.zoneId || e.to === incident.zoneId).map((e) => e._id);

  const onConfirm = async () => {
    if (!LIVE.blockages) return setNote("blockages.confirm is not implemented yet (mock).");
    try {
      const r = (await confirm({ incidentId: incident._id, edgeIds })) as { blockedEdges: number; reassigned: number };
      setNote(`Closed ${r.blockedEdges} edges, reassigned ${r.reassigned}.`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Failed");
    }
  };

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
      {incident.status === "pending_review" && (
        <div className="mt-3">
          <button
            onClick={onConfirm}
            className="w-full rounded-lg bg-yellow-500 px-3 py-2 font-semibold text-black"
          >
            Confirm blockage{edgeIds.length ? ` · close ${edgeIds.length} edge${edgeIds.length === 1 ? "" : "s"}` : ""}
          </button>
          {note && <p className="mt-1 text-xs text-neutral-400">{note}</p>}
        </div>
      )}
    </section>
  );
}
