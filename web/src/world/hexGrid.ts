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

import { Euler, Matrix4, Quaternion, Vector3 } from "three";

export const TILE_SCALE = 3;
export const COL_PITCH = 6; // across-flats at scale 3
export const ROW_PITCH = 3 * Math.sqrt(3); // 5.196

export type { TileDef, PropDef, ShapeDef, AnchorDef, CameraDef, RouteDef, LightDef, SceneDef, IslandDef } from "./sceneDef";
import type { Placed, PropDef, TileDef, IslandDef } from "./sceneDef";

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

/** World position of anything Placed: a cell centre or explicit coords, plus height. */
export function placedPosition(p: Placed): Vector3 {
  const v = p.q !== undefined && p.r !== undefined ? axialToWorld(p.q, p.r) : new Vector3(p.x ?? 0, 0, p.z ?? 0);
  v.y = p.y ?? 0;
  return v;
}

/** Full placement matrix: yaw (+ optional tilt, YXZ) and uniform or per-axis scale. */
export function placedMatrix(p: Placed, s: number | [number, number, number] = 1): Matrix4 {
  const d = Math.PI / 180;
  const e = new Euler((p.tilt?.[0] ?? 0) * d, (p.rot ?? 0) * d, (p.tilt?.[1] ?? 0) * d, "YXZ");
  const sc = Array.isArray(s) ? new Vector3(s[0], s[1], s[2]) : new Vector3(s, s, s);
  return new Matrix4().compose(placedPosition(p), new Quaternion().setFromEuler(e), sc);
}

export function tilePlacement(t: TileDef): Placement {
  const pos = axialToWorld(t.q, t.r);
  // Godot's Y-rotation serialises row0 = (cos, 0, sin) and three's makeRotationY(yaw) has the
  // same row0, so the authored yaw maps 1:1 (no sign flip). Verified by the round-trip render.
  const yaw = ((t.rot ?? 0) * Math.PI) / 3;
  return { model: `kaykit/hexagon/hex_${t.t}.gltf`, matrix: yawMatrix(pos, yaw, TILE_SCALE) };
}

export function propPlacement(p: PropDef): Placement {
  return { model: p.m, matrix: placedMatrix(p, p.sc ?? p.s ?? 1) };
}

/** Expand a whole island into placements (tiles first, so props draw over the floor). */
export function expandIsland(def: IslandDef): Placement[] {
  return [...def.tiles.map(tilePlacement), ...def.props.map(propPlacement)];
}

/** Every distinct model an island needs (for preloading). */
export function islandModels(def: IslandDef): string[] {
  return [...new Set(expandIsland(def).map((p) => p.model))];
}
