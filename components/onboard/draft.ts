// Pure helpers for the /onboard wizard: the editable draft, an optional venue map taken from a
// pack file, fact parsing for the Bitdeer extraction, and draft -> Venue Pack. Without a map the
// whole venue is one area: dispatch then picks by role and workload, not walking distance.
import {
  LOCATION_KINDS,
  STAFF_ROLES,
  VENUE_PACK_FORMAT,
  ZONE_KINDS,
  shapePolygon,
  slugify,
  type VenuePack,
  type VenuePackInput,
} from "../../convex/lib/venuePack";

export type ZoneKind = (typeof ZONE_KINDS)[number];
export type PlaceKind = (typeof LOCATION_KINDS)[number];
export type StaffRoleName = (typeof STAFF_ROLES)[number];

/** Rectangle zone drawn on the plan; x/z is the center, meters. */
export type DraftZone = { id: string; name: string; floor: string; x: number; z: number; w: number; d: number; height: number; kind: ZoneKind };
/** `key`: the pack location id when imported from a pack (kept on export). */
export type DraftPlace = { id: string; name: string; kind: PlaceKind; floor: string; x: number; z: number; key?: string };
export type DraftEdge = { from: string; to: string; kind: "walk" | "stairs" };
export type DraftFact = { id: string; title: string; text: string; source?: string };
/** startZone: an area id from the map, or "" (the first area). */
export type DraftStaff = { name: string; role: StaffRoleName; startZone: string; status: "available" | "off_duty" };

export const ROLE_SHORT: Record<StaffRoleName, string> = {
  facilities: "Facilities",
  network: "Network",
  supplies: "Supplies",
  guest_services: "Guest services",
  ops_lead: "Ops lead",
};

/** Plain-language role names for the staff step. */
export const ROLE_LABEL: Record<StaffRoleName, string> = {
  facilities: "Facilities (power, tables, lights)",
  network: "Network (wifi, ethernet)",
  supplies: "Supplies (water, food)",
  guest_services: "Guest services (lost & found)",
  ops_lead: "Ops lead (emergencies, blocked paths)",
};

export type Draft = {
  /** helpDesk: a draft place id, "zone:<zone id>", or "" for none. city/timezone only survive an import. */
  event: { name: string; venueName: string; helpDesk: string; city?: string; timezone?: string };
  floors: { id: string; name: string; elevation: number }[];
  passcode: string;
  /** Plan size in meters; the uploaded image (kept in the browser only) is stretched to it. */
  plan: { widthM: number; heightM: number };
  zones: DraftZone[];
  places: DraftPlace[];
  /** Stairs between floors and walkways between zones that do not touch. Touching zones connect automatically. */
  extraEdges: DraftEdge[];
  facts: DraftFact[];
  staff: DraftStaff[];
};

export const EMPTY_DRAFT: Draft = {
  event: { name: "", venueName: "", helpDesk: "" },
  floors: [{ id: "ground", name: "Ground floor", elevation: 0 }],
  passcode: "",
  plan: { widthM: 60, heightM: 40 },
  zones: [],
  places: [],
  extraEdges: [],
  facts: [],
  staff: [],
};

/** Id not yet in `taken`: "lobby", "lobby-2", ... */
export function uniqueId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const root = base || "item";
  if (!used.has(root)) return root;
  for (let i = 2; ; i++) if (!used.has(`${root}-${i}`)) return `${root}-${i}`;
}

const inside = (z: DraftZone, x: number, zz: number) => Math.abs(x - z.x) <= z.w / 2 && Math.abs(zz - z.z) <= z.d / 2;

/** The zone a place belongs to: the smallest zone containing it on its floor, else the nearest on its floor. */
export function zoneForPlace(place: Pick<DraftPlace, "floor" | "x" | "z">, zones: DraftZone[]): DraftZone | undefined {
  const sameFloor = zones.filter((z) => z.floor === place.floor);
  const containing = sameFloor.filter((z) => inside(z, place.x, place.z)).sort((a, b) => a.w * a.d - b.w * b.d);
  if (containing[0]) return containing[0];
  return [...sameFloor].sort((a, b) => Math.hypot(a.x - place.x, a.z - place.z) - Math.hypot(b.x - place.x, b.z - place.z))[0];
}

/** Every walking connection: the drawn extras plus one per pair of touching zones on a floor. */
export const connections = (draft: Pick<Draft, "zones" | "extraEdges">): DraftEdge[] => [
  ...draft.extraEdges,
  ...suggestEdges(draft.zones, draft.extraEdges),
];

