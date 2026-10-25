"use client";

import { Canvas } from "@react-three/fiber";
import { useCallback, useMemo, useRef, useState } from "react";
import { CameraRig, frameFor, type CameraApi } from "./CameraRig";
import { AreaLabels, Booths, HackerTables, MezzanineDeck, VenueFloor, VenueRooms } from "./VenueFloor";
import { GenericVenue } from "./GenericVenue";
import { IncidentMarker } from "./IncidentMarker";
import { RouteLine } from "./RouteLine";
import { StaffDot } from "./StaffDot";
import { ACCENT_HEX, COLOR_HEX, isLevelVisible, type LevelView, type VenueSceneProps } from "./types";
import { VenueViewProvider, useVenueMeta, venueViewFor } from "./venueView";
import { ZoomProvider } from "./zoom";

/**
 * R3F venue: floor, rooms, tables, mezzanine, plus incident markers, staff dots and route lines.
 * Fills its parent (give the parent a height). Everything is optional so `<VenueScene />` still works.
 * The built-in Cal Hacks model is drawn unless a loaded Venue Pack has no detailed model; then
 * GenericVenue draws the pack's zones and places.
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
  const meta = useVenueMeta();
  const venueView = useMemo(() => venueViewFor(meta ?? null), [meta]);
  const frame = useMemo(() => (meta && !venueView.detailed ? frameFor(meta.outline) : undefined), [meta, venueView.detailed]);
  const levels: { id: LevelView; label: string }[] = [{ id: "all", label: "All" }, ...venueView.floors.map((f) => ({ id: f.level, label: f.label }))];
  const camera = useRef<CameraApi>(null);
  const compass = useRef<HTMLSpanElement>(null);
  const selected = incidents.find((i) => i._id === selectedId);
  const onHeading = useCallback((azimuth: number) => {
    if (compass.current) compass.current.style.transform = `rotate(${azimuth}rad)`;
  }, []);

  return (
    <div className="@container relative h-full w-full">
      <Canvas camera={{ position: [0, 140, 110], fov: 45, near: 1, far: 2000 }}>
        <color attach="background" args={["#0d1117"]} />
        <fog attach="fog" args={["#0d1117", 320, 720]} />
        <hemisphereLight args={["#d6defc", "#1a2030", 1.2]} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[60, 140, 80]} intensity={1.1} />
        <directionalLight position={[-80, 60, -40]} intensity={0.25} color="#9fb2ff" />
        {/* Wait for the venue (one round trip) so the camera frames the right building. */}
        {meta !== undefined && (
        <VenueViewProvider value={venueView}>
        <ZoomProvider scale={frame ? Math.min(1, frame.halfW / 108) : 1}>
        {venueView.detailed || !meta ? (
          <>
            <VenueFloor />
            <VenueRooms />
            <MezzanineDeck view={view} />
            <AreaLabels view={view} />
            <HackerTables view={view} />
            <Booths view={view} />
          </>
        ) : (
          <GenericVenue meta={meta} view={view} />
        )}

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
        </ZoomProvider>

        <CameraRig
          apiRef={camera}
          frame={frame}
          focus={selected ? [selected.at.x, venueView.elevation[selected.level], selected.at.z] : null}
          focusKey={selectedId}
          onHeading={onHeading}
        />
        </VenueViewProvider>
        )}
      </Canvas>

      {levels.length > 2 && (
      <div
        role="group"
        aria-label="Floor"
        className="absolute left-4 top-4 z-20 flex gap-1 rounded-xl bg-overlay p-1 text-xs ring-1 ring-inset ring-line backdrop-blur"
      >
        {levels.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setView(l.id)}
            aria-pressed={view === l.id}
            className={`h-8 rounded-lg px-3 font-medium transition ${
              view === l.id ? "bg-raised text-fg ring-1 ring-inset ring-line-strong" : "text-muted hover:text-fg"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      )}

      <div
        role="group"
        aria-label="Camera"
        className="absolute right-4 bottom-4 z-20 flex flex-col overflow-hidden rounded-xl bg-overlay text-fg ring-1 ring-inset ring-line backdrop-blur"
      >
        {[
          { label: "Zoom in", glyph: "+", factor: 0.6 },
          { label: "Zoom out", glyph: "\u2212", factor: 1 / 0.6 },
        ].map((b) => (
          <button
            key={b.label}
            type="button"
            aria-label={b.label}
            title={b.label}
            onClick={() => camera.current?.zoomBy(b.factor)}
            className="grid size-9 place-items-center border-b border-line text-lg leading-none text-muted transition hover:bg-raised hover:text-fg"
          >
            {b.glyph}
          </button>
        ))}
        <button
          type="button"
          aria-label="Reset to north"
          title="Reset to north"
          onClick={() => camera.current?.resetHeading()}
          className="grid size-9 place-items-center text-muted transition hover:bg-raised hover:text-fg"
        >
          <span ref={compass} className="block">
            <svg width="14" height="18" viewBox="0 0 14 18" aria-hidden>
              <path d="M7 0 L12 9 L2 9 Z" fill="#f0605d" />
              <path d="M7 18 L12 9 L2 9 Z" fill="currentColor" />
            </svg>
          </span>
        </button>
      </div>

      <ul className="pointer-events-none absolute right-17 bottom-4 z-20 hidden flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-overlay px-3 py-2 text-[11px] text-muted ring-1 ring-inset ring-line backdrop-blur @md:flex">
        {[
          { hex: COLOR_HEX.red, text: "Needs staff" },
          { hex: COLOR_HEX.yellow, text: "On it" },
          { hex: COLOR_HEX.green, text: "Resolved" },
        ].map((k) => (
          <li key={k.text} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: k.hex }} />
            {k.text}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: ACCENT_HEX }} />
          Route
        </li>
      </ul>
    </div>
  );
}
