"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

type LabelStyle = { color: string; bg: string; bold: boolean };

const cache = new Map<string, { texture: THREE.CanvasTexture; aspect: number }>();

/** Text -> canvas texture, cached. A sprite instead of drei <Html>: no DOM overlay, no CDN font fetch. */
function textTexture(text: string, { color, bg, bold }: LabelStyle) {
  const key = `${text}|${color}|${bg}|${bold}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const px = 48;
  const family = getComputedStyle(document.body).fontFamily || "ui-sans-serif, system-ui, sans-serif";
  const font = `${bold ? 600 : 500} ${px}px ${family}`;
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.font = font;
  const padX = px * 0.35;
  const w = Math.ceil(ctx.measureText(text).width + padX * 2);
  const h = Math.ceil(px * 1.5);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d")!;
  if (bg !== "transparent") {
    c.fillStyle = bg;
    c.beginPath();
    c.roundRect(0, 0, w, h, h * 0.25);
    c.fill();
  }
  c.font = font;
  c.fillStyle = color;
  c.textBaseline = "middle";
  c.textAlign = "center";
  c.fillText(text, w / 2, h / 2 + px * 0.04);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const entry = { texture, aspect: w / h };
  cache.set(key, entry);
  return entry;
}

/** World-space text label (billboard sprite). `size` is the label height in meters. */
export function Label({
  position,
  text,
  size = 2,
  color = "#e7ebf2",
  bg = "rgba(13,17,23,0.82)",
  bold = false,
  onTop = false,
}: {
  position: [number, number, number];
  text: string;
  size?: number;
  color?: string;
  bg?: string;
  bold?: boolean;
  /** Draw over other geometry (for badges that must never be hidden). */
  onTop?: boolean;
}) {
  const { texture, aspect } = useMemo(() => textTexture(text, { color, bg, bold }), [text, color, bg, bold]);
  const material = useMemo(
    () => new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: !onTop }),
    [texture, onTop],
  );
  useEffect(() => () => material.dispose(), [material]);

  return (
    <sprite
      position={position}
      scale={[size * aspect, size, 1]}
      material={material}
      renderOrder={onTop ? 10 : 1}
      raycast={() => null}
    />
  );
}
