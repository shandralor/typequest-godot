// What the cave duel SHOWS as the child types: one beat per finished sentence of a fight
// passage. Kept as data beside the arc, and pure, so a test can hold every beat to a sentence
// that exists -- edit a passage down to two sentences and a third-sentence beat would silently
// never fire.

export type FightBeat = "rise" | "taunt" | "windup" | "step_in" | "reel" | "bones" | "topple" | "glint" | "guard" | "resurrect";
/**
 * What happens when the child FINISHES each sentence of a fight passage (key = sentence index).
 * The picture follows the words: the skeleton rises when "komt langzaam overeind" is typed,
 * raises its blade on "haalt het hard uit", sheds bones on "er vallen botjes op de grond" and
 * crashes down on "valt met een klap om". Typing is what makes the fight happen.
 */
export const FIGHT_BEATS: Record<string, Partial<Record<number, FightBeat>>> = {
  strijd_slag: { 0: "rise", 1: "taunt", 2: "windup" },
  strijd_open: { 2: "step_in" },
  strijd_wankel: { 0: "reel", 1: "bones" },
  strijd_val: { 0: "topple", 1: "glint" },
  strijd_raak: { 2: "guard" },
  strijd_herrijst: { 0: "resurrect", 2: "taunt" },
};
/** the index just past each sentence's full stop: where a fight beat fires */
export function sentenceEnds(prose: string): number[] {
  const ends: number[] = [];
  for (let i = 0; i < prose.length; i++) if (prose[i] === ".") ends.push(i + 1);
  if (ends.length === 0 || ends[ends.length - 1] < prose.length) ends.push(prose.length);
  return ends;
}
