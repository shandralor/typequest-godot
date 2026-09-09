// "What the child is asked to type must match what is shown." That mismatch is the recurring
// defect in this project, so the invariant is pinned here rather than left to a play-through.
//
// The band renders the prose through the reveal window, which means it shows a SLICE. A slice
// is safe; anything else is a bug the child experiences as "the screen disagrees with my
// fingers". This walks every prose string in the catalog, for every hero variant, cursor by
// cursor, and checks the rendered band against the real target.

import { describe, expect, it } from "vitest";
import { visibleEnd, windowStart } from "../logic/revealWindow";
import { nlBe, heroIds, fillTokens } from "../axis/locale/nlBe";
import { build, LIST } from "../content/scenarios";

/** exactly what ui/hud.ts prose() concatenates into the band */
function bandText(target: string, cursor: number): string {
  const start = windowStart(target, cursor);
  const end = visibleEnd(target, cursor);
  return target.slice(start, cursor) + (target[cursor] ?? "") + target.slice(cursor + 1, Math.max(cursor + 1, end));
}

/** every prose line the game can put in front of a child, resolved per hero */
function allProse(): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  for (const s of LIST) {
    const graph = build(s.id);
    for (const [id, node] of graph.nodes) {
      if (!node.proseKey) continue;
      for (const hero of heroIds()) {
        out.push({ where: `${s.id}/${id}/${hero}`, text: fillTokens(nlBe.resolve(node.proseKey), hero) });
      }
    }
  }
  return out;
}

/** every word the child is asked to TYPE at a fork, resolved per hero */
function allChoiceWords(): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  for (const s of LIST) {
    const graph = build(s.id);
    for (const [id, node] of graph.nodes) {
      for (const ch of node.choices ?? []) {
        for (const hero of heroIds()) {
          out.push({ where: `${s.id}/${id}/${ch.wordKey}/${hero}`, text: fillTokens(nlBe.resolve(ch.wordKey), hero) });
        }
      }
    }
  }
  return out;
}

describe("the words at a fork are typeable", () => {
  const words = allChoiceWords();

  it("has fork words to check", () => {
    expect(words.length).toBeGreaterThan(0);
  });

  it("leaves no unresolved {token} in a word the child must type", () => {
    for (const { where, text } of words) {
      expect(text.includes("{"), `${where}: unresolved token "${text}"`).toBe(false);
    }
  });

  it("asks for no character the on-screen keyboard cannot produce", () => {
    for (const { where, text } of words) {
      const bad = [...text].filter((ch) => !/[a-z .]/.test(ch));
      expect(bad, `${where}: untypeable ${JSON.stringify(bad)}`).toEqual([]);
    }
  });

  it("keeps every fork word inside the band-1 word length", () => {
    for (const { where, text } of words) {
      for (const w of text.split(" ").filter(Boolean)) {
        expect(w.length, `${where}: "${w}" is ${w.length} letters`).toBeLessThanOrEqual(9);
      }
    }
  });

  it("never offers two forks the same word at one node", () => {
    const byNode = new Map<string, string[]>();
    for (const { where, text } of words) {
      const node = where.split("/").slice(0, 2).join("/") + "/" + where.split("/")[3];
      byNode.set(node, [...(byNode.get(node) ?? []), text]);
    }
    for (const [node, list] of byNode) {
      expect(new Set(list).size, `${node}: duplicate fork words ${JSON.stringify(list)}`).toBe(list.length);
    }
  });
});

describe("the band shows what the child types", () => {
  const prose = allProse();

  it("covers every prose beat in every arc, for every hero", () => {
    // 6 heroes x every node that carries prose -- if this number collapses, the suite below
    // is quietly checking nothing, which is worse than failing
    expect(prose.length).toBeGreaterThanOrEqual(6 * 10);
    expect(new Set(prose.map((p) => p.where.split("/")[0])).size).toBe(LIST.length);
  });

  it("only ever renders a contiguous slice of the real target", () => {
    for (const { where, text } of prose) {
      for (let c = 0; c <= text.length; c++) {
        const band = bandText(text, c);
        expect(text.includes(band), `${where} @${c}: band is not a slice of the target`).toBe(true);
      }
    }
  });

  it("highlights exactly the character the cursor is on", () => {
    for (const { where, text } of prose) {
      for (let c = 0; c < text.length; c++) {
        const start = windowStart(text, c);
        expect(bandText(text, c)[c - start], `${where} @${c}`).toBe(text[c]);
      }
    }
  });

  it("never hides a character before it has been typed", () => {
    for (const { where, text } of prose) {
      for (let c = 0; c < text.length; c++) {
        expect(visibleEnd(text, c), `${where} @${c}: runway ends before the cursor`).toBeGreaterThan(c);
      }
    }
  });

  it("asks for no character the on-screen keyboard cannot produce", () => {
    for (const { where, text } of prose) {
      const bad = [...text].filter((ch) => !/[a-z .]/.test(ch));
      expect(bad, `${where}: untypeable ${JSON.stringify(bad)}`).toEqual([]);
    }
  });

  it("leaves no unresolved {token} in anything the child reads", () => {
    for (const { where, text } of prose) {
      expect(text.includes("{"), `${where}: unresolved token in "${text}"`).toBe(false);
    }
  });
});
