import { describe, it, expect } from "vitest";
import { validate } from "../logic/contentValidator";
import { build, LIST } from "../content/scenarios";
import { nlBe } from "../axis/locale/nlBe";
import { BAND1_SPEC } from "../content/bandSpec";

// Runs the ContentValidator over EVERY playable arc (mirrors tests/test_content.gd). Zero
// problems proves, in one shot: the CURRENT prose safety hashes match the ported prose
// (byte-identical to Godot), band limits hold, every hero-noun variant is typeable, all
// text keys resolve, and every scene actor/prop id resolves in the vocabulary.
//
// It used to check band-1 alone, which left the A4 safety gate covering one arc out of six:
// grind, archery, home, mill and intro all carry approved hashes that nothing verified. The
// loop is over content/scenarios.LIST so a new scenario is covered the day it is added.
describe("content validator", () => {
  for (const s of LIST) {
    it(`${s.id} arc has zero problems`, () => {
      expect(validate(build(s.id), nlBe, BAND1_SPEC)).toEqual([]);
    });
  }
});
