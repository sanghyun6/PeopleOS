import { MEZZ_HEIGHT, type VenueLevel, type XZ } from "@/convex/lib/venueData";

/** Venue x/z (meters) + level -> three.js world position. y is up. */
export function toWorld(at: XZ, level: VenueLevel, lift = 0): [number, number, number] {
  return [at.x, (level === "mezz" ? MEZZ_HEIGHT : 0) + lift, at.z];
}
