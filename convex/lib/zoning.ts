// Derives dispatch zones, the walking graph, and the location vocabulary from
// data/palace-venue.json. Pure functions: used by the seed and by the frontend.
import { venue, type VenueLevel, type XZ } from "./venueData";

export type ZoneDef = {
  key: string;
  name: string;
  level: VenueLevel;
  center: XZ;
  aliases: string[];
};

export type EdgeDef = {
  a: string; // zone key
  b: string; // zone key
  kind: "walk" | "stairs";
  via?: XZ[]; // intermediate points (doors, stairs) so routes do not cut through walls
};

export type LocationDef = {
  key: string;
  label: string;
  kind: "table" | "booth" | "amenity" | "room" | "area" | "entrance" | "zone";
  level: VenueLevel;
  at: XZ;
  zoneKey: string;
  aliases: string[];
};

/** Extra cost for taking stairs between main floor and mezzanine. */
export const STAIR_PENALTY_M = 15;

export const ZONES: ZoneDef[] = [
  // Main floor, west hall (Pavilion + Atrium)
  { key: "stage", name: "Main Stage & Green Rooms", level: "main", center: { x: -89, z: -5 }, aliases: ["stage", "green rooms", "southwest lobby"] },
  { key: "pavilion-north", name: "Pavilion North", level: "main", center: { x: -73, z: -8 }, aliases: ["pavilion"] },
  { key: "pavilion-south", name: "Pavilion South", level: "main", center: { x: -65, z: -29 }, aliases: ["pavilion back", "west storage"] },
  { key: "atrium-west", name: "Atrium West", level: "main", center: { x: -48, z: -21 }, aliases: ["atrium"] },
  { key: "atrium-east", name: "Atrium East", level: "main", center: { x: -24, z: -21 }, aliases: ["atrium", "bleachers"] },
  { key: "public-entrance", name: "Public Entrance", level: "main", center: { x: -33, z: -5 }, aliases: ["main entrance", "front entrance"] },
  { key: "north-hall", name: "North Hall (Catering & Sponsor Row)", level: "main", center: { x: -20, z: -38 }, aliases: ["catering", "loading doors", "north sponsor row"] },
  // Main floor, center + east
  { key: "broadway-1", name: "Broadway #1 (Gate #3/#4 Hallway)", level: "main", center: { x: 3, z: -7 }, aliases: ["broadway 1", "gate 3/4 hallway", "hallway near gate 3", "hallway near gate 4"] },
  { key: "gate-3-4", name: "Gate #3/#4 Breakout & Fountain", level: "main", center: { x: 10, z: -24 }, aliases: ["gate 3", "gate 4", "breakout room", "fountain", "water station", "north restrooms"] },
  { key: "broadway-2", name: "Broadway #2", level: "main", center: { x: 30, z: -3 }, aliases: ["broadway 2", "mentor tables"] },
  { key: "broadway-3", name: "Broadway #3 & Gate #6", level: "main", center: { x: 51, z: 13 }, aliases: ["broadway 3", "gate 6", "claude's corner"] },
  { key: "food-court", name: "Food & Breakout #5", level: "main", center: { x: 68, z: 5 }, aliases: ["food", "food line", "breakout 5"] },
  { key: "east-lobby", name: "East Lobby (Luggage & Queue)", level: "main", center: { x: 86, z: 8 }, aliases: ["luggage", "bag check", "shower trailers", "queue"] },
  { key: "box-office", name: "Box Office & Business Entrance", level: "main", center: { x: 90, z: 31 }, aliases: ["box office", "check-in", "business entrance"] },
  { key: "theater", name: "Theater", level: "main", center: { x: 70, z: 36 }, aliases: ["theater", "theatre"] },
  // Mezzanine
  { key: "mezz-north", name: "Mezzanine North (Hardware & 3D Printers)", level: "mezz", center: { x: 25, z: -24 }, aliases: ["hardware", "3d printers", "merch", "upstairs"] },
  { key: "mezz-tables", name: "Mezzanine Tables", level: "mezz", center: { x: 35, z: -8 }, aliases: ["mezzanine", "upstairs tables"] },
  { key: "mezz-breakout-5", name: "Mezzanine Breakout #5", level: "mezz", center: { x: 63, z: -1 }, aliases: ["upstairs breakout 5"] },
];

