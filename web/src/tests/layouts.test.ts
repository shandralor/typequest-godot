import { describe, it, expect } from "vitest";
import { supportsText as azertySupports } from "../axis/layout/beAzerty";
import { supportsText as qwertySupports } from "../axis/layout/qwerty";
import { build } from "../content/band1/band1Arc";
import { resolve, heroProseVariants } from "../axis/locale/nlBe";

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
