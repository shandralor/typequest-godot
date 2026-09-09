// A fork must accept the word the child SEES. The gear fetch at home asks for "{wapen}", which
// the banner renders as the hero's own weapon -- bijl, dolk, staf, kruisboog. RunState.choose
// was comparing the typed word against the RAW key, so it matched nothing and the fork looped
// forever: no gear, and the forge and practice yard unreachable. For every hero, including the
// knight, because the raw key is "{wapen}" for all of them.

import { describe, expect, it } from "vitest";
import { RunState } from "../logic/runState";
import { build, LIST } from "../content/scenarios";
import { nlBe, heroIds, fillTokens } from "../axis/locale/nlBe";

// No flag function on purpose: this test is about WORD MATCHING, and passing an always-true
// stub would hide any choice whose hiddenFlag set is "fully met", which is a different concern.
describe("a fork accepts the word on the banner", () => {
  it("commits every choice, for every hero, in every arc", () => {
    for (const s of LIST) {
      for (const hero of heroIds()) {
        const graph = build(s.id);
        for (const [nodeId, node] of graph.nodes) {
          for (const ch of node.choices ?? []) {
            const run = new RunState(build(s.id), nlBe);
            run.heroId = hero;
            run.currentId = nodeId;
            const shown = fillTokens(nlBe.resolve(ch.wordKey), hero);
            const res = run.choose(shown);
            expect(res.ok, `${s.id}/${nodeId} "${shown}" (${hero}) did not commit`).toBe(true);
            expect(run.currentId, `${s.id}/${nodeId} "${shown}" went nowhere`).not.toBe(nodeId);
          }
        }
      }
    }
  });

  it("still rejects a word that is not on offer", () => {
    const run = new RunState(build("home"), nlBe);
    run.heroId = "barbarian";
    expect(run.choose("nonsense").ok).toBe(false);
  });

  it("falls back to the raw word when no hero is set, so the pure layer stays usable", () => {
    const run = new RunState(build("band1"), nlBe);
    expect(run.wordFor("word.grot")).toBe("grot"); // no token in this one
  });
});
