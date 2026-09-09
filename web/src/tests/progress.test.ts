// Cumulative progress (AppProgress.add_stat): effort that adds up across runs. The point of
// these counters is that they only ever grow -- a child who typed 400 words yesterday still
// has 400 today, whatever happened in the run.

import { beforeEach, describe, expect, it } from "vitest";
import { addStat, allStats, getStat, resetProgress, wordCount, setFlag, getFlag } from "../game/flags";
import { count } from "../ui/menu";

describe("cumulative stats", () => {
  beforeEach(() => resetProgress());

  it("starts every counter at zero", () => {
    expect(getStat("words")).toBe(0);
    expect(allStats()).toEqual({});
  });

  it("accumulates rather than replaces", () => {
    addStat("words", 12);
    addStat("words", 30);
    expect(getStat("words")).toBe(42);
  });

  it("ignores a zero bump so nothing is written for an empty beat", () => {
    addStat("words", 0);
    expect(allStats()).toEqual({});
  });

  it("keeps counters independent", () => {
    addStat("adventures", 1);
    addStat("stars", 3);
    addStat("xp", 120);
    expect(allStats()).toEqual({ adventures: 1, stars: 3, xp: 120 });
  });

  it("hands out a copy, so a caller cannot edit the totals", () => {
    addStat("words", 5);
    allStats().words = 999;
    expect(getStat("words")).toBe(5);
  });

  it("counts words the way the Godot build does", () => {
    expect(wordCount("de ridder loopt weg")).toBe(4);
    expect(wordCount("  dubbele   spaties  ")).toBe(2);
    expect(wordCount("")).toBe(0);
  });

  it("wipes stats along with flags on a reset", () => {
    addStat("words", 7);
    setFlag("has_sword");
    resetProgress();
    expect(getStat("words")).toBe(0);
    expect(getFlag("has_sword")).toBe(false);
  });
});

describe("the totals line", () => {
  it("uses the singular for exactly one", () => {
    expect(count(1, "avontuur", "avonturen")).toBe("1 avontuur");
    expect(count(0, "avontuur", "avonturen")).toBe("0 avonturen");
    expect(count(7, "ster", "sterren")).toBe("7 sterren");
  });
});
