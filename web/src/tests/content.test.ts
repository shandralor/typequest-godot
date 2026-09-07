import { describe, it, expect } from "vitest";
import { validate } from "../logic/contentValidator";
import { build } from "../content/band1/band1Arc";
import { nlBe } from "../axis/locale/nlBe";
import { BAND1_SPEC } from "../content/bandSpec";

// Runs the ContentValidator over the band-1 arc (mirrors tests/test_content.gd). Zero
// problems proves, in one shot: the CURRENT prose safety hashes match the ported prose
// (byte-identical to Godot), band limits hold, every hero-noun variant is typeable, all
// text keys resolve, and every scene actor/prop id resolves in the vocabulary.
describe("content validator", () => {
  it("band-1 arc has zero problems", () => {
    const problems = validate(build(), nlBe, BAND1_SPEC);
    expect(problems).toEqual([]);
  });
});
