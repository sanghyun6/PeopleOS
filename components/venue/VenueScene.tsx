"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import type { ReactNode } from "react";
import { VenueFloor } from "./VenueFloor";

/** R3F canvas with the venue floor. Markers, staff dots, and routes go in `children`. */
export default function VenueScene({ children }: { children?: ReactNode }) {
  return (
    <Canvas camera={{ position: [0, 140, 110], fov: 45, near: 1, far: 2000 }}>
      <color attach="background" args={["#0a0a0a"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[50, 120, 40]} intensity={1.2} />
      <VenueFloor />
      {children}
      <OrbitControls makeDefault target={[0, 0, 0]} maxPolarAngle={Math.PI / 2.1} />
    </Canvas>
  );
}
