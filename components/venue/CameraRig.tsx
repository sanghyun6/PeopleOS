"use client";

import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import * as THREE from "three";
import { MOUSE, TOUCH } from "three";
import { venue, type XZ } from "@/convex/lib/venueData";

const MIN_DISTANCE = 12;
const MAX_DISTANCE = 420;
/** Wheel zoom strength: log-distance change per pixel of deltaY (one mouse notch ~ x1.65 closer/farther). */
const WHEEL_ZOOM_GAIN = 0.005;
/** Cap on queued zoom, so a fast spin cannot overshoot the whole venue. */
const WHEEL_ZOOM_MAX = 2.5;
/** Never look from below ~15deg above the horizon, so the camera can't sink under the floor. */
const MAX_POLAR = Math.PI * 0.42;
const HOME_TARGET = new THREE.Vector3(0, 0, 5);
/** Camera distance after flying to a selected point (inside the "near" label tier). */
const FOCUS_DISTANCE = 55;

const boundsOf = (outline: XZ[]) =>
  outline.reduce(
    (b, p) => ({ minX: Math.min(b.minX, p.x), maxX: Math.max(b.maxX, p.x), minZ: Math.min(b.minZ, p.z), maxZ: Math.max(b.maxZ, p.z) }),
    { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
  );

/** Where the camera starts and how far it may pan: the building bounds, home target, and the half extents to fit. */
export type CameraFrame = ReturnType<typeof boundsOf> & { home: THREE.Vector3; halfW: number; halfD: number };

// Keep the orbit target over the building, with a little slack. Fit the whole building (~215 m wide).
const CAL_HACKS_FRAME: CameraFrame = { ...boundsOf(venue.outline), home: HOME_TARGET, halfW: 108, halfD: 62 };

/** Frame for another venue's outline (Venue Pack). */
export function frameFor(outline: XZ[]): CameraFrame {
  const b = boundsOf(outline);
  const home = new THREE.Vector3((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
  // Margin for the tilted view and upper floors, which sit closer to the camera.
  return { ...b, home, halfW: (b.maxX - b.minX) * 0.65 + 8, halfD: (b.maxZ - b.minZ) * 0.65 + 8 };
}

export type CameraApi = {
  /** factor < 1 zooms in, > 1 zooms out. */
  zoomBy: (factor: number) => void;
  /** Turn back to north-up at the default tilt, keeping target and distance. */
  resetHeading: () => void;
  flyTo: (point: [number, number, number]) => void;
};

type Controls = THREE.EventDispatcher<{ start: object }> & { mouseButtons: { LEFT: MOUSE | null }; target: THREE.Vector3; getAzimuthalAngle: () => number };

type Flight = { fromPos: THREE.Vector3; toPos: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3; t0: number; dur: number };

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Orbit controls (drag = orbit, right-drag = pan, wheel/pinch = zoom to cursor, damped) plus animated
 * camera moves for the overlay buttons and selection fly-to. `onHeading` gets the azimuth each frame
 * so the compass can rotate without React re-renders.
 */
export function CameraRig({
  apiRef,
  focus,
  focusKey,
  onHeading,
  frame = CAL_HACKS_FRAME,
}: {
  frame?: CameraFrame;
  apiRef: Ref<CameraApi>;
  focus: [number, number, number] | null;
  focusKey: string | null;
  onHeading?: (azimuth: number) => void;
}) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as Controls | null;
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const gl = useThree((s) => s.gl);
  const flight = useRef<Flight | null>(null);
  // Wheel zoom still to apply (log of distance factor) and the ground point it zooms towards.
  // Inertia left over from a grab-pan (ground m/s), applied and decayed each frame.
  const glide = useRef(new THREE.Vector3());
  const wheel = useRef({ pending: 0, anchor: new THREE.Vector3() });
  const homePolar = useRef(0.96);

  // Fit the whole building once, at the canvas aspect.
  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera;
    const tanHalf = Math.tan((persp.fov * Math.PI) / 360);
    const dist = Math.max(frame.halfW / (tanHalf * aspect), frame.halfD / tanHalf);
    camera.position.set(frame.home.x, dist * 0.82, frame.home.z + dist * 0.57);
    camera.lookAt(frame.home);
    homePolar.current = Math.atan2(0.57, 0.82);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Any user drag/wheel cancels a flight in progress.
  useEffect(() => {
    if (!controls) return;
    const stop = () => (flight.current = null);
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [controls]);

  // Own wheel handling: the stock controls take a fixed step per event (jumpy on mice, too fast on
  // trackpads). This scales by deltaY, eases over a few frames, and zooms towards the cursor.
  useEffect(() => {
    if (!controls) return;
    const el = gl.domElement;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      flight.current = null;
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      const rect = el.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -controls.target.y);
      if (!ray.ray.intersectPlane(plane, wheel.current.anchor)) wheel.current.anchor.copy(controls.target);
      wheel.current.pending = THREE.MathUtils.clamp(wheel.current.pending + THREE.MathUtils.clamp(dy, -150, 150) * WHEEL_ZOOM_GAIN, -WHEEL_ZOOM_MAX, WHEEL_ZOOM_MAX);
    };
    el.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => el.removeEventListener("wheel", onWheel, { capture: true });
  }, [controls, gl, camera]);

  // Grab-pan: left drag / one finger. The ground point under the pointer at press time stays under
  // the pointer for the whole drag, at any distance or tilt. Shift+left (and right) drag rotate via
  // the stock controls, which swap LEFT<->PAN when shift is held.
  useEffect(() => {
    if (!controls) return;
    const el = gl.domElement;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const anchor = new THREE.Vector3();
    const hit = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const touches = new Set<number>();
    let active: number | null = null;
    let last = { t: 0, v: new THREE.Vector3() };

    const groundAt = (e: PointerEvent, out: THREE.Vector3) => {
      const rect = el.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      plane.constant = -controls.target.y;
      return ray.ray.intersectPlane(plane, out) !== null;
    };
    const stop = () => {
      active = null;
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") {
        touches.add(e.pointerId);
        if (touches.size > 1) return stop(); // two fingers: the controls zoom + rotate
      } else if (e.button !== 0) {
        return; // right = rotate (controls)
      } else {
        // Shift+left: let the controls rotate (they swap PAN for ROTATE with shift); otherwise disable theirs.
        controls.mouseButtons.LEFT = e.shiftKey ? MOUSE.PAN : (-1 as MOUSE);
        if (e.shiftKey) return;
      }
      if (!groundAt(e, anchor)) return;
      flight.current = null;
      glide.current.set(0, 0, 0);
      active = e.pointerId;
      last = { t: performance.now(), v: new THREE.Vector3() };
    };
    const onMove = (e: PointerEvent) => {
      if (active !== e.pointerId || !groundAt(e, hit)) return;
      const d = anchor.clone().sub(hit);
      d.y = 0;
      camera.position.add(d);
      controls.target.add(d);
      camera.updateMatrixWorld(); // the next ray must see the moved camera, or the grab overshoots
      const now = performance.now();
      const dt = Math.max(1, now - last.t) / 1000;
      last = { t: now, v: d.divideScalar(dt) };
    };
    const onUp = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      if (active !== e.pointerId) return;
      active = null;
      // Only glide if the pointer was still moving when released.
      if (performance.now() - last.t < 60) glide.current.copy(last.v).clampLength(0, 400);
    };

    el.addEventListener("pointerdown", onDown, { capture: true });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown, { capture: true });
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [controls, gl, camera]);

  const fly = (toPos: THREE.Vector3, toTarget: THREE.Vector3, dur = 0.9) => {
    if (!controls) return;
    flight.current = { fromPos: camera.position.clone(), toPos, fromTarget: controls.target.clone(), toTarget, t0: performance.now(), dur: dur * 1000 };
  };

  /** Camera position at `dist` from `target`, keeping the current heading; tilt clamped to a readable range. */
  const orbitPos = (target: THREE.Vector3, dist: number, polar?: number, azimuth?: number) => {
    const s = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls?.target ?? frame.home));
    s.radius = THREE.MathUtils.clamp(dist, MIN_DISTANCE, MAX_DISTANCE);
    if (polar !== undefined) s.phi = polar;
    if (azimuth !== undefined) s.theta = azimuth;
    s.phi = THREE.MathUtils.clamp(s.phi, 0.05, MAX_POLAR);
    return new THREE.Vector3().setFromSpherical(s).add(target);
  };

  useImperativeHandle(apiRef, () => ({
    zoomBy: (factor) => {
      if (!controls) return;
      const target = flight.current?.toTarget ?? controls.target;
      const from = flight.current?.toPos ?? camera.position;
      fly(orbitPos(target.clone(), from.distanceTo(target) * factor), target.clone(), 0.35);
    },
    resetHeading: () => {
      if (!controls) return;
      fly(orbitPos(controls.target.clone(), camera.position.distanceTo(controls.target), homePolar.current, 0), controls.target.clone(), 0.7);
    },
    flyTo: (p) => {
      const target = new THREE.Vector3(...p);
      fly(orbitPos(target, Math.min(FOCUS_DISTANCE, camera.position.distanceTo(controls?.target ?? frame.home)), Math.min(0.9, MAX_POLAR)), target);
    },
  }));

  // Fly to the selection when it changes (not when the selected incident merely updates).
  const focusRef = useRef(focus);
  useEffect(() => {
    focusRef.current = focus;
  });
  useEffect(() => {
    if (!focusKey || !focusRef.current || !controls) return;
    const target = new THREE.Vector3(...focusRef.current);
    const dist = Math.min(FOCUS_DISTANCE, camera.position.distanceTo(controls.target));
    fly(orbitPos(target, dist, Math.min(0.9, MAX_POLAR)), target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, controls]);

  useFrame((_, dt) => {
    if (!controls) return;
    const g = glide.current;
    if (g.lengthSq() > 0.01) {
      const d = g.clone().multiplyScalar(dt);
      camera.position.add(d);
      controls.target.add(d);
      g.multiplyScalar(Math.exp(-dt * 5));
    }
    const w = wheel.current;
    if (Math.abs(w.pending) > 1e-4) {
      const step = w.pending * (1 - Math.exp(-dt * 14));
      w.pending -= step;
      const dist = camera.position.distanceTo(controls.target);
      const k = THREE.MathUtils.clamp(dist * Math.exp(step), MIN_DISTANCE, MAX_DISTANCE) / dist;
      // Scale camera and target about the cursor's ground point, so that point stays under the cursor.
      camera.position.sub(w.anchor).multiplyScalar(k).add(w.anchor);
      controls.target.sub(w.anchor).multiplyScalar(k).add(w.anchor);
      if (k === 1) w.pending = 0;
    }
    const f = flight.current;
    if (f) {
      const k = Math.min(1, (performance.now() - f.t0) / f.dur);
      const e = ease(k);
      camera.position.lerpVectors(f.fromPos, f.toPos, e);
      controls.target.lerpVectors(f.fromTarget, f.toTarget, e);
      if (k >= 1) flight.current = null;
    } else {
      // Clamp panning to the building; move the camera with the target so it doesn't jerk.
      const t = controls.target;
      const cx = THREE.MathUtils.clamp(t.x, frame.minX - 10, frame.maxX + 10);
      const cz = THREE.MathUtils.clamp(t.z, frame.minZ - 10, frame.maxZ + 10);
      if (cx !== t.x || cz !== t.z) {
        camera.position.add(new THREE.Vector3(cx - t.x, 0, cz - t.z));
        t.set(cx, t.y, cz);
      }
    }
    onHeading?.(controls.getAzimuthalAngle());
  });

  return (
    <OrbitControls
      makeDefault
      target={frame.home.toArray()}
      enableDamping
      dampingFactor={0.08}
      zoomToCursor
      zoomSpeed={0.55}
      rotateSpeed={0.55}
      panSpeed={0.9}
      screenSpacePanning={false}
      minDistance={MIN_DISTANCE}
      maxDistance={MAX_DISTANCE}
      maxPolarAngle={MAX_POLAR}
      mouseButtons={{ LEFT: -1 as MOUSE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }}
      touches={{ ONE: -1 as TOUCH, TWO: TOUCH.DOLLY_ROTATE }}
    />
  );
}