/** Walk edges between zones on the same floor whose rectangles touch or overlap (gap <= `gap` m). */
export function suggestEdges(zones: DraftZone[], existing: DraftEdge[], gap = 0.5): DraftEdge[] {
  const has = (a: string, b: string) => existing.some((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a));
  const out: DraftEdge[] = [];
  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      const [a, b] = [zones[i], zones[j]];
      if (a.floor !== b.floor || has(a.id, b.id)) continue;
      const dx = Math.abs(a.x - b.x) - (a.w + b.w) / 2;
      const dz = Math.abs(a.z - b.z) - (a.d + b.d) / 2;
      if (dx <= gap && dz <= gap) out.push({ from: a.id, to: b.id, kind: "walk" });
    }
  }
  return out;
}

/** Facts from a model reply: a JSON array of {title, text}, possibly inside a ``` fence or prose. */
export function parseFactsReply(reply: string, source?: string): DraftFact[] {
  const start = reply.indexOf("[");
  const end = reply.lastIndexOf("]");
  if (start < 0 || end <= start) throw new Error("The model reply did not contain a JSON list of facts.");
  let rows: unknown;
  try {
    rows = JSON.parse(reply.slice(start, end + 1));
  } catch {
    throw new Error("The model reply was not valid JSON.");
  }
  if (!Array.isArray(rows)) throw new Error("The model reply was not a list.");
  const facts: DraftFact[] = [];
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    if (typeof r?.title !== "string" || typeof r?.text !== "string" || !r.title.trim() || !r.text.trim()) continue;
    const id = uniqueId(slugify(r.title).slice(0, 40), facts.map((f) => f.id));
    facts.push({ id, title: r.title.trim(), text: r.text.trim(), ...(source ? { source } : {}) });
  }
  return facts;
}

const placeKey = (p: DraftPlace, taken: string[]) => {
  if (p.key && !taken.includes(p.key)) return p.key;
  const table = p.kind === "table" ? /(\d+)\s*$/.exec(p.name)?.[1] : undefined;
  return uniqueId(table ? `table:${Number(table)}` : `${p.kind}:${slugify(p.name) || "place"}`, taken);
};

/** The one area used when no venue map was added. */
export function defaultArea(draft: Draft): DraftZone {
  return { id: "venue", name: draft.event.venueName.trim() || "Venue", floor: draft.floors[0].id, x: 20, z: 15, w: 40, d: 30, height: 4, kind: "hall" };
}

