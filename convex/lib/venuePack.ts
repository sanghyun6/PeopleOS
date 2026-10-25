// Venue Pack: one JSON file that describes a venue for PeopleOS (floors, zones,
// walking graph, location vocabulary, staff, event knowledge, escalation, passcode).
// Pure: used by scripts/venue-load.ts, scripts/export-venue-pack.ts, the /onboard
// wizard, and tests. `compileVenuePack` turns a pack into the exact rows the
// zones/edges/locations/staff tables hold (same shapes as lib/zoning.ts).
import { z } from "zod";
import type { EdgeDef, LocationDef, ZoneDef } from "./zoning";
import type { StaffRole, StaffStatus } from "./validators";

export const VENUE_PACK_FORMAT = "peopleos.venue-pack";

/** Extra routing cost for stairs (same as lib/zoning.ts STAIR_PENALTY_M). */
export const PACK_STAIR_PENALTY_M = 15;

export const STAFF_ROLES = ["network", "facilities", "supplies", "guest_services", "ops_lead"] as const;
export const ZONE_KINDS = ["hall", "room", "corridor", "stairs", "entrance", "outdoor", "service", "other"] as const;
export const LOCATION_KINDS = ["table", "booth", "amenity", "room", "area", "entrance"] as const;
/** Built-in detailed 3D models. Packs without one get the generic renderer. */
export const DETAILED_GEOMETRY = ["palace-of-fine-arts"] as const;

const xz = z.object({ x: z.number(), z: z.number() });
const slugId = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "use lowercase letters, digits and dashes");
const locationKey = z.string().regex(/^[a-z]+:[a-z0-9-]+$/, 'use "kind:slug", e.g. "table:12" or "booth:acme"');
const text = z.string().trim().min(1);

const zoneShape = z.discriminatedUnion("type", [
  z.object({ type: z.literal("polygon"), points: z.array(xz).min(3) }),
  z.object({
    type: z.literal("rect"),
    center: xz,
    width: z.number().positive(), // along x before rotation
    depth: z.number().positive(), // along z before rotation
    rotationDeg: z.number().default(0),
  }),
]);

export const venuePackSchema = z
  .object({
    format: z.literal(VENUE_PACK_FORMAT),
    version: z.literal(1),
    event: z.object({
      name: text, // "Cal Hacks 13.0"
      venueName: text, // "Palace of Fine Arts"
      city: z.string().optional(),
      timezone: z.string().default("America/Los_Angeles"),
      startsAt: z.string().optional(),
      endsAt: z.string().optional(),
      /** Location id people are sent to for help; also where escalations without a location land. */
      helpDesk: locationKey.optional(),
      /** Speech-recognition hints for the voice agent (venue words callers say). */
      keyterms: z.array(z.string()).default([]),
    }),
    /** 1 or 2 floors. The lowest is stored as level "main", the other as "mezz". */
    floors: z.array(z.object({ id: slugId, name: text, elevation: z.number() })).min(1).max(2),
    /** Building footprint (meters, x/z). Defaults to the bounding box of all zones. */
    outline: z.array(xz).min(3).optional(),
    zones: z
      .array(
        z.object({
          id: slugId,
          name: text,
          floor: slugId,
          shape: zoneShape,
          /** Graph node position for routing; defaults to the shape's centroid. */
          center: xz.optional(),
          /** Wall height in meters for the generic 3D renderer. */
          height: z.number().positive().default(3),
          kind: z.enum(ZONE_KINDS).default("hall"),
          aliases: z.array(z.string()).default([]),
        }),
      )
      .min(1),
    edges: z.array(
      z.object({
        from: slugId,
        to: slugId,
        kind: z.enum(["walk", "stairs"]).default("walk"),
        /** Intermediate points (doors, stairs) so drawn routes do not cut through walls. */
        via: z.array(xz).default([]),
        /** Routing cost in meters. Defaults to the path length (+15 m for stairs). */
        distance: z.number().positive().optional(),
      }),
    ),
    locations: z
      .array(
        z.object({
          id: locationKey,
          name: text,
          kind: z.enum(LOCATION_KINDS),
          at: xz,
          zone: slugId,
          /** Defaults to the zone's floor. */
          floor: slugId.optional(),
          aliases: z.array(z.string()).default([]),
        }),
      )
      .default([]),
    staff: z
      .array(
        z.object({
          name: text,
          role: z.enum(STAFF_ROLES),
          startZone: slugId,
          status: z.enum(["available", "off_duty"]).default("available"),
          phone: z.string().optional(),
        }),
      )
      .min(1),
    /** Facts the voice agent answers event questions from (venue_search). */
    knowledge: z
      .array(z.object({ id: slugId, title: text, text, asOf: z.string().optional(), source: z.string().optional() }))
      .default([]),
    escalation: z
      .object({
        contacts: z.array(
          z.object({ role: z.enum(STAFF_ROLES).optional(), name: z.string().optional(), phone: z.string().optional() }),
        ),
      })
      .optional(),
    /** Operator dashboard passcode. Without one the app's default passcode applies. */
    operatorPasscode: z.string().min(4).optional(),
    geometry: z
      .object({
        /** Use a built-in detailed 3D model instead of drawing zones (Cal Hacks only today). */
        detailed: z.enum(DETAILED_GEOMETRY).optional(),
        source: z.string().optional(),
        notes: z.string().optional(),
      })
      .optional(),
  })
  .superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
    const dupes = (ids: string[], path: string) => {
      const seen = new Set<string>();
      ids.forEach((id, i) => {
        if (seen.has(id)) issue([path, i], `duplicate id "${id}"`);
        seen.add(id);
      });
    };
    dupes(pack.floors.map((f) => f.id), "floors");
    dupes(pack.zones.map((z) => z.id), "zones");
    dupes(pack.locations.map((l) => l.id), "locations");
    dupes(pack.knowledge.map((k) => k.id), "knowledge");

    const floors = new Set(pack.floors.map((f) => f.id));
    const zones = new Set(pack.zones.map((z) => z.id));
    pack.zones.forEach((z, i) => floors.has(z.floor) || issue(["zones", i, "floor"], `unknown floor "${z.floor}"`));
    pack.edges.forEach((e, i) => {
      if (!zones.has(e.from)) issue(["edges", i, "from"], `unknown zone "${e.from}"`);
      if (!zones.has(e.to)) issue(["edges", i, "to"], `unknown zone "${e.to}"`);
      if (e.from === e.to) issue(["edges", i], "an edge must connect two different zones");
    });
    pack.locations.forEach((l, i) => {
      if (!zones.has(l.zone)) issue(["locations", i, "zone"], `unknown zone "${l.zone}"`);
      if (l.floor && !floors.has(l.floor)) issue(["locations", i, "floor"], `unknown floor "${l.floor}"`);
      if (l.id.startsWith("zone:")) issue(["locations", i, "id"], '"zone:" ids are generated from zones');
    });
    pack.staff.forEach((s, i) => zones.has(s.startZone) || issue(["staff", i, "startZone"], `unknown zone "${s.startZone}"`));
    const helpDesk = pack.event.helpDesk;
    if (helpDesk && !pack.locations.some((l) => l.id === helpDesk) && !zones.has(helpDesk.replace(/^zone:/, ""))) {
      issue(["event", "helpDesk"], `unknown location "${helpDesk}"`);
    }
  });

