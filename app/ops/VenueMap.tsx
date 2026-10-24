"use client";

import dynamic from "next/dynamic";
import type { Doc, Id } from "@/convex/_generated/dataModel";

// three.js needs the browser.
const VenueScene = dynamic(() => import("@/components/venue/VenueScene"), { ssr: false });

type Props = {
  incidents?: Doc<"incidents">[];
  staff?: Doc<"staff">[];
  selectedId?: Id<"incidents"> | null;
  onSelect?: (id: Id<"incidents">) => void;
};

/**
 * Placeholder seam for the 3D venue. Currently renders the bare VenueScene floor;
 * when markers, staff dots and routes land, mount them as children here.
 */
export function VenueMap(_props: Props) {
  return <VenueScene />;
}
