"use client";

import { useConvex } from "convex/react";
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { MEZZ_HEIGHT, type VenueLevel, type XZ } from "@/convex/lib/venueData";

/** A loaded Venue Pack's metadata (venuePack.get), or null for the built-in Cal Hacks venue. */
export type VenueMetaView = NonNullable<FunctionReturnType<typeof api.venuePack.get>>;

let cached: Promise<VenueMetaView | null> | null = null;

/**
 * The loaded Venue Pack, fetched once per page load. null = built-in Cal Hacks venue, also when
 * the deployment predates venuePack.get (so this branch's UI still works against older
 * deployments). undefined while loading. Not reactive: reload the page after loading a pack.
 */
export function useVenueMeta(): VenueMetaView | null | undefined {
  const convex = useConvex();
  const [meta, setMeta] = useState<VenueMetaView | null | undefined>(undefined);
  useEffect(() => {
    cached ??= convex.query(api.venuePack.get, {}).catch(() => null);
    let live = true;
    void cached.then((m) => live && setMeta(m));
    return () => {
      live = false;
    };
  }, [convex]);
  return meta;
}

/** What the 3D scene needs to place things: floor heights and names, and which renderer to use. */
export type VenueView = {
  elevation: Record<VenueLevel, number>;
  /** Level buttons; one entry per floor. */
  floors: { level: VenueLevel; label: string }[];
  /** Built-in detailed model (Cal Hacks) vs. the generic zone renderer. */
  detailed: boolean;
  meta: VenueMetaView | null;
};

export const CAL_HACKS_VIEW: VenueView = {
  elevation: { main: 0, mezz: MEZZ_HEIGHT },
  floors: [
    { level: "main", label: "Main" },
    { level: "mezz", label: "Mezzanine" },
  ],
  detailed: true,
  meta: null,
};

export function venueViewFor(meta: VenueMetaView | null): VenueView {
  if (!meta) return CAL_HACKS_VIEW;
  const elevation = { main: 0, mezz: MEZZ_HEIGHT };
  for (const f of meta.floors) elevation[f.level] = f.elevation;
  return {
    elevation,
    floors: meta.floors.map((f) => ({ level: f.level, label: f.name })),
    detailed: meta.detailedGeometry === "palace-of-fine-arts",
    meta,
  };
}

const VenueViewContext = createContext<VenueView>(CAL_HACKS_VIEW);
export const VenueViewProvider = VenueViewContext.Provider;
export const useVenueView = () => useContext(VenueViewContext);

/** Venue x/z + level -> world position using this venue's floor heights. */
export function useToWorld() {
  const { elevation } = useVenueView();
  return (at: XZ, level: VenueLevel, lift = 0): [number, number, number] => [at.x, elevation[level] + lift, at.z];
}

/** "main floor" / "mezzanine" for Cal Hacks; the pack's floor name otherwise. */
export function levelLabel(meta: VenueMetaView | null | undefined, level: VenueLevel): string {
  const name = meta?.floors.find((f) => f.level === level)?.name;
  if (name) return name.toLowerCase();
  return level === "mezz" ? "mezzanine" : "main floor";
}
