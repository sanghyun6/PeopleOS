// Fixed location vocabulary (tables 1-304, sponsor booths, amenities, rooms, areas).
import { v } from "convex/values";
import { internalQuery, query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { normalizeLocationText } from "./lib/locationText";
import { directionsBetween, directionsMessage } from "./lib/directions";
import { locationKind, type LocationKind } from "./lib/validators";
import { sharesWord } from "./lib/matching";

// When several entries match equally, the most specific place wins.
const KIND_RANK: Record<LocationKind, number> = {
  table: 0,
  booth: 1,
  amenity: 2,
  room: 3,
  entrance: 4,
  area: 5,
  zone: 6,
};

const normalize = normalizeLocationText;

/** Pick one match: unique, or all in the same zone (then the most specific one). */
function pickOne(matches: Doc<"locations">[]): Doc<"locations"> | null {
  if (matches.length === 0) return null;
  const zones = new Set(matches.map((m) => m.zoneId));
  if (zones.size > 1) return null; // ambiguous: e.g. "atrium" spans two zones
  return [...matches].sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind])[0];
}

/**
 * Resolve what the caller said ("Table 142", "the Cartesia booth", "zone:box-office")
 * to exactly one location. Order: exact key -> table number -> label -> alias -> search.
 * Returns null when ambiguous or unknown so the agent asks again.
 */
export async function resolveLocation(ctx: QueryCtx, text: string): Promise<Doc<"locations"> | null> {
  const raw = text.trim();
  if (!raw) return null;
  const byKey = (key: string) =>
    ctx.db
      .query("locations")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();

  // 1. Location keys such as "table:142", "booth:11", "zone:box-office".
  if (/^[a-z]+:[a-z0-9-]+$/i.test(raw)) {
    const hit = await byKey(raw.toLowerCase());
    if (hit) return hit;
  }

  // 2. Table numbers: "Table 142", "table number 142", "t-142", "#142".
  const table = raw.match(/\b(?:table|t)\s*(?:number|no\.?|#|-)?\s*(\d{1,3})\b/i) ?? raw.match(/^#?(\d{1,3})$/);
  if (table) {
    const hit = await byKey(`table:${Number(table[1])}`);
    if (hit) return hit;
  }

  // 3/4. Exact label, then exact alias (~400 rows, small enough to scan).
  const wanted = normalize(raw);
  const all = await ctx.db.query("locations").take(1000);
  const byLabel = pickOne(all.filter((l) => normalize(l.label) === wanted));
  if (byLabel) return byLabel;
  const byAlias = pickOne(all.filter((l) => l.aliases.some((a) => normalize(a) === wanted)));
  if (byAlias) return byAlias;
  const booth = pickOne(all.filter((l) => l.kind === "booth" && normalize(l.label).replace(/ booth.*$/, "") === wanted.replace(/ booth$/, "")));
  if (booth) return booth;

  // 5. Full-text search as a last resort; only trust it when the top hit is unambiguous.
  const hits = await ctx.db
    .query("locations")
    .withSearchIndex("search_text", (q) => q.search("searchText", wanted))
    .take(3);
  // A hit that shares only a number with the query ("Gate 3" vs "Table 3") is not a match.
  const trusted = hits.filter((h) => sharesWord(wanted, h.searchText));
  if (trusted.length > 0) return trusted.length === 1 || trusted[0].zoneId === trusted[1].zoneId ? trusted[0] : null;

  // 6. A venue loaded without a map is one area: whatever the caller named is in it.
  const zones = await ctx.db.query("zones").take(2);
  if (zones.length !== 1) return null;
  return await byKey(`zone:${zones[0].key}`);
}

export const resolve = internalQuery({
  args: { text: v.string() },
  handler: async (ctx, { text }) => resolveLocation(ctx, text),
});

/** Vocabulary listing, e.g. for the agent prompt or an ops search box. */
export const list = query({
  args: { kind: v.optional(locationKind) },
  handler: async (ctx, { kind }) => {
    const all = await ctx.db.query("locations").take(1000);
    return kind ? all.filter((l) => l.kind === kind) : all;
  },
});

export type DirectionsOutcome =
  | { outcome: "directions" | "no_route"; message: string }
  | { outcome: "unknown_location"; message: string };

/** Spoken walking directions between two caller-said places (blocked edges are avoided). */
export const directions = internalQuery({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }): Promise<DirectionsOutcome> => {
    const [start, end] = [await resolveLocation(ctx, from), await resolveLocation(ctx, to)];
    if (!start || !end) {
      const missing = [!start && `"${from}"`, !end && `"${to}"`].filter(Boolean).join(" and ");
      return {
        outcome: "unknown_location",
        message: `I could not match ${missing} to a place in the venue. Ask the caller for the nearest table number or booth and try once more.`,
      };
    }
    const zones = await ctx.db.query("zones").collect();
    const edges = await ctx.db.query("edges").collect();
    const route = directionsBetween(
      start.zoneId,
      end.zoneId,
      edges,
      [],
      new Map(zones.map((z) => [z._id as string, z.name])),
      new Map(zones.map((z) => [z._id as string, z.level])),
    );
    if (!route) {
      return {
        outcome: "no_route",
        message: `Paths between ${start.label} and ${end.label} are blocked right now. Tell the caller to ask the nearest staff member.`,
      };
    }
    return { outcome: "directions", message: directionsMessage(start.label, end.label, route) };
  },
});
