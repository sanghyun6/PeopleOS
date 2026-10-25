"use client";

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type ComponentRef } from "react";
import { Vector3 } from "three";
import { ACCENT_HEX, type RouteLineProps } from "./types";
import { useVenueView } from "./venueView";

const LIFT = 0.6;
/** drei <Line> through each edge path, rising to the upper floor height on stair edges (step 4/8). */
export function RouteLine({ segments, color = ACCENT_HEX }: RouteLineProps) {
  const dashed = useRef<ComponentRef<typeof Line>>(null);
  const { elevation } = useVenueView();

  const points = useMemo(() => {
    const levelY = (level: "main" | "mezz") => elevation[level] + LIFT;
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
  }, [segments, elevation]);

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
      {/* soft halo, solid core, then a light dash marching toward the destination */}
      <Line points={points} color={color} lineWidth={10} transparent opacity={0.14} depthWrite={false} />
      <Line points={points} color={color} lineWidth={3} transparent opacity={0.9} />
      <Line ref={dashed} points={points} color="#ffffff" lineWidth={1.5} dashed dashSize={1.2} gapSize={3} transparent opacity={0.7} />
      <mesh position={start} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.4, 24]} />
        <meshBasicMaterial color={color} depthWrite={false} />
      </mesh>
      <mesh position={end} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.4, 24]} />
        <meshBasicMaterial color={color} depthWrite={false} />
      </mesh>
    </group>
  );
}
