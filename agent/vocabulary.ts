// Location vocabulary the agent is allowed to use. Derived from the same
// buildLocations() that seeds the `locations` table, so every label the agent
// says resolves to exactly one row there.
import { buildLocations } from "../convex/lib/zoning";

export type LocationVocabulary = {
  tableRange: { min: number; max: number; mezzanine: number[] };
  booths: string[]; // "Cartesia booth", "Creao booth (Pavilion North)", ...
  areas: string[]; // zones, rooms, amenities, entrances
};

const AREA_KINDS = new Set(["zone", "room", "amenity", "area", "entrance"]);

export function buildVocabulary(): LocationVocabulary {
  const locations = buildLocations();
  const tables = locations
    .filter((l) => l.kind === "table")
    .map((l) => ({ n: Number(l.key.slice("table:".length)), level: l.level }));
  const numbers = tables.map((t) => t.n);

  const unique = (labels: string[]) => [...new Set(labels)].sort((a, b) => a.localeCompare(b));

  return {
    tableRange: {
      min: Math.min(...numbers),
      max: Math.max(...numbers),
      mezzanine: tables.filter((t) => t.level === "mezz").map((t) => t.n).sort((a, b) => a - b),
    },
    booths: unique(locations.filter((l) => l.kind === "booth").map((l) => l.label)),
    areas: unique(locations.filter((l) => AREA_KINDS.has(l.kind)).map((l) => l.label)),
  };
}
