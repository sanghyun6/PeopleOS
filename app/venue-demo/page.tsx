"use client";

// Standalone preview of the 3D venue with mock props (no Convex). Mirrors the demo script:
// a table outlet issue (x2 reports), a hallway blockage, a mezzanine network issue routed
// over the stairs, and a resolved one. "Confirm blockage" swaps the table-142 assignee.
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { EDGES, edgeGeometry, getZone } from "@/convex/lib/zoning";
import type { VenueLevel, XZ } from "@/convex/lib/venueData";
import type { RouteLineProps, StaffDotProps } from "@/components/venue/types";

const VenueScene = dynamic(() => import("@/components/venue/VenueScene"), { ssr: false });

const id = <T extends "incidents" | "staff" | "zones">(_t: T, s: string) => s as Id<T>;

function zoneDoc(key: string): Doc<"zones"> {
  const z = getZone(key);
  return { _id: id("zones", key), _creationTime: 0, key, name: z.name, level: z.level, center: z.center, aliases: z.aliases };
}

function staffDoc(key: string, name: string, role: Doc<"staff">["role"], status: Doc<"staff">["status"], zone: string): StaffDotProps {
  return {
    staff: { _id: id("staff", key), _creationTime: 0, name, role, status, zoneId: id("zones", zone) },
    zone: zoneDoc(zone),
  };
}

/** Route over real zone-graph edges, ending at the incident point. */
function route(zoneKeys: string[], dest: XZ, destLevel: VenueLevel): RouteLineProps["segments"] {
  const segments: RouteLineProps["segments"] = [];
  for (let i = 0; i + 1 < zoneKeys.length; i++) {
    const [a, b] = [zoneKeys[i], zoneKeys[i + 1]];
    const def = EDGES.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
    if (!def) throw new Error(`no edge ${a} - ${b}`);
    const path = edgeGeometry(def).path;
    segments.push({ path: def.a === a ? path : [...path].reverse(), fromLevel: getZone(a).level, toLevel: getZone(b).level });
  }
  const last = getZone(zoneKeys[zoneKeys.length - 1]);
  segments.push({ path: [last.center, dest], fromLevel: last.level, toLevel: destLevel });
  return segments;
}

function incident(key: string, p: Partial<Doc<"incidents">> & Pick<Doc<"incidents">, "description" | "category" | "status" | "at" | "level" | "zoneId">): Doc<"incidents"> {
  return {
    _id: id("incidents", key),
    _creationTime: 0,
    priority: "medium",
    source: "voice",
    locationId: "loc" as Id<"locations">,
    reportCount: 1,
    lastReportedAt: 0,
    ...p,
  };
}

const t142: XZ = { x: -49.44, z: -30.7 };
const hallway: XZ = { x: 5.16, z: -7.79 };
const t270: XZ = { x: 30.73, z: -12.97 };
const fountain: XZ = { x: 16.17, z: -29.79 };

export default function VenueDemoPage() {
  const [selectedId, setSelectedId] = useState<Id<"incidents"> | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const staff = useMemo<StaffDotProps[]>(
    () => [
      staffDoc("alex", "Alex (facilities)", "facilities", confirmed ? "available" : "busy", "atrium-east"),
      staffDoc("bea", "Bea (facilities)", "facilities", confirmed ? "busy" : "available", "pavilion-north"),
      staffDoc("chris", "Chris (network)", "network", "busy", "broadway-2"),
      staffDoc("dana", "Dana (supplies)", "supplies", "available", "gate-3-4"),
      staffDoc("eli", "Eli (ops lead)", "ops_lead", "available", "public-entrance"),
      staffDoc("fay", "Fay (guest services)", "guest_services", "off_duty", "east-lobby"),
    ],
    [confirmed],
  );

  const incidents = useMemo<Doc<"incidents">[]>(
    () => [
      incident("i142", {
        category: "power", description: "Table 142 outlet is not working", status: "acknowledged", reportCount: 2,
        at: t142, level: "main", zoneId: id("zones", "atrium-west"), assigneeId: id("staff", confirmed ? "bea" : "alex"),
      }),
      incident("ihall", {
        category: "blockage", description: "Hallway near Gate 3/4 is blocked", priority: "high",
        status: confirmed ? "assigned" : "pending_review", at: hallway, level: "main", zoneId: id("zones", "broadway-1"),
      }),
      incident("i270", {
        category: "network", description: "Wired ethernet down at table 270", status: "assigned",
        at: t270, level: "mezz", zoneId: id("zones", "mezz-tables"), assigneeId: id("staff", "chris"),
      }),
      incident("icups", {
        category: "supplies", description: "Out of cups at the water station", status: "resolved",
        at: fountain, level: "main", zoneId: id("zones", "gate-3-4"),
      }),
    ],
    [confirmed],
  );

  const routes = useMemo<RouteLineProps[]>(
    () => [
      confirmed
        ? { segments: route(["pavilion-north", "atrium-west"], t142, "main"), color: "#f59e0b" }
        : { segments: route(["atrium-east", "atrium-west"], t142, "main"), color: "#f59e0b" },
      // Crosses levels: the line climbs the stairs to the mezzanine.
      { segments: route(["broadway-2", "mezz-tables"], t270, "mezz"), color: "#38bdf8" },
    ],
    [confirmed],
  );

  const selected = incidents.find((i) => i._id === selectedId);

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100">
      <div className="relative flex-1">
        <VenueScene incidents={incidents} staff={staff} routes={routes} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
      <aside className="flex w-80 flex-col gap-4 border-l border-neutral-800 p-4 text-sm">
        <h1 className="text-base font-semibold">/venue-demo (mock props)</h1>
        <button
          type="button"
          onClick={() => setConfirmed((c) => !c)}
          className="rounded-md bg-neutral-100 px-3 py-2 font-medium text-neutral-900"
        >
          {confirmed ? "Undo blockage confirmation" : "Confirm hallway blockage"}
        </button>
        <p className="text-neutral-400">
          {confirmed ? "Table 142 reassigned: Alex → Bea, new route drawn." : "Table 142 assigned to Alex; blockage awaiting operator."}
        </p>
        <section className="rounded-md border border-neutral-800 p-3">
          <h2 className="mb-1 font-medium">Selected</h2>
          {selected ? (
            <dl className="space-y-1 text-neutral-300">
              <div>{selected.description}</div>
              <div className="text-neutral-500">
                {selected.category} · {selected.status} · {selected.level} · ×{selected.reportCount}
              </div>
            </dl>
          ) : (
            <p className="text-neutral-500">Click a marker.</p>
          )}
        </section>
      </aside>
    </div>
  );
}
