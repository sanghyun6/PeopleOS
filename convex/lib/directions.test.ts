import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import { directionsBetween, directionsMessage, walkingTimePhrase } from "./directions";
import { blockZone, edgeId, seededEdges, zoneId } from "./demoVenue.fixture";
import { ZONES } from "./zoning";

const names = new Map<string, string>(ZONES.map((z) => [zoneId(z.key), z.name]));

describe("directionsBetween", () => {
  test("walks Atrium West to Atrium East in one step", () => {
    const d = directionsBetween(zoneId("atrium-west"), zoneId("atrium-east"), seededEdges(), [], names)!;
    expect(d.zones).toEqual([zoneId("atrium-west"), zoneId("atrium-east")]);
    expect(d.steps).toEqual(["Head through Atrium West into Atrium East"]);
    expect(d.blockedDetour).toBe(false);
    expect(d.distanceMeters).toBeGreaterThan(0);
  });

  test("later hops say continue, and stairs say up", () => {
    const d = directionsBetween(zoneId("broadway-3"), zoneId("mezz-north"), seededEdges(), [], names)!;
    expect(d.steps[0]).toMatch(/^Head through Broadway #3 & Gate #6 into /);
    expect(d.steps[1]).toBe("Take the stairs up to Mezzanine Tables");
    expect(d.steps[2]).toBe("Continue into Mezzanine North");
  });

  test("blocked edge ids force a detour", () => {
    const open = directionsBetween(zoneId("broadway-2"), zoneId("atrium-west"), seededEdges(), [], names)!;
    const closed = [edgeId("broadway-1", "broadway-2")];
    const d = directionsBetween(zoneId("broadway-2"), zoneId("atrium-west"), seededEdges(), closed, names)!;
    expect(d.zones).not.toContain(zoneId("broadway-1"));
    expect(d.distanceMeters).toBeGreaterThan(open.distanceMeters);
    expect(d.blockedDetour).toBe(true);
  });

  test("edges already marked blocked count too", () => {
    const d = directionsBetween(zoneId("broadway-2"), zoneId("atrium-west"), seededEdges(blockZone("broadway-1")), [], names)!;
    expect(d.zones).not.toContain(zoneId("broadway-1"));
    expect(d.blockedDetour).toBe(true);
  });

  test("returns null when blockages disconnect the zones", () => {
    expect(directionsBetween(zoneId("theater"), zoneId("stage"), seededEdges(blockZone("theater")), [], names)).toBeNull();
  });

  test("same zone", () => {
    const d = directionsBetween(zoneId("stage"), zoneId("stage"), seededEdges(), [], names)!;
    expect(d).toMatchObject({ zones: [zoneId("stage")], distanceMeters: 0, blockedDetour: false });
  });

  test("parentheticals are not spoken", () => {
    const d = directionsBetween(zoneId("north-hall"), zoneId("broadway-1"), seededEdges(), [], names)!;
    expect(d.steps.join(" ")).not.toContain("(");
  });

  test("falls back to ids without names", () => {
    const d = directionsBetween("a" as Id<"zones">, "a" as Id<"zones">, [])!;
    expect(d.steps).toEqual(["You are already in a"]);
  });
});

describe("spoken output", () => {
  test("walking time uses 1.3 m/s", () => {
    expect(walkingTimePhrase(30)).toBe("under a minute");
    expect(walkingTimePhrase(78)).toBe("about a minute");
    expect(walkingTimePhrase(234)).toBe("about 3 minutes");
  });

  test("message is short and includes time", () => {
    const d = directionsBetween(zoneId("atrium-west"), zoneId("atrium-east"), seededEdges(), [], names)!;
    const m = directionsMessage("Atrium West", "Atrium East", d);
    expect(m).toMatch(/^Head through Atrium West into Atrium East\. It is .* on foot\.$/);
  });
});
