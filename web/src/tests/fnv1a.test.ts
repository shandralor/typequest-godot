import { describe, it, expect } from "vitest";
import { hashProse } from "../logic/fnv1a";

// The six frozen band-1 safety hashes from brief A7 (mirrors tests/test_fnv1a.gd).
// These verify the FNV-1a ALGORITHM reproduces the known reference values byte-for-byte
// -- the whole point of the port. A failing case means the TS hash diverges from Godot.
const CASES: [string, string, string][] = [
  ["de kleine ridder wandelt door het bos. hij volgt het pad en stapt verder.", "fnv1a:dff7ec80", "start"],
  ["het pad gaat twee kanten op. links gaapt een zwarte grot. rechts staat een oude brug.", "fnv1a:fc978a65", "kruispunt"],
  ["in de grot rammelt een wit skelet. de ridder rent snel terug naar het licht.", "fnv1a:3778a255", "grot"],
  ["de ridder kiest nu voor de veilige brug.", "fnv1a:859459c1", "naGrot"],
  ["de brug ligt naar beneden. de ridder stapt over de brug en gaat verder.", "fnv1a:a585a423", "brug"],
  ["de ridder opent de kist vol goud. hij vindt de schat en is heel blij.", "fnv1a:1f2d5082", "schat"],
];

describe("fnv1a (A7 reference hashes)", () => {
  for (const [prose, expected, name] of CASES) {
    it(`reproduces the A7 hash for '${name}'`, () => {
      expect(hashProse(prose)).toBe(expected);
    });
  }
});
