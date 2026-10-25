// Builds agent/venue-guide.md: spoken-friendly "where things are" facts for the voice agent.
// The place list comes from buildLocations(), the same source as the location vocabulary
// and the `locations` table, so the guide can never name a place the agent cannot resolve.
// Hand-written facts live in agent/event-facts.md (edit that, then `npx tsx agent/export.ts`).
import { EDGES, ZONES, buildLocations, type EdgeDef, type LocationDef, type ZoneDef } from "../convex/lib/zoning";
import { compressRanges } from "./prompt";

/** The venue the guide describes. Defaults to the built-in Cal Hacks venue. */
export type GuideVenue = {
  zones: Pick<ZoneDef, "key" | "name" | "level">[];
  edges: Pick<EdgeDef, "a" | "b" | "kind">[];
  locations: LocationDef[];
  levelName: (level: "main" | "mezz") => string;
};

const calHacksVenue = (): GuideVenue => ({
  zones: ZONES,
  edges: EDGES,
  locations: buildLocations(),
  levelName: (level) => (level === "mezz" ? "mezzanine" : "main floor"),
});

export const CAL_HACKS_NOT_IN_GUIDE =
  "Not in this guide, so call venue_search instead of guessing: wifi rules, food and meal times, the schedule, workshops, shower hours, merch, mentors, hardware checkout. Parking, and anything about places that are not named above: say you are not sure.";

export function buildWhereThingsAre(venue: GuideVenue = calHacksVenue()): string {
  const { locations, levelName } = venue;
  const zoneName = new Map(venue.zones.map((z) => [z.key, z.name]));
  const neighbors = new Map<string, string[]>();
  for (const e of venue.edges) {
    const note = (to: string) => (e.kind === "stairs" ? `${zoneName.get(to)} (by stairs)` : zoneName.get(to)!);
    (neighbors.get(e.a) ?? neighbors.set(e.a, []).get(e.a)!).push(note(e.b));
    (neighbors.get(e.b) ?? neighbors.set(e.b, []).get(e.b)!).push(note(e.a));
  }

  const lines = venue.zones.map((zone) => {
    const here = locations.filter((l) => l.zoneKey === zone.key);
    const tables = here.filter((l) => l.kind === "table").map((l) => Number(l.key.slice("table:".length)));
    const named = [...new Set(here.filter((l) => l.kind !== "table" && l.kind !== "zone" && l.label !== zone.name).map((l) => l.label))];
    const parts = [`${zone.name} (${levelName(zone.level)})`];
    if (named.length) parts.push(`has ${named.join("; ")}`);
    if (tables.length) parts.push(`Tables ${compressRanges(tables)}`);
    parts.push(`next to ${(neighbors.get(zone.key) ?? []).join("; ")}`);
    return parts.join(" | ");
  });

  return [
    "Where things are. One line per area: area name (level) | what is in it | table numbers | neighboring areas. Use these names exactly; say them naturally on the phone.",
    ...lines,
  ].join("\n");
}

export function buildVenueGuide(eventFacts: string, venue?: GuideVenue, notInGuide = CAL_HACKS_NOT_IN_GUIDE): string {
  return `${buildWhereThingsAre(venue)}

Event facts (edited by organizers):
${eventFacts.trim()}

${notInGuide}
`;
}
