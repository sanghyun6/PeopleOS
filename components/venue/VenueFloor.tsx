"use client";

import { Line } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { MEZZ_HEIGHT, venue, type PlacedRect, type Segment, type VenueLevel, type XZ } from "@/convex/lib/venueData";
import { Label } from "./Label";
import { isLevelVisible, type LevelView } from "./types";
import { useCloseZoom, useNearZoom } from "./zoom";

const FLOOR_THICKNESS = 0.4;
const ROOM_HEIGHT = 0.5;
const TABLE_HEIGHT = 0.8;
const WALL_HEIGHT = 2.6;

// Muted, close in value so rooms read as zones without competing with incident markers.
const ROOM_COLOR: Record<string, string> = {
  service: "#1d2430",
  green: "#21302b",
  room: "#232c3b",
  catering: "#2f2a24",
  restroom: "#1f2d33",
  theater: "#2a2538",
  stair: "#363223",
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
  const near = useNearZoom();
  const { stage, mainWalls, entrances } = { stage: venue.geometry.stage, mainWalls: venue.geometry.mainWalls, entrances: venue.entrances };

  return (
    <group>
      <Slab poly={venue.outline} y={-FLOOR_THICKNESS} depth={FLOOR_THICKNESS} color="#1d2531" />
      <Line points={outlinePts} color="#5b6880" lineWidth={1.5} />
      <Slab poly={stage} y={0} depth={0.9} color="#2e2840" />
      {mainWalls.map((w, i) => (
        <SegmentBox key={i} seg={w} y={0} height={WALL_HEIGHT} thickness={0.35} color="#3b4555" opacity={0.6} />
      ))}
      {entrances.map((e) => (
        <group key={e.id}>
          <SegmentBox seg={{ a: e.a, b: e.b }} y={0} height={0.4} thickness={0.8} color="#2f8f68" />
          {near && (
            <Label position={[(e.a.x + e.b.x) / 2, 2.2, (e.a.z + e.b.z) / 2]} text={e.label} size={1.4} color="#8be0bb" />
          )}
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
      <Slab poly={hull} y={MEZZ_HEIGHT - FLOOR_THICKNESS} depth={FLOOR_THICKNESS} color="#222b3a" opacity={0.85} />
      <Slab poly={venue.geometry.merchRoom} y={MEZZ_HEIGHT} depth={0.3} color="#2c3649" />
      {venue.geometry.mezzWalls.map((w, i) => (
        <SegmentBox key={i} seg={w} y={MEZZ_HEIGHT} height={WALL_HEIGHT} thickness={0.35} color="#56627a" opacity={0.45} />
      ))}
      {venue.geometry.mezzDoors.map((d, i) => (
        <SegmentBox key={`d${i}`} seg={d} y={MEZZ_HEIGHT} height={0.3} thickness={0.9} color="#8a7a4c" />
      ))}
    </group>
  );
}

/** Room polygons (slightly extruded, colored by kind) with labels. */
export function VenueRooms() {
  const rooms = venue.rooms;
  const near = useNearZoom();
  return (
    <group>
      {rooms.map((r) => (
        <Slab key={r.id} poly={r.poly} y={0} depth={ROOM_HEIGHT} color={ROOM_COLOR[r.kind] ?? "#34415a"} />
      ))}
      {near &&
        rooms
        .filter((r) => r.kind !== "service")
        .map((r) => {
          const c = centroid(r.poly);
          const label = r.label ?? r.id.replace(/-/g, " ");
          return (
            <Label key={r.id} position={[c.x, ROOM_HEIGHT + 0.8, c.z]} text={label.replace(/\b\w/g, (m) => m.toUpperCase())} size={1.5} color="#8d97a8" bg="transparent" />
          );
        })}
    </group>
  );
}

/** Named areas (Atrium, Broadway #1...) as faint floor-level captions; the only labels kept at far zoom. */
export function AreaLabels({ view = "all" }: { view?: LevelView }) {
  if (!isLevelVisible(view, "main")) return null;
  return (
    <>
      {venue.labels.map((l) => (
        <Label key={l.label} position={[l.at.x, 0.8, l.at.z]} text={l.label} size={2.6} color="#5d6879" bg="transparent" bold />
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
      <InstancedBoxes rects={main} y={0} height={TABLE_HEIGHT} color="#5a667b" visible={showMain} />
      <InstancedBoxes rects={mezz} y={MEZZ_HEIGHT} height={TABLE_HEIGHT} color="#6b7790" visible={showMezz} />
      <InstancedBoxes rects={g.checkinTables} y={0} height={TABLE_HEIGHT} color="#6b5636" visible={showMain} />
      <InstancedBoxes rects={g.serviceTables} y={0} height={TABLE_HEIGHT} color="#5f5034" visible={showMain} />
      <InstancedBoxes rects={g.printerTables} y={MEZZ_HEIGHT} height={TABLE_HEIGHT} color="#5f5034" visible={showMezz} />
    </group>
  );
}

/** One sponsor booth; its name shows at close zoom or on hover. */
function Booth({ name, at, level, tableCount }: { name: string; at: XZ; level: VenueLevel; tableCount: number }) {
  const near = useCloseZoom();
  const [hovered, setHovered] = useState(false);
  const side = Math.min(7, Math.max(3, 2 + tableCount));
  const y = levelY(level);
  return (
    <group>
      <mesh
        position={[at.x, y + 0.5, at.z]}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[side, 1, side]} />
        <meshStandardMaterial color={hovered ? "#5a6c9e" : "#38445f"} />
      </mesh>
      {(near || hovered) && <Label position={[at.x, y + 2.2, at.z]} text={name} size={hovered ? 2 : 1.4} color="#c3cff5" />}
    </group>
  );
}

/** Amenity (food, luggage...): small marker, label at close zoom or on hover. */
function Amenity({ label, at, level }: { label: string; at: XZ; level: VenueLevel }) {
  const near = useCloseZoom();
  const [hovered, setHovered] = useState(false);
  const y = levelY(level);
  return (
    <group>
      <mesh
        position={[at.x, y + 1.4, at.z]}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <octahedronGeometry args={[0.9]} />
        <meshStandardMaterial color="#c9a45a" emissive="#c9a45a" emissiveIntensity={hovered ? 0.6 : 0.2} />
      </mesh>
      {(near || hovered) && <Label position={[at.x, y + 3.4, at.z]} text={label} size={hovered ? 2 : 1.5} color="#e6cf98" />}
    </group>
  );
}

/** Sponsor booths + amenities (step 4). Booth footprint is approximated from tableCount; the map has no booth sizes. */
export function Booths({ view = "all" }: { view?: LevelView }) {
  return (
    <group>
      {venue.sponsors
        .filter((s) => isLevelVisible(view, s.level))
        .map((s) => (
          <Booth key={s.n} name={s.name} at={s.at} level={s.level} tableCount={s.tableCount} />
        ))}
      {venue.amenities
        .filter((a) => isLevelVisible(view, a.level))
        .map((a) => (
          <Amenity key={a.label} label={a.label} at={a.at} level={a.level} />
        ))}
    </group>
  );
}
