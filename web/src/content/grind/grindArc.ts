// The "Slijp je zwaard" session: a short, single-beat adventure where the hero grinds his
// sword on a grindstone while the child types the words of a song. One node, win ending.
// Faithful port of content/grind/grind_arc.gd. AUTHORED -- do not regenerate casually.

import { StoryGraph, StoryNode } from "../../logic/storyGraph";
import { SceneDescriptor, ActorPlacement, PropPlacement } from "../../logic/sceneDescriptor";

export const GRAPH_ID = "grind-arc";
export const VOCABULARY_ID = "fantasy-poc";
export const START_ID = "slijpen";

export function build(): StoryGraph {
  const g = new StoryGraph();
  g.graphId = GRAPH_ID;
  g.vocabularyId = VOCABULARY_ID;
  g.startId = START_ID;

  const node = new StoryNode("slijpen");
  node.proseKey = "slijpen.prose";
  node.narrationKey = "slijpen.narration";
  node.ending = "win";
  node.winKey = "slijpen.win";
  node.setsFlag = "sword_sharp"; // a sharp sword -- the training the armed cave fight needs
  node.safety = { "nl-BE": { hash: "fnv1a:e7256a7d", date: "2026-07-13", criteria_version: "v0-stub" } };
  node.scene = scene();
  g.addNode(node);
  return g;
}

export function scene(): SceneDescriptor {
  const d = new SceneDescriptor();
  d.location = "forge";
  d.mood = "day";
  d.actors = [new ActorPlacement("hero", "center", "work", "camera")];
  d.props = [new PropPlacement("sword", "grind_point")];
  return d;
}
