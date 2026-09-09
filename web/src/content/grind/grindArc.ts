// The forge session: a short, single-beat adventure at the smidse while the child types the
// words of a work song. THREE nodes, one per weapon group, because a staf and a kruisboog
// cannot be sharpened -- blades grind, the ranger fletches, casters study (characters.GROUPS).
// The mode starts the run at the node for the chosen hero. Each node keeps its OWN safety hash:
// the three beats differ in sentence structure, so one template cannot cover them.
// Grown from content/grind/grind_arc.gd. AUTHORED -- do not regenerate casually.

import { StoryGraph, StoryNode } from "../../logic/storyGraph";
import { SceneDescriptor, ActorPlacement } from "../../logic/sceneDescriptor";
import type { WeaponGroup } from "../characters";

export const GRAPH_ID = "grind-arc";
export const VOCABULARY_ID = "fantasy-poc";
export const START_ID = "slijpen_blades";

/** The node a hero starts on, by weapon group. */
export function startFor(group: WeaponGroup): string {
  return `slijpen_${group}`;
}

const HASHES: Record<WeaponGroup, string> = {
  blades: "fnv1a:1d1aad30",
  ranged: "fnv1a:4ac7ac28",
  caster: "fnv1a:b5b6afe8",
};

export function build(): StoryGraph {
  const g = new StoryGraph();
  g.graphId = GRAPH_ID;
  g.vocabularyId = VOCABULARY_ID;
  g.startId = START_ID;

  for (const group of ["blades", "ranged", "caster"] as WeaponGroup[]) {
    const node = new StoryNode(startFor(group));
    node.proseKey = `slijpen.${group}.prose`;
    node.narrationKey = `slijpen.${group}.narration`;
    node.ending = "win";
    node.winKey = `slijpen.${group}.win`;
    // the same flag whichever way the gear was tended -- it gates the armed cave fight
    node.setsFlag = "sword_sharp";
    node.safety = { "nl-BE": { hash: HASHES[group], date: "2026-09-09", criteria_version: "v0-stub" } };
    node.scene = scene();
    g.addNode(node);
  }
  return g;
}

export function scene(): SceneDescriptor {
  const d = new SceneDescriptor();
  d.location = "forge";
  d.mood = "day";
  d.actors = [new ActorPlacement("hero", "center", "work", "camera")];
  // No authored prop: what lies on the grindstone is the HERO's own weapon, which the
  // descriptor cannot name (it has no hero). scenarioMode stages it, the way the archery
  // target is code-built. Naming a placeholder id here would only fool the validator.
  d.props = [];
  return d;
}
