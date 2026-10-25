// Seeds zones, the walking graph, the location vocabulary, and demo staff.
// Run: npx convex run seed:seedAll            (first time)
//      npx convex run seed:seedAll '{"reset":true}'   (wipe everything and reseed)
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Id, TableNames } from "./_generated/dataModel";
import { EDGES, ZONES, buildLocations, edgeGeometry } from "./lib/zoning";
import { SEED_STAFF } from "./lib/seedStaff";

const STAFF = SEED_STAFF;

// Children before parents so references never dangle mid-reset.
// venueMeta too: a reseed returns the deployment to the built-in Cal Hacks venue.
const ALL_TABLES: TableNames[] = ["assignments", "incidents", "staff", "locations", "edges", "zones", "venueMeta"];

export const seedAll = internalMutation({
  args: { reset: v.optional(v.boolean()) },
  returns: v.object({
    zones: v.number(),
    edges: v.number(),
    locations: v.number(),
    staff: v.number(),
  }),
  handler: async (ctx, { reset }) => {
    const alreadySeeded = (await ctx.db.query("zones").first()) !== null;
    if (alreadySeeded && !reset) {
      throw new Error('Already seeded. Run with {"reset": true} to wipe and reseed.');
    }
    if (reset) {
      for (const table of ALL_TABLES) {
        for (const doc of await ctx.db.query(table).collect()) {
          await ctx.db.delete(table, doc._id);
        }
      }
    }

    const zoneIds = new Map<string, Id<"zones">>();
    for (const zone of ZONES) {
      zoneIds.set(
        zone.key,
        await ctx.db.insert("zones", {
          key: zone.key,
          name: zone.name,
          level: zone.level,
          center: zone.center,
          aliases: zone.aliases,
        }),
      );
    }
    const zoneId = (key: string) => {
      const id = zoneIds.get(key);
      if (!id) throw new Error(`Unknown zone key: ${key}`);
      return id;
    };

    for (const edge of EDGES) {
      const { path, distance } = edgeGeometry(edge);
      await ctx.db.insert("edges", {
        from: zoneId(edge.a),
        to: zoneId(edge.b),
        kind: edge.kind,
        distance,
        path,
        blocked: false,
      });
    }

    const locations = buildLocations();
    for (const loc of locations) {
      await ctx.db.insert("locations", {
        key: loc.key,
        label: loc.label,
        kind: loc.kind,
        level: loc.level,
        at: loc.at,
        zoneId: zoneId(loc.zoneKey),
        aliases: loc.aliases,
        searchText: [loc.label, ...loc.aliases].join(" ").toLowerCase(),
      });
    }

    for (const s of STAFF) {
      await ctx.db.insert("staff", {
        name: s.name,
        role: s.role,
        status: s.status ?? "available",
        zoneId: zoneId(s.zone),
      });
    }

    return { zones: ZONES.length, edges: EDGES.length, locations: locations.length, staff: STAFF.length };
  },
});
