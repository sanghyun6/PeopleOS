import { describe, expect, it } from "vitest";
import { buildCalHacksPack } from "./calhacks-pack";
import { EDGES, ZONES, buildLocations, edgeGeometry } from "../convex/lib/zoning";
import { SEED_STAFF } from "../convex/lib/seedStaff";
import { compileVenuePack, parseVenuePack, unreachableZones } from "../convex/lib/venuePack";

const parsed = parseVenuePack(JSON.parse(JSON.stringify(buildCalHacksPack())));
if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
const compiled = compileVenuePack(parsed.pack);

describe("Cal Hacks as a Venue Pack", () => {
  it("validates and is fully connected", () => {
    expect(unreachableZones(parsed.pack)).toEqual([]);
  });

  it("reproduces the seeded zones", () => {
    expect(compiled.zones).toEqual(ZONES);
  });

  it("reproduces edge paths and routing distances (stair penalty included)", () => {
    expect(compiled.edges.map(({ a, b, kind, distance, path }) => ({ a, b, kind, distance, path }))).toEqual(
      EDGES.map((e) => ({ a: e.a, b: e.b, kind: e.kind, ...edgeGeometry(e) })),
    );
  });

  it("reproduces the location vocabulary exactly", () => {
    const key = (l: { key: string }) => l.key;
    expect([...compiled.locations].sort((a, b) => key(a).localeCompare(key(b)))).toEqual(
      [...buildLocations()].sort((a, b) => key(a).localeCompare(key(b))),
    );
  });

  it("reproduces the seed staff and keeps the detailed 3D model", () => {
    expect(compiled.staff.map((s) => [s.name, s.role, s.zoneKey, s.status])).toEqual(
      SEED_STAFF.map((s) => [s.name, s.role, s.zone, s.status ?? "available"]),
    );
    expect(compiled.meta.detailedGeometry).toBe("palace-of-fine-arts");
    expect(compiled.meta.floors.map((f) => [f.level, f.elevation])).toEqual([["main", 0], ["mezz", 5]]);
  });
});