export const EDGES: EdgeDef[] = [
  { a: "stage", b: "pavilion-north", kind: "walk" },
  { a: "stage", b: "pavilion-south", kind: "walk" },
  { a: "pavilion-north", b: "pavilion-south", kind: "walk" },
  { a: "pavilion-north", b: "atrium-west", kind: "walk" },
  { a: "pavilion-south", b: "atrium-west", kind: "walk" },
  { a: "atrium-west", b: "atrium-east", kind: "walk" },
  { a: "atrium-west", b: "public-entrance", kind: "walk" },
  { a: "atrium-west", b: "north-hall", kind: "walk" },
  { a: "atrium-east", b: "public-entrance", kind: "walk" },
  { a: "atrium-east", b: "north-hall", kind: "walk" },
  { a: "atrium-east", b: "broadway-1", kind: "walk", via: [{ x: -14, z: -11 }] },
  { a: "public-entrance", b: "broadway-1", kind: "walk" },
  { a: "north-hall", b: "gate-3-4", kind: "walk", via: [{ x: 0, z: -35 }] },
  { a: "broadway-1", b: "gate-3-4", kind: "walk", via: [{ x: 0, z: -15 }] },
  { a: "broadway-1", b: "broadway-2", kind: "walk", via: [{ x: 16, z: -8 }] },
  { a: "broadway-2", b: "gate-3-4", kind: "walk", via: [{ x: 19, z: -14 }] },
  { a: "broadway-2", b: "broadway-3", kind: "walk", via: [{ x: 42, z: 4 }] },
  { a: "broadway-3", b: "food-court", kind: "walk" },
  { a: "broadway-3", b: "theater", kind: "walk", via: [{ x: 58, z: 26 }] },
  { a: "food-court", b: "east-lobby", kind: "walk" },
  { a: "east-lobby", b: "box-office", kind: "walk" },
  { a: "box-office", b: "theater", kind: "walk" },
  { a: "mezz-north", b: "mezz-tables", kind: "walk" },
  { a: "mezz-tables", b: "mezz-breakout-5", kind: "walk", via: [{ x: 50, z: -9 }] },
  // Stairs between levels
  { a: "atrium-east", b: "mezz-north", kind: "stairs", via: [{ x: -10, z: -24 }, { x: -2, z: -24 }] }, // bleachers
  { a: "broadway-2", b: "mezz-tables", kind: "stairs", via: [{ x: 45, z: -3 }, { x: 50, z: -12 }] }, // stair-m5
  { a: "food-court", b: "mezz-breakout-5", kind: "stairs", via: [{ x: 68.6, z: 10.6 }] }, // stair-43
];

// Rooms callers might name. Rooms not listed here (pure service areas) are skipped.
const ROOMS: Record<string, { label?: string; zone: string; level?: VenueLevel; aliases?: string[] }> = {
  "green-rooms": { zone: "stage" },
  "sw-lobby": { label: "Southwest Lobby", zone: "stage" },
  "west-storage": { label: "West Storage", zone: "pavilion-south" },
  "loading-office": { label: "Loading Office", zone: "north-hall" },
  catering: { zone: "north-hall" },
  "restrooms-north": { label: "North Restrooms", zone: "gate-3-4", aliases: ["restrooms", "bathroom"] },
  "breakout-3-4": { label: "Gate #3/#4 Breakout Room", zone: "gate-3-4", aliases: ["gate 3", "gate 4", "gate three", "gate four"] },
  bleachers: { label: "Bleachers", zone: "atrium-east", aliases: ["bleacher stairs"] },
  "venue-offices": { label: "Venue Staff Office", zone: "broadway-2" },
  "breakout-5": { label: "Breakout #5", zone: "food-court" },
  "east-room": { label: "Luggage Room", zone: "east-lobby", aliases: ["bag check"] },
  "stair-43": { label: "Stairs near Food", zone: "food-court" },
  "box-office": { zone: "box-office" },
  "east-restroom": { label: "East Restrooms", zone: "box-office", aliases: ["restrooms", "bathroom"] },
  theater: { zone: "theater" },
  "theater-annex": { label: "Theater Restrooms", zone: "theater", aliases: ["restrooms", "bathroom"] },
  "stair-m5": { label: "Mezzanine Stairs (MLH)", zone: "mezz-tables", level: "mezz" },
};

const AMENITY_ALIASES: Record<string, string[]> = {
  Fountain: ["water station", "water fountain", "cups"],
  Food: ["food line", "meals"],
  "Luggage storage": ["bag check", "luggage"],
  "Hardware + merch": ["hardware", "merch", "swag"],
  "3D printers": ["3d printer", "printers"],
  "Claude's Corner": ["claude corner", "anthropic corner"],
};

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const dist = (a: XZ, b: XZ) => Math.hypot(a.x - b.x, a.z - b.z);

