// Pure data model for the scene a story node carries (brief A7/B4). Faithful port of
// logic/scene_descriptor.gd. Names elements by id from an asset vocabulary; never a
// model path. Zero knowledge of rendering.

export const PATH_STRAIGHT = "straight";
export const PATH_FORK = "fork";

export class ActorPlacement {
  asset: string;
  anchor: string;
  pose: string;
  facing: string;
  constructor(asset: string, anchor: string, pose = "idle", facing = "camera") {
    this.asset = asset;
    this.anchor = anchor;
    this.pose = pose;
    this.facing = facing;
  }
}

export class PropPlacement {
  asset: string;
  anchor: string;
  constructor(asset: string, anchor: string) {
    this.asset = asset;
    this.anchor = anchor;
  }
}

export class SceneDescriptor {
  location = "";
  mood = "";
  actors: ActorPlacement[] = [];
  props: PropPlacement[] = [];
  camera = "";
  path: string = PATH_STRAIGHT; // presentation hint only, never affects logic
  setName = ""; // explicit editable-set override
  travelFrom = "path_near";
  travelTo = "path_far";
  continuous = false; // this beat continues the previous on the same set
}
