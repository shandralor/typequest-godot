// Which gear a hero must fetch before the training sites open.
//
// The practice yard requires `has_ranged`, and only the bow/crossbow fetch granted it. But a
// jager's kruisboog and a caster's staf ARE ranged weapons: those classes were told "Haal eerst
// een boog thuis!" and made to carry a second, off-class weapon to train with -- a mage cast
// spells holding a bow. Reviewers caught it on the ranger AND the mage runs.

import { describe, expect, it } from "vitest";
import { ALL, primaryIsRanged, weaponGroupFor, rangedFor, meleeFor } from "../content/characters";
import { resolve as resolveAsset } from "../axis/vocabulary/fantasyPoc";

describe("gear gating by weapon group", () => {
  it("treats a kruisboog and a staf as ranged, and blades as not", () => {
    expect(primaryIsRanged("ranger")).toBe(true);
    expect(primaryIsRanged("mage")).toBe(true);
    expect(primaryIsRanged("witch")).toBe(true);
    for (const id of ["knight", "barbarian", "rogue"]) expect(primaryIsRanged(id), id).toBe(false);
  });

  it("agrees with the weapon group for every hero", () => {
    for (const c of ALL) expect(primaryIsRanged(c.id), c.id).toBe(weaponGroupFor(c.id) !== "blades");
  });

  it("arms a caster with the staff their prose names, not a wand", () => {
    for (const id of ["mage", "witch"]) {
      const kit = rangedFor(id);
      expect(kit.weapon, `${id} should train with the staf {wapen} names`).toBe("staff");
      expect(kit.weapon).toBe(meleeFor(id)); // the same object the house rack shows
    }
  });

  it("keeps the child's bow/crossbow choice for the blade classes", () => {
    expect(rangedFor("knight", "crossbow").weapon).toBe("crossbow");
    expect(rangedFor("rogue", "bow").weapon).toBe("bow");
    // but a caster keeps casting whatever was picked up
    expect(rangedFor("witch", "bow").weapon).toBe("staff");
  });

  it("stages a ranged weapon that resolves in the vocabulary, for every hero", () => {
    for (const c of ALL) expect(resolveAsset(rangedFor(c.id).weapon), c.id).not.toBe("");
  });
});
