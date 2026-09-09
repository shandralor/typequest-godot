import { describe, expect, it } from "vitest";
import { TRACKS } from "../audio/tracks.generated";

describe("music manifest", () => {
  it("has a playlist for every context the game asks for", () => {
    for (const ctx of ["menu", "overworld", "adventure"]) {
      expect(TRACKS[ctx], ctx).toBeDefined();
      expect(TRACKS[ctx].length, ctx).toBeGreaterThan(0);
    }
  });

  it("every path is served from /audio/music/<context>/ and is an audio file", () => {
    for (const [ctx, list] of Object.entries(TRACKS)) {
      for (const p of list) {
        expect(p.startsWith(`/audio/music/${ctx}/`), p).toBe(true);
        expect(/\.(ogg|mp3|wav)$/i.test(p), p).toBe(true);
      }
    }
  });

  it("the menu's authored start track exists (it plays first every time)", () => {
    expect(TRACKS.menu.some((p) => p.endsWith("/01 - Quiet Menu.ogg"))).toBe(true);
  });

  it("no duplicate paths", () => {
    const all = Object.values(TRACKS).flat();
    expect(new Set(all).size).toBe(all.length);
  });
});
