import { describe, expect, it } from "vitest";
import { FIGHT_BEATS, sentenceEnds } from "../content/band1/fightBeats";
import { build } from "../content/band1/band1Arc";
import * as nlBe from "../axis/locale/nlBe";

describe("fight beats", () => {
  const graph = build();

  it("names only fight nodes that exist", () => {
    for (const id of Object.keys(FIGHT_BEATS)) expect(graph.hasNode(id), id).toBe(true);
  });

  it("fires every beat on a sentence the passage actually has", () => {
    for (const [id, beats] of Object.entries(FIGHT_BEATS)) {
      const node = graph.nodes.get(id)!;
      const prose = nlBe.fillTokens(nlBe.resolve(node.proseKey), "knight");
      const sentences = sentenceEnds(prose).length;
      for (const i of Object.keys(beats).map(Number)) expect(i, `${id} sentence ${i} of ${sentences}`).toBeLessThan(sentences);
    }
  });

  it("finds the end of each sentence", () => {
    expect(sentenceEnds("a b. c d. e.")).toEqual([4, 9, 12]);
    expect(sentenceEnds("geen punt")).toEqual([9]);
  });
});
