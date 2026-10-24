// Test fixture: the seeded venue graph and demo staff as in-memory docs (no Convex).
// Ids are readable strings ("zone:broadway-1", "staff:priya") cast to Id<...>.
// The multi-dot filename keeps Convex from bundling this file.
import type { Doc, Id } from "../_generated/dataModel";
import type { IncidentCategory, StaffRole, StaffStatus } from "./validators";
import { EDGES, buildLocations, edgeGeometry } from "./zoning";

export const zoneId = (key: string) => `zone:${key}` as Id<"zones">;
export const edgeId = (a: string, b: string) => `edge:${a}--${b}` as Id<"edges">;
export const staffId = (handle: string) => `staff:${handle}` as Id<"staff">;

export function seededEdges(blocked: (a: string, b: string) => boolean = () => false): Doc<"edges">[] {
  return EDGES.map((def, i) => {
    const { path, distance } = edgeGeometry(def);
    return {
      _id: edgeId(def.a, def.b),
      _creationTime: i,
      from: zoneId(def.a),
      to: zoneId(def.b),
      kind: def.kind,
      distance,
      path,
      blocked: blocked(def.a, def.b),
    };
  });
}

/** Every edge touching `zone` is closed (e.g. a blocked hallway). */
export const blockZone = (zone: string) => (a: string, b: string) => a === zone || b === zone;

// Mirrors STAFF in convex/seed.ts.
const STAFF: { handle: string; name: string; role: StaffRole; zone: string; status?: StaffStatus }[] = [
  { handle: "maya", name: "Maya Chen", role: "network", zone: "atrium-east" },
  { handle: "diego", name: "Diego Ramirez", role: "network", zone: "mezz-tables" },
  { handle: "priya", name: "Priya Patel", role: "facilities", zone: "broadway-2" },
  { handle: "jordan", name: "Jordan Kim", role: "facilities", zone: "mezz-north" },
  { handle: "sam", name: "Sam Okafor", role: "facilities", zone: "pavilion-north", status: "off_duty" },
  { handle: "lena", name: "Lena Novak", role: "supplies", zone: "north-hall" },
  { handle: "theo", name: "Theo Park", role: "guest_services", zone: "east-lobby" },
  { handle: "alex", name: "Alex Morgan", role: "ops_lead", zone: "public-entrance" },
];

export function seededStaff(): Doc<"staff">[] {
  return STAFF.map((s, i) => ({
    _id: staffId(s.handle),
    _creationTime: i,
    name: s.name,
    role: s.role,
    status: s.status ?? "available",
    zoneId: zoneId(s.zone),
  }));
}

export function incidentAt(
  locationKey: string,
  opts: { category?: IncidentCategory; id?: string; lastReportedAt?: number } = {},
): Doc<"incidents"> {
  const loc = buildLocations().find((l) => l.key === locationKey);
  if (!loc) throw new Error(`Unknown location: ${locationKey}`);
  return {
    _id: (opts.id ?? `incident:${locationKey}`) as Id<"incidents">,
    _creationTime: 0,
    category: opts.category ?? "power",
    description: `${loc.label} issue`,
    priority: "medium",
    status: "open",
    source: "voice",
    locationId: `location:${loc.key}` as Id<"locations">,
    zoneId: zoneId(loc.zoneKey),
    level: loc.level,
    at: loc.at,
    reportCount: 1,
    lastReportedAt: opts.lastReportedAt ?? 0,
  };
}
