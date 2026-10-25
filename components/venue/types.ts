import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { IncidentStatus } from "@/convex/lib/validators";

/** Marker color bucket: red = needs someone, yellow = someone on it, green = done. */
export type MarkerColor = "red" | "yellow" | "green";

export const STATUS_COLOR: Record<IncidentStatus, MarkerColor> = {
  open: "red",
  escalated: "red",
  pending_review: "red",
  assigned: "yellow",
  acknowledged: "yellow",
  resolved: "green",
  cancelled: "green",
};

export const COLOR_HEX: Record<MarkerColor, string> = {
  red: "#f0605d",
  yellow: "#f2b23e",
  green: "#3ccb8a",
};

export type IncidentMarkerProps = {
  incident: Doc<"incidents">;
  selected: boolean;
  onSelect: (id: Id<"incidents">) => void;
};

export type StaffDotProps = {
  staff: Doc<"staff">;
  zone: Doc<"zones">;
};

export type RouteLineProps = {
  /** Edge polylines in route order (from edges.path), possibly crossing levels. */
  segments: { path: { x: number; z: number }[]; fromLevel: "main" | "mezz"; toLevel: "main" | "mezz" }[];
  color?: string;
};

/** Which floor(s) the scene shows. "all" draws both; the others hide the other level's objects. */
export type LevelView = "all" | "main" | "mezz";

export const isLevelVisible = (view: LevelView, level: "main" | "mezz") => view === "all" || view === level;

export const ROLE_HEX: Record<Doc<"staff">["role"], string> = {
  network: "#4cc2e8",
  facilities: "#c792ea",
  supplies: "#5ed4c0",
  guest_services: "#f28cc4",
  ops_lead: "#d7dde8",
};

/** The one UI accent (matches --accent in globals.css). */
export const ACCENT_HEX = "#7f9bff";

export type VenueSceneProps = {
  incidents?: Doc<"incidents">[];
  staff?: StaffDotProps[];
  /** One entry per drawn route (e.g. one per active assignment). */
  routes?: RouteLineProps[];
  selectedId?: Id<"incidents"> | null;
  onSelect?: (id: Id<"incidents">) => void;
  initialLevel?: LevelView;
  children?: React.ReactNode;
};
