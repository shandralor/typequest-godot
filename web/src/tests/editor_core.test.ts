import { describe, expect, it } from "vitest";
import { UndoStack } from "../editor/undo_core";
import { appendSpan, removeSpan } from "../editor/span_core";
import { sanitizeIslandDef, serializeIslandJson, serializeIslandTs, cloneIsland } from "../editor/island_doc";
import { tileIndexAt, tilesAt, pickProp, snapPropToCell, unsnapProp, propWorld } from "../editor/edit_core";
import { CommitCoalescer, propRotStep, scaleStep, tileRotStep, nudgeDelta } from "../editor/transform_core";
import { OVERWORLD } from "../content/island/overworld";
import { axialToWorld } from "../world/hexGrid";

describe("undo stack", () => {
  it("undo/redo replay closures and clear the redo branch on push", () => {
    let v = 0;
    const s = new UndoStack(3);
    const cmd = (n: number) => ({ label: "set", undo: () => (v -= n), redo: () => (v += n) });
    v += 1; s.push(cmd(1));
    v += 2; s.push(cmd(2));
    expect(v).toBe(3);
    s.undo(); expect(v).toBe(1);
    s.redo(); expect(v).toBe(3);
    s.undo(); v += 5; s.push(cmd(5));
    expect(s.canRedo).toBe(false);
    expect(v).toBe(6);
  });
  it("is capped", () => {
    const s = new UndoStack(2);
    for (let i = 0; i < 5; i++) s.push({ label: "x", undo() {}, redo() {} });
    expect(s.depth).toBe(2);
  });
});

describe("span", () => {
  it("removes an appended batch with one splice, and by identity if shifted", () => {
    const arr = [1, 2];
    const items = [10, 11];
    const start = appendSpan(arr, items);
    expect(start).toBe(2);
    arr.unshift(0); // shift
    removeSpan(arr, start, items);
    expect(arr).toEqual([0, 1, 2]);
  });
});

describe("island document", () => {
  it("round-trips the authored overworld through JSON + sanitizer unchanged", () => {
    const back = sanitizeIslandDef(JSON.parse(serializeIslandJson(OVERWORLD)));
    expect(back).toEqual(OVERWORLD);
  });
  it("drops malformed entries, clamps, and never throws", () => {
    expect(sanitizeIslandDef(null)).toBeNull();
    expect(sanitizeIslandDef("x")).toBeNull();
    const d = sanitizeIslandDef({
      tiles: [{ q: 1, r: 2, t: "grass", rot: 8 }, { q: "a", r: 0, t: "grass" }, { q: 0, r: 0, t: "../evil" }, 7],
      props: [{ m: "kaykit/hexagon/flag_red.gltf", x: 1e999, z: 0, s: 100 }, { m: "no.exe", x: 0, z: 0 }, { m: "a/b.glb", q: 1, r: 1, rot: -30 }],
    })!;
    expect(d.tiles).toEqual([{ q: 1, r: 2, t: "grass", rot: 2 }]);
    expect(d.props.length).toBe(1); // Infinity x drops that prop; .exe drops; the cell one stays
    expect(d.props[0]).toEqual({ m: "a/b.glb", q: 1, r: 1, rot: 330 });
  });
  it("serialises to TS source that lists every tile and prop", () => {
    const src = serializeIslandTs(OVERWORLD, "OVERWORLD");
    expect(src).toContain("export const OVERWORLD: SceneDef = {");
    expect((src.match(/\{ q: -?\d+, r: -?\d+, t: "/g) ?? []).length).toBe(OVERWORLD.tiles.length);
    expect((src.match(/\{ m: "/g) ?? []).length).toBe(OVERWORLD.props.length);
    expect(src).toContain("// row r=");
  });
  it("cloneIsland is a deep copy", () => {
    const c = cloneIsland(OVERWORLD);
    c.tiles[0].q = 999;
    expect(OVERWORLD.tiles[0].q).not.toBe(999);
  });
});

describe("edit helpers", () => {
  const tiles = [{ q: 0, r: 0, t: "water" }, { q: 1, r: 0, t: "grass" }, { q: 0, r: 0, t: "coast_A", rot: 2 }];
  it("tileIndexAt returns the TOPMOST tile of a stacked cell", () => {
    expect(tileIndexAt(tiles, 0, 0)).toBe(2);
    expect(tilesAt(tiles, 0, 0)).toEqual([0, 2]);
    expect(tileIndexAt(tiles, 5, 5)).toBe(-1);
  });
  it("pickProp finds the nearest prop within its scaled radius", () => {
    const props = [{ m: "a.gltf", x: 0, z: 0 }, { m: "b.gltf", q: 1, r: 0, s: 3 }];
    const w = axialToWorld(1, 0);
    expect(pickProp(props, w.x + 1, w.z, 2.5)).toBe(1);
    expect(pickProp(props, 0.5, 0.2)).toBe(0);
    expect(pickProp(props, 40, 40)).toBe(-1);
  });
  it("snap/unsnap are inverse on cell centres", () => {
    const p = { m: "a.gltf", q: 2, r: -1 };
    const free = unsnapProp(p);
    expect(free.q).toBeUndefined();
    expect(propWorld(free)).toEqual(propWorld(p));
    expect(snapPropToCell(free)).toEqual(p);
  });
});

describe("transform math", () => {
  it("tile rotation wraps in 6 steps", () => {
    expect(tileRotStep(5, 1)).toBe(0);
    expect(tileRotStep(0, -1)).toBe(5);
  });
  it("prop rotation snaps to the step grid and wraps degrees", () => {
    expect(propRotStep(0, -1, 15)).toBe(345);
    expect(propRotStep(350, 1, 15)).toBe(0);
    expect(propRotStep(7, 1, 60)).toBe(60);
  });
  it("scale steps clamp", () => {
    expect(scaleStep(8, -1)).toBe(8);
    expect(scaleStep(1, -1)).toBe(1.1);
  });
  it("nudge is camera-relative", () => {
    const d = nudgeDelta("ArrowUp", Math.PI, 1);
    expect(d.dx).toBeCloseTo(0, 9);
    expect(d.dz).toBeCloseTo(-1, 9);
  });
  it("coalescer commits once after the window lapses", () => {
    const c = new CommitCoalescer(100);
    c.tick(0); c.tick(50);
    expect(c.due(120)).toBe(false);
    expect(c.due(151)).toBe(true);
    expect(c.due(200)).toBe(false);
  });
});
