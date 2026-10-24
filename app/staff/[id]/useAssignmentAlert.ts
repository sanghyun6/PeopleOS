"use client";

import { useEffect, useRef } from "react";
import type { Id } from "@/convex/_generated/dataModel";

function beep(ctx: AudioContext) {
  [880, 1175, 880].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.value = 0.25;
    osc.connect(gain).connect(ctx.destination);
    const t = ctx.currentTime + i * 0.22;
    osc.start(t);
    osc.stop(t + 0.16);
  });
}

/**
 * Beep + navigator.vibrate when a new offered assignment id appears (step 6).
 * Pass `undefined` while loading so the first snapshot never alerts.
 * Browsers only allow audio after a user gesture, so the first tap unlocks it.
 */
export function useAssignmentAlert(latestOfferedId: Id<"assignments"> | null | undefined): void {
  const seen = useRef<Id<"assignments"> | null | undefined>(undefined);
  const audio = useRef<AudioContext | null>(null);

  useEffect(() => {
    const unlock = () => {
      audio.current ??= new AudioContext();
      void audio.current.resume();
    };
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    if (latestOfferedId === undefined) return;
    const isNew = seen.current !== undefined && latestOfferedId !== null && latestOfferedId !== seen.current;
    seen.current = latestOfferedId;
    if (!isNew) return;
    navigator.vibrate?.([300, 100, 300, 100, 600]);
    if (audio.current?.state === "running") beep(audio.current);
  }, [latestOfferedId]);
}
