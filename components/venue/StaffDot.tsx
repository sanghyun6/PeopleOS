"use client";

import { useMemo } from "react";
import { Label } from "./Label";
import { toWorld } from "./coords";
import { ROLE_HEX, type StaffDotProps } from "./types";

/** Small stable offset so staff sharing a zone center don't stack on one point. */
function jitter(id: string): [number, number] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const angle = (Math.abs(h) % 360) * (Math.PI / 180);
  const r = 2 + (Math.abs(h >> 8) % 20) / 10;
  return [Math.cos(angle) * r, Math.sin(angle) * r];
}

/** Role-colored dot at the staff member's zone, with name label (step 4). */
export function StaffDot({ staff, zone }: StaffDotProps) {
  const [dx, dz] = useMemo(() => jitter(staff._id), [staff._id]);
  const [x, y, z] = toWorld({ x: zone.center.x + dx, z: zone.center.z + dz }, zone.level, 1.1);
  const color = ROLE_HEX[staff.role];
  const off = staff.status === "off_duty";

  return (
    <group position={[x, y, z]}>
      <mesh>
        <sphereGeometry args={[1.1, 20, 14]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={off ? 0 : 0.35} transparent opacity={off ? 0.35 : 1} />
      </mesh>
      {staff.status === "busy" && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.9, 0]}>
          <ringGeometry args={[1.5, 1.9, 32]} />
          <meshBasicMaterial color={color} depthWrite={false} />
        </mesh>
      )}
      <Label position={[0, 2.4, 0]} text={staff.name} size={1.8} color={color} bg="rgba(0,0,0,0.65)" onTop />
    </group>
  );
}
