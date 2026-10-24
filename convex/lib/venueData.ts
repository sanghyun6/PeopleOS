// Typed view of data/palace-venue.json (extracted from palace-interior.vercel.app).
// Units are ~meters on an x/z ground plane; negative z is north.
import raw from "../../data/palace-venue.json";

export type VenueLevel = "main" | "mezz";
export type XZ = { x: number; z: number };
export type Segment = { a: XZ; b: XZ };

export type VenueRoom = {
  id: string;
  kind: string; // service | green | room | catering | restroom | theater | stair
  label?: string;
  poly: XZ[];
  dividers: XZ[][];
  doors: Segment[];
};

export type HackerTable = {
  n: number;
  level: VenueLevel;
  at: XZ;
  rotY: number;
  w: number;
  h: number;
};

export type SponsorBooth = {
  n: number;
  name: string;
  level: VenueLevel;
  at: XZ;
  tableCount: number;
};

export type Amenity = { label: string; kind: string; at: XZ; level: VenueLevel };
export type VenueLabel = { label: string; at: XZ };
export type Entrance = { id: string; label: string; a: XZ; b: XZ };
export type PlacedRect = { at: XZ; w: number; h: number; rotY: number };

export type VenueData = {
  source: string;
  notes: string;
  outline: XZ[];
  entrances: Entrance[];
  rooms: VenueRoom[];
  labels: VenueLabel[];
  amenities: Amenity[];
  sponsors: SponsorBooth[];
  hackerTables: HackerTable[];
  geometry: {
    checkinTables: PlacedRect[];
    serviceTables: PlacedRect[];
    stage: XZ[];
    queue: XZ[];
    mainWalls: Segment[];
    mezzWalls: Segment[];
    mezzDoors: Segment[];
    merchRoom: XZ[];
    printerTables: PlacedRect[];
  };
};

export const venue = raw as VenueData;

/** Mezzanine floor height in meters (not in the source data; ~5 m looks right). */
export const MEZZ_HEIGHT = 5;
