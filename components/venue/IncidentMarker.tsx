"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { Label } from "./Label";
import { toWorld } from "./coords";
import { COLOR_HEX, STATUS_COLOR, type IncidentMarkerProps } from "./types";

/** Status-colored pin at incident.at; shows reportCount badge when > 1 (step 4). */
export function IncidentMarker({ incident, selected, onSelect }: IncidentMarkerProps) {
  const colorName = STATUS_COLOR[incident.status];
  const color = COLOR_HEX[colorName];
  const [hovered, setHovered] = useState(false);
  const pin = useRef<Group>(null);
  const pulse = useRef<Mesh>(null);

  // Don't leave a pointer cursor behind if the marker unmounts while hovered.
  useEffect(() => () => void (document.body.style.cursor = ""), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (pin.current && colorName !== "green") pin.current.position.y = 3.6 + Math.sin(t * 2.5) * 0.35;
    if (pulse.current && colorName === "red") {
      const k = (t % 1.6) / 1.6;
      pulse.current.scale.setScalar(1 + k * 2.2);
      (pulse.current.material as MeshBasicMaterial).opacity = 0.6 * (1 - k);
    }
  });

  const [x, y, z] = toWorld(incident.at, incident.level);
  const s = hovered || selected ? 1.25 : 1;

  return (
    <group
      position={[x, y, z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(incident._id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "";
      }}
    >
      {/* ground ring (pulses while the incident still needs someone) */}
      <mesh ref={pulse} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]}>
        <ringGeometry args={[1.6, 2.1, 40]} />
        <meshBasicMaterial color={color} transparent opacity={colorName === "red" ? 0.5 : 0.35} depthWrite={false} />
      </mesh>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
          <ringGeometry args={[3.2, 3.6, 48]} />
          <meshBasicMaterial color="#ffffff" depthWrite={false} />
        </mesh>
      )}
      {/* pin: cone with its tip on the incident point, sphere head on top */}
      <group ref={pin} position={[0, 3.6, 0]} scale={s}>
        <mesh rotation={[Math.PI, 0, 0]} position={[0, -1.4, 0]}>
          <coneGeometry args={[1.1, 2.4, 20]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <sphereGeometry args={[1.4, 24, 16]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
        </mesh>
        {incident.reportCount > 1 && (
          <Label position={[0, 2.8, 0]} text={`×${incident.reportCount}`} size={2.4} color="#ffffff" bg="rgba(0,0,0,0.85)" bold onTop />
        )}
      </group>
    </group>
  );
}
