import { describe, expect, it } from "vitest";
import { arrowRings, sparkColor } from "../render/effects";

const BOOG = "de ridder maakt zich klaar. de ridder mikt goed op het doel. het schot vliegt snel recht door de lucht. de ridder raakt het doel precies in het midden.";

describe("archery rings", () => {
  it("one arrow per sentence", () => {
    expect(arrowRings(BOOG).length).toBe(4);
  });
  it("a LONGER sentence lands nearer the bullseye", () => {
    const rings = arrowRings(BOOG);
    const len = (r: (typeof rings)[number]): number => r.span[1] - r.span[0];
    const sorted = [...rings].sort((a, b) => len(b) - len(a));
    // longest sentence -> smallest radius (dead centre), shortest -> the outer ring
    expect(sorted[0].offset.length()).toBeLessThan(sorted[sorted.length - 1].offset.length());
    expect(sorted[0].offset.length()).toBeCloseTo(0, 6);
  });
  it("every arrow stays on the target face", () => {
    for (const r of arrowRings(BOOG)) expect(r.offset.length()).toBeLessThanOrEqual(1.0001);
  });
  it("spans tile the prose in order", () => {
    const rings = arrowRings(BOOG);
    expect(rings[0].span[0]).toBe(0);
    for (let i = 1; i < rings.length; i++) expect(rings[i].span[0]).toBe(rings[i - 1].span[1]);
  });
  it("prose with no full stop still gets one arrow", () => {
    expect(arrowRings("geen punt hier").length).toBe(1);
  });
});

describe("spark heat ramp", () => {
  it("runs red-orange -> gold -> white-hot -> blue", () => {
    const at = (p: number) => sparkColor(p).clone();
    expect(at(0).r).toBeGreaterThan(at(0).b); // red-orange
    const gold = at(0.5);
    expect(gold.g).toBeGreaterThan(0.7);
    const end = at(1);
    expect(end.b).toBeGreaterThan(end.r); // cooled to blue
  });
  it("is continuous across both hand-offs", () => {
    const near = (a: number, b: number): number => {
      const x = sparkColor(a).clone();
      const y = sparkColor(b).clone();
      return Math.hypot(x.r - y.r, x.g - y.g, x.b - y.b);
    };
    expect(near(0.499, 0.501)).toBeLessThan(0.02);
    expect(near(0.669, 0.671)).toBeLessThan(0.02);
  });
});
