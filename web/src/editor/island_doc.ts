// The SceneDef as a DOCUMENT: a never-throws sanitizer (world-of-claudecraft map_doc pattern --
// def-fill, clamp, drop malformed entries, cap sizes; every number through finiteNum because
// JSON.parse turns 1e999 into Infinity) and serializers back to the authored TS source and to
// JSON. Pure: no DOM, no Three. The editor, the playtest handoff and any server validate through
// this one function. The TS output is byte-identical to tools/tscn_to_scene.py's, so an editor
// save of an untouched scene produces no diff.

import type { AnchorDef, CameraDef, IslandDef, LightDef, Placed, PropDef, RouteDef, SceneDef, ShapeDef, TileDef } from "../world/sceneDef";

export const MAX_TILES = 4000;
export const MAX_PROPS = 4000;
export const MAX_SHAPES = 1000;
export const MAX_ANCHORS = 200;
export const MAX_ROUTES = 100;
export const MAX_ROUTE_POINTS = 500;
export const MAX_LIGHTS = 64;
export const MAX_COORD = 10_000;
export const MAX_CELL = 500;
export const PROP_SCALE_LIMITS: [number, number] = [0.05, 40];

const TILE_CODE = /^[A-Za-z0-9_]{1,40}$/;
const MODEL_PATH = /^[A-Za-z0-9_./-]{1,200}\.(gltf|glb)$/;
const NAME = /^[A-Za-z0-9_@ .-]{1,60}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

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
function coord(v: unknown): number | null {
  const n = finiteNum(v, NaN);
  return Number.isFinite(n) ? r3(clamp(n, -MAX_COORD, MAX_COORD)) : null;
}
function deg(v: unknown): number {
  return r3(((finiteNum(v, 0) % 360) + 360) % 360);
}
function str(v: unknown, re: RegExp): string | null {
  return typeof v === "string" && re.test(v) ? v : null;
}
function triple(v: unknown, lo: number, hi: number): [number, number, number] | null {
  if (!Array.isArray(v) || v.length !== 3) return null;
  const t = v.map((n) => r3(clamp(finiteNum(n, NaN), lo, hi)));
  return t.every(Number.isFinite) ? (t as [number, number, number]) : null;
}

/** Fill the shared placement fields; returns false when there is no usable position. */
function sanitizePlaced(raw: Record<string, unknown>, out: Placed): boolean {
  const q = intIn(raw.q, -MAX_CELL, MAX_CELL);
  const r = intIn(raw.r, -MAX_CELL, MAX_CELL);
  if (q !== null && r !== null) {
    out.q = q;
    out.r = r;
  } else {
    const x = coord(raw.x);
    const z = coord(raw.z);
    if (x === null || z === null) return false;
    out.x = x;
    out.z = z;
  }
  const y = coord(raw.y);
  if (y !== null && y !== 0) out.y = y;
  const rot = deg(raw.rot);
  if (rot !== 0) out.rot = rot;
  if (Array.isArray(raw.tilt) && raw.tilt.length === 2) {
    const t: [number, number] = [r3(clamp(finiteNum(raw.tilt[0], 0), -180, 180)), r3(clamp(finiteNum(raw.tilt[1], 0), -180, 180))];
    if (t[0] !== 0 || t[1] !== 0) out.tilt = t;
  }
  return true;
}

function sanitizeTile(raw: unknown): TileDef | null {
  if (!isObj(raw)) return null;
  const q = intIn(raw.q, -MAX_CELL, MAX_CELL);
  const r = intIn(raw.r, -MAX_CELL, MAX_CELL);
  const t = str(raw.t, TILE_CODE);
  if (q === null || r === null || t === null) return null;
  const tile: TileDef = { q, r, t };
  const rot = intIn(raw.rot, -1000, 1000);
  if (rot !== null && rot !== 0) tile.rot = ((rot % 6) + 6) % 6;
  return tile;
}

function sanitizeProp(raw: unknown): PropDef | null {
  if (!isObj(raw)) return null;
  const m = str(raw.m, MODEL_PATH);
  if (m === null || m.includes("..")) return null;
  const p: PropDef = { m };
  if (!sanitizePlaced(raw, p)) return null;
  const sc = triple(raw.sc, PROP_SCALE_LIMITS[0], PROP_SCALE_LIMITS[1]);
  if (sc) p.sc = sc;
  else {
    const s = finiteNum(raw.s, 1);
    if (s !== 1) p.s = r3(clamp(s, PROP_SCALE_LIMITS[0], PROP_SCALE_LIMITS[1]));
  }
  if (Array.isArray(raw.tags)) {
    const tags = raw.tags.filter((t): t is string => typeof t === "string" && NAME.test(t)).slice(0, 8);
    if (tags.length) p.tags = tags;
  }
  if (raw.hidden === true) p.hidden = true;
  return p;
}

