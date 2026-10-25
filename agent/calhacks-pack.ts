// The built-in Cal Hacks venue (lib/zoning.ts + seed staff + agent/event-kb.json) as a
// Venue Pack. Proves the pack format can express the live system:
// compileVenuePack(buildCalHacksPack()) reproduces the seeded zones, edges, locations
// and staff (see agent/calhacks-pack.test.ts). Written to
// docs/examples/calhacks-venue-pack.json by `npm run export:venue-pack`.
import eventKb from "./event-kb.json";
import { EDGES, ZONES, buildLocations } from "../convex/lib/zoning";
import { SEED_STAFF } from "../convex/lib/seedStaff";
import { MEZZ_HEIGHT, venue } from "../convex/lib/venueData";
import { VENUE_PACK_FORMAT, type VenuePackInput, type XZ } from "../convex/lib/venuePack";

const ZONE_PAD_M = 3;

/**
 * Cal Hacks zones are graph nodes (a center), not polygons. The pack needs a shape, so
 * each zone gets the padded bounding box of the places assigned to it. Approximate:
 * the detailed 3D model draws the real rooms from data/palace-venue.json instead.
 */
function approximateShape(points: XZ[], center: XZ) {
  const pts = points.length ? points : [center];
  const minX = Math.min(...pts.map((p) => p.x)) - ZONE_PAD_M;
  const maxX = Math.max(...pts.map((p) => p.x)) + ZONE_PAD_M;
  const minZ = Math.min(...pts.map((p) => p.z)) - ZONE_PAD_M;
  const maxZ = Math.max(...pts.map((p) => p.z)) + ZONE_PAD_M;
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    type: "rect" as const,
    center: { x: r((minX + maxX) / 2), z: r((minZ + maxZ) / 2) },
    width: r(Math.max(maxX - minX, 2 * ZONE_PAD_M)),
    depth: r(Math.max(maxZ - minZ, 2 * ZONE_PAD_M)),
    rotationDeg: 0,
  };
}

export function buildCalHacksPack(): VenuePackInput {
  const locations = buildLocations().filter((l) => l.kind !== "zone");
  return {
    format: VENUE_PACK_FORMAT,
    version: 1,
    event: {
      name: "Cal Hacks 13.0",
      venueName: "Palace of Fine Arts",
      city: "San Francisco",
      timezone: "America/Los_Angeles",
      startsAt: "2026-10-23T17:00:00-07:00",
      endsAt: "2026-10-25T15:00:00-07:00",
      helpDesk: "zone:box-office",
      keyterms: ["mezzanine", "Broadway", "atrium", "Cal Hacks"],
    },
    floors: [
      { id: "main", name: "Main floor", elevation: 0 },
      { id: "mezz", name: "Mezzanine", elevation: MEZZ_HEIGHT },
    ],
    outline: venue.outline,
    zones: ZONES.map((z) => ({
      id: z.key,
      name: z.name,
      floor: z.level,
      shape: approximateShape(locations.filter((l) => l.zoneKey === z.key).map((l) => l.at), z.center),
      center: z.center,
      height: 3,
      kind: z.key.startsWith("broadway") ? "corridor" : "hall",
      aliases: z.aliases,
    })),
    edges: EDGES.map((e) => ({ from: e.a, to: e.b, kind: e.kind, via: e.via ?? [] })),
    locations: locations.map((l) => ({
      id: l.key,
      name: l.label,
      kind: l.kind as Exclude<typeof l.kind, "zone">,
      at: l.at,
      zone: l.zoneKey,
      floor: l.level,
      aliases: l.aliases,
    })),
    staff: SEED_STAFF.map((s) => ({ name: s.name, role: s.role, startZone: s.zone, status: s.status === "off_duty" ? "off_duty" : "available" })),
    knowledge: eventKb,
    escalation: { contacts: [{ role: "ops_lead" }] },
    geometry: {
      detailed: "palace-of-fine-arts",
      source: "https://palace-interior.vercel.app (organizers' map), extracted to data/palace-venue.json",
      notes: "Zone shapes are padded bounding boxes of each zone's places; the real room polygons, tables, chairs and stairs come from the built-in detailed model.",
    },
  };
}
