"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { Label } from "./Label";
import { toWorld } from "./coords";
import { COLOR_HEX, STATUS_COLOR, type IncidentMarkerProps } from "./types";
import { useNearZoom } from "./zoom";
import { displayBrief } from "@/convex/lib/bitdeer";

const clip = (s: string, n = 34) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Status-colored pin at incident.at; shows reportCount badge when > 1 (step 4). */
export function IncidentMarker({ incident, selected, onSelect }: IncidentMarkerProps) {
  const colorName = STATUS_COLOR[incident.status];
  const color = COLOR_HEX[colorName];
  const [hovered, setHovered] = useState(false);
  const near = useNearZoom();
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
      {/* contact shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <circleGeometry args={[1.3, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.45} depthWrite={false} />
      </mesh>
      {/* ground ring (pulses while the incident still needs someone) */}
      <mesh ref={pulse} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]}>
        <ringGeometry args={[1.6, 2.1, 40]} />
        <meshBasicMaterial color={color} transparent opacity={colorName === "red" ? 0.5 : 0.35} depthWrite={false} />
      </mesh>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
          <ringGeometry args={[3.2, 3.5, 48]} />
          <meshBasicMaterial color="#7f9bff" depthWrite={false} />
        </mesh>
      )}
      {/* pin: cone with its tip on the incident point, sphere head on top */}
      <group ref={pin} position={[0, 3.6, 0]} scale={s}>
        <mesh rotation={[Math.PI, 0, 0]} position={[0, -1.4, 0]}>
          <coneGeometry args={[1.1, 2.4, 20]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <sphereGeometry args={[1.4, 24, 16]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <sphereGeometry args={[0.55, 16, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        {incident.reportCount > 1 && (
          <Label position={[1.9, 1.9, 0]} text={`×${incident.reportCount}`} size={1.9} color="#0d1117" bg="#e7ebf2" bold onTop />
        )}
        {(selected || hovered || near) && (
          <Label
            position={[0, incident.reportCount > 1 ? 4.6 : 3, 0]}
            text={clip(displayBrief(incident))}
            size={selected || hovered ? 2.2 : 1.6}
            color="#e7ebf2"
            onTop
          />
        )}
      </group>
    </group>
  );
}
