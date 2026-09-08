// Pure island edit helpers: which tile is under a cell (topmost), which prop is near a point,
// cell/world conversions for props. No DOM, no Three. The app composes these into commands;
// a Vitest drives them directly.

import { axialToWorld, worldToAxial, type IslandDef, type PropDef, type TileDef } from "../world/hexGrid";

export interface Cell {
  q: number;
  r: number;
}

/** Index of the TOPMOST tile at a cell (tiles later in the list draw over earlier), or -1. */
export function tileIndexAt(tiles: readonly TileDef[], q: number, r: number): number {
  for (let i = tiles.length - 1; i >= 0; i--) {
    if (tiles[i].q === q && tiles[i].r === r) return i;
  }
  return -1;
}

/** All tile indices at a cell, bottom to top. */
export function tilesAt(tiles: readonly TileDef[], q: number, r: number): number[] {
  const out: number[] = [];
  tiles.forEach((t, i) => {
    if (t.q === q && t.r === r) out.push(i);
  });
  return out;
}

/** A prop's world x/z whether it is on a cell or free-placed. */
export function propWorld(p: PropDef): { x: number; z: number } {
  if (p.q !== undefined && p.r !== undefined) {
    const w = axialToWorld(p.q, p.r);
    return { x: w.x, z: w.z };
  }
  return { x: p.x ?? 0, z: p.z ?? 0 };
}

/** Nearest prop anchor within `radius * max(1, scale)` of a ground point, or -1. */
export function pickProp(props: readonly PropDef[], x: number, z: number, radius = 2.5): number {
  let best = -1;
  let bestD2 = Infinity;
  props.forEach((p, i) => {
    const w = propWorld(p);
    const dx = w.x - x;
    const dz = w.z - z;
    const d2 = dx * dx + dz * dz;
    const lim = radius * Math.max(1, p.s ?? 1);
    if (d2 <= lim * lim && d2 < bestD2) {
      best = i;
      bestD2 = d2;
    }
  });
  return best;
}

/** Same prop, expressed on its nearest cell. */
export function snapPropToCell(p: PropDef): PropDef {
  const w = propWorld(p);
  const c = worldToAxial(w.x, w.z);
  const out: PropDef = { ...p, q: c.q, r: c.r };
  delete out.x;
  delete out.z;
  return out;
}

/** Same prop, expressed at explicit world coords (so it can be dragged freely). */
export function unsnapProp(p: PropDef): PropDef {
  const w = propWorld(p);
  const out: PropDef = { ...p, x: w.x, z: w.z };
  delete out.q;
  delete out.r;
  return out;
}

/** Bounding cells of the island (for framing the camera); null when empty. */
export function islandCellBounds(def: IslandDef): { min: Cell; max: Cell } | null {
  if (def.tiles.length === 0) return null;
  const min = { q: Infinity, r: Infinity };
  const max = { q: -Infinity, r: -Infinity };
  for (const t of def.tiles) {
    min.q = Math.min(min.q, t.q);
    min.r = Math.min(min.r, t.r);
    max.q = Math.max(max.q, t.q);
    max.r = Math.max(max.r, t.r);
  }
  return { min, max };
}
