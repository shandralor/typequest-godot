import { describe, expect, it } from "vitest";
import { setupGaze, targetYaw, yawTo, lerpAngle } from "../game/gaze";

const HERE = { x: 0, z: 0 };
const CAVE = { x: -5, z: -6.5 };
const BRIDGE = { x: 5, z: -6.5 };
const PROSE = "het pad gaat twee kanten op. links gaapt een zwarte grot. rechts staat een oude brug.";

describe("gaze", () => {
  it("yawTo faces a point ahead (-z) with PI, and the camera (+z) with 0", () => {
    expect(yawTo(HERE, { x: 0, z: -5 })).toBeCloseTo(Math.PI, 6);
    expect(yawTo(HERE, { x: 0, z: 5 })).toBeCloseTo(0, 6);
  });

  it("a walking beat keeps its travel facing (no gaze)", () => {
    expect(setupGaze({ walking: true, archery: false, landmarks: true, prerevealed: false, hasChest: false, prose: PROSE }).mode).toBe("none");
  });

  it("the fork looks ahead, then at the cave on 'links', then the bridge on 'rechts'", () => {
    const g = setupGaze({ walking: false, archery: false, landmarks: true, prerevealed: false, hasChest: false, prose: PROSE });
    expect(g.mode).toBe("fork");
    expect(g.links).toBeGreaterThan(0);
    expect(g.rechts).toBeGreaterThan(g.links);
    // before "links": look ahead, away from the camera
    expect(targetYaw(g, 0, HERE, { cave: CAVE, bridge: BRIDGE })).toBeCloseTo(Math.PI, 6);
    // after "links" is typed: turn to the cave (to the hero's left, ahead)
    expect(targetYaw(g, g.links + 1, HERE, { cave: CAVE, bridge: BRIDGE })).toBeCloseTo(yawTo(HERE, CAVE), 6);
    // after "rechts": the bridge
    expect(targetYaw(g, g.rechts + 1, HERE, { cave: CAVE, bridge: BRIDGE })).toBeCloseTo(yawTo(HERE, BRIDGE), 6);
  });

  it("never faces the camera during a fork beat", () => {
    const g = setupGaze({ walking: false, archery: false, landmarks: true, prerevealed: false, hasChest: false, prose: PROSE });
    for (const c of [0, 10, g.links + 1, g.rechts + 1, PROSE.length]) {
      const yaw = Math.abs(targetYaw(g, c, HERE, { cave: CAVE, bridge: BRIDGE }));
      expect(yaw, `cursor ${c}`).toBeGreaterThan(Math.PI / 2); // pointing away, not at +z
    }
  });

  it("a pre-revealed landmark beat looks at the bridge", () => {
    const g = setupGaze({ walking: false, archery: false, landmarks: true, prerevealed: true, hasChest: false, prose: "" });
    expect(g.mode).toBe("bridge");
    expect(targetYaw(g, 0, HERE, { bridge: BRIDGE })).toBeCloseTo(yawTo(HERE, BRIDGE), 6);
  });

  it("a plain standing beat faces the camera (yaw 0)", () => {
    const g = setupGaze({ walking: false, archery: false, landmarks: false, prerevealed: false, hasChest: false, prose: "x" });
    expect(targetYaw(g, 0, HERE, {})).toBe(0);
  });

  it("lerpAngle takes the short way around the wrap", () => {
    const TAU = Math.PI * 2;
    const norm = (a: number): number => ((a % TAU) + TAU) % TAU;
    // 3.0 -> -3.0 is 0.28 rad the short way (through PI), not 6.0 back through 0
    const end = lerpAngle(3.0, -3.0, 1);
    expect(norm(end)).toBeCloseTo(norm(-3.0), 6);
    expect(end - 3.0).toBeCloseTo(0.2832, 3); // moved forward through PI
    const half = lerpAngle(3.0, -3.0, 0.5);
    expect(half - 3.0).toBeCloseTo(0.1416, 3);
  });
});
