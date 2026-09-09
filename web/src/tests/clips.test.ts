// Every animation the game asks for must actually be reachable. This test reads the REAL rig
// GLBs off disk and checks two things at once: that each clip the code plays exists in some
// KayKit pack, and that the pack it lives in is one the game will actually load.
//
// It exists because the opposite was true and nobody noticed: the port loaded two of Godot's
// five rig packs, so `Cheering`, `Sawing`, `Lie_StandUp` and every `Ranged_*` clip resolved to
// nothing and the animation silently did not play -- no error, no warning, just a hero standing
// still through his own victory.
//
// Node types are pulled in HERE rather than in tsconfig's `types`, so the app's own sources
// keep seeing a browser-only global scope.
/// <reference types="node" />

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RIGS, EXTRA_RIGS } from "../game/hero";

const here = dirname(fileURLToPath(import.meta.url));

/** Clip names out of a .glb, straight from its JSON chunk (no three, no WebGL). */
function clipsInGlb(relPath: string): string[] {
  const buf = readFileSync(resolve(here, "../../public/assets", relPath));
  expect(buf.subarray(0, 4).toString("ascii"), relPath).toBe("glTF");
  let off = 12;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    if (type === 0x4e4f534a) {
      const json = JSON.parse(buf.subarray(off + 8, off + 8 + len).toString("utf8")) as {
        animations?: { name?: string }[];
      };
      return (json.animations ?? []).map((a) => a.name ?? "");
    }
    off += 8 + len;
  }
  return [];
}

/** Clips the game plays, read out of the source so the list cannot drift from the code. */
function clipsPlayedInSource(): string[] {
  const files = ["../game/scenarioMode.ts", "../game/hero.ts", "../game/world.ts"];
  const names = new Set<string>();
  for (const f of files) {
    const src = readFileSync(resolve(here, f), "utf8");
    for (const m of src.matchAll(/\b(?:play|playOneShot)\("([^"]+)"/g)) names.add(m[1]);
    for (const m of src.matchAll(/\bensureClips\(\[([^\]]*)\]/g)) {
      for (const q of m[1].matchAll(/"([^"]+)"/g)) names.add(q[1]);
    }
    // the pose table: { idle: "Idle_A", work: "Sawing", ... }
    const poses = src.match(/POSE_CLIPS[^=]*=\s*\{([^}]*)\}/);
    if (poses) for (const q of poses[1].matchAll(/"([^"]+)"/g)) names.add(q[1]);
  }
  return [...names];
}

describe("animation clips are reachable", () => {
  const base = new Map(RIGS.map((r) => [r, clipsInGlb(r)]));
  const extra = new Map(Object.keys(EXTRA_RIGS).map((r) => [r, clipsInGlb(r)]));
  const everywhere = new Set([...base.values(), ...extra.values()].flat());

  it("declares extra-pack clips that the pack really contains", () => {
    for (const [pack, names] of Object.entries(EXTRA_RIGS)) {
      for (const n of names) expect(extra.get(pack), `${n} in ${pack}`).toContain(n);
    }
  });

  it("plays only clips that exist in some pack", () => {
    for (const n of clipsPlayedInSource()) expect(everywhere, `clip '${n}'`).toContain(n);
  });

  it("plays only clips the game will actually load", () => {
    const loadable = new Set([...[...base.values()].flat(), ...Object.values(EXTRA_RIGS).flat()]);
    for (const n of clipsPlayedInSource()) expect(loadable, `clip '${n}' is in no loaded pack`).toContain(n);
  });

  it("keeps the base packs small -- they are on the critical path for the menu", () => {
    expect(RIGS.length).toBe(2);
  });
});
