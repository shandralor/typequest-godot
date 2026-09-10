// The "Boogschieten" session: the hero shoots at a target while the child types an archery
// rhyme. One node, win ending. Faithful port of content/archery/archery_arc.gd.
// AUTHORED -- do not regenerate casually.

import { StoryGraph, StoryNode } from "../../logic/storyGraph";
import { SceneDescriptor, ActorPlacement, PropPlacement } from "../../logic/sceneDescriptor";

export const GRAPH_ID = "archery-arc";
export const VOCABULARY_ID = "fantasy-poc";
export const START_ID = "boogschieten";

export function build(): StoryGraph {
  const g = new StoryGraph();
  g.graphId = GRAPH_ID;
  g.vocabularyId = VOCABULARY_ID;
  g.startId = START_ID;

  const node = new StoryNode("boogschieten");
  node.proseKey = "boog.prose";
  node.narrationKey = "boog.narration";
  node.ending = "win";
  node.winKey = "boog.win";
  node.setsFlag = "archery_done"; // bow training done (with sword_sharp -> fully_trained)
  node.safety = { "nl-BE": { hash: "fnv1a:f60fdda3", date: "2026-09-09", criteria_version: "v0-stub" } };
  node.scene = scene();
  g.addNode(node);
  return g;
}

export function scene(): SceneDescriptor {
  const d = new SceneDescriptor();
  d.location = "archery_range";
  d.mood = "day";
  d.actors = [new ActorPlacement("hero", "line", "aim", "downrange")];
  d.props = [new PropPlacement("bow", "hand")];
  return d;
}
