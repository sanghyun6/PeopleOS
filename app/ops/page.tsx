"use client";

import dynamic from "next/dynamic";
import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { IncidentDetail } from "./IncidentDetail";
import { IncidentList } from "./IncidentList";
import { MetricsBar } from "./MetricsBar";
import { StaffPanel } from "./StaffPanel";

// three.js needs the browser.
const VenueScene = dynamic(() => import("@/components/venue/VenueScene"), { ssr: false });

export default function OpsPage() {
  const graph = useQuery(api.zones.graph);
  const staff = useQuery(api.staff.list);
  const incidents = useQuery(api.incidents.listActive);
  const [selectedId, setSelectedId] = useState<Id<"incidents"> | null>(null);

  return (
    <div className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
      <MetricsBar zoneCount={graph?.zones.length} edgeCount={graph?.edges.length} />
      <div className="flex min-h-0 flex-1">
        <div className="relative flex-1">
          <VenueScene />
        </div>
        <aside className="flex w-96 flex-col gap-4 overflow-y-auto border-l border-neutral-800 p-4">
          <IncidentList incidents={incidents} selectedId={selectedId} onSelect={setSelectedId} />
          <IncidentDetail incidentId={selectedId} />
          <StaffPanel staff={staff} zones={graph?.zones} />
        </aside>
      </div>
    </div>
  );
}
