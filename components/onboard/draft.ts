// Pure helpers for the /onboard wizard: the editable draft, CSV staff parsing, zone
// adjacency suggestions, fact parsing for the Bitdeer extraction, and draft -> Venue Pack.
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
export type DraftStaff = { name: string; role: StaffRoleName; startZone: string; status: "available" | "off_duty"; phone?: string };

export type Draft = {
  /** helpDesk: a draft place id, "zone:<zone id>", or "" for none. */
  event: { name: string; venueName: string; city: string; timezone: string; helpDesk: string };
  floors: { id: string; name: string; elevation: number }[];
  passcode: string;
  /** Plan size in meters; the uploaded image (kept in the browser only) is stretched to it. */
  plan: { widthM: number; heightM: number };
  zones: DraftZone[];
  places: DraftPlace[];
  edges: DraftEdge[];
  facts: DraftFact[];
  staffCsv: string;
};

export const EMPTY_DRAFT: Draft = {
  event: { name: "", venueName: "", city: "", timezone: "America/Los_Angeles", helpDesk: "" },
  floors: [{ id: "ground", name: "Ground floor", elevation: 0 }],
  passcode: "",
  plan: { widthM: 60, heightM: 40 },
  zones: [],
  places: [],
  edges: [],
  facts: [],
  staffCsv: "",
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

/** Walk edges between zones on the same floor whose rectangles touch or overlap (gap <= `gap` m). */
export function suggestEdges(zones: DraftZone[], existing: DraftEdge[], gap = 1.5): DraftEdge[] {
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

const ROLE_ALIASES: Record<string, StaffRoleName> = {
  network: "network",
  it: "network",
  wifi: "network",
  facilities: "facilities",
  facility: "facilities",
  maintenance: "facilities",
  supplies: "supplies",
  supply: "supplies",
  catering: "supplies",
  guest_services: "guest_services",
  guest: "guest_services",
  guest_service: "guest_services",
  ops_lead: "ops_lead",
  ops: "ops_lead",
  lead: "ops_lead",
  operator: "ops_lead",
};

/** Minimal CSV line split: commas, with "double quoted" fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(field.trim());
      field = "";
    } else field += c;
  }
  out.push(field.trim());
  return out;
}

/**
 * `name,role,start_zone[,status][,phone]` per line (header row optional). Zones match by id or
 * name. Returns the rows that parsed and one readable error per bad line.
 */
export function parseStaffCsv(text: string, zones: Pick<DraftZone, "id" | "name">[]): { staff: DraftStaff[]; errors: string[] } {
  const staff: DraftStaff[] = [];
  const errors: string[] = [];
  const zoneFor = (s: string) => {
    const k = s.trim().toLowerCase();
    return zones.find((z) => z.id === k || z.name.toLowerCase() === k || slugify(z.name) === slugify(k));
  };
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const cols = splitCsvLine(line);
    if (i === 0 && cols[0]?.toLowerCase() === "name") return; // header
    const [name, roleRaw = "", zoneRaw = "", statusRaw = "", phone = ""] = cols;
    const where = `line ${i + 1}`;
    if (!name) return void errors.push(`${where}: missing name`);
    const role = ROLE_ALIASES[roleRaw.toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "")];
    if (!role) return void errors.push(`${where}: unknown role "${roleRaw}" (use ${STAFF_ROLES.join(", ")})`);
    const zone = zoneFor(zoneRaw);
    if (!zone) return void errors.push(`${where}: unknown start zone "${zoneRaw}"`);
    const off = /^off/i.test(statusRaw.trim());
    staff.push({ name, role, startZone: zone.id, status: off ? "off_duty" : "available", ...(phone ? { phone } : {}) });
  });
  return { staff, errors };
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

/** Visible text of an HTML page (scripts, styles and tags removed), whitespace collapsed. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n[\s]*/g, "\n")
    .trim();
}

const placeKey = (p: DraftPlace, taken: string[]) => {
  if (p.key && !taken.includes(p.key)) return p.key;
  const table = p.kind === "table" ? /(\d+)\s*$/.exec(p.name)?.[1] : undefined;
  return uniqueId(table ? `table:${Number(table)}` : `${p.kind}:${slugify(p.name) || "place"}`, taken);
};

/** The draft as a Venue Pack (validate it with parseVenuePack before using it). */
export function draftToPack(draft: Draft, staff: DraftStaff[]): VenuePackInput {
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
      ...(draft.event.city.trim() ? { city: draft.event.city.trim() } : {}),
      timezone: draft.event.timezone,
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
    edges: draft.edges.map((e) => ({ from: e.from, to: e.to, kind: e.kind, via: [] })),
    locations,
    staff,
    knowledge: draft.facts.map((f) => ({ id: f.id, title: f.title, text: f.text, ...(f.source ? { source: f.source } : {}) })),
    ...(draft.passcode.trim() ? { operatorPasscode: draft.passcode.trim() } : {}),
    geometry: { notes: "Made with the PeopleOS /onboard wizard. Zones are rectangles drawn over the floor plan." },
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** A validated pack back into an editable draft (polygon zones become their bounding boxes). */
export function packToDraft(pack: VenuePack): { draft: Draft; staffCsv: string } {
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
  const staffCsv = ["name,role,start_zone,status,phone", ...pack.staff.map((s) => [s.name.includes(",") ? `"${s.name}"` : s.name, s.role, s.startZone, s.status, s.phone ?? ""].join(","))].join("\n");
  return {
    staffCsv,
    draft: {
      event: {
        name: pack.event.name,
        venueName: pack.event.venueName,
        city: pack.event.city ?? "",
        timezone: pack.event.timezone,
        helpDesk: deskIndex >= 0 ? places[deskIndex].id : pack.event.helpDesk?.startsWith("zone:") ? pack.event.helpDesk : "",
      },
      floors: pack.floors,
      passcode: pack.operatorPasscode ?? "",
      plan: { widthM: round(maxX - minX), heightM: round(maxZ - minZ) },
      zones,
      places,
      edges: pack.edges.map((e) => ({ from: e.from, to: e.to, kind: e.kind })),
      facts: pack.knowledge.map((k) => ({ id: k.id, title: k.title, text: k.text, ...(k.source ? { source: k.source } : {}) })),
      staffCsv,
    },
  };
}
