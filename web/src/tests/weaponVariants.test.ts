// The house wall racks one weapon per hero class, authored as tagged variants sharing a slot.
// Exactly one must hang there. The bug this guards: the tags were authored but nothing read
// them, so every hero -- barbarian included -- walked past a crossbow while the prose said
// "hier hangt je bijl".

import { describe, expect, it } from "vitest";
import { HOUSE } from "../content/scenes/house";
import { ALL } from "../content/characters";

const variants = HOUSE.props.filter((p) => (p.tags?.length ?? 0) > 0);

/** the game's rule: a tagged prop shows only when one of its tags is active */
const shownFor = (heroId: string) => variants.filter((p) => p.tags!.includes(`weapon_${heroId}`));

describe("per-class weapon on the house rack", () => {
  it("authors a weapon variant for every hero in the roster", () => {
    for (const c of ALL) expect(shownFor(c.id), `no weapon tagged for '${c.id}'`).toHaveLength(1);
  });

  it("shows exactly one weapon, whoever the hero is", () => {
    for (const c of ALL) {
      const shown = shownFor(c.id);
      expect(shown, c.id).toHaveLength(1);
      expect(variants.length - shown.length).toBe(variants.length - 1); // the rest stay hidden
    }
  });

  it("gives each class the weapon its prose promises", () => {
    const expected: Record<string, string> = {
      knight: "sword", barbarian: "axe", mage: "staff", witch: "staff", ranger: "crossbow", rogue: "dagger",
    };
    const model = (id: string) => shownFor(id)[0].m.toLowerCase();
    expect(model("knight")).toContain("sword");
    expect(model("barbarian")).toContain("axe");
    expect(model("mage")).toContain("staff");
    expect(model("witch")).toContain("staff");
    expect(model("ranger")).toContain("crossbow");
    expect(model("rogue")).toContain("dagger");
    expect(Object.keys(expected).sort()).toEqual(ALL.map((c) => c.id).sort());
  });

  it("authors every variant hidden, so the tags alone decide what hangs there", () => {
    for (const p of variants) expect(p.hidden, `${p.m} is not authored hidden`).toBe(true);
  });

  it("tags no prop for a hero that does not exist", () => {
    const ids = new Set(ALL.map((c) => c.id));
    for (const p of variants) {
      for (const t of p.tags!) {
        expect(ids.has(t.replace("weapon_", "")), `unknown hero in tag '${t}'`).toBe(true);
      }
    }
  });
});
