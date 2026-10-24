import { describe, expect, test } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import { buildGraph, reverseRoute, routesFrom, shortestPath } from "./graph";
import { blockZone, edgeId, seededEdges, zoneId } from "./demoVenue.fixture";

const z = (k: string) => k as Id<"zones">;
const edge = (id: string, from: string, to: string, distance: number, blocked = false): Doc<"edges"> => ({
  _id: id as Id<"edges">,
  _creationTime: 0,
  from: z(from),
  to: z(to),
  kind: "walk",
  distance,
  path: [],
  blocked,
});

describe("buildGraph", () => {
  test("is undirected and leaves blocked edges out", () => {
    const g = buildGraph([edge("ab", "a", "b", 1), edge("bc", "b", "c", 2, true)]);
    expect(g.adjacency.get(z("a"))).toEqual([{ to: "b", edgeId: "ab", distance: 1 }]);
    expect(g.adjacency.get(z("b"))).toEqual([{ to: "a", edgeId: "ab", distance: 1 }]);
    expect(g.adjacency.has(z("c"))).toBe(false);
  });
});

describe("Dijkstra", () => {
  // a -1- b -1- c is cheaper than the direct a -5- c edge.
  const edges = [edge("ab", "a", "b", 1), edge("bc", "b", "c", 1), edge("ac", "a", "c", 5)];

  test("prefers the cheaper multi-hop path over a direct edge", () => {
    expect(shortestPath(buildGraph(edges), z("a"), z("c"))).toEqual({
      zoneIds: ["a", "b", "c"],
      edgeIds: ["ab", "bc"],
      distance: 2,
    });
  });

  test("falls back to the next path when an edge is blocked", () => {
    const blocked = edges.map((e) => (e._id === "bc" ? { ...e, blocked: true } : e));
    expect(shortestPath(buildGraph(blocked), z("a"), z("c"))).toEqual({ zoneIds: ["a", "c"], edgeIds: ["ac"], distance: 5 });
  });

  test("returns null when blockages disconnect the zones", () => {
    const g = buildGraph(edges.map((e) => ({ ...e, blocked: e._id !== "ab" })));
    expect(shortestPath(g, z("a"), z("c"))).toBeNull();
  });

  test("route to self is zero length", () => {
    expect(shortestPath(buildGraph(edges), z("a"), z("a"))).toEqual({ zoneIds: ["a"], edgeIds: [], distance: 0 });
  });

  test("an isolated start zone still reaches itself", () => {
    expect(routesFrom(buildGraph([]), z("lonely"))).toEqual(new Map([["lonely", { zoneIds: ["lonely"], edgeIds: [], distance: 0 }]]));
  });

  test("reverseRoute walks the same edges backwards", () => {
    const r = shortestPath(buildGraph(edges), z("a"), z("c"))!;
    expect(reverseRoute(r)).toEqual({ zoneIds: ["c", "b", "a"], edgeIds: ["bc", "ab"], distance: 2 });
  });
});

describe("seeded venue graph", () => {
  test("every zone is reachable from every other zone", () => {
    const routes = routesFrom(buildGraph(seededEdges()), zoneId("stage"));
    expect(routes.size).toBe(18);
  });

  test("blocking Broadway #1 forces Broadway #2 -> Atrium West around through the north hall", () => {
    const open = shortestPath(buildGraph(seededEdges()), zoneId("broadway-2"), zoneId("atrium-west"))!;
    const blocked = shortestPath(buildGraph(seededEdges(blockZone("broadway-1"))), zoneId("broadway-2"), zoneId("atrium-west"))!;
    expect(open.edgeIds).toContain(edgeId("broadway-1", "broadway-2"));
    expect(blocked.zoneIds).not.toContain(zoneId("broadway-1"));
    expect(blocked.distance).toBeGreaterThan(open.distance);
  });
});
