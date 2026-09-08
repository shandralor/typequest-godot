import { describe, expect, it } from "vitest";
import { AUTHORED } from "../editor/content_index";

// the authored files' raw text, via Vite (works in vitest and needs no Node types)
const RAW = import.meta.glob<string>("../content/{island,scenes}/*.ts", { query: "?raw", import: "default", eager: true });
function fileText(dir: string, name: string): string {
  return RAW[`../content/${dir}/${name}.ts`];
}
import { sanitizeIslandDef, serializeIslandJson, serializeIslandTs } from "../editor/island_doc";

describe("authored scenes (all converted sets)", () => {
  it("discovers every set", () => {
    const names = AUTHORED.map((s) => s.name).sort();
    expect(names).toEqual(["archery", "dungeon", "forest_bridge", "forest_fork", "forest_straight", "forge", "house", "mill", "overworld"]);
  });
  for (const s of AUTHORED) {
    it(`${s.dir}/${s.name}: JSON + sanitizer round-trip is lossless`, () => {
      expect(sanitizeIslandDef(JSON.parse(serializeIslandJson(s.def)))).toEqual(s.def);
    });
    it(`${s.dir}/${s.name}: serialises byte-identically to the file on disk`, () => {
      expect(serializeIslandTs(s.def, s.name.toUpperCase())).toBe(fileText(s.dir, s.name));
    });
  }
  it("story sets carry anchors the descriptors refer to", () => {
    const fork = AUTHORED.find((s) => s.name === "forest_fork")!.def;
    const names = new Set(fork.anchors?.map((a) => a.name));
    for (const n of ["center", "path_near", "path_far", "far_left", "far_right", "cross_exit", "crystal_socket"]) expect(names.has(n)).toBe(true);
    const ow = AUTHORED.find((s) => s.name === "overworld")!.def;
    expect(ow.camera).toEqual({ pos: [0, 30, 34], look: [0, 0, -2] });
    expect(ow.routes?.map((r) => r.name).sort()).toEqual(["route_boog", "route_bos", "route_home", "route_molen", "route_smidse"]);
  });
});
