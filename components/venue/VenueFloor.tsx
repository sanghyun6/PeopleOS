"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { venue } from "@/convex/lib/venueData";

/** Building outline as a flat floor. Rooms, tables, booths, mezzanine: step 4. */
export function VenueFloor() {
  const shape = useMemo(() => {
    // Shape lives in local XY; rotating -90deg about X maps local y to world -z.
    const s = new THREE.Shape();
    venue.outline.forEach((p, i) => (i === 0 ? s.moveTo(p.x, -p.z) : s.lineTo(p.x, -p.z)));
    s.closePath();
    return s;
  }, []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial color="#d4d4d8" />
    </mesh>
  );
}

/** Room polygons with labels (step 4). */
export function VenueRooms() {
  return null;
}

/** 304 hacker tables as instanced boxes, mezzanine raised to MEZZ_HEIGHT (step 4). */
export function HackerTables() {
  return null;
}

/** Sponsor booths + amenities (step 4). */
export function Booths() {
  return null;
}
