// The "Molen" beat: a short STORY visit. The child travels to the mill, meets the molenaar,
// and types his TIP -- to cross the old bridge you need a crystal, found in the cave. One node,
// win ending; sets `molen_tip`. Faithful port of content/mill/mill_arc.gd.
// AUTHORED -- do not regenerate casually.

import { StoryGraph, StoryNode } from "../../logic/storyGraph";
import { SceneDescriptor, ActorPlacement } from "../../logic/sceneDescriptor";

export const GRAPH_ID = "mill-arc";
export const VOCABULARY_ID = "fantasy-poc";
export const START_ID = "molenaar";

export function build(): StoryGraph {
  const g = new StoryGraph();
  g.graphId = GRAPH_ID;
  g.vocabularyId = VOCABULARY_ID;
  g.startId = START_ID;

  const node = new StoryNode("molenaar");
  node.proseKey = "mill.prose";
  node.narrationKey = "mill.narration";
  node.ending = "win";
  node.winKey = "mill.win";
  node.setsFlag = "molen_tip"; // heard the miller's bridge tip (a hook for later)
  node.safety = { "nl-BE": { hash: "fnv1a:d8422584", date: "2026-09-09", criteria_version: "v0-stub" } };
  node.scene = scene();
  g.addNode(node);
  return g;
}

export function scene(): SceneDescriptor {
  const d = new SceneDescriptor();
  d.location = "mill";
  d.setName = "mill";
  d.mood = "day";
  // a standing beat: the hero listens at center, the miller stands to the side facing him
  d.actors = [new ActorPlacement("hero", "center", "idle", "right"), new ActorPlacement("molenaar", "far_right", "idle", "left")];
  return d;
}
