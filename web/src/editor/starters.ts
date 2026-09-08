// Starting points for a new scene. Pure data (no DOM, no Three).
import type { SceneDef } from "../world/sceneDef";

function hexDist(q: number, r: number): number {
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
}

/** A small grass island (radius 2) in a ring of water (radius 4), a hub anchor, the overworld camera. */
export function starterIsland(): SceneDef {
  const def: SceneDef = { tiles: [], props: [], anchors: [{ name: "hub", x: 0, z: 0 }], camera: { pos: [0, 30, 34], look: [0, 0, -2] } };
  for (let q = -4; q <= 4; q++) {
    for (let r = -4; r <= 4; r++) {
      const d = hexDist(q, r);
      if (d <= 4) def.tiles.push({ q, r, t: d <= 2 ? "grass" : "water" });
    }
  }
  return def;
}

/** A flat ground plane, a center anchor and a camera looking at it -- the bones of a story set. */
export function starterInterior(): SceneDef {
  return {
    tiles: [],
    props: [],
    shapes: [{ kind: "plane", size: [40, 40], color: "#9cb37a", x: 0, z: 0, name: "Ground" }],
    anchors: [{ name: "center", x: 0, z: 0 }, { name: "path_near", x: 0, z: 6 }, { name: "path_far", x: 0, z: -6 }],
    camera: { pos: [0, 9, 16], look: [0, 0.5, 0] },
  };
}
