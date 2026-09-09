// The reveal window (B5): the child sees a little of what they typed, the next character, and
// a few words of runway -- never the whole paragraph. Getting this wrong is not a crash, it is
// a wall of text in front of a six-year-old, so the boundaries are pinned here.

import { describe, expect, it } from "vitest";
import { visibleEnd, windowStart, DEFAULT_WORDS_AHEAD, DEFAULT_CHARS_BEHIND } from "../logic/revealWindow";

const PROSE = "de ridder loopt door het bos. de ridder volgt het pad en stapt verder naar de grote brug.";

/** what the band actually renders: the window from `start` to `end` */
const shown = (cursor: number): string => PROSE.slice(windowStart(PROSE, cursor), visibleEnd(PROSE, cursor));

describe("reveal window", () => {
  it("starts at the beginning while the cursor is still near it", () => {
    expect(windowStart(PROSE, 0)).toBe(0);
    expect(windowStart(PROSE, DEFAULT_CHARS_BEHIND)).toBe(0);
  });

  it("scrolls older text off once the cursor runs past the look-behind", () => {
    const start = windowStart(PROSE, 70);
    expect(start).toBeGreaterThan(0);
    expect(70 - start).toBeLessThanOrEqual(DEFAULT_CHARS_BEHIND);
  });

  it("snaps the window start to a word boundary, never mid-word", () => {
    for (let c = 0; c <= PROSE.length; c++) {
      const i = windowStart(PROSE, c);
      if (i > 0) expect(PROSE[i - 1], `cursor ${c} starts mid-word`).toBe(" ");
    }
  });

  it("shows a few words of runway, not the whole passage", () => {
    // at the very start the child sees the opening words only
    expect(shown(0).length).toBeLessThan(PROSE.length);
    expect(shown(0)).toBe("de ridder loopt door het ");
  });

  it("never hides what has already been typed inside the window", () => {
    for (let c = 0; c <= PROSE.length; c++) {
      expect(visibleEnd(PROSE, c), `cursor ${c}`).toBeGreaterThanOrEqual(c);
    }
  });

  it("keeps the visible span roughly stable as the cursor advances", () => {
    const lens = [10, 30, 50, 70].map((c) => shown(c).length);
    expect(Math.max(...lens) - Math.min(...lens)).toBeLessThan(40);
  });

  it("reveals the tail once the cursor reaches the end", () => {
    expect(visibleEnd(PROSE, PROSE.length)).toBe(PROSE.length);
    expect(shown(PROSE.length).endsWith("brug.")).toBe(true);
  });

  it("widens with wordsAhead and stays inside the prose", () => {
    expect(visibleEnd(PROSE, 0, DEFAULT_WORDS_AHEAD + 3)).toBeGreaterThan(visibleEnd(PROSE, 0));
    expect(visibleEnd(PROSE, 0, 999)).toBe(PROSE.length);
  });

  it("survives an empty target and an out-of-range cursor", () => {
    expect(visibleEnd("", 0)).toBe(0);
    expect(windowStart("", 0)).toBe(0);
    expect(visibleEnd(PROSE, 9999)).toBe(PROSE.length);
  });
});