export function polylineLength(points: XZ[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
  return total;
}

const centroid = (poly: XZ[]): XZ => ({
  x: poly.reduce((s, p) => s + p.x, 0) / poly.length,
  z: poly.reduce((s, p) => s + p.z, 0) / poly.length,
});

const round2 = (p: XZ): XZ => ({ x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100 });

const zoneByKey = new Map(ZONES.map((z) => [z.key, z]));

export function getZone(key: string): ZoneDef {
  const zone = zoneByKey.get(key);
  if (!zone) throw new Error(`Unknown zone key: ${key}`);
  return zone;
}

/** Nearest zone center on the same level. */
export function nearestZoneKey(at: XZ, level: VenueLevel): string {
  let best = ZONES[0].key;
  let bestD = Infinity;
  for (const zone of ZONES) {
    if (zone.level !== level) continue;
    const d = dist(at, zone.center);
    if (d < bestD) {
      bestD = d;
      best = zone.key;
    }
  }
  return best;
}

/** Polyline for an edge (zone center -> via points -> zone center) and its routing cost. */
export function edgeGeometry(def: EdgeDef): { path: XZ[]; distance: number } {
  const path = [getZone(def.a).center, ...(def.via ?? []), getZone(def.b).center];
  const length = polylineLength(path);
  const distance = Math.round((length + (def.kind === "stairs" ? STAIR_PENALTY_M : 0)) * 10) / 10;
  return { path, distance };
}

/**
 * Every place a caller can name, mapped to a zone: 304 hacker tables, sponsor
 * booths, amenities, named rooms, area labels, entrances, and the zones themselves.
 */
export function buildLocations(): LocationDef[] {
  const out: LocationDef[] = [];
  const seenLabels = new Set<string>();
  const push = (loc: LocationDef) => {
    seenLabels.add(loc.label.toLowerCase());
    out.push({ ...loc, at: round2(loc.at) });
  };

  for (const zone of ZONES) {
    push({ key: `zone:${zone.key}`, label: zone.name, kind: "zone", level: zone.level, at: zone.center, zoneKey: zone.key, aliases: zone.aliases });
  }

  for (const t of venue.hackerTables) {
    push({
      key: `table:${t.n}`,
      label: `Table ${t.n}`,
      kind: "table",
      level: t.level,
      at: t.at,
      zoneKey: nearestZoneKey(t.at, t.level),
      aliases: [`table ${t.n}`, `table number ${t.n}`],
    });
  }

  const sponsorNameCount = new Map<string, number>();
  for (const s of venue.sponsors) sponsorNameCount.set(s.name, (sponsorNameCount.get(s.name) ?? 0) + 1);
  for (const s of venue.sponsors) {
    const zoneKey = nearestZoneKey(s.at, s.level);
    const base = s.name === "Mentor tables" ? "Mentor Tables" : `${s.name} booth`;
    // Two booths share a name (Creao, Capital One): disambiguate with the zone.
    const zoneShort = getZone(zoneKey).name.split(" (")[0];
    const label = (sponsorNameCount.get(s.name) ?? 0) > 1 ? `${base} (${zoneShort})` : base;
    push({
      key: `booth:${s.n}`,
      label,
      kind: "booth",
      level: s.level,
      at: s.at,
      zoneKey,
      aliases: [s.name.toLowerCase(), `${s.name.toLowerCase()} booth`, `booth ${s.n}`],
    });
  }

  for (const a of venue.amenities) {
    push({
      key: `amenity:${slug(a.label)}`,
      label: a.label,
      kind: "amenity",
      level: a.level,
      at: a.at,
      zoneKey: nearestZoneKey(a.at, a.level),
      aliases: AMENITY_ALIASES[a.label] ?? [],
    });
  }

  for (const room of venue.rooms) {
    const meta = ROOMS[room.id];
    if (!meta) continue;
    const label = meta.label ?? room.label ?? room.id;
    push({
      key: `room:${room.id}`,
      label,
      kind: "room",
      level: meta.level ?? "main",
      at: centroid(room.poly),
      zoneKey: meta.zone,
      aliases: meta.aliases ?? [],
    });
  }

  for (const e of venue.entrances) {
    const at = { x: (e.a.x + e.b.x) / 2, z: (e.a.z + e.b.z) / 2 };
    const label = e.id.startsWith("loading-doors-") ? `${e.label} ${e.id.endsWith("north") ? "North" : "South"}` : e.label;
    push({ key: `entrance:${e.id}`, label, kind: "entrance", level: "main", at, zoneKey: nearestZoneKey(at, "main"), aliases: [] });
  }

  // Floor labels last; skip ones that duplicate a room/amenity label.
  for (const l of venue.labels) {
    if (seenLabels.has(l.label.toLowerCase())) continue;
    push({ key: `area:${slug(l.label)}`, label: l.label, kind: "area", level: "main", at: l.at, zoneKey: nearestZoneKey(l.at, "main"), aliases: [] });
  }

  return out;
}
