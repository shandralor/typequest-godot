// Camera framing, ported verbatim from game_controller.gd `_camera_rig()`. Framing adapts to the
// scene: a close follow while walking; a wide, raised establishing shot at the fork (so the cave
// on the left and the bridge on the right are both in view); a fixed frame inside the house; a
// near front view at the grindstone; over-the-shoulder down the archery lane.
//
// The FOVs are Godot's VERTICAL fovs, authored against its 3D viewport (1920x680). Keeping them
// verbatim keeps the hero the same apparent size as the Godot build; a browser window that is
// less wide simply shows more ground and sky, never less of the scene.

export interface Rig {
  /** camera position relative to the lead (or absolute when `fixed`) */
  off: [number, number, number];
  /** look target relative to the lead (or absolute when `fixed`) */
  look: [number, number, number];
  fov: number;
  /** the frame does not follow the hero (the house) */
  fixed?: boolean;
}

/** Godot's default follow: a fixed offset behind/above the hero (CAM_OFFSET / CAM_LOOK_Y). */
export const WALKING: Rig = { off: [0, 3.4, 7.5], look: [0, 1.0, 0], fov: 75 };
/** the fork: wide + raised, so cave (left) and bridge (right) are both in view */
export const LANDMARKS: Rig = { off: [0, 5.5, 11.5], look: [0, 0.5, -4.5], fov: 75 };
/** inside the room, raised and tilted down the room toward the door */
export const HOUSE: Rig = { off: [0, 6.1, 11.2], look: [0, 0.2, -2.4], fov: 56, fixed: true };
/** a closer hero shot of the knight + the opening chest at the win */
export const TREASURE: Rig = { off: [0, 2.7, 5.8], look: [0, 0.9, -2.4], fov: 75 };
/** a near front view of the knight grinding the sword on the wheel in front */
export const WORK: Rig = { off: [0.5, 1.9, 4.0], look: [0.55, 0.95, 1.2], fov: 75 };
/** same angle at the win, raised a touch; tighter fov crops the smithy's open edge */
export const WORK_WIN: Rig = { off: [0.3, 2.1, 4.0], look: [0.3, 1.3, 0.6], fov: 46 };
/**
 * Over-the-shoulder down the lane: hero in the foreground, target ahead. The look sits lower
 * than Godot's (1.2) because the web stage is a wider, shallower strip than Godot's 1920x680,
 * so the same aim clipped the hero's legs at the bottom edge.
 */
export const ARCHERY: Rig = { off: [2.3, 3.0, 6.2], look: [-0.3, 0.45, -7.0], fov: 46 };
/** every other standing beat */
export const STANDING: Rig = { off: [0, 4.2, 9.5], look: [0, 1.0, -1.5], fov: 75 };

/** The island's tele lens, and how far the idle view pulls back from the authored markers. */
export const ISLAND_FOV = 30;
export const OW_IDLE_ZOOM = 1.5;
/** shift the idle focus south so the far windmill stays in frame */
export const OW_IDLE_BIAS = 5.0;
/** once travelling, dolly in to this fraction of the authored iso offset */
export const OW_TRAVEL_ZOOM = 0.62;

/** Pick the rig for a staged scene. `set` is the SceneDef name; `phase` distinguishes the win. */
export function rigFor(set: string, opts: { walking: boolean; win: boolean; landmarks: boolean }): Rig {
  if (set === "house") return HOUSE;
  if (opts.walking) return WALKING;
  if (opts.landmarks) return LANDMARKS;
  if (set === "forge") return opts.win ? WORK_WIN : WORK;
  if (set === "archery") return ARCHERY;
  return STANDING;
}
