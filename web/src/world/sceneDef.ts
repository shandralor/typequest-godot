// The authored SCENE document: every component of a story set as data-as-code. Islands are
// scenes whose floor is hex tiles; interiors are scenes with no tiles. Pure types; the grid
// math lives in hexGrid.ts, placement helpers alongside. Everything here is editable in the
// scene editor (web/editor.html) and round-trips byte-identically through island_doc.ts.

/** A hex floor tile on the pointy-top lattice. */
export interface TileDef {
  q: number;
  r: number;
  /** KayKit hex code without the `hex_` prefix: water, grass, road_B, coast_A ... */
  t: string;
  /** yaw in 60-degree steps, 0-5 (omit = 0) */
  rot?: number;
}

/** Shared placement fields for anything free-placed in the world. */
export interface Placed {
  /** on a cell ... */
  q?: number;
  r?: number;
  /** ... or at explicit world coords */
  x?: number;
  z?: number;
  /** height (omit = 0) */
  y?: number;
  /** yaw in degrees (omit = 0) */
  rot?: number;
  /** pitch/roll in degrees for leaning objects (YXZ order with `rot`); omit = upright */
  tilt?: [number, number];
}

export interface PropDef extends Placed {
  /** model path under /assets */
  m: string;
  /** uniform scale (omit = 1) */
  s?: number;
  /** non-uniform scale; overrides `s` */
  sc?: [number, number, number];
  /** Godot groups carried over (e.g. "reveal_<flag>" mist) */
  tags?: string[];
  /** starts invisible (revealed by the story) */
  hidden?: boolean;
}

/** A primitive mesh (the hand-built ground planes, path ribbons, plinths). */
export interface ShapeDef extends Placed {
  kind: "box" | "plane";
  /** box: [w, h, d]; plane: [w, d] (a plane lies flat, facing +y) */
  size: number[];
  /** sRGB hex */
  color: string;
  alpha?: number;
  emissive?: string;
  sc?: [number, number, number];
  name?: string;
  hidden?: boolean;
}

/** A named point the story refers to (hub, center, path_near, site_bos ...). */
export interface AnchorDef extends Placed {
  name: string;
}

export interface CameraDef {
  pos: [number, number, number];
  look: [number, number, number];
  fov?: number;
}

/** A named polyline the hero walks (Godot Path3D). */
export interface RouteDef {
  name: string;
  points: [number, number, number][];
}

export interface LightDef {
  kind: "omni";
  x: number;
  y: number;
  z: number;
  color: string;
  energy: number;
  range: number;
}

export interface SceneDef {
  tiles: TileDef[];
  props: PropDef[];
  shapes?: ShapeDef[];
  anchors?: AnchorDef[];
  camera?: CameraDef;
  routes?: RouteDef[];
  lights?: LightDef[];
}

/** An island is a scene (kept as an alias for the earlier code). */
export type IslandDef = SceneDef;

export function emptyScene(): SceneDef {
  return { tiles: [], props: [] };
}
