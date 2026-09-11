// The house wall racks one weapon per hero class, authored as tagged variants sharing a slot.
// Exactly one must hang there. The bug this guards: the tags were authored but nothing read
// them, so every hero -- barbarian included -- walked past a crossbow while the prose said
// "hier hangt je bijl".

import { describe, expect, it } from "vitest";
import { HOUSE } from "../content/scenes/house";
import { ALL, meleeFor, weaponGroupFor, WORK_PROPS, RANGED, rangedFor } from "../content/characters";
import { build } from "../content/scenarios";
import { startFor } from "../content/grind/grindArc";
import { resolve as resolveAsset } from "../axis/vocabulary/fantasyPoc";
import { nlBe, fillTokens } from "../axis/locale/nlBe";

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

// A staf and a kruisboog cannot be sharpened, so the forge beat forks three ways. Every hero
// must land on a beat that exists AND that talks about the weapon they actually carry.
describe("the forge beat fits the weapon", () => {
  const graph = build("grind");

  it("sends every hero to a forge node that exists", () => {
    for (const c of ALL) {
      const id = startFor(weaponGroupFor(c.id));
      expect(graph.hasNode(id), `${c.id} -> ${id}`).toBe(true);
    }
  });

  it("stages a forge prop that resolves in the vocabulary", () => {
    for (const c of ALL) {
      const id = WORK_PROPS[weaponGroupFor(c.id)] || meleeFor(c.id);
      expect(resolveAsset(id), `${c.id} forge prop '${id}'`).not.toBe("");
    }
  });

  it("stages a primary weapon that resolves in the vocabulary", () => {
    for (const c of ALL) {
      expect(resolveAsset(meleeFor(c.id)), `${c.id} melee '${meleeFor(c.id)}'`).not.toBe("");
    }
  });

  it("never tells a caster or a ranger to sharpen anything", () => {
    for (const c of ALL) {
      const node = graph.getNodeById(startFor(weaponGroupFor(c.id)))!;
      const prose = fillTokens(nlBe.resolve(node.proseKey), c.id);
      if (weaponGroupFor(c.id) !== "blades") {
        expect(prose, `${c.id}: sharpening prose`).not.toMatch(/slijp|scherp|staal/);
      } else {
        expect(prose, `${c.id}: blades should grind`).toMatch(/slijp/);
      }
    }
  });

  it("names the hero's own weapon in the beat they get", () => {
    const noun: Record<string, string> = {
      knight: "zwaard", barbarian: "bijl", rogue: "dolk", ranger: "kruisboog", mage: "staf", witch: "staf",
    };
    for (const c of ALL) {
      const node = graph.getNodeById(startFor(weaponGroupFor(c.id)))!;
      const prose = fillTokens(nlBe.resolve(node.proseKey), c.id);
      expect(prose, `${c.id}`).toContain(noun[c.id]);
      // and no other class's weapon sneaks in
      for (const [other, w] of Object.entries(noun)) {
        if (w !== noun[c.id]) expect(prose, `${c.id} mentions ${other}'s ${w}`).not.toContain(w);
      }
    }
  });
});

// The item-get banner names the weapon the child just took. Dutch article trap: only "zwaard"
// is a het-word, so the line has to be possessive ("je bijl") for every class -- an article
// here would be wrong for five of the six.
describe("item-get banner", () => {
  it("names each hero's own weapon, possessively", () => {
    const want: Record<string, string> = {
      knight: "zwaard",
      barbarian: "bijl",
      mage: "staf",
      ranger: "kruisboog",
      rogue: "dolk",
      witch: "staf",
    };
    for (const [id, noun] of Object.entries(want)) {
      const line = nlBe.fillTokens(nlBe.resolve("itemget.wapen"), id);
      expect(line).toBe(`Je hebt nu je ${noun}!`);
      expect(line).not.toMatch(/\b(het|de) /);
    }
  });

  it("names the chosen ranged weapon when that is what was fetched", () => {
    expect(nlBe.resolve("itemget.bow")).toBe("Je hebt nu je boog!");
    expect(nlBe.resolve("itemget.crossbow")).toBe("Je hebt nu je kruisboog!");
  });
});

// How a weapon sits in the hand is a property of the MODEL, not of the class holding it.
// A crossbow's stock runs along its local +Z; a bow aims along its local -X. Attached with no
// correction the crossbow pointed ninety degrees across the lane while the hero aimed down it.
describe("ranged grip correction", () => {
  it("only the crossbow needs turning, and by a quarter turn", () => {
    expect(RANGED.ranger.weapon).toBe("crossbow");
    expect(RANGED.ranger.gripTurn).toBeCloseTo(Math.PI / 2);
    for (const id of ["knight", "mage", "witch", "barbarian", "rogue"]) {
      expect(RANGED[id].gripTurn ?? 0, `${id} should not need a grip turn`).toBe(0);
    }
  });

  it("a blade class that picks up a crossbow gets the correction with it", () => {
    for (const id of ["knight", "barbarian", "rogue"]) {
      expect(rangedFor(id, "crossbow").gripTurn).toBeCloseTo(Math.PI / 2);
      expect(rangedFor(id, "bow").gripTurn ?? 0).toBe(0);
    }
  });
});
