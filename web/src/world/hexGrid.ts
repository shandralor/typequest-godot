// Hex-grid island expander. Turns the compact authorable IslandDef (axial cells + free props)
// into world transforms. The grid math OWNS the geometry: a tile authored at (q, r) lands
// exactly edge-to-edge with its neighbours, and a road rotated `rot` steps meets the next
// road, so an island can be written as data (ClaudeCraft-style) without ever touching a
// matrix -- and without a visual editor.
//
// Geometry: pointy-top hexes, KayKit hex tiles at scale 3 -> across-flats 6, corner-to-corner
// 4*sqrt(3) = 6.93, row pitch 3*sqrt(3) = 5.196. Axial (q, r) -> world:
//   x = 6*q + 3*r      z = 3*sqrt(3) * r
// (same lattice the Godot set was snapped to, so the reversed island round-trips exactly.)
// Pure module: no scene-tree / render access -- only math.

import { Matrix4, Vector3 } from "three";

export const TILE_SCALE = 3;
export const COL_PITCH = 6; // across-flats at scale 3
export const ROW_PITCH = 3 * Math.sqrt(3); // 5.196

export interface TileDef {
  q: number;
  r: number;
  /** KayKit hex code without the `hex_` prefix: water, grass, road_B, coast_A ... */
  t: string;
  /** yaw in 60-degree steps, 0-5 (omit = 0) */
  rot?: number;
}

export interface PropDef {
  /** model path under /assets */
  m: string;
  /** on a cell ... */
  q?: number;
  r?: number;
  /** ... or at explicit world coords */
  x?: number;
  z?: number;
  /** yaw in degrees (omit = 0) */
  rot?: number;
  /** uniform scale (omit = 1) */
  s?: number;
  /** height (omit = 0) */
  y?: number;
}

export interface IslandDef {
  tiles: TileDef[];
  props: PropDef[];
}

export interface Placement {
  model: string;
  matrix: Matrix4;
}

export function axialToWorld(q: number, r: number): Vector3 {
  return new Vector3(COL_PITCH * q + (COL_PITCH / 2) * r, 0, ROW_PITCH * r);
}

/** World -> nearest axial cell (inverse of axialToWorld), for snapping/authoring tools. */
export function worldToAxial(x: number, z: number): { q: number; r: number } {
  const r = z / ROW_PITCH;
  const q = (x - (COL_PITCH / 2) * r) / COL_PITCH;
  return { q: Math.round(q), r: Math.round(r) };
}

function yawMatrix(pos: Vector3, yawRad: number, scale: number): Matrix4 {
  const m = new Matrix4();
  m.makeRotationY(yawRad);
  m.scale(new Vector3(scale, scale, scale));
  m.setPosition(pos);
  return m;
}

export function tilePlacement(t: TileDef): Placement {
  const pos = axialToWorld(t.q, t.r);
  // Godot's Y-rotation serialises row0 = (cos, 0, sin) and three's makeRotationY(yaw) has the
  // same row0, so the authored yaw maps 1:1 (no sign flip). Verified by the round-trip render.
  const yaw = ((t.rot ?? 0) * Math.PI) / 3;
  return { model: `kaykit/hexagon/hex_${t.t}.gltf`, matrix: yawMatrix(pos, yaw, TILE_SCALE) };
}

export function propPlacement(p: PropDef): Placement {
  const pos = p.q !== undefined && p.r !== undefined ? axialToWorld(p.q, p.r) : new Vector3(p.x ?? 0, 0, p.z ?? 0);
  pos.y = p.y ?? 0;
  const yaw = ((p.rot ?? 0) * Math.PI) / 180;
  return { model: p.m, matrix: yawMatrix(pos, yaw, p.s ?? 1) };
}

/** Expand a whole island into placements (tiles first, so props draw over the floor). */
export function expandIsland(def: IslandDef): Placement[] {
  return [...def.tiles.map(tilePlacement), ...def.props.map(propPlacement)];
}

/** Every distinct model an island needs (for preloading). */
export function islandModels(def: IslandDef): string[] {
  return [...new Set(expandIsland(def).map((p) => p.model))];
}
