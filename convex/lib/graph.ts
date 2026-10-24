// Zone graph + Dijkstra. Dispatch uses path distance, never straight-line distance.
import type { Doc, Id } from "../_generated/dataModel";
import { todo } from "./todo";

export type Neighbor = { to: Id<"zones">; edgeId: Id<"edges">; distance: number };

export type Graph = {
  adjacency: Map<Id<"zones">, Neighbor[]>;
};

export type Route = {
  zoneIds: Id<"zones">[]; // from ... to, inclusive
  edgeIds: Id<"edges">[];
  distance: number; // meters
};

/** Undirected adjacency list. Blocked edges are left out. */
export function buildGraph(_edges: Doc<"edges">[]): Graph {
  return todo("buildGraph");
}

/** Single-source Dijkstra: best route from `from` to every reachable zone. */
export function routesFrom(_graph: Graph, _from: Id<"zones">): Map<Id<"zones">, Route> {
  return todo("routesFrom");
}

/** Shortest route between two zones, or null if the blockages disconnect them. */
export function shortestPath(_graph: Graph, _from: Id<"zones">, _to: Id<"zones">): Route | null {
  return todo("shortestPath");
}