/** What a person writes (defaults optional). */
export type VenuePackInput = z.input<typeof venuePackSchema>;
/** After validation (defaults filled in). */
export type VenuePack = z.output<typeof venuePackSchema>;

export type Level = "main" | "mezz";
export type XZ = { x: number; z: number };

export type CompiledFloor = { level: Level; id: string; name: string; elevation: number };
export type ZoneShapeRow = { key: string; level: Level; polygon: XZ[]; height: number; kind: (typeof ZONE_KINDS)[number] };

/** Stored once per deployment (venueMeta table): what the UI and the agent need beyond the graph. */
export type VenueMeta = {
  eventName: string;
  venueName: string;
  city?: string;
  timezone: string;
  helpDeskKey?: string;
  keyterms: string[];
  floors: CompiledFloor[];
  outline: XZ[];
  zoneShapes: ZoneShapeRow[];
  knowledge: { id: string; title: string; text: string; asOf?: string; source?: string }[];
  escalation: { role?: StaffRole; name?: string; phone?: string }[];
  operatorPasscode?: string;
  detailedGeometry?: (typeof DETAILED_GEOMETRY)[number];
};

export type CompiledEdge = EdgeDef & { distance: number; path: XZ[] };
export type CompiledStaff = { name: string; role: StaffRole; status: StaffStatus; zoneKey: string; phone?: string };