function sanitizeShape(raw: unknown): ShapeDef | null {
  if (!isObj(raw)) return null;
  const kind = raw.kind === "box" || raw.kind === "plane" || raw.kind === "polygon" ? raw.kind : null;
  const color = str(raw.color, HEX);
  if (!kind || !color) return null;
  let size: number[] = [];
  if (kind !== "polygon") {
    if (!Array.isArray(raw.size)) return null;
    size = raw.size.slice(0, kind === "box" ? 3 : 2).map((n) => r3(clamp(finiteNum(n, 1), 0.001, MAX_COORD)));
    if (size.length !== (kind === "box" ? 3 : 2)) return null;
  }
  const sh: ShapeDef = kind === "polygon" ? { kind, color } : { kind, size, color };
  if (kind === "polygon") {
    if (!Array.isArray(raw.points) || raw.points.length < 3) return null;
    const pts: [number, number][] = [];
    for (const pt of raw.points) {
      if (!Array.isArray(pt) || pt.length !== 2) continue;
      const x = finiteNum(pt[0], NaN);
      const y = finiteNum(pt[1], NaN);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      pts.push([r3(clamp(x, -MAX_COORD, MAX_COORD)), r3(clamp(y, -MAX_COORD, MAX_COORD))]);
    }
    if (pts.length < 3) return null;
    sh.points = pts;
    sh.depth = r3(clamp(finiteNum(raw.depth, 1), 0.001, 1000));
  }
  if (!sanitizePlaced(raw, sh)) return null;
  const sc = triple(raw.sc, 0.001, 1000);
  if (sc) sh.sc = sc;
  const alpha = finiteNum(raw.alpha, 1);
  if (alpha < 1) sh.alpha = r3(clamp(alpha, 0, 1));
  const em = str(raw.emissive, HEX);
  if (em) sh.emissive = em;
  const name = str(raw.name, NAME);
  if (name) sh.name = name;
  if (raw.hidden === true) sh.hidden = true;
  return sh;
}

function sanitizeAnchor(raw: unknown): AnchorDef | null {
  if (!isObj(raw)) return null;
  const name = str(raw.name, NAME);
  if (!name) return null;
  const a: AnchorDef = { name };
  return sanitizePlaced(raw, a) ? a : null;
}

function sanitizeCamera(raw: unknown): CameraDef | null {
  if (!isObj(raw)) return null;
  const pos = triple(raw.pos, -MAX_COORD, MAX_COORD);
  const look = triple(raw.look, -MAX_COORD, MAX_COORD);
  if (!pos || !look) return null;
  const c: CameraDef = { pos, look };
  const fov = finiteNum(raw.fov, 0);
  if (fov > 0) c.fov = r3(clamp(fov, 5, 150));
  return c;
}

function sanitizeRoute(raw: unknown): RouteDef | null {
  if (!isObj(raw)) return null;
  const name = str(raw.name, NAME);
  if (!name || !Array.isArray(raw.points)) return null;
  const points: [number, number, number][] = [];
  for (const p of raw.points) {
    const t = triple(p, -MAX_COORD, MAX_COORD);
    if (t) points.push(t);
    if (points.length >= MAX_ROUTE_POINTS) break;
  }
  return { name, points };
}

function sanitizeLight(raw: unknown): LightDef | null {
  if (!isObj(raw) || raw.kind !== "omni") return null;
  const x = coord(raw.x);
  const y = coord(raw.y);
  const z = coord(raw.z);
  const color = str(raw.color, HEX);
  if (x === null || y === null || z === null || !color) return null;
  return { kind: "omni", x, y, z, color, energy: r3(clamp(finiteNum(raw.energy, 1), 0, 100)), range: r3(clamp(finiteNum(raw.range, 5), 0.1, 1000)) };
}

function takeList<T>(raw: unknown, cap: number, fn: (v: unknown) => T | null): T[] {
  const out: T[] = [];
  if (!Array.isArray(raw)) return out;
  for (const v of raw) {
    const s = fn(v);
    if (s) out.push(s);
    if (out.length >= cap) break;
  }
  return out;
}

/** Never throws. Returns null only when `raw` is not an object at all. */
export function sanitizeIslandDef(raw: unknown): SceneDef | null {
  if (!isObj(raw)) return null;
  const def: SceneDef = { tiles: takeList(raw.tiles, MAX_TILES, sanitizeTile), props: takeList(raw.props, MAX_PROPS, sanitizeProp) };
  const shapes = takeList(raw.shapes, MAX_SHAPES, sanitizeShape);
  if (shapes.length) def.shapes = shapes;
  const anchors = takeList(raw.anchors, MAX_ANCHORS, sanitizeAnchor);
  if (anchors.length) def.anchors = anchors;
  const camera = sanitizeCamera(raw.camera);
  if (camera) def.camera = camera;
  const routes = takeList(raw.routes, MAX_ROUTES, sanitizeRoute);
  if (routes.length) def.routes = routes;
  const lights = takeList(raw.lights, MAX_LIGHTS, sanitizeLight);
  if (lights.length) def.lights = lights;
  return def;
}
export const sanitizeSceneDef = sanitizeIslandDef;

export function cloneIsland(def: IslandDef): SceneDef {
  return sanitizeIslandDef(JSON.parse(JSON.stringify(def))) ?? { tiles: [], props: [] };
}

