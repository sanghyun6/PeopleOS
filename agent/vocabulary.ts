// Location vocabulary the agent is allowed to use (derived from the venue JSON).
import { todo } from "../convex/lib/todo";

export type LocationVocabulary = {
  tableRange: { min: number; max: number; mezzanine: number[] };
  booths: string[]; // "Cartesia booth", "Creao booth (Pavilion North)", ...
  areas: string[]; // zones, rooms, amenities, entrances
};

export function buildVocabulary(): LocationVocabulary {
  return todo("buildVocabulary");
}
