// Zone graph + Dijkstra. Dispatch uses path distance, never straight-line distance.
import type { Doc, Id } from "../_generated/dataModel";

export type Neighbor = { to: Id<"zones">; edgeId: Id<"edges">; distance: number };

export type Graph = {
  adjacency: Map<Id<"zones">, Neighbor[]>;
};

export type Route = {
  zoneIds: Id<"zones">[]; // from ... to, inclusive
  edgeIds: Id<"edges">[];
  distance: number; // meters
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Undirected adjacency list. Blocked edges are left out. */
export function buildGraph(edges: Doc<"edges">[]): Graph {
  const adjacency = new Map<Id<"zones">, Neighbor[]>();
  const add = (from: Id<"zones">, n: Neighbor) => {
    const list = adjacency.get(from);
    if (list) list.push(n);
    else adjacency.set(from, [n]);
  };
  for (const e of edges) {
    if (e.blocked) continue;
    add(e.from, { to: e.to, edgeId: e._id, distance: e.distance });
    add(e.to, { to: e.from, edgeId: e._id, distance: e.distance });
  }
  return { adjacency };
}

/** Single-source Dijkstra: best route from `from` to every reachable zone. */
export function routesFrom(graph: Graph, from: Id<"zones">): Map<Id<"zones">, Route> {
  // ~20 nodes: a linear scan for the closest unvisited node beats a heap here.
  const dist = new Map<Id<"zones">, number>([[from, 0]]);
  const prev = new Map<Id<"zones">, { zone: Id<"zones">; edge: Id<"edges"> }>();
  const done = new Set<Id<"zones">>();

  for (;;) {
    let current: Id<"zones"> | null = null;
    let best = Infinity;
    for (const [zone, d] of dist) {
      if (!done.has(zone) && d < best) {
        best = d;
        current = zone;
      }
    }
    if (current === null) break;
    done.add(current);
    for (const n of graph.adjacency.get(current) ?? []) {
      const next = best + n.distance;
      if (next < (dist.get(n.to) ?? Infinity)) {
        dist.set(n.to, next);
        prev.set(n.to, { zone: current, edge: n.edgeId });
      }
    }
  }

  const routes = new Map<Id<"zones">, Route>();
  for (const [zone, d] of dist) {
    const zoneIds: Id<"zones">[] = [zone];
    const edgeIds: Id<"edges">[] = [];
    for (let step = prev.get(zone); step; step = prev.get(step.zone)) {
      zoneIds.push(step.zone);
      edgeIds.push(step.edge);
    }
    routes.set(zone, { zoneIds: zoneIds.reverse(), edgeIds: edgeIds.reverse(), distance: round1(d) });
  }
  return routes;
}

/** Shortest route between two zones, or null if the blockages disconnect them. */
export function shortestPath(graph: Graph, from: Id<"zones">, to: Id<"zones">): Route | null {
  return routesFrom(graph, from).get(to) ?? null;
}

/** The same route walked the other way (the graph is undirected). */
export function reverseRoute(route: Route): Route {
  return {
    zoneIds: [...route.zoneIds].reverse(),
    edgeIds: [...route.edgeIds].reverse(),
    distance: route.distance,
  };
}
