"use client";

import { useRef, useState } from "react";
import { slugify } from "@/convex/lib/venuePack";
import { NextStepBadge } from "./NextStep";
import { inputClass } from "./fields";
import { connections, uniqueId, zoneForPlace, type Draft, type DraftPlace, type DraftZone, type PlaceKind } from "./draft";

type Mode = "zone" | "place" | "link" | "select";
type Selection = { kind: "zone" | "place"; id: string } | null;

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "zone", label: "Draw area", hint: "Drag a rectangle over each area (hall, room, lobby). Areas that touch are connected automatically." },
  { id: "place", label: "Add place", hint: "Click where a table, booth, restroom or help desk is, then name it." },
  { id: "link", label: "Link areas", hint: "Only for stairs, or areas that don't touch: click one area, then the other (switch floors in between for stairs)." },
  { id: "select", label: "Edit", hint: "Click an area or place to rename or delete it." },
];

const PLACE_KINDS: { id: PlaceKind; label: string }[] = [
  { id: "table", label: "Table" },
  { id: "booth", label: "Booth" },
  { id: "amenity", label: "Amenity (water, food, desk)" },
  { id: "room", label: "Room (restroom, office)" },
  { id: "entrance", label: "Entrance" },
];

const snap = (n: number) => Math.round(n * 2) / 2;

/**
 * Floor plan step: an uploaded image under an SVG in meters. People draw rectangular areas and
 * drop places; touching areas connect by themselves. Automatic area detection is not built.
 */
