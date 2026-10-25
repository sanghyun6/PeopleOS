"use client";

import { Line } from "@react-three/drei";
import { useQuery } from "convex/react";
import { useMemo } from "react";
import * as THREE from "three";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import type { XZ } from "@/convex/lib/venueData";
import { Label } from "./Label";
import { SegmentBox, Slab } from "./VenueFloor";
import { isLevelVisible, type LevelView } from "./types";
import { useVenueView, type VenueMetaView } from "./venueView";
import { useCloseZoom, useNearZoom } from "./zoom";

// Same muted palette as the detailed model, so markers and routes stay the brightest things.
const ZONE_COLOR: Record<string, string> = {
  hall: "#232c3b",
  room: "#26303f",
  corridor: "#1f2733",
  stairs: "#363223",
  entrance: "#21302b",
  outdoor: "#1e2a24",
  service: "#1d2430",
  other: "#232c3b",
};
const WALL_COLOR = "#56627a";
const PILL_BLUE = "#3f6fd8";
const SLAB = 0.3;

const centroid = (poly: XZ[]): XZ => ({
  x: poly.reduce((s, p) => s + p.x, 0) / poly.length,
  z: poly.reduce((s, p) => s + p.z, 0) / poly.length,
});

/**
 * Venue drawn from a Venue Pack: building outline, one floor slab + see-through walls per zone
 * (wall height from the pack), zone name pills, and a small mesh per named place.
 * Used when the pack has no built-in detailed model.
 */
export function GenericVenue({ meta, view }: { meta: VenueMetaView; view: LevelView }) {
  const { elevation } = useVenueView();
  const near = useNearZoom();
  const graph = useQuery(api.zones.graph, {});
  const locations = useQuery(api.locations.list, {});
  const zoneName = useMemo(() => new Map(graph?.zones.map((z) => [z.key, z.name])), [graph]);
  const outlinePts = useMemo(
    () => [...meta.outline, meta.outline[0]].map((p) => new THREE.Vector3(p.x, 0.15, p.z)),
    [meta.outline],
  );

  return (
    <group>
      <Slab poly={meta.outline} y={-0.4} depth={0.4} color="#1d2531" />
      <Line points={outlinePts} color="#5b6880" lineWidth={1.5} />
      {meta.zoneShapes
        .filter((z) => isLevelVisible(view, z.level))
        .map((z) => {
          const y = elevation[z.level];
          const upper = z.level === "mezz";
          const c = centroid(z.polygon);
          const name = zoneName.get(z.key) ?? z.key;
          return (
            <group key={z.key}>
              <Slab poly={z.polygon} y={upper ? y - SLAB : 0} depth={SLAB} color={ZONE_COLOR[z.kind] ?? ZONE_COLOR.other} opacity={upper ? (view === "all" ? 0.35 : 0.9) : 1} />
              {z.polygon.map((a, i) => (
                <SegmentBox
                  key={i}
                  seg={{ a, b: z.polygon[(i + 1) % z.polygon.length] }}
                  y={y}
                  height={z.height}
                  thickness={0.3}
                  color={WALL_COLOR}
                  opacity={0.28}
                />
              ))}
              <Label
                position={[c.x, y + z.height + (near ? 0.8 : 2), c.z]}
                text={name}
                size={near ? 1.3 : 2}
                color="#ffffff"
                bg={PILL_BLUE}
                bold
                pill
              />
            </group>
          );
        })}
      {(locations ?? [])
        .filter((l) => l.kind !== "zone" && isLevelVisible(view, l.level))
        .map((l) => (
          <Place key={l._id} place={l} y={elevation[l.level]} />
        ))}
    </group>
  );
}

/** Table: small desk; booth: block; amenity: gold marker; room/entrance/area: post. Names at close zoom. */
function Place({ place, y }: { place: Doc<"locations">; y: number }) {
  const close = useCloseZoom();
  const { at, kind, label } = place;
  const mesh =
    kind === "table" ? (
      <mesh position={[at.x, y + 0.4, at.z]}>
        <boxGeometry args={[2.2, 0.8, 1.2]} />
        <meshStandardMaterial color="#b97f4b" />
      </mesh>
    ) : kind === "booth" ? (
      <mesh position={[at.x, y + 0.5, at.z]}>
        <boxGeometry args={[3.5, 1, 3.5]} />
        <meshStandardMaterial color="#38445f" />
      </mesh>
    ) : kind === "amenity" ? (
      <mesh position={[at.x, y + 1.4, at.z]}>
        <octahedronGeometry args={[0.9]} />
        <meshStandardMaterial color="#c9a45a" emissive="#c9a45a" emissiveIntensity={0.2} />
      </mesh>
    ) : (
      <mesh position={[at.x, y + 0.6, at.z]}>
        <cylinderGeometry args={[0.35, 0.35, 1.2, 12]} />
        <meshStandardMaterial color={kind === "entrance" ? "#2f8f68" : "#8d97a8"} />
      </mesh>
    );
  const text = kind === "table" ? label.replace(/^Table /, "") : label;
  return (
    <group>
      {mesh}
      {close && <Label position={[at.x, y + (kind === "table" ? 1.6 : 2.8), at.z]} text={text} size={kind === "table" ? 1 : 1.3} color="#c3cff5" />}
    </group>
  );
}
