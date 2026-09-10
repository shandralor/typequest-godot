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

  // grot_fight -- the ARMED return (via the grot fork once fully_trained). Wins has_crystal.
  const grotFight = new StoryNode("grot_fight");
  grotFight.proseKey = "grotFight.prose";
  grotFight.narrationKey = "grotFight.narration";
  grotFight.ending = "win";
  grotFight.winKey = "grotFight.win";
  grotFight.setsFlag = "has_crystal";
  grotFight.safety = nlBeSafety("fnv1a:48aecf72");
  grotFight.scene = Scenes.grot();
  g.addNode(grotFight);

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
