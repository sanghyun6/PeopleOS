"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import type * as THREE from "three";
import { useEffect, useState } from "react";
import { AreaLabels, Booths, HackerTables, MezzanineDeck, VenueFloor, VenueRooms } from "./VenueFloor";
import { IncidentMarker } from "./IncidentMarker";
import { RouteLine } from "./RouteLine";
import { StaffDot } from "./StaffDot";
import { isLevelVisible, type LevelView, type VenueSceneProps } from "./types";

const LEVELS: { id: LevelView; label: string }[] = [
  { id: "all", label: "All" },
  { id: "main", label: "Main" },
  { id: "mezz", label: "Mezzanine" },
];

/** Place the camera once so the whole building (~215 m wide) fits at the canvas aspect. */
function FitCamera() {
  const camera = useThree((s) => s.camera);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera;
    const tanHalf = Math.tan((persp.fov * Math.PI) / 360);
    const dist = Math.max(108 / (tanHalf * aspect), 62 / tanHalf);
    camera.position.set(0, dist * 0.82, 5 + dist * 0.57);
    camera.lookAt(0, 0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/**
 * R3F venue: floor, rooms, tables, mezzanine, plus incident markers, staff dots and route lines.
 * Fills its parent (give the parent a height). Everything is optional so `<VenueScene />` still works.
 */
export default function VenueScene({
  incidents = [],
  staff = [],
  routes = [],
  selectedId = null,
  onSelect = () => {},
  initialLevel = "all",
  children,
}: VenueSceneProps) {
  const [view, setView] = useState<LevelView>(initialLevel);

  return (
    <div className="relative h-full w-full">
      <Canvas camera={{ position: [0, 140, 110], fov: 45, near: 1, far: 2000 }}>
        <color attach="background" args={["#0a0a0a"]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[50, 120, 40]} intensity={1.3} />
        <FitCamera />
        <VenueFloor />
        <VenueRooms />
        <MezzanineDeck view={view} />
        <AreaLabels view={view} />
        <HackerTables view={view} />
        <Booths view={view} />

        {incidents
          .filter((i) => isLevelVisible(view, i.level))
          .map((incident) => (
            <IncidentMarker key={incident._id} incident={incident} selected={incident._id === selectedId} onSelect={onSelect} />
          ))}
        {staff
          .filter((s) => isLevelVisible(view, s.zone.level))
          .map((s) => (
            <StaffDot key={s.staff._id} {...s} />
          ))}
        {routes
          .filter((r) => r.segments.some((seg) => isLevelVisible(view, seg.fromLevel) || isLevelVisible(view, seg.toLevel)))
          .map((r, i) => (
            <RouteLine key={i} {...r} />
          ))}
        {children}

        <OrbitControls makeDefault target={[0, 0, 5]} maxPolarAngle={Math.PI / 2.1} minDistance={15} maxDistance={500} />
      </Canvas>

      <div className="absolute left-3 top-3 z-20 flex overflow-hidden rounded-md border border-neutral-700 bg-neutral-900/90 text-xs">
        {LEVELS.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setView(l.id)}
            aria-pressed={view === l.id}
            className={`px-3 py-1.5 ${view === l.id ? "bg-neutral-100 text-neutral-900" : "text-neutral-300 hover:bg-neutral-800"}`}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
