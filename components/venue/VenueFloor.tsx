"use client";

import { Line } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MEZZ_HEIGHT, venue, type PlacedRect, type Segment, type VenueLevel, type XZ } from "@/convex/lib/venueData";
import { Label } from "./Label";
import { isLevelVisible, type LevelView } from "./types";

const FLOOR_THICKNESS = 0.4;
const ROOM_HEIGHT = 0.5;
const TABLE_HEIGHT = 0.8;
const WALL_HEIGHT = 2.6;

const ROOM_COLOR: Record<string, string> = {
  service: "#2a2f3a",
  green: "#2f4a3c",
  room: "#34415a",
  catering: "#52402e",
  restroom: "#2d4a52",
  theater: "#41335c",
  stair: "#5c5530",
};

const levelY = (level: VenueLevel) => (level === "mezz" ? MEZZ_HEIGHT : 0);

/** Shape lives in local XY; extruding then rotating -90deg about X maps local (x, y, depth) to world (x, depth, -y). */
function polyShape(poly: XZ[]): THREE.Shape {
  const s = new THREE.Shape();
  poly.forEach((p, i) => (i === 0 ? s.moveTo(p.x, -p.z) : s.lineTo(p.x, -p.z)));
  s.closePath();
  return s;
}

const centroid = (poly: XZ[]): XZ => ({
  x: poly.reduce((s, p) => s + p.x, 0) / poly.length,
  z: poly.reduce((s, p) => s + p.z, 0) / poly.length,
});

/** Convex hull (monotone chain) of padded points; used for the mezzanine deck, which the map data does not outline. */
function paddedHull(points: XZ[], pad: number): XZ[] {
  const pts = points.flatMap((p) => [
    { x: p.x - pad, z: p.z - pad },
    { x: p.x + pad, z: p.z - pad },
    { x: p.x + pad, z: p.z + pad },
    { x: p.x - pad, z: p.z + pad },
  ]);
  pts.sort((a, b) => a.x - b.x || a.z - b.z);
  const cross = (o: XZ, a: XZ, b: XZ) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const build = (input: XZ[]) => {
    const h: XZ[] = [];
    for (const p of input) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  return [...build(pts), ...build([...pts].reverse())];
}

function Slab({ poly, y, depth, color, opacity = 1 }: { poly: XZ[]; y: number; depth: number; color: string; opacity?: number }) {
  const geometry = useMemo(() => new THREE.ExtrudeGeometry(polyShape(poly), { depth, bevelEnabled: false }), [poly, depth]);
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} />
    </mesh>
  );
}

