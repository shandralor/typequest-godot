// Band-1 scene descriptors (brief A7), as pure data. Faithful port of
// content/band1/scene_descriptors.gd. Each node's scene names elements BY ID.

import { SceneDescriptor, ActorPlacement, PATH_STRAIGHT, PATH_FORK } from "../../logic/sceneDescriptor";

// start -- the opening walk up to the fork.
export function start(): SceneDescriptor {
  const d = new SceneDescriptor();
  d.location = "forest_path";
  d.mood = "day";
  d.path = PATH_STRAIGHT;
  d.setName = "forest_fork";
  d.travelFrom = "start_approach";
  d.travelTo = "center";
  d.actors = [new ActorPlacement("hero", "path_near", "walk", "camera")];
  return d;
}

// kruispunt (the fork) -- SAME forest_fork set as start; re-stages in place (continuous).
export function kruispunt(): SceneDescriptor {
  const d = new SceneDescriptor();
  d.location = "forest_path";
  d.mood = "day";
  d.path = PATH_FORK;
  d.setName = "forest_fork";
  d.continuous = true;
  d.actors = [new ActorPlacement("hero", "center", "idle", "camera")];
  return d;
}

// grot (the cave) -- dungeon, dark; hero at center, skeleton at far_right.
export function grot(): SceneDescriptor {
  const d = new SceneDescriptor();
  d.location = "dungeon";
  d.mood = "dark";
  d.actors = [
    new ActorPlacement("hero", "center", "idle", "camera"),
    new ActorPlacement("skeleton", "far_right", "idle", "camera"),
  ];
  return d;
}

// brug (the crossing) -- REUSES the fork set; a walking straight-scene, continuous.
export function brug(): SceneDescriptor {
  const d = new SceneDescriptor();
  d.location = "forest_path";
  d.mood = "day";
  d.path = PATH_STRAIGHT;
  d.setName = "forest_fork";
  d.continuous = true;
  d.actors = [new ActorPlacement("hero", "path_near", "walk", "camera")];
  return d;
}
