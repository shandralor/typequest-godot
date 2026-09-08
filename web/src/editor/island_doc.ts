// The IslandDef as a DOCUMENT: a never-throws sanitizer (the world-of-claudecraft map_doc
// pattern -- def-fill, clamp, drop malformed entries, cap sizes; every number through finiteNum
// because JSON.parse turns 1e999 into Infinity) and serializers back to the authored TS source
// and to JSON. Pure: no DOM, no Three. The editor, the playtest handoff and any future server
// all validate through this one function.

import type { IslandDef, PropDef, TileDef } from "../world/hexGrid";

export const MAX_TILES = 4000;
export const MAX_PROPS = 2000;
export const MAX_COORD = 10_000;
export const MAX_CELL = 500;
export const PROP_SCALE_LIMITS: [number, number] = [0.05, 40];

const TILE_CODE = /^[A-Za-z0-9_]{1,40}$/;
const MODEL_PATH = /^[A-Za-z0-9_./-]{1,200}\.(gltf|glb)$/;

function finiteNum(v: unknown, def: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : def;
}
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
/** Placement precision: 3 decimals, so serialised documents are canonical (no float noise). */
function r3(v: number): number {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
}
function intIn(v: unknown, lo: number, hi: number): number | null {
  const n = finiteNum(v, NaN);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  return i < lo || i > hi ? null : i;
}
function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function sanitizeTile(raw: unknown): TileDef | null {
  if (!isObj(raw)) return null;
  const q = intIn(raw.q, -MAX_CELL, MAX_CELL);
  const r = intIn(raw.r, -MAX_CELL, MAX_CELL);
  const t = typeof raw.t === "string" && TILE_CODE.test(raw.t) ? raw.t : null;
  if (q === null || r === null || t === null) return null;
  const tile: TileDef = { q, r, t };
  const rot = intIn(raw.rot, -1000, 1000);
  if (rot !== null && rot !== 0) tile.rot = ((rot % 6) + 6) % 6;
  return tile;
}

function sanitizeProp(raw: unknown): PropDef | null {
  if (!isObj(raw)) return null;
  const m = typeof raw.m === "string" && MODEL_PATH.test(raw.m) && !raw.m.includes("..") ? raw.m : null;
  if (m === null) return null;
  const p: PropDef = { m };
  const q = intIn(raw.q, -MAX_CELL, MAX_CELL);
  const r = intIn(raw.r, -MAX_CELL, MAX_CELL);
  if (q !== null && r !== null) {
    p.q = q;
    p.r = r;
  } else {
    const x = finiteNum(raw.x, NaN);
    const z = finiteNum(raw.z, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    p.x = r3(clamp(x, -MAX_COORD, MAX_COORD));
    p.z = r3(clamp(z, -MAX_COORD, MAX_COORD));
  }
  const rot = finiteNum(raw.rot, 0);
  if (rot !== 0) p.rot = r3(((rot % 360) + 360) % 360);
  const s = finiteNum(raw.s, 1);
  if (s !== 1) p.s = r3(clamp(s, PROP_SCALE_LIMITS[0], PROP_SCALE_LIMITS[1]));
  const y = finiteNum(raw.y, 0);
  if (y !== 0) p.y = r3(clamp(y, -MAX_COORD, MAX_COORD));
  return p;
}

/** Never throws. Returns null only when `raw` is not an object at all. */
export function sanitizeIslandDef(raw: unknown): IslandDef | null {
  if (!isObj(raw)) return null;
  const tiles: TileDef[] = [];
  const props: PropDef[] = [];
  if (Array.isArray(raw.tiles)) {
    for (const t of raw.tiles) {
      const s = sanitizeTile(t);
      if (s) tiles.push(s);
      if (tiles.length >= MAX_TILES) break;
    }
  }
  if (Array.isArray(raw.props)) {
    for (const p of raw.props) {
      const s = sanitizeProp(p);
      if (s) props.push(s);
      if (props.length >= MAX_PROPS) break;
    }
  }
  return { tiles, props };
}

export function cloneIsland(def: IslandDef): IslandDef {
  return { tiles: def.tiles.map((t) => ({ ...t })), props: def.props.map((p) => ({ ...p })) };
}

/** Compact number for source output: 3 -> "3", 2.5 -> "2.5", -0 -> "0". */
export function fmtNum(v: number): string {
  const r = Math.round(v * 1000) / 1000;
  if (Object.is(r, -0) || r === 0) return "0";
  return Number.isInteger(r) ? String(r) : String(r);
}

export function serializeIslandJson(def: IslandDef): string {
  return JSON.stringify(def, null, 1);
}

/**
 * Emit the authored TS module (the same shape tools/layout_to_island.py produces): tiles grouped
 * by row, props in order, defaults omitted. `exportName` is the const the game imports.
 */
export function serializeIslandTs(def: IslandDef, exportName: string, note = ""): string {
  const tiles = [...def.tiles].sort((a, b) => a.r - b.r || a.q - b.q);
  const out: string[] = [];
  out.push("// AUTHORED island data-as-code -- floor tiles + props. Source of truth for this island;");
  out.push("// edited by hand or written back by the island editor (/editor.html). Grid math lives in");
  out.push("// src/world/hexGrid.ts. tiles: axial (q, r), t = KayKit hex code (hex_<t>.gltf), rot = yaw in");
  out.push("// 60-degree steps (0-5); tiles may stack. props: on a cell (q, r) or at world (x, z); rot = yaw");
  out.push("// in degrees; s = scale; y = height.");
  if (note) out.push("// " + note);
  out.push('import type { IslandDef } from "../../world/hexGrid";');
  out.push("");
  out.push(`export const ${exportName}: IslandDef = {`);
  out.push("  tiles: [");
  let cur: number | null = null;
  for (const t of tiles) {
    if (t.r !== cur) {
      out.push(`    // row r=${t.r}`);
      cur = t.r;
    }
    const rs = t.rot ? `, rot: ${t.rot}` : "";
    out.push(`    { q: ${t.q}, r: ${t.r}, t: "${t.t}"${rs} },`);
  }
  out.push("  ],");
  out.push("  props: [");
  for (const p of def.props) {
    const parts = [`m: "${p.m}"`];
    if (p.q !== undefined && p.r !== undefined) parts.push(`q: ${p.q}, r: ${p.r}`);
    else parts.push(`x: ${fmtNum(p.x ?? 0)}, z: ${fmtNum(p.z ?? 0)}`);
    if (p.rot) parts.push(`rot: ${fmtNum(p.rot)}`);
    if (p.s !== undefined && p.s !== 1) parts.push(`s: ${fmtNum(p.s)}`);
    if (p.y) parts.push(`y: ${fmtNum(p.y)}`);
    out.push("    { " + parts.join(", ") + " },");
  }
  out.push("  ],");
  out.push("};");
  out.push("");
  return out.join("\n");
}
