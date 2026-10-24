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
  red: "#ef4444",
  yellow: "#eab308",
  green: "#22c55e",
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
  network: "#38bdf8",
  facilities: "#fb923c",
  supplies: "#a78bfa",
  guest_services: "#f472b6",
  ops_lead: "#f8fafc",
};

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