/** Thin box along a wall/door segment. */
function SegmentBox({ seg, y, height, thickness, color, opacity = 1 }: { seg: Segment; y: number; height: number; thickness: number; color: string; opacity?: number }) {
  const dx = seg.b.x - seg.a.x;
  const dz = seg.b.z - seg.a.z;
  return (
    <mesh position={[(seg.a.x + seg.b.x) / 2, y + height / 2, (seg.a.z + seg.b.z) / 2]} rotation={[0, -Math.atan2(dz, dx), 0]}>
      <boxGeometry args={[Math.hypot(dx, dz), height, thickness]} />
      <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}

/** One draw call for many rotated boxes (rotY is about the vertical axis, as in the map data). */
function InstancedBoxes({ rects, y, height, color, visible = true }: { rects: PlacedRect[]; y: number; height: number; color: string; visible?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new THREE.Object3D();
    rects.forEach((r, i) => {
      o.position.set(r.at.x, y + height / 2, r.at.z);
      o.rotation.set(0, r.rotY, 0);
      o.scale.set(r.w, height, r.h);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [rects, y, height]);
  if (rects.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, rects.length]} visible={visible} frustumCulled={false} castShadow>
      <boxGeometry />
      <meshStandardMaterial color={color} />
    </instancedMesh>
  );
}

/** Building outline as a thin slab with a bright edge, main-floor walls, stage, and entrances. */
export function VenueFloor() {
  const outlinePts = useMemo(
    () => [...venue.outline, venue.outline[0]].map((p) => new THREE.Vector3(p.x, 0.15, p.z)),
    [],
  );
  const { stage, mainWalls, entrances } = { stage: venue.geometry.stage, mainWalls: venue.geometry.mainWalls, entrances: venue.entrances };

  return (
    <group>
      <Slab poly={venue.outline} y={-FLOOR_THICKNESS} depth={FLOOR_THICKNESS} color="#1f2530" />
      <Line points={outlinePts} color="#94a3b8" lineWidth={2} />
      <Slab poly={stage} y={0} depth={0.9} color="#4c3d6b" />
      {mainWalls.map((w, i) => (
        <SegmentBox key={i} seg={w} y={0} height={WALL_HEIGHT} thickness={0.35} color="#64748b" opacity={0.7} />
      ))}
      {entrances.map((e) => (
        <group key={e.id}>
          <SegmentBox seg={{ a: e.a, b: e.b }} y={0} height={0.5} thickness={0.8} color="#34d399" />
          <Label position={[(e.a.x + e.b.x) / 2, 2.4, (e.a.z + e.b.z) / 2]} text={e.label} size={2} color="#6ee7b7" bg="rgba(2,44,34,0.8)" />
        </group>
      ))}
    </group>
  );
}

/** Mezzanine deck (hull of everything on the mezz), its walls and the merch room, raised to MEZZ_HEIGHT. */
export function MezzanineDeck({ view = "all" }: { view?: LevelView }) {
  const hull = useMemo(() => {
    const pts: XZ[] = [
      ...venue.hackerTables.filter((t) => t.level === "mezz").map((t) => t.at),
      ...venue.sponsors.filter((s) => s.level === "mezz").map((s) => s.at),
      ...venue.geometry.mezzWalls.flatMap((w) => [w.a, w.b]),
      ...venue.geometry.merchRoom,
    ];
    return paddedHull(pts, 3.5);
  }, []);
  if (view === "main") return null;

  return (
    <group>
      <Slab poly={hull} y={MEZZ_HEIGHT - FLOOR_THICKNESS} depth={FLOOR_THICKNESS} color="#2b3447" opacity={0.88} />
      <Slab poly={venue.geometry.merchRoom} y={MEZZ_HEIGHT} depth={0.3} color="#3b4a66" />
      {venue.geometry.mezzWalls.map((w, i) => (
        <SegmentBox key={i} seg={w} y={MEZZ_HEIGHT} height={WALL_HEIGHT} thickness={0.35} color="#94a3b8" opacity={0.55} />
      ))}
      {venue.geometry.mezzDoors.map((d, i) => (
        <SegmentBox key={`d${i}`} seg={d} y={MEZZ_HEIGHT} height={0.3} thickness={0.9} color="#fbbf24" />
      ))}
    </group>
  );
}

/** Room polygons (slightly extruded, colored by kind) with labels. */
export function VenueRooms() {
  const rooms = venue.rooms;
  return (
    <group>
      {rooms.map((r) => (
        <Slab key={r.id} poly={r.poly} y={0} depth={ROOM_HEIGHT} color={ROOM_COLOR[r.kind] ?? "#34415a"} />
      ))}
      {rooms
        .filter((r) => r.kind !== "service")
        .map((r) => {
          const c = centroid(r.poly);
          const label = r.label ?? r.id.replace(/-/g, " ");
          return (
            <Label key={r.id} position={[c.x, ROOM_HEIGHT + 0.8, c.z]} text={label.replace(/\b\w/g, (m) => m.toUpperCase())} size={1.8} color="#a3a3a3" bg="transparent" />
          );
        })}
    </group>
  );
}

/** Named areas (Atrium, Broadway #1...) as faint floor-level captions. */
export function AreaLabels({ view = "all" }: { view?: LevelView }) {
  if (!isLevelVisible(view, "main")) return null;
  return (
    <>
      {venue.labels.map((l) => (
        <Label key={l.label} position={[l.at.x, 0.8, l.at.z]} text={l.label.toUpperCase()} size={3} color="#737373" bg="transparent" bold />
      ))}
    </>
  );
}

/** 304 hacker tables as instanced boxes, mezzanine raised to MEZZ_HEIGHT (step 4). Also check-in, service and printer tables. */
export function HackerTables({ view = "all" }: { view?: LevelView }) {
  const { main, mezz } = useMemo(
    () => ({
      main: venue.hackerTables.filter((t) => t.level === "main"),
      mezz: venue.hackerTables.filter((t) => t.level === "mezz"),
    }),
    [],
  );
  const g = venue.geometry;
  const showMain = isLevelVisible(view, "main");
  const showMezz = isLevelVisible(view, "mezz");
  return (
    <group>
      <InstancedBoxes rects={main} y={0} height={TABLE_HEIGHT} color="#7c8aa0" visible={showMain} />
      <InstancedBoxes rects={mezz} y={MEZZ_HEIGHT} height={TABLE_HEIGHT} color="#9aa8c0" visible={showMezz} />
      <InstancedBoxes rects={g.checkinTables} y={0} height={TABLE_HEIGHT} color="#b45309" visible={showMain} />
      <InstancedBoxes rects={g.serviceTables} y={0} height={TABLE_HEIGHT} color="#a16207" visible={showMain} />
      <InstancedBoxes rects={g.printerTables} y={MEZZ_HEIGHT} height={TABLE_HEIGHT} color="#a16207" visible={showMezz} />
    </group>
  );
}

/** Sponsor booths + amenities (step 4). Booth footprint is approximated from tableCount; the map has no booth sizes. */
export function Booths({ view = "all" }: { view?: LevelView }) {
  return (
    <group>
      {venue.sponsors
        .filter((s) => isLevelVisible(view, s.level))
        .map((s) => {
          const side = Math.min(7, Math.max(3, 2 + s.tableCount));
          const y = levelY(s.level);
          return (
            <group key={s.n}>
              <mesh position={[s.at.x, y + 0.5, s.at.z]}>
                <boxGeometry args={[side, 1, side]} />
                <meshStandardMaterial color={s.level === "mezz" ? "#3b82f6" : "#2563eb"} transparent opacity={0.75} />
              </mesh>
              <Label position={[s.at.x, y + 2.2, s.at.z]} text={s.name} size={1.6} color="#bfdbfe" bg="rgba(23,37,84,0.7)" />
            </group>
          );
        })}
      {venue.amenities
        .filter((a) => isLevelVisible(view, a.level))
        .map((a) => {
          const y = levelY(a.level);
          return (
            <group key={a.label}>
              <mesh position={[a.at.x, y + 1.6, a.at.z]}>
                <octahedronGeometry args={[1.1]} />
                <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.4} />
              </mesh>
              <Label position={[a.at.x, y + 3.9, a.at.z]} text={a.label} size={2} color="#fcd34d" bg="rgba(69,26,3,0.8)" />
            </group>
          );
        })}
    </group>
  );
}
