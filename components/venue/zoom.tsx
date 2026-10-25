"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { Vector3 } from "three";

/** 0 = far (whole venue), 1 = mid (a few zones), 2 = close (booth level). */
export type ZoomTier = 0 | 1 | 2;

// Camera-to-target distance (m) to enter each tier; leaving needs 15% more, so labels don't flicker.
const ENTER = [Infinity, 120, 65];
const HYSTERESIS = 1.15;

const ZoomContext = createContext<ZoomTier>(0);

/** Mid zoom or closer: incident, staff, room and entrance labels. */
export const useNearZoom = () => useContext(ZoomContext) >= 1;
/** Close zoom: sponsor booth and amenity names too. */
export const useCloseZoom = () => useContext(ZoomContext) >= 2;

const ORIGIN = new Vector3(0, 0, 5);

function tierFor(d: number, current: ZoomTier, scale: number): ZoomTier {
  let t: ZoomTier = 0;
  for (const k of [1, 2] as const) {
    const limit = (current >= k ? ENTER[k] * HYSTERESIS : ENTER[k]) * scale;
    if (d < limit) t = k;
  }
  return t;
}

/**
 * Tracks camera-to-target distance and exposes a coarse zoom tier to labels.
 * `scale` shrinks the tier distances for smaller venues (1 = Cal Hacks, ~215 m wide).
 */
export function ZoomProvider({ children, scale = 1 }: { children: ReactNode; scale?: number }) {
  const controls = useThree((s) => s.controls) as { target?: Vector3 } | null;
  const [tier, setTier] = useState<ZoomTier>(0);
  const tierRef = useRef<ZoomTier>(0);

  useFrame(({ camera }) => {
    const next = tierFor(camera.position.distanceTo(controls?.target ?? ORIGIN), tierRef.current, scale);
    if (next !== tierRef.current) {
      tierRef.current = next;
      setTier(next);
    }
  });

  return <ZoomContext.Provider value={tier}>{children}</ZoomContext.Provider>;
}