/** The draft as a Venue Pack (validate it with parseVenuePack before using it). */
export function draftToPack(input: Draft): VenuePackInput {
  const draft = input.zones.length ? input : { ...input, floors: input.floors.slice(0, 1), zones: [defaultArea(input)], places: [], extraEdges: [] };
  const firstZone = draft.zones[0].id;
  const zoneIds = new Set(draft.zones.map((z) => z.id));
  const keys: string[] = [];
  const keyOf = new Map<string, string>(); // draft place id -> pack location id
  const locations = draft.places.flatMap((p) => {
    const zone = zoneForPlace(p, draft.zones);
    if (!zone) return [];
    const id = placeKey(p, keys);
    keys.push(id);
    keyOf.set(p.id, id);
    return [{ id, name: p.name, kind: p.kind, at: { x: round(p.x), z: round(p.z) }, zone: zone.id, floor: p.floor, aliases: [] }];
  });
  const desk = draft.event.helpDesk;
  const helpDesk = desk.startsWith("zone:") ? desk : keyOf.get(desk);
  return {
    format: VENUE_PACK_FORMAT,
    version: 1,
    event: {
      name: draft.event.name.trim(),
      venueName: draft.event.venueName.trim(),
      ...(draft.event.city ? { city: draft.event.city } : {}),
      timezone: draft.event.timezone ?? "America/Los_Angeles",
      ...(helpDesk ? { helpDesk } : {}),
      keyterms: [],
    },
    floors: draft.floors,
    zones: draft.zones.map((z) => ({
      id: z.id,
      name: z.name,
      floor: z.floor,
      shape: { type: "rect" as const, center: { x: round(z.x), z: round(z.z) }, width: round(z.w), depth: round(z.d), rotationDeg: 0 },
      height: z.height,
      kind: z.kind,
      aliases: [],
    })),
    edges: connections(draft).map((e) => ({ from: e.from, to: e.to, kind: e.kind, via: [] })),
    locations,
    staff: draft.staff
      .filter((s) => s.name.trim())
      .map((s) => ({ ...s, name: s.name.trim(), startZone: zoneIds.has(s.startZone) ? s.startZone : firstZone })),
    knowledge: draft.facts.map((f) => ({ id: f.id, title: f.title, text: f.text, ...(f.source ? { source: f.source } : {}) })),
    ...(draft.passcode.trim() ? { operatorPasscode: draft.passcode.trim() } : {}),
    geometry: { notes: draft.zones === input.zones ? "Made with the PeopleOS /onboard wizard from a map file." : "Made with the PeopleOS /onboard wizard. No map: the venue is one area." },
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** A validated pack back into an editable draft (polygon zones become their bounding boxes). */
export function packToDraft(pack: VenuePack): Draft {
  const zones: DraftZone[] = pack.zones.map((z) => {
    const poly = shapePolygon(z.shape);
    const xs = poly.map((p) => p.x);
    const zs = poly.map((p) => p.z);
    const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    return { id: z.id, name: z.name, floor: z.floor, x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, w: maxX - minX, d: maxZ - minZ, height: z.height, kind: z.kind };
  });
  const places: DraftPlace[] = pack.locations.map((l, i) => ({
    id: `p${i + 1}`,
    name: l.name,
    kind: l.kind,
    floor: l.floor ?? pack.zones.find((z) => z.id === l.zone)?.floor ?? pack.floors[0].id,
    x: l.at.x,
    z: l.at.z,
    key: l.id,
  }));
  // Shift everything so the plan starts at (0, 0) with a 4 m margin.
  const all = [...zones.flatMap((z) => [{ x: z.x - z.w / 2, z: z.z - z.d / 2 }, { x: z.x + z.w / 2, z: z.z + z.d / 2 }]), ...places];
  const [minX, minZ] = [Math.min(...all.map((p) => p.x)) - 4, Math.min(...all.map((p) => p.z)) - 4];
  const [maxX, maxZ] = [Math.max(...all.map((p) => p.x)) + 4, Math.max(...all.map((p) => p.z)) + 4];
  for (const item of [...zones, ...places]) {
    item.x = round(item.x - minX);
    item.z = round(item.z - minZ);
  }
  const deskIndex = pack.locations.findIndex((l) => l.id === pack.event.helpDesk);
  // Keep only the connections the editor would not draw by itself.
  const auto = suggestEdges(zones, []);
  const isAuto = (e: DraftEdge) => e.kind === "walk" && auto.some((a) => (a.from === e.from && a.to === e.to) || (a.from === e.to && a.to === e.from));
  return {
    event: {
      name: pack.event.name,
      venueName: pack.event.venueName,
      ...(pack.event.city ? { city: pack.event.city } : {}),
      timezone: pack.event.timezone,
      helpDesk: deskIndex >= 0 ? places[deskIndex].id : pack.event.helpDesk?.startsWith("zone:") ? pack.event.helpDesk : "",
    },
    floors: pack.floors,
    passcode: pack.operatorPasscode ?? "",
    plan: { widthM: round(maxX - minX), heightM: round(maxZ - minZ) },
    zones,
    places,
    extraEdges: pack.edges.map((e) => ({ from: e.from, to: e.to, kind: e.kind })).filter((e) => !isAuto(e)),
    facts: pack.knowledge.map((k) => ({ id: k.id, title: k.title, text: k.text, ...(k.source ? { source: k.source } : {}) })),
    staff: pack.staff.map((s) => ({ name: s.name, role: s.role, startZone: s.startZone, status: s.status })),
  };
}

/** Take only the venue map (floors, areas, places, links, help desk) from a pack file. */
export function withMap(draft: Draft, pack: VenuePack): Draft {
  const map = packToDraft(pack);
  return {
    ...draft,
    event: {
      ...draft.event,
      name: draft.event.name || map.event.name,
      venueName: draft.event.venueName || map.event.venueName,
      helpDesk: map.event.helpDesk,
    },
    floors: map.floors,
    plan: map.plan,
    zones: map.zones,
    places: map.places,
    extraEdges: map.extraEdges,
  };
}

/** Back to "no map": the whole venue is one area. */
export const withoutMap = (draft: Draft): Draft => ({
  ...draft,
  event: { ...draft.event, helpDesk: "" },
  floors: EMPTY_DRAFT.floors,
  plan: EMPTY_DRAFT.plan,
  zones: [],
  places: [],
  extraEdges: [],
  staff: draft.staff.map((s) => ({ ...s, startZone: "" })),
});
