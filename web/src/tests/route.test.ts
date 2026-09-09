// The hero walks a POLYLINE in step with the typing (the intro goes bed -> weapon rack -> key
// -> door, because that is the order the prose names them). Pace must stay even however the
// waypoints are spaced, or he sprints one leg and crawls the next.

import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { pointOnRoute } from "../game/scenarioMode";

const v = (x: number, z: number) => new THREE.Vector3(x, 0, z);

describe("route walking", () => {
  const straight = [v(0, 0), v(0, 10)];
  const bent = [v(0, 0), v(0, 2), v(0, 10)]; // a short leg then a long one

  it("starts at the first point and ends at the last", () => {
    expect(pointOnRoute(bent, 0).z).toBeCloseTo(0);
    expect(pointOnRoute(bent, 1).z).toBeCloseTo(10);
  });

  it("spends time on each leg in proportion to its LENGTH, not its index", () => {
    // the short leg is 2 of 10 units, so it should be done at p = 0.2, not p = 0.5
    expect(pointOnRoute(bent, 0.2).z).toBeCloseTo(2, 5);
    expect(pointOnRoute(bent, 0.5).z).toBeCloseTo(5, 5);
  });

  it("matches a simple lerp when there is only one leg", () => {
    for (const p of [0, 0.25, 0.5, 0.75, 1]) expect(pointOnRoute(straight, p).z).toBeCloseTo(p * 10);
  });

  it("never goes backwards", () => {
    let last = -Infinity;
    for (let p = 0; p <= 1; p += 0.05) {
      const z = pointOnRoute(bent, p).z;
      expect(z).toBeGreaterThanOrEqual(last - 1e-9);
      last = z;
    }
  });

  it("clamps outside 0..1 and survives degenerate routes", () => {
    expect(pointOnRoute(bent, -1).z).toBeCloseTo(0);
    expect(pointOnRoute(bent, 5).z).toBeCloseTo(10);
    expect(pointOnRoute([v(3, 4)], 0.5).toArray()).toEqual([3, 0, 4]);
    expect(pointOnRoute([], 0.5).toArray()).toEqual([0, 0, 0]);
    expect(pointOnRoute([v(1, 1), v(1, 1)], 0.5).toArray()).toEqual([1, 0, 1]); // zero length
  });
});
