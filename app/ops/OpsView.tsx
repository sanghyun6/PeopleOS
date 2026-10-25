"use client";

import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { SwitchUser } from "@/components/ui/SwitchUser";
import { useActiveIncidents, useGraph, useStaffList } from "@/components/ui/hooks";
import { BlockageBanner } from "./BlockageBanner";
import { IncidentDetail } from "./IncidentDetail";
import { IncidentList } from "./IncidentList";
import { MetricsBar } from "./MetricsBar";
import { StaffPanel } from "./StaffPanel";
import { VenueMap } from "./VenueMap";

/** The ops dashboard. `embedded` fills its parent (the /demo split); otherwise it fills the space under the page's tab bar. */
export function OpsView({ embedded = false }: { embedded?: boolean }) {
  const graph = useGraph();
  const staff = useStaffList();
  const incidents = useActiveIncidents();
  const [selectedId, setSelectedId] = useState<Id<"incidents"> | null>(null);

  return (
    <div className={`flex ${embedded ? "h-full" : "min-h-0 flex-1"} flex-col bg-ink text-fg`}>
      <MetricsBar zoneCount={graph?.zones.length} edgeCount={graph?.edges.length}>
        {!embedded && <SwitchUser />}
      </MetricsBar>
      <BlockageBanner />
      <div className={`flex min-h-0 flex-1 ${embedded ? "" : "flex-col md:flex-row"}`}>
        <div className={`relative min-w-0 flex-1 ${embedded ? "" : "min-h-[55vh] md:min-h-0"}`}>
          <VenueMap incidents={incidents} staff={staff} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <aside
          className={`flex shrink-0 flex-col gap-6 overflow-y-auto border-line p-4 ${
            embedded ? "w-80 border-l" : "w-full border-t md:w-[400px] md:border-t-0 md:border-l"
          }`}
        >
          <IncidentList incidents={incidents} selectedId={selectedId} onSelect={setSelectedId} zones={graph?.zones} staff={staff} />
          <IncidentDetail incidentId={selectedId} staff={staff} graph={graph} />
          <StaffPanel staff={staff} zones={graph?.zones} incidents={incidents} />
        </aside>
      </div>
    </div>
  );
}
