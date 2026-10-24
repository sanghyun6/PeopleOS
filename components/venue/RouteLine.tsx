"use client";

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type ComponentRef } from "react";
import { Vector3 } from "three";
import { MEZZ_HEIGHT } from "@/convex/lib/venueData";
import type { RouteLineProps } from "./types";

const LIFT = 0.6;
const levelY = (level: "main" | "mezz") => (level === "mezz" ? MEZZ_HEIGHT : 0) + LIFT;

/** drei <Line> through each edge path, rising to MEZZ_HEIGHT on stair edges (step 4/8). */
export function RouteLine({ segments, color = "#38bdf8" }: RouteLineProps) {
  const dashed = useRef<ComponentRef<typeof Line>>(null);

  const points = useMemo(() => {
    const out: Vector3[] = [];
    for (const seg of segments) {
      const { path, fromLevel, toLevel } = seg;
      // Climb/descend linearly with distance along the edge, so stairs read as a ramp.
      const cum = [0];
      for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z));
      const total = cum[cum.length - 1] || 1;
      path.forEach((p, i) => {
        const y = levelY(fromLevel) + (levelY(toLevel) - levelY(fromLevel)) * (cum[i] / total);
        const v = new Vector3(p.x, y, p.z);
        // Consecutive edges share their junction zone center; skip the duplicate.
        if (i === 0 && out.length && out[out.length - 1].distanceToSquared(v) < 0.01) return;
        out.push(v);
      });
    }
    return out;
  }, [segments]);

  // Flow animation: march the dashes toward the destination.
  useFrame((_, dt) => {
    const mat = dashed.current?.material;
    if (mat) mat.dashOffset -= dt * 6;
  });

  if (points.length < 2) return null;
  const end = points[points.length - 1];
  const start = points[0];

  return (
    <group>
      <Line points={points} color={color} lineWidth={7} transparent opacity={0.25} depthWrite={false} />
      <Line ref={dashed} points={points} color={color} lineWidth={3.5} dashed dashSize={2.5} gapSize={1.5} />
      <mesh position={start}>
        <sphereGeometry args={[0.7, 12, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={end}>
        <coneGeometry args={[1.2, 2.4, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}
