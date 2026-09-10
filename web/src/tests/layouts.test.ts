import { describe, it, expect } from "vitest";
import { supportsText as azertySupports } from "../axis/layout/beAzerty";
import { supportsText as qwertySupports } from "../axis/layout/qwerty";
import { build } from "../content/band1/band1Arc";
import { resolve, heroProseVariants } from "../axis/locale/nlBe";
import { activeLayoutId, available, keyboardRows, setActive } from "../game/keyboardSettings";
import { getChoice } from "../game/flags";

// Every band-1 prose string, for EVERY hero-noun substitution, must be typeable on both
// supported layouts -- swapping layouts never makes content untypeable (mirrors
// tests/test_layouts.gd).
describe("keyboard layouts", () => {
  it("all band-1 prose is typeable on AZERTY and QWERTY (every hero variant)", () => {
    const g = build();
    for (const node of g.nodes.values()) {
      const prose = resolve(node.proseKey);
      for (const variant of heroProseVariants(prose)) {
        expect(azertySupports(variant), `azerty: node '${node.id}'`).toBe(true);
        expect(qwertySupports(variant), `qwerty: node '${node.id}'`).toBe(true);
      }
    }
  });

  it("both layouts type the same character set (a swap never breaks content)", () => {
    const alphabet = "abcdefghijklmnopqrstuvwxyz .";
    for (const ch of alphabet) {
      expect(azertySupports(ch), `azerty: '${ch}'`).toBe(true);
      expect(qwertySupports(ch), `qwerty: '${ch}'`).toBe(true);
    }
  });
});

// The options screen cycles through available() and persists the pick. That the CHOICE
// survives a restart is the point: the finger guidance is only correct for the board actually
// under the child's hands, so a layout that reverted to AZERTY every session would teach the
// wrong fingering to every QWERTY child.
describe("layout selection (the Opties row)", () => {
  it("cycles every available layout and comes back round", () => {
    const ids = available().map((l) => l.LAYOUT_ID);
    expect(ids).toContain("azerty");
    expect(ids).toContain("qwerty");
    const seen: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      const at = ids.indexOf(activeLayoutId());
      setActive(ids[(at + 1) % ids.length]);
      seen.push(activeLayoutId());
    }
    expect(new Set(seen).size).toBe(ids.length);
  });

  it("persists the pick and re-letters the board", () => {
    setActive("qwerty");
    expect(activeLayoutId()).toBe("qwerty");
    expect(getChoice("layout", "azerty")).toBe("qwerty");
    expect(keyboardRows()[0].join("")).toBe("qwertyuiop");
    setActive("azerty");
    expect(keyboardRows()[0].join("")).toBe("azertyuiop");
    expect(getChoice("layout", "qwerty")).toBe("azerty");
  });

  it("falls back to AZERTY for an id that is not a layout", () => {
    setActive("dvorak");
    expect(activeLayoutId()).toBe("azerty");
  });
});
