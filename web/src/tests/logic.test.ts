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

  it("grot is a somber win (met_skeleton, no crystal); the fight grants the crystal", () => {
    const g = build();
    const grot = g.getNodeById("grot")!;
    expect(grot.ending).toBe("win");
    expect(grot.celebrate).toBe(false);
    expect(grot.setsFlag).toContain("met_skeleton");
    expect(grot.setsFlag).not.toContain("has_crystal");
    // the armed return is now the APPROACH to a staged fight; the crystal is won at its end
    expect(g.getNodeById("grot_fight")!.setsFlag).not.toContain("has_crystal");
    expect(g.getNodeById("strijd_val")!.setsFlag).toContain("has_crystal");
  });

  // The fight is three phases with a setback each, and every path has to come back round --
  // a six-year-old must never be able to type a legal word and end up stuck in the cave.
  it("every fight choice leads somewhere, and every path can still reach the crystal", () => {
    const g = build();
    const seen = new Set<string>();
    const walk = (id: string): void => {
      if (seen.has(id)) return;
      seen.add(id);
      const n = g.getNodeById(id)!;
      expect(n, `node '${id}' is missing`).toBeTruthy();
      for (const c of n.choices) walk(c.target);
    };
    walk("grot_fight");
    for (const id of ["strijd_slag", "strijd_open", "strijd_wankel", "strijd_raak", "strijd_mis", "strijd_herrijst", "strijd_val"]) {
      expect(seen.has(id), `'${id}' is unreachable from the fight`).toBe(true);
    }
    // no phase is a dead end: each one offers a way on
    for (const id of seen) {
      const n = g.getNodeById(id)!;
      expect(n.choices.length > 0 || n.ending === "win", `'${id}' is a dead end`).toBe(true);
    }
    // Every phase is TYPED and then forks. The fight is still a typing beat: a version that
    // only asked for the choice word cut the cave from ~50 typed words to three.
    for (const id of ["strijd_slag", "strijd_open", "strijd_wankel", "strijd_raak", "strijd_mis", "strijd_herrijst"]) {
      const n = g.getNodeById(id)!;
      expect(n.proseKey, `'${id}' has no passage to type`).not.toBe("");
      expect(n.prerevealed, `'${id}' shows its passage instead of asking for it`).toBe(false);
    }
    // and each of the three real phases takes all three fight words
    for (const id of ["strijd_slag", "strijd_open", "strijd_wankel"]) {
      const words = g.getNodeById(id)!.choices.map((c) => c.wordKey).sort();
      expect(words).toEqual(["word.blok", "word.duik", "word.sla"]);
    }
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
