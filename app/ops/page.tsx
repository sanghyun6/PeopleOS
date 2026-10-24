"use client";

import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { useActiveIncidents, useGraph, useStaffList } from "@/components/ui/hooks";
import { IncidentDetail } from "./IncidentDetail";
import { IncidentList } from "./IncidentList";
import { MetricsBar } from "./MetricsBar";
import { StaffPanel } from "./StaffPanel";
import { VenueMap } from "./VenueMap";

export default function OpsPage() {
  const graph = useGraph();
  const staff = useStaffList();
  const incidents = useActiveIncidents();
  const [selectedId, setSelectedId] = useState<Id<"incidents"> | null>(null);

  return (
    <div className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
      <MetricsBar zoneCount={graph?.zones.length} edgeCount={graph?.edges.length} />
      <div className="flex min-h-0 flex-1">
        <div className="relative flex-1">
          <VenueMap incidents={incidents} staff={staff} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <aside className="flex w-96 flex-col gap-4 overflow-y-auto border-l border-neutral-800 p-4">
          <IncidentList incidents={incidents} selectedId={selectedId} onSelect={setSelectedId} zones={graph?.zones} />
          <IncidentDetail incidentId={selectedId} staff={staff} graph={graph} />
          <StaffPanel staff={staff} zones={graph?.zones} incidents={incidents} />
        </aside>
      </div>
    </div>
  );
}