export function PlanEditor({ draft, setDraft, image, setImage }: {
  draft: Draft;
  setDraft: (update: (d: Draft) => Draft) => void;
  image: string | null;
  setImage: (url: string | null) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [mode, setMode] = useState<Mode>("zone");
  const [floor, setFloor] = useState(draft.floors[0]?.id ?? "ground");
  const [drag, setDrag] = useState<{ x0: number; z0: number; x1: number; z1: number } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selection>(null);
  const { widthM, heightM } = draft.plan;
  const currentFloor = draft.floors.some((f) => f.id === floor) ? floor : draft.floors[0].id;
  const zoneById = new Map(draft.zones.map((z) => [z.id, z]));
  const edges = connections(draft);
  const stroke = Math.max(widthM, heightM) / 400;

  const toPlan = (e: React.PointerEvent) => {
    const el = svg.current!;
    const pt = el.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(el.getScreenCTM()!.inverse());
    return { x: snap(Math.min(widthM, Math.max(0, p.x))), z: snap(Math.min(heightM, Math.max(0, p.y))) };
  };

  const addZone = (x0: number, z0: number, x1: number, z1: number) => {
    const w = Math.abs(x1 - x0);
    const d = Math.abs(z1 - z0);
    if (w < 1.5 || d < 1.5) return;
    const n = draft.zones.length + 1;
    const id = uniqueId(`area-${n}`, draft.zones.map((z) => z.id));
    const zone: DraftZone = { id, name: `Area ${n}`, floor: currentFloor, x: (x0 + x1) / 2, z: (z0 + z1) / 2, w, d, height: 3, kind: "hall" };
    setDraft((dr) => ({ ...dr, zones: [...dr.zones, zone] }));
    setSelected({ kind: "zone", id });
  };

  const addPlace = (x: number, z: number) => {
    const n = draft.places.length + 1;
    const id = uniqueId(`p${n}`, draft.places.map((p) => p.id));
    setDraft((dr) => ({ ...dr, places: [...dr.places, { id, name: `Place ${n}`, kind: "amenity", floor: currentFloor, x, z }] }));
    setSelected({ kind: "place", id });
  };

  const clickZone = (zone: DraftZone, e: React.PointerEvent) => {
    if (mode === "select") {
      e.stopPropagation();
      setSelected({ kind: "zone", id: zone.id });
    } else if (mode === "link") {
      e.stopPropagation();
      if (!pending) return setPending(zone.id);
      const a = zoneById.get(pending);
      if (a && a.id !== zone.id && !edges.some((ed) => (ed.from === a.id && ed.to === zone.id) || (ed.from === zone.id && ed.to === a.id))) {
        setDraft((dr) => ({ ...dr, extraEdges: [...dr.extraEdges, { from: a.id, to: zone.id, kind: a.floor === zone.floor ? "walk" : "stairs" }] }));
      }
      setPending(null);
    }
  };

  const renameZone = (id: string, name: string) => {
    // Ids follow names so a pasted staff list can use either; links, staff and the help desk follow.
    const nextId = uniqueId(slugify(name) || id, draft.zones.filter((z) => z.id !== id).map((z) => z.id));
    const swap = (x: string) => (x === id ? nextId : x);
    setSelected({ kind: "zone", id: nextId });
    setDraft((dr) => ({
      ...dr,
      zones: dr.zones.map((z) => (z.id === id ? { ...z, name, id: nextId } : z)),
      extraEdges: dr.extraEdges.map((e) => ({ ...e, from: swap(e.from), to: swap(e.to) })),
      staff: dr.staff.map((s) => ({ ...s, startZone: swap(s.startZone) })),
      event: dr.event.helpDesk === `zone:${id}` ? { ...dr.event, helpDesk: `zone:${nextId}` } : dr.event,
    }));
  };
  const updatePlace = (id: string, patch: Partial<DraftPlace>) =>
    setDraft((dr) => ({ ...dr, places: dr.places.map((p) => (p.id === id ? { ...p, ...patch, ...(patch.name ? { key: undefined } : {}) } : p)) }));
  const remove = (sel: NonNullable<Selection>) => {
    setDraft((dr) =>
      sel.kind === "zone"
        ? { ...dr, zones: dr.zones.filter((z) => z.id !== sel.id), extraEdges: dr.extraEdges.filter((e) => e.from !== sel.id && e.to !== sel.id) }
        : { ...dr, places: dr.places.filter((p) => p.id !== sel.id) },
    );
    setSelected(null);
  };

  const onImage = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(url);
      // Keep the plan width; height follows the image's aspect ratio.
      setDraft((dr) => ({ ...dr, plan: { ...dr.plan, heightM: Math.round((dr.plan.widthM * img.height) / img.width) } }));
    };
    img.src = url;
  };

  const zone = selected?.kind === "zone" ? zoneById.get(selected.id) : undefined;
  const place = selected?.kind === "place" ? draft.places.find((p) => p.id === selected.id) : undefined;
  const tab = (active: boolean) =>
    `h-8 rounded-lg px-3 font-medium transition ${active ? "bg-raised text-fg ring-1 ring-inset ring-line-strong" : "text-muted hover:text-fg"}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Tool" className="flex gap-1 rounded-xl bg-surface p-1 text-xs ring-1 ring-inset ring-line">
            {MODES.map((m) => (
              <button key={m.id} type="button" onClick={() => (setMode(m.id), setPending(null))} aria-pressed={mode === m.id} className={tab(mode === m.id)}>
                {m.label}
              </button>
            ))}
          </div>
          {draft.floors.length > 1 && (
            <div role="group" aria-label="Floor" className="flex gap-1 rounded-xl bg-surface p-1 text-xs ring-1 ring-inset ring-line">
              {draft.floors.map((f) => (
                <button key={f.id} type="button" onClick={() => setFloor(f.id)} aria-pressed={currentFloor === f.id} className={tab(currentFloor === f.id)}>
                  {f.name}
                </button>
              ))}
            </div>
          )}
          <label className="ml-auto flex h-10 cursor-pointer items-center rounded-lg bg-surface px-3 text-sm ring-1 ring-inset ring-line transition hover:bg-raised">
            {image ? "Replace floor plan image" : "Upload floor plan image (optional)"}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => onImage(e.target.files?.[0])} />
          </label>
        </div>
        <p className="mb-2 text-sm text-muted">
          {MODES.find((m) => m.id === mode)?.hint}
          {mode === "link" && pending && <> First area: <span className="text-fg">{zoneById.get(pending)?.name}</span>.</>}
        </p>

        <div className="overflow-hidden rounded-xl bg-ink ring-1 ring-inset ring-line">
          <svg
            ref={svg}
            viewBox={`0 0 ${widthM} ${heightM}`}
            className={`block w-full touch-none select-none ${mode === "select" ? "cursor-default" : "cursor-crosshair"}`}
            role="img"
            aria-label="Floor plan editor"
            onPointerDown={(e) => {
              const p = toPlan(e);
              if (mode === "zone") {
                svg.current?.setPointerCapture(e.pointerId);
                setDrag({ x0: p.x, z0: p.z, x1: p.x, z1: p.z });
              } else if (mode === "place") addPlace(p.x, p.z);
              else if (mode === "select") setSelected(null);
            }}
            onPointerMove={(e) => drag && setDrag({ ...drag, ...((p) => ({ x1: p.x, z1: p.z }))(toPlan(e)) })}
            onPointerUp={() => {
              if (drag) addZone(drag.x0, drag.z0, drag.x1, drag.z1);
              setDrag(null);
            }}
          >
            {image && <image href={image} x={0} y={0} width={widthM} height={heightM} preserveAspectRatio="none" opacity={0.55} />}
            {Array.from({ length: Math.floor(widthM / 5) + 1 }, (_, i) => (
              <line key={`gx${i}`} x1={i * 5} y1={0} x2={i * 5} y2={heightM} stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
            ))}
            {Array.from({ length: Math.floor(heightM / 5) + 1 }, (_, i) => (
              <line key={`gz${i}`} x1={0} y1={i * 5} x2={widthM} y2={i * 5} stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
            ))}
            {[...draft.zones].sort((a, b) => Number(a.floor === currentFloor) - Number(b.floor === currentFloor)).map((z) => {
              const here = z.floor === currentFloor;
              const hot = (selected?.kind === "zone" && selected.id === z.id) || pending === z.id;
              return (
                <g key={z.id} opacity={here ? 1 : 0.3} pointerEvents={here || mode === "link" ? "auto" : "none"} onPointerDown={(e) => clickZone(z, e)}>
                  <rect
                    x={z.x - z.w / 2}
                    y={z.z - z.d / 2}
                    width={z.w}
                    height={z.d}
                    fill="#232c3b"
                    fillOpacity={image ? 0.65 : 0.9}
                    stroke={hot ? "#7f9bff" : "#56627a"}
                    strokeWidth={stroke * (hot ? 3 : 1.5)}
                    strokeDasharray={here ? undefined : `${stroke * 4} ${stroke * 3}`}
                  />
                  <text x={z.x} y={z.z} textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(1.2, Math.min(z.w / 8, 2.4))} fill="#e7ebf2">
                    {z.name}
                  </text>
                </g>
              );
            })}
            {edges.map((e, i) => {
              const [a, b] = [zoneById.get(e.from), zoneById.get(e.to)];
              if (!a || !b) return null;
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.z}
                  x2={b.x}
                  y2={b.z}
                  stroke={e.kind === "stairs" ? "#f2b23e" : "#7f9bff"}
                  strokeOpacity={0.7}
                  strokeWidth={stroke * 2}
                  strokeDasharray={e.kind === "stairs" ? `${stroke * 5} ${stroke * 3}` : undefined}
                  pointerEvents="none"
                />
              );
            })}
            {draft.places.map((p) => {
              const here = p.floor === currentFloor;
              const isSel = selected?.kind === "place" && selected.id === p.id;
              return (
                <g
                  key={p.id}
                  opacity={here ? 1 : 0.3}
                  pointerEvents={here && mode === "select" ? "auto" : "none"}
                  onPointerDown={(e) => (e.stopPropagation(), setSelected({ kind: "place", id: p.id }))}
                >
                  <circle cx={p.x} cy={p.z} r={1.8} fill="transparent" />
                  <circle cx={p.x} cy={p.z} r={isSel ? 0.9 : 0.6} fill={p.kind === "table" ? "#b97f4b" : p.kind === "booth" ? "#8ea2d8" : "#c9a45a"} stroke={isSel ? "#ffffff" : "none"} strokeWidth={stroke * 2} />
                  <text x={p.x + 1} y={p.z} dominantBaseline="middle" fontSize={1.1} fill="#c3cff5">
                    {p.name}
                  </text>
                </g>
              );
            })}
            {drag && (
              <rect
                x={Math.min(drag.x0, drag.x1)}
                y={Math.min(drag.z0, drag.z1)}
                width={Math.abs(drag.x1 - drag.x0)}
                height={Math.abs(drag.z1 - drag.z0)}
                fill="#7f9bff"
                fillOpacity={0.15}
                stroke="#7f9bff"
                strokeWidth={stroke * 2}
              />
            )}
          </svg>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
          <label className="flex items-center gap-2">
            Plan is about
            <input
              type="number"
              min={5}
              value={widthM}
              aria-label="Plan width in meters"
              onChange={(e) => {
                const w = Math.max(5, Number(e.target.value) || 5);
                setDraft((dr) => ({ ...dr, plan: { widthM: w, heightM: Math.round((dr.plan.heightM * w) / dr.plan.widthM) } }));
              }}
              className={`${inputClass} h-8 w-20`}
            />
            m wide
          </label>
          <span className="inline-flex items-center gap-2 text-faint">
            Detect areas from the image automatically <NextStepBadge title="Not built yet: draw areas by hand." />
          </span>
        </div>
      </div>

      <aside className="space-y-4">
        {zone && (
          <Panel title="Area">
            <input aria-label="Area name" value={zone.name} onChange={(e) => renameZone(zone.id, e.target.value)} className={inputClass} />
            <button type="button" onClick={() => remove({ kind: "zone", id: zone.id })} className="text-sm text-red hover:underline">
              Delete area
            </button>
          </Panel>
        )}
        {place && (
          <Panel title="Place">
            <input aria-label="Place name" value={place.name} onChange={(e) => updatePlace(place.id, { name: e.target.value })} className={inputClass} />
            <select aria-label="Place type" value={place.kind} onChange={(e) => updatePlace(place.id, { kind: e.target.value as PlaceKind })} className={inputClass}>
              {PLACE_KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-faint">In {zoneForPlace(place, draft.zones)?.name ?? "no area yet"}.</p>
            <button type="button" onClick={() => remove({ kind: "place", id: place.id })} className="text-sm text-red hover:underline">
              Delete place
            </button>
          </Panel>
        )}

        <Panel title={`${draft.zones.length} areas · ${draft.places.length} places`}>
          <ul className="max-h-64 space-y-1 overflow-auto text-sm">
            {draft.zones.map((z) => (
              <li key={z.id}>
                <button type="button" onClick={() => (setFloor(z.floor), setSelected({ kind: "zone", id: z.id }), setMode("select"))} className="w-full truncate text-left text-muted hover:text-fg">
                  ▭ {z.name}
                  {draft.floors.length > 1 && <span className="text-faint"> · {draft.floors.find((f) => f.id === z.floor)?.name}</span>}
                </button>
              </li>
            ))}
            {draft.places.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => (setFloor(p.floor), setSelected({ kind: "place", id: p.id }), setMode("select"))} className="w-full truncate text-left text-muted hover:text-fg">
                  • {p.name}
                </button>
              </li>
            ))}
            {draft.zones.length === 0 && <li className="text-faint">Start by drawing the main areas.</li>}
          </ul>
        </Panel>

        {draft.extraEdges.length > 0 && (
          <Panel title="Stairs and extra links">
            <ul className="space-y-1 text-sm">
              {draft.extraEdges.map((e, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">
                    {zoneById.get(e.from)?.name} {e.kind === "stairs" ? "⇅" : "↔"} {zoneById.get(e.to)?.name}
                  </span>
                  <button type="button" aria-label="Remove link" onClick={() => setDraft((dr) => ({ ...dr, extraEdges: dr.extraEdges.filter((_, j) => j !== i) }))} className="text-faint hover:text-red">
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </aside>
    </div>
  );
}

export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-inset ring-line">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}
