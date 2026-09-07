import { describe, it, expect } from "vitest";
import { RunState } from "../logic/runState";
import { build } from "../content/band1/band1Arc";
import { nlBe } from "../axis/locale/nlBe";
import { score } from "../logic/scoring";
import { TypingState } from "../logic/typing";

// Band-1 traversal + gating (mirrors tests/test_logic.gd).
describe("band-1 traversal", () => {
  it("type 'verder' advances start -> kruispunt", () => {
    const run = new RunState(build(), nlBe);
    const r = run.choose("verder");
    expect(r.ok).toBe(true);
    expect(run.currentId).toBe("kruispunt");
  });

  it("grot fork -> flee when untrained, armed fight only when fully_trained", () => {
    const grot = build().getNodeById("kruispunt")!.choices[0];
    expect(grot.resolvedTarget(() => false)).toBe("grot");
    expect(grot.resolvedTarget((f) => f === "sword_sharp")).toBe("grot"); // half-trained still flees
    expect(grot.resolvedTarget((f) => f === "fully_trained")).toBe("grot_fight");
  });

  it("grot fork retires once crystal + tip are both held, and brug is available in exactly that state", () => {
    const kruispunt = build().getNodeById("kruispunt")!;
    const grot = kruispunt.choices[0];
    const brug = kruispunt.choices[1];
    const both = (f: string) => f === "has_crystal" || f === "molen_tip";
    expect(grot.isAvailable(() => false)).toBe(true); // shown at the start
    expect(grot.isAvailable((f) => f === "has_crystal")).toBe(true); // still shown with crystal but no tip (no soft-lock)
    expect(grot.isAvailable(both)).toBe(false); // HIDDEN once both set
    expect(brug.isAvailable(both)).toBe(true); // the crossing is open in exactly that state
  });

  it("grot is a somber win (met_skeleton, no crystal); grot_fight grants the crystal", () => {
    const g = build();
    const grot = g.getNodeById("grot")!;
    expect(grot.ending).toBe("win");
    expect(grot.celebrate).toBe(false);
    expect(grot.setsFlag).toContain("met_skeleton");
    expect(grot.setsFlag).not.toContain("has_crystal");
    expect(g.getNodeById("grot_fight")!.setsFlag).toContain("has_crystal");
  });
});

describe("scoring (A6) -- completion + accuracy, zero speed", () => {
  it("accuracy drives stars; speed is not even a parameter", () => {
    const careful = score(true, 50, 0.98);
    const sloppy = score(true, 50, 0.6);
    expect(careful.stars).toBe(3);
    expect(sloppy.stars).toBe(1);
    // same volume, same completion, different accuracy -> careful out-scores sloppy
    expect(careful.xp).toBeGreaterThan(sloppy.xp);
  });
});

describe("typing (B7 progress primitive)", () => {
  it("advances on the expected char, counts mismatches, progress hits 1 at the end", () => {
    const t = new TypingState("de");
    expect(t.typeChar("x")).toBe(false); // mismatch: counts a keystroke, no advance
    expect(t.typeChar("d")).toBe(true);
    expect(t.typeChar("e")).toBe(true);
    expect(t.isComplete()).toBe(true);
    expect(t.progress()).toBe(1);
    expect(t.correctChars()).toBe(2);
    expect(t.accuracy()).toBeCloseTo(2 / 3, 5);
  });
});
