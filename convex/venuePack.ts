// A loaded Venue Pack (see lib/venuePack.ts). scripts/venue-load.ts validates and
// compiles the pack, then calls `load` to replace the venue on THIS deployment.
// No venueMeta row = the built-in Cal Hacks venue from seed.ts.
import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import type { Id, TableNames } from "./_generated/dataModel";
import { edgeKind, level, locationKind, point, staffRole, staffStatus, venueMetaFields } from "./lib/validators";

// Children before parents so references never dangle mid-reset.
const VENUE_TABLES: TableNames[] = [
  "assignments",
  "incidents",
  "staff",
  "locations",
  "edges",
  "zones",
  "venueMeta",
  "retrievals",
  "bitdeerCalls",
];

/** Replace the whole venue (and its incidents) with a compiled pack. */
export const load = internalMutation({
  args: {
    meta: v.object(venueMetaFields),
    zones: v.array(v.object({ key: v.string(), name: v.string(), level, center: point, aliases: v.array(v.string()) })),
    edges: v.array(
      v.object({
        a: v.string(),
        b: v.string(),
        kind: edgeKind,
        via: v.optional(v.array(point)),
        distance: v.number(),
        path: v.array(point),
      }),
    ),
    locations: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        kind: locationKind,
        level,
        at: point,
        zoneKey: v.string(),
        aliases: v.array(v.string()),
      }),
    ),
    staff: v.array(
      v.object({ name: v.string(), role: staffRole, status: staffStatus, zoneKey: v.string(), phone: v.optional(v.string()) }),
    ),
  },
  returns: v.object({ zones: v.number(), edges: v.number(), locations: v.number(), staff: v.number() }),
  handler: async (ctx, { meta, zones, edges, locations, staff }) => {
    for (const table of VENUE_TABLES) {
      for (const doc of await ctx.db.query(table).collect()) await ctx.db.delete(table, doc._id);
    }

    const zoneIds = new Map<string, Id<"zones">>();
    for (const z of zones) zoneIds.set(z.key, await ctx.db.insert("zones", z));
    const zoneId = (key: string) => {
      const id = zoneIds.get(key);
      if (!id) throw new Error(`Unknown zone key: ${key}`);
      return id;
    };
    for (const e of edges) {
      await ctx.db.insert("edges", { from: zoneId(e.a), to: zoneId(e.b), kind: e.kind, distance: e.distance, path: e.path, blocked: false });
    }
    for (const l of locations) {
      await ctx.db.insert("locations", {
        key: l.key,
        label: l.label,
        kind: l.kind,
        level: l.level,
        at: l.at,
        zoneId: zoneId(l.zoneKey),
        aliases: l.aliases,
        searchText: [l.label, ...l.aliases].join(" ").toLowerCase(),
      });
    }
    for (const s of staff) {
      await ctx.db.insert("staff", { name: s.name, role: s.role, status: s.status, zoneId: zoneId(s.zoneKey), ...(s.phone ? { phone: s.phone } : {}) });
    }
    await ctx.db.insert("venueMeta", { ...meta, loadedAt: Date.now() });
    return { zones: zones.length, edges: edges.length, locations: locations.length, staff: staff.length };
  },
});

/** Venue metadata for the UI (3D renderer, floor names). Null = built-in Cal Hacks venue. */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const meta = await ctx.db.query("venueMeta").first();
    if (!meta) return null;
    const { operatorPasscode, knowledge, ...rest } = meta;
    return { ...rest, hasPasscode: operatorPasscode !== undefined, factCount: knowledge.length };
  },
});

/** true/false when the loaded pack sets a passcode; null = no pack passcode (use the app default). */
export const checkPasscode = query({
  args: { passcode: v.string() },
  returns: v.union(v.boolean(), v.null()),
  handler: async (ctx, { passcode }) => {
    const meta = await ctx.db.query("venueMeta").first();
    return meta?.operatorPasscode === undefined ? null : meta.operatorPasscode === passcode;
  },
});

/** Event facts for venue_search's keyword fallback. Null = use agent/event-kb.json. */
export const knowledge = internalQuery({
  args: {},
  handler: async (ctx) => (await ctx.db.query("venueMeta").first())?.knowledge ?? null,
});

/** What the voice webhooks need to phrase fallbacks. Null = Cal Hacks defaults. */
export const agentContext = internalQuery({
  args: {},
  returns: v.union(v.null(), v.object({ eventName: v.string(), helpDeskKey: v.optional(v.string()), helpDeskLabel: v.optional(v.string()) })),
  handler: async (ctx) => {
    const meta = await ctx.db.query("venueMeta").first();
    if (!meta) return null;
    const key = meta.helpDeskKey;
    const desk = key
      ? await ctx.db
          .query("locations")
          .withIndex("by_key", (q) => q.eq("key", key))
          .unique()
      : null;
    return { eventName: meta.eventName, helpDeskKey: desk?.key, helpDeskLabel: desk?.label };
  },
});
