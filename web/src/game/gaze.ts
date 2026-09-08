// Where a STANDING hero looks, ported from game_controller.gd (_setup_gaze / _standing_target_yaw
// / _yaw_to). The authored `facing` on an actor places NPCs; the lead's yaw is owned by this
// gaze so a standing beat can turn to what the prose is talking about:
//
//   fork    -- look ahead into the fork, then at the cave when the prose says "links",
//              then at the bridge at "rechts" (the child sees what the words mean)
//   bridge  -- a pre-revealed beat: look at the safe bridge it will take
//   chest   -- face the won treasure
//   none    -- yaw 0 (facing the camera), and walking beats keep their travel facing
//
// Pure: positions and a cursor in, a yaw out. Vitest drives it directly.

export type GazeMode = "none" | "fork" | "bridge" | "chest";

export interface Vec2 {
  x: number;
  z: number;
}

/** Godot's `_yaw_to`: face a world point from `from`. Model forward is +Z, so atan2(dx, dz). */
export function yawTo(from: Vec2, target: Vec2): number {
  return Math.atan2(target.x - from.x, target.z - from.z);
}

export interface GazeTargets {
  /** the cave mouth (the set's far_left anchor) */
  cave?: Vec2;
  /** the bridge (far_right) */
  bridge?: Vec2;
  /** the treasure anchor */
  treasure?: Vec2;
}

export interface GazeState {
  mode: GazeMode;
  /** character index of "links" in the prose, or -1 */
  links: number;
  /** character index of "rechts", or -1 */
  rechts: number;
}

/** Decide the gaze for a beat. `landmarks` = the set has the cave/bridge anchors. */
export function setupGaze(opts: { walking: boolean; archery: boolean; landmarks: boolean; prerevealed: boolean; hasChest: boolean; prose: string }): GazeState {
  if (opts.walking || opts.archery) return { mode: "none", links: -1, rechts: -1 };
  if (opts.landmarks) {
    if (opts.prerevealed) return { mode: "bridge", links: -1, rechts: -1 };
    return { mode: "fork", links: opts.prose.indexOf("links"), rechts: opts.prose.indexOf("rechts") };
  }
  if (opts.hasChest) return { mode: "chest", links: -1, rechts: -1 };
  return { mode: "none", links: -1, rechts: -1 };
}

/** The yaw the hero should be turning toward right now, given how far the prose is typed. */
export function targetYaw(g: GazeState, cursor: number, from: Vec2, t: GazeTargets): number {
  switch (g.mode) {
    case "fork":
      if (g.links >= 0 && cursor < g.links) return Math.PI; // look ahead into the fork
      if (g.rechts >= 0 && cursor < g.rechts) return t.cave ? yawTo(from, t.cave) : Math.PI;
      return t.bridge ? yawTo(from, t.bridge) : Math.PI;
    case "bridge":
      return t.bridge ? yawTo(from, t.bridge) : Math.PI;
    case "chest":
      return t.treasure ? yawTo(from, t.treasure) : 0;
    default:
      return 0;
  }
}

/** Shortest-path angle lerp (Godot's lerp_angle). */
export function lerpAngle(from: number, to: number, w: number): number {
  let d = (to - from) % (Math.PI * 2);
  d = ((2 * d) % (Math.PI * 2)) - d;
  return from + d * w;
}