/** Compact number for source output: 3 -> "3", 2.5 -> "2.5", -0 -> "0". */
export function fmtNum(v: number): string {
  const r = r3(v);
  return String(r);
}
const list = (a: readonly number[]): string => "[" + a.map(fmtNum).join(", ") + "]";

export function serializeIslandJson(def: IslandDef): string {
  return JSON.stringify(def, null, 1);
}

function placedParts(p: Placed): string[] {
  const parts: string[] = [];
  if (p.q !== undefined && p.r !== undefined) parts.push(`q: ${p.q}, r: ${p.r}`);
  else parts.push(`x: ${fmtNum(p.x ?? 0)}, z: ${fmtNum(p.z ?? 0)}`);
  if (p.y) parts.push(`y: ${fmtNum(p.y)}`);
  if (p.rot) parts.push(`rot: ${fmtNum(p.rot)}`);
  if (p.tilt) parts.push(`tilt: ${list(p.tilt)}`);
  return parts;
}

/**
 * Emit the authored TS module -- the same text tools/tscn_to_scene.py writes: tiles grouped by
 * row, then props, shapes, anchors, camera, routes, lights; defaults omitted; optional sections
 * omitted when empty.
 */
export function serializeIslandTs(def: IslandDef, exportName: string): string {
  const tiles = [...def.tiles].sort((a, b) => a.r - b.r || a.q - b.q);
  const out: string[] = [];
  out.push("// AUTHORED scene data-as-code -- floor tiles, props, primitive shapes, anchors, camera, routes,");
  out.push("// lights. Source of truth for this set; edited by hand or written back by the scene editor");
  out.push("// (/editor.html). Grid math: src/world/hexGrid.ts. Types: src/world/sceneDef.ts.");
  out.push('import type { SceneDef } from "../../world/sceneDef";');
  out.push("");
  out.push(`export const ${exportName}: SceneDef = {`);
  out.push("  tiles: [");
  let cur: number | null = null;
  for (const t of tiles) {
    if (t.r !== cur) {
      out.push(`    // row r=${t.r}`);
      cur = t.r;
    }
    out.push(`    { q: ${t.q}, r: ${t.r}, t: "${t.t}"${t.rot ? `, rot: ${t.rot}` : ""} },`);
  }
  out.push("  ],");
  out.push("  props: [");
  for (const p of def.props) {
    const parts = [`m: "${p.m}"`, ...placedParts(p)];
    if (p.sc) parts.push(`sc: ${list(p.sc)}`);
    else if (p.s !== undefined && p.s !== 1) parts.push(`s: ${fmtNum(p.s)}`);
    if (p.tags?.length) parts.push(`tags: [${p.tags.map((t) => `"${t}"`).join(", ")}]`);
    if (p.hidden) parts.push("hidden: true");
    out.push("    { " + parts.join(", ") + " },");
  }
  out.push("  ],");
  if (def.shapes?.length) {
    out.push("  shapes: [");
    for (const s of def.shapes) {
      const parts = [`kind: "${s.kind}"`];
      if (s.kind === "polygon") {
        parts.push(`points: [${(s.points ?? []).map((p) => list(p)).join(", ")}]`, `depth: ${fmtNum(s.depth ?? 1)}`);
      } else {
        parts.push(`size: ${list(s.size ?? [])}`);
      }
      parts.push(`color: "${s.color}"`, ...placedParts(s));
      if (s.sc) parts.push(`sc: ${list(s.sc)}`);
      if (s.alpha !== undefined) parts.push(`alpha: ${fmtNum(s.alpha)}`);
      if (s.emissive) parts.push(`emissive: "${s.emissive}"`);
      if (s.name) parts.push(`name: "${s.name}"`);
      if (s.hidden) parts.push("hidden: true");
      out.push("    { " + parts.join(", ") + " },");
    }
    out.push("  ],");
  }
  if (def.anchors?.length) {
    out.push("  anchors: [");
    for (const a of def.anchors) out.push("    { " + [`name: "${a.name}"`, ...placedParts(a)].join(", ") + " },");
    out.push("  ],");
  }
  if (def.camera) out.push(`  camera: { pos: ${list(def.camera.pos)}, look: ${list(def.camera.look)}${def.camera.fov ? `, fov: ${fmtNum(def.camera.fov)}` : ""} },`);
  if (def.routes?.length) {
    out.push("  routes: [");
    for (const r of def.routes) out.push(`    { name: "${r.name}", points: [${r.points.map(list).join(", ")}] },`);
    out.push("  ],");
  }
  if (def.lights?.length) {
    out.push("  lights: [");
    for (const l of def.lights) out.push(`    { kind: "omni", x: ${fmtNum(l.x)}, y: ${fmtNum(l.y)}, z: ${fmtNum(l.z)}, color: "${l.color}", energy: ${fmtNum(l.energy)}, range: ${fmtNum(l.range)} },`);
    out.push("  ],");
  }
  out.push("};");
  out.push("");
  return out.join("\n");
}
export const serializeSceneTs = serializeIslandTs;
