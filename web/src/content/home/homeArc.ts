// A RETURN visit to the house (the overworld "thuis" site), reusing the SAME set as the intro.
// The hero comes home to COLLECT his gear before he can train -- a CHOICE of which item to take
// first (type `zwaard` or `wapen`), then he walks to it and picks it up. The mode filters the
// choice to items not yet collected. Faithful port of content/home/home_arc.gd.
// AUTHORED -- do not regenerate casually.

import { StoryGraph, StoryNode, Choice } from "../../logic/storyGraph";
import { SceneDescriptor, ActorPlacement, PATH_STRAIGHT } from "../../logic/sceneDescriptor";

export const GRAPH_ID = "home-arc";
export const VOCABULARY_ID = "fantasy-poc";
export const START_ID = "thuiskeuze";

function safety(hash: string): StoryNode["safety"] {
  return { "nl-BE": { hash, date: "2026-07-17", criteria_version: "v0-stub" } };
}

export function build(): StoryGraph {
  const g = new StoryGraph();
  g.graphId = GRAPH_ID;
  g.vocabularyId = VOCABULARY_ID;
  g.startId = START_ID;

  // the choice: walk in, then pick which item to take (the mode filters to uncollected)
  const keuze = new StoryNode("thuiskeuze");
  keuze.proseKey = "home.prose";
  keuze.narrationKey = "home.narration";
  keuze.choices = [new Choice("word.zwaard", "neem_zwaard", "right"), new Choice("word.boog", "neem_boog", "left")];
  keuze.safety = safety("fnv1a:faa09ff1");
  keuze.scene = houseScene();
  g.addNode(keuze);

  // take the sword (the mode walks him to sword_point + collects on the win)
  const zwaard = new StoryNode("neem_zwaard");
  zwaard.proseKey = "home.sword_prose";
  zwaard.narrationKey = "home.narration";
  zwaard.ending = "win";
  zwaard.winKey = "home.win_sword";
  zwaard.safety = safety("fnv1a:6c66816b");
  zwaard.scene = houseScene();
  g.addNode(zwaard);

  // take the bow
  const boog = new StoryNode("neem_boog");
  boog.proseKey = "home.bow_prose";
  boog.narrationKey = "home.narration";
  boog.ending = "win";
  boog.winKey = "home.win_bow";
  boog.safety = safety("fnv1a:d9e2a77c");
  boog.scene = houseScene();
  g.addNode(boog);
  return g;
}

function houseScene(): SceneDescriptor {
  const d = new SceneDescriptor();
  d.location = "house";
  d.mood = "day";
  d.path = PATH_STRAIGHT;
  // enter from the door (path_far) and walk in, facing into the room
  d.actors = [new ActorPlacement("hero", "path_far", "idle", "camera")];
  return d;
}

/** The collectable gear: which take-node grants which flag, and where it sits in the set. */
export const HOUSE_ITEMS = [
  { id: "sword", anchor: "sword_point", flag: "has_sword", takeNode: "neem_zwaard" },
  { id: "bow", anchor: "bow_point", flag: "has_ranged", takeNode: "neem_boog" },
];
