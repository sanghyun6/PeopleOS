// Spoken walking directions between two zones. Pure: reuses the dispatch Dijkstra.
import type { Doc, Id } from "../_generated/dataModel";
import { buildGraph, shortestPath } from "./graph";

export type Directions = {
  zones: string[]; // zone ids, from ... to, inclusive
  distanceMeters: number;
  steps: string[]; // short spoken phrases
  blockedDetour: boolean; // true when a blockage changes the route
};

/** Average indoor walking speed used for time estimates. */
export const WALKING_SPEED_MPS = 1.3;

/** "Broadway #1 (Gate #3/#4 Hallway)" -> "Broadway #1": parentheticals are too long to say. */
export const spokenZoneName = (name: string) => name.replace(/\s*\(.*?\)\s*/g, " ").trim();

/**
 * Route from one zone to another, skipping edges that are `blocked` in the table
 * or listed in `blockedEdgeIds`. Returns null when blockages disconnect the zones.
 * `zoneNames` (zone id -> name) makes the steps speakable; ids are the fallback.
 */
export function directionsBetween(
  fromZoneId: Id<"zones">,
  toZoneId: Id<"zones">,
  edges: Doc<"edges">[],
  blockedEdgeIds: Id<"edges">[] = [],
  zoneNames: ReadonlyMap<string, string> = new Map(),
): Directions | null {
  const closed = new Set<string>(blockedEdgeIds);
  const name = (id: string) => spokenZoneName(zoneNames.get(id) ?? id);

  const route = shortestPath(
    buildGraph(edges.map((e) => ({ ...e, blocked: e.blocked || closed.has(e._id) }))),
    fromZoneId,
    toZoneId,
  );
  if (!route) return null;

  // Same walk with every blockage lifted: a different path or length means a detour.
  const unblocked = shortestPath(buildGraph(edges.map((e) => ({ ...e, blocked: false }))), fromZoneId, toZoneId);
  const blockedDetour =
    !!unblocked &&
    (unblocked.distance !== route.distance || unblocked.zoneIds.join(">") !== route.zoneIds.join(">"));

  const kindOf = new Map(edges.map((e) => [e._id as string, e.kind]));
  const steps: string[] = [];
  if (route.zoneIds.length === 1) {
    steps.push(`You are already in ${name(fromZoneId)}`);
  } else {
    route.edgeIds.forEach((edgeId, i) => {
      const to = route.zoneIds[i + 1];
      const stairs = kindOf.get(edgeId) === "stairs";
      if (stairs) {
        const up = /mezz/i.test(zoneNames.get(to) ?? to); // mezzanine zones are upstairs
        steps.push(`Take the stairs ${up ? "up" : "down"} to ${name(to)}`);
      } else if (i === 0) {
        steps.push(`Head through ${name(route.zoneIds[0])} into ${name(to)}`);
      } else {
        steps.push(`Continue into ${name(to)}`);
      }
    });
  }

  return { zones: route.zoneIds, distanceMeters: route.distance, steps, blockedDetour };
}

/** Rounded to the nearest half minute, never less than "under a minute". */
export function walkingTimePhrase(distanceMeters: number): string {
  const minutes = distanceMeters / WALKING_SPEED_MPS / 60;
  if (minutes < 1) return "under a minute";
  const rounded = Math.round(minutes * 2) / 2;
  return rounded === 1 ? "about a minute" : `about ${rounded} minutes`;
}

/** Two short sentences ready to speak: the steps, then the walking time. */
export function directionsMessage(fromLabel: string, toLabel: string, d: Directions): string {
  if (d.zones.length === 1) return `${toLabel} is in the same area as ${fromLabel}, so it is a short walk from where you are.`;
  const lead = d.blockedDetour ? "A path is blocked, so go the long way. " : "";
  const steps = d.steps.map((s, i) => (i === 0 ? s : s.charAt(0).toLowerCase() + s.slice(1))).join(", then ");
  return `${lead}${steps}. It is ${walkingTimePhrase(d.distanceMeters)} on foot.`;
}
