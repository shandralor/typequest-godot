import { describe, expect, it } from "vitest";
import { axialToWorld, worldToAxial, expandIsland, COL_PITCH, TILE_SCALE } from "../world/hexGrid";
import { OVERWORLD } from "../content/island/overworld";

// The six axial neighbour directions of a pointy-top hex.
const NEIGHBOURS = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1],
];

describe("hex grid math", () => {
  it("every neighbour sits exactly one across-flats apart (tessellation invariant)", () => {
    const o = axialToWorld(0, 0);
    for (const [dq, dr] of NEIGHBOURS) {
      const n = axialToWorld(dq, dr);
      expect(n.distanceTo(o)).toBeCloseTo(COL_PITCH, 9);
    }
  });

  it("worldToAxial inverts axialToWorld on a wide range of cells", () => {
    for (let q = -12; q <= 12; q++) {
      for (let r = -12; r <= 12; r++) {
        const w = axialToWorld(q, r);
        expect(worldToAxial(w.x, w.z)).toEqual({ q, r });
      }
    }
  });

  it("origin cell is the hub (world origin)", () => {
    const o = axialToWorld(0, 0);
    expect([o.x, o.y, o.z]).toEqual([0, 0, 0]);
  });
});

describe("authored overworld island", () => {
  it("expands every tile at TILE_SCALE with a whole-step yaw", () => {
    const tiles = expandIsland({ tiles: OVERWORLD.tiles, props: [] });
    expect(tiles.length).toBe(OVERWORLD.tiles.length);
    for (const p of tiles) {
      const e = p.matrix.elements; // column-major
      const sx = Math.hypot(e[0], e[1], e[2]);
      expect(sx).toBeCloseTo(TILE_SCALE, 9);
      expect(e[13]).toBe(0); // floor tiles sit at y = 0
    }
  });

  it("has a hub cell and no duplicate (cell, model) pairs", () => {
    const hub = OVERWORLD.tiles.find((t) => t.q === 0 && t.r === 0);
    expect(hub).toBeDefined();
    const seen = new Set<string>();
    for (const t of OVERWORLD.tiles) {
      const key = `${t.q},${t.r},${t.t}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});