export type CompiledVenue = {
  meta: VenueMeta;
  zones: ZoneDef[];
  edges: CompiledEdge[];
  locations: LocationDef[]; // includes one "zone:<id>" entry per zone, like buildLocations()
  staff: CompiledStaff[];
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (p: XZ): XZ => ({ x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100 });
const dist = (a: XZ, b: XZ) => Math.hypot(a.x - b.x, a.z - b.z);

export function shapePolygon(shape: VenuePack["zones"][number]["shape"]): XZ[] {
  if (shape.type === "polygon") return shape.points;
  const { center, width, depth, rotationDeg } = shape;
  const r = (rotationDeg * Math.PI) / 180;
  const [cos, sin] = [Math.cos(r), Math.sin(r)];
  return [
    [-width / 2, -depth / 2],
    [width / 2, -depth / 2],
    [width / 2, depth / 2],
    [-width / 2, depth / 2],
  ].map(([dx, dz]) => round2({ x: center.x + dx * cos - dz * sin, z: center.z + dx * sin + dz * cos }));
}

export const polygonCentroid = (poly: XZ[]): XZ =>
  round2({ x: poly.reduce((s, p) => s + p.x, 0) / poly.length, z: poly.reduce((s, p) => s + p.z, 0) / poly.length });

export function boundingOutline(polys: XZ[][], pad = 2): XZ[] {
  const pts = polys.flat();
  const minX = Math.min(...pts.map((p) => p.x)) - pad;
  const maxX = Math.max(...pts.map((p) => p.x)) + pad;
  const minZ = Math.min(...pts.map((p) => p.z)) - pad;
  const maxZ = Math.max(...pts.map((p) => p.z)) + pad;
  return [
    { x: minX, z: minZ },
    { x: maxX, z: minZ },
    { x: maxX, z: maxZ },
    { x: minX, z: maxZ },
  ].map(round2);
}

/** Validate unknown JSON. Returns readable "path: message" errors instead of throwing. */
export function parseVenuePack(json: unknown): { ok: true; pack: VenuePack } | { ok: false; errors: string[] } {
  const result = venuePackSchema.safeParse(json);
  if (result.success) return { ok: true, pack: result.data };
  return { ok: false, errors: result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
}

/** Zones no other zone can walk to (dispatch can never reach staff or incidents there). */
export function unreachableZones(pack: VenuePack): string[] {
  if (pack.zones.length === 0) return [];
  const adj = new Map<string, string[]>(pack.zones.map((z) => [z.id, []]));
  for (const e of pack.edges) {
    adj.get(e.from)?.push(e.to);
    adj.get(e.to)?.push(e.from);
  }
  const seen = new Set([pack.zones[0].id]);
  const queue = [pack.zones[0].id];
  while (queue.length) {
    for (const n of adj.get(queue.shift()!) ?? []) {
      if (seen.has(n)) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  return pack.zones.map((z) => z.id).filter((id) => !seen.has(id));
}

/** Pack -> rows for zones/edges/locations/staff plus venue metadata. */
export function compileVenuePack(pack: VenuePack): CompiledVenue {
  const floors: CompiledFloor[] = [...pack.floors]
    .sort((a, b) => a.elevation - b.elevation)
    .map((f, i) => ({ level: i === 0 ? "main" : "mezz", id: f.id, name: f.name, elevation: f.elevation }));
  const levelOf = new Map(floors.map((f) => [f.id, f.level]));
  const level = (floorId: string): Level => levelOf.get(floorId)!;

  const polygons = new Map(pack.zones.map((z) => [z.id, shapePolygon(z.shape)]));
  const zones: ZoneDef[] = pack.zones.map((z) => ({
    key: z.id,
    name: z.name,
    level: level(z.floor),
    center: z.center ?? polygonCentroid(polygons.get(z.id)!),
    aliases: z.aliases,
  }));
  const zoneByKey = new Map(zones.map((z) => [z.key, z]));

  const edges: CompiledEdge[] = pack.edges.map((e) => {
    const path = [zoneByKey.get(e.from)!.center, ...e.via, zoneByKey.get(e.to)!.center];
    let length = 0;
    for (let i = 1; i < path.length; i++) length += dist(path[i - 1], path[i]);
    const distance = e.distance ?? round1(length + (e.kind === "stairs" ? PACK_STAIR_PENALTY_M : 0));
    return { a: e.from, b: e.to, kind: e.kind, ...(e.via.length ? { via: e.via } : {}), distance, path };
  });

  const locations: LocationDef[] = [
    ...zones.map((z) => ({ key: `zone:${z.key}`, label: z.name, kind: "zone" as const, level: z.level, at: round2(z.center), zoneKey: z.key, aliases: z.aliases })),
    ...pack.locations.map((l) => ({
      key: l.id,
      label: l.name,
      kind: l.kind,
      level: l.floor ? level(l.floor) : zoneByKey.get(l.zone)!.level,
      at: round2(l.at),
      zoneKey: l.zone,
      aliases: l.aliases,
    })),
  ];

  const staff: CompiledStaff[] = pack.staff.map((s) => ({
    name: s.name,
    role: s.role,
    status: s.status,
    zoneKey: s.startZone,
    ...(s.phone ? { phone: s.phone } : {}),
  }));

  const meta: VenueMeta = {
    eventName: pack.event.name,
    venueName: pack.event.venueName,
    ...(pack.event.city ? { city: pack.event.city } : {}),
    timezone: pack.event.timezone,
    ...(pack.event.helpDesk ? { helpDeskKey: pack.event.helpDesk } : {}),
    keyterms: pack.event.keyterms,
    floors,
    outline: pack.outline ?? boundingOutline([...polygons.values()]),
    zoneShapes: pack.zones.map((z) => ({ key: z.id, level: level(z.floor), polygon: polygons.get(z.id)!, height: z.height, kind: z.kind })),
    knowledge: pack.knowledge,
    escalation: pack.escalation?.contacts ?? [],
    ...(pack.operatorPasscode ? { operatorPasscode: pack.operatorPasscode } : {}),
    ...(pack.geometry?.detailed ? { detailedGeometry: pack.geometry.detailed } : {}),
  };

  return { meta, zones, edges, locations, staff };
}

/** Floor name for a level ("main floor" / "mezzanine" for Cal Hacks). */
export const floorName = (floors: CompiledFloor[], level: Level) => floors.find((f) => f.level === level)?.name ?? level;

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
