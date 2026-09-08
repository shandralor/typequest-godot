// The intro: the hero wakes up in the house and walks out the door into the world. A gentle
// "how to play" -- SHORT words / three-word sentences -- teaching the one core move: type the
// words and the hero advances. It plays ONCE (progress remembers it) and then hands off to the
// island. Faithful port of content/intro/intro_arc.gd. AUTHORED -- do not regenerate casually.

import { StoryGraph, StoryNode } from "../../logic/storyGraph";
import { SceneDescriptor, ActorPlacement, PATH_STRAIGHT } from "../../logic/sceneDescriptor";

export const GRAPH_ID = "intro-arc";
export const VOCABULARY_ID = "fantasy-poc";
export const START_ID = "ontwaken";

export function build(): StoryGraph {
  const g = new StoryGraph();
  g.graphId = GRAPH_ID;
  g.vocabularyId = VOCABULARY_ID;
  g.startId = START_ID;

  const node = new StoryNode("ontwaken");
  node.proseKey = "intro.prose";
  node.narrationKey = "intro.narration";
  node.ending = "win";
  node.winKey = "intro.win";
  node.safety = { "nl-BE": { hash: "fnv1a:e9cc91dc", date: "2026-07-19", criteria_version: "v0-stub" } };
  node.scene = scene();
  g.addNode(node);
  return g;
}

export function scene(): SceneDescriptor {
  const d = new SceneDescriptor();
  d.location = "house";
  d.mood = "day";
  d.path = PATH_STRAIGHT; // a walking node: bed -> door
  d.actors = [new ActorPlacement("hero", "path_near", "idle", "away")];
  return d;
}
