// Pure math + commit policy for direct manipulation (adapted from world-of-claudecraft
// placement_transform_core.ts): rotate/scale steps, arrow nudges relative to the camera, and the
// coalescer that turns a burst of wheel ticks into ONE undo entry. No DOM, no Three.

import { cameraAxes } from "./camera_axes";

export const PROP_SCALE_MIN = 0.2;
export const PROP_SCALE_MAX = 8;
/** A hex tile has 6 orientations. */
export const TILE_ROT_STEPS = 6;
/** Props rotate in 15-degree steps (Shift = 60, a hex face). */
export const PROP_ROT_STEP_DEG = 15;
export const PROP_ROT_STEP_BIG_DEG = 60;
const SCALE_WHEEL_FACTOR = 1.1;
/** Arrow-key nudge distances (world units; a hex is 6 across). */
export const NUDGE_STEP = 0.5;
export const NUDGE_STEP_BIG = 3;
/** A burst of transform ticks commits once, this long after the last tick. */
export const TRANSFORM_COMMIT_MS = 400;

export type NudgeKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

/** Ground-plane delta for one arrow nudge, relative to the CAMERA yaw (screen-relative). */
export function nudgeDelta(key: NudgeKey, camYaw: number, step: number): { dx: number; dz: number } {
  const { fx, fz, rx, rz } = cameraAxes(camYaw);
  switch (key) {
    case "ArrowUp":
      return { dx: fx * step, dz: fz * step };
    case "ArrowDown":
      return { dx: -fx * step, dz: -fz * step };
    case "ArrowRight":
      return { dx: rx * step, dz: rz * step };
    case "ArrowLeft":
      return { dx: -rx * step, dz: -rz * step };
  }
}

/** Tile yaw step (0-5), wrapped. */
export function tileRotStep(rot: number, dir: 1 | -1): number {
  return (((rot + dir) % TILE_ROT_STEPS) + TILE_ROT_STEPS) % TILE_ROT_STEPS;
}

/** Wrap degrees into [0, 360). */
export function wrapDeg(a: number): number {
  const r = a % 360;
  return r < 0 ? r + 360 : r;
}

/** Prop yaw step in degrees, wrapped, rounded to the step grid so repeated ticks stay tidy. */
export function propRotStep(deg: number, dir: 1 | -1, step: number): number {
  return wrapDeg(Math.round((deg + dir * step) / step) * step);
}

/** One scale tick: multiplicative, clamped, 2 decimals. Scrolling up grows. */
export function scaleStep(scale: number, deltaY: number): number {
  const next = deltaY > 0 ? scale / SCALE_WHEEL_FACTOR : scale * SCALE_WHEEL_FACTOR;
  const clamped = Math.min(PROP_SCALE_MAX, Math.max(PROP_SCALE_MIN, next));
  return Math.round(clamped * 100) / 100;
}

/**
 * Coalesces a burst of live transform ticks into ONE undo commit: each tick pushes the deadline
 * out; the burst is due once the window lapses with no further tick. Time is injected.
 */
export class CommitCoalescer {
  private deadline: number | null = null;
  constructor(readonly windowMs: number = TRANSFORM_COMMIT_MS) {}
  tick(now: number): void {
    this.deadline = now + this.windowMs;
  }
  get pending(): boolean {
    return this.deadline !== null;
  }
  /** True exactly once when the burst window has lapsed. */
  due(now: number): boolean {
    if (this.deadline === null || now < this.deadline) return false;
    this.deadline = null;
    return true;
  }
  cancel(): void {
    this.deadline = null;
  }
}
