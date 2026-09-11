// The band-1 story graph `band1-arc` (brief A7/A9), built as pure data. Faithful port
// of content/band1/band1_arc.gd.
//
// Arc shape: start -> kruispunt -> { grot (first visit: FLEE, sets met_skeleton) |
// grot_fight (armed return once fully_trained: wins has_crystal) | brug (the crossing,
// needs has_crystal + molen_tip) }. Once has_crystal AND molen_tip the grot fork is
// HIDDEN (spent). Safety records carry the per-locale FNV-1a hash from A7.

import { StoryGraph, StoryNode, Choice, SafetyRecord } from "../../logic/storyGraph";
import * as Scenes from "./sceneDescriptors";

export const GRAPH_ID = "band1-arc";
export const VOCABULARY_ID = "fantasy-poc";
export const START_ID = "start";
const SAFETY_DATE = "2026-06-26";
const CRITERIA_VERSION = "v0-stub";

function nlBeSafety(hash: string): Record<string, SafetyRecord> {
  return { "nl-BE": { hash, date: SAFETY_DATE, criteria_version: CRITERIA_VERSION } };
}

export function build(): StoryGraph {
  const g = new StoryGraph();
  g.graphId = GRAPH_ID;
  g.vocabularyId = VOCABULARY_ID;
  g.startId = START_ID;

  // start -- type prose, then `verder` to the fork.
  const start = new StoryNode("start");
  start.proseKey = "start.prose";
  start.narrationKey = "start.narration";
  start.choices = [new Choice("word.verder", "kruispunt", "forward")];
  start.safety = nlBeSafety("fnv1a:dd59dea4");
  start.scene = Scenes.start();
  g.addNode(start);

  // kruispunt -- the fork: `grot` (left) or `brug` (right).
  const kruispunt = new StoryNode("kruispunt");
  kruispunt.proseKey = "kruispunt.prose";
  kruispunt.narrationKey = "kruispunt.narration";
  const brugChoice = new Choice("word.brug", "brug", "right");
  brugChoice.requiresFlag = "has_crystal molen_tip";
  const grotChoice = new Choice("word.grot", "grot", "left");
  grotChoice.altTarget = "grot_fight";
  grotChoice.altFlag = "fully_trained";
  grotChoice.hiddenFlag = "has_crystal molen_tip";
  kruispunt.choices = [grotChoice, brugChoice];
  kruispunt.safety = nlBeSafety("fnv1a:fc978a65");
  kruispunt.scene = Scenes.kruispunt();
  g.addNode(kruispunt);

  // grot -- FIRST visit: the cave frightens him, he flees. Only `met_skeleton`.
  const grot = new StoryNode("grot");
  grot.proseKey = "grot.prose";
  grot.narrationKey = "grot.narration";
  grot.ending = "win";
  grot.winKey = "grot.win";
  grot.celebrate = false;
  grot.setsFlag = "met_skeleton";
  grot.safety = nlBeSafety("fnv1a:1352a646");
  grot.scene = Scenes.grot();
  g.addNode(grot);

  // grot_fight -- the ARMED return (via the grot fork once fully_trained). The APPROACH only;
  // the fight is staged in three phases below and the crystal is won at the end of them.
  const grotFight = new StoryNode("grot_fight");
  grotFight.proseKey = "grotFight.prose";
  grotFight.narrationKey = "grotFight.narration";
  grotFight.choices = [new Choice("word.verder", "strijd_slag", "forward")];
  grotFight.safety = nlBeSafety("fnv1a:2d165f21");
  grotFight.scene = Scenes.grot();
  g.addNode(grotFight);

  // --- the fight, three phases ------------------------------------------------------------
  //
  // Every phase telegraphs what the skeleton is doing and the child answers with the matching
  // word. One rule, stated every time, so it can be LEARNED rather than guessed. A wrong word
  // is never a loss: the hero takes a knock and the phase comes round again, which is the only
  // stake a six-year-old should carry.
  //
  // Every phase is a PASSAGE the child types and then a fork. The passage is also the tell --
  // it says what the skeleton is doing, which is how the child knows which word answers it --
  // so the typing and the choice teach the same thing instead of competing.
  const phase = (id: string, key: string, hash: string): StoryNode => {
    const n = new StoryNode(id);
    n.proseKey = `${key}.prose`;
    n.narrationKey = `${key}.narration`;
    n.celebrate = false;
    n.safety = nlBeSafety(hash);
    n.scene = Scenes.grot();
    return n;
  };

  // phase 1 -- it wakes and swings. Blocking or dodging both work; swinging INTO it does not.
  const slag = phase("strijd_slag", "strijd.slag", "fnv1a:117d1034");
  slag.choices = [
    new Choice("word.blok", "strijd_open", "forward"),
    new Choice("word.duik", "strijd_open", "left"),
    new Choice("word.sla", "strijd_raak", "right"),
  ];
  g.addNode(slag);

  // phase 2 -- its guard is down. Now the swing lands; waiting wastes the opening.
  const open = phase("strijd_open", "strijd.open", "fnv1a:5345ff55");
  open.choices = [
    new Choice("word.sla", "strijd_wankel", "forward"),
    new Choice("word.blok", "strijd_mis", "left"),
    new Choice("word.duik", "strijd_mis", "right"),
  ];
  g.addNode(open);

  // phase 3 -- it staggers. One more swing finishes it; anything else lets it recover.
  const wankel = phase("strijd_wankel", "strijd.wankel", "fnv1a:61171728");
  wankel.choices = [
    new Choice("word.sla", "strijd_val", "forward"),
    new Choice("word.blok", "strijd_herrijst", "left"),
    new Choice("word.duik", "strijd_herrijst", "right"),
  ];
  g.addNode(wankel);

  // the three setbacks -- each one names what went wrong and hands the phase back
  const raak = phase("strijd_raak", "strijd.raak", "fnv1a:248abb79");
  raak.choices = [new Choice("word.verder", "strijd_slag", "forward")];
  g.addNode(raak);
  const mis = phase("strijd_mis", "strijd.mis", "fnv1a:daddaf85");
  mis.choices = [new Choice("word.verder", "strijd_open", "forward")];
  g.addNode(mis);
  const herrijst = phase("strijd_herrijst", "strijd.herrijst", "fnv1a:ab3ff740");
  herrijst.choices = [new Choice("word.verder", "strijd_open", "forward")];
  g.addNode(herrijst);

  // the payoff, typed: the skeleton goes down and the crystal is his
  const val = new StoryNode("strijd_val");
  val.proseKey = "strijdVal.prose";
  val.narrationKey = "strijdVal.narration";
  val.ending = "win";
  val.winKey = "grotFight.win";
  val.setsFlag = "has_crystal";
  val.safety = nlBeSafety("fnv1a:0d5a0632");
  val.scene = Scenes.grot();
  g.addNode(val);

  // brug -- the CROSSING: reuses the fork set with the lowered drawbridge.
  const brug = new StoryNode("brug");
  brug.proseKey = "brug.prose";
  brug.narrationKey = "brug.narration";
  brug.ending = "win";
  brug.exitWalk = true;
  brug.winKey = "demo.end"; // placeholder end of demo
  brug.setsFlag = "crossed_bridge";
  brug.safety = nlBeSafety("fnv1a:360036c6");
  brug.scene = Scenes.brug();
  g.addNode(brug);

  return g;
}
