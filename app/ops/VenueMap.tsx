"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useActiveAssignments, useGraph } from "@/components/ui/hooks";
import { ACCENT_HEX, COLOR_HEX, type RouteLineProps, type StaffDotProps } from "@/components/venue/types";

// three.js needs the browser.
const VenueScene = dynamic(() => import("@/components/venue/VenueScene"), { ssr: false });

const ROUTE_COLOR: Partial<Record<Doc<"assignments">["status"], string>> = {
  offered: COLOR_HEX.yellow, // waiting for the staff member to accept
  accepted: ACCENT_HEX, // on the way
};

type Props = {
  incidents?: Doc<"incidents">[];
  staff?: Doc<"staff">[];
  selectedId?: Id<"incidents"> | null;
  onSelect?: (id: Id<"incidents">) => void;
};

/** Edge polylines in walking order, flipped where the route walks an edge backwards. */
function routeSegments(
  assignment: Doc<"assignments">,
  zones: Map<Id<"zones">, Doc<"zones">>,
  edges: Map<Id<"edges">, Doc<"edges">>,
): RouteLineProps["segments"] {
  const { zoneIds, edgeIds } = assignment.route;
  return edgeIds.flatMap((edgeId, i) => {
    const edge = edges.get(edgeId);
    const from = zones.get(zoneIds[i]);
    const to = zones.get(zoneIds[i + 1]);
    if (!edge || !from || !to) return [];
    const path = edge.from === from._id ? edge.path : [...edge.path].reverse();
    return [{ path, fromLevel: from.level, toLevel: to.level }];
  });
}

/** Live 3D venue: incident markers, staff dots at their zones, and active assignment routes. */
export function VenueMap({ incidents, staff, selectedId, onSelect }: Props) {
  const graph = useGraph();
  const assignments = useActiveAssignments();

  const { staffDots, routes } = useMemo(() => {
    const zones = new Map(graph?.zones.map((z) => [z._id, z]));
    const edges = new Map(graph?.edges.map((e) => [e._id, e]));
    const staffDots: StaffDotProps[] = (staff ?? []).flatMap((s) => {
      const zone = zones.get(s.zoneId);
      return zone ? [{ staff: s, zone }] : [];
    });
    const routes: RouteLineProps[] = (assignments ?? [])
      .map((a) => ({ segments: routeSegments(a, zones, edges), color: ROUTE_COLOR[a.status] }))
      .filter((r) => r.segments.length > 0);
    return { staffDots, routes };
  }, [graph, staff, assignments]);

  return (
    <VenueScene
      incidents={incidents}
      staff={staffDots}
      routes={routes}
      selectedId={selectedId}
      onSelect={onSelect}
    />
  );
}
