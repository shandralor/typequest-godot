// Ground-plane forward/right basis for a yaw-only camera (copied from world-of-claudecraft), so
// arrow nudges, fly and drag-pan agree on which way is "right". The camera sits behind its target
// along -(sin yaw, cos yaw); forward = (sin yaw, cos yaw); right = (-cos yaw, sin yaw).

export interface CameraAxes {
  fx: number;
  fz: number;
  rx: number;
  rz: number;
}

export function cameraAxes(yaw: number): CameraAxes {
  return { fx: Math.sin(yaw), fz: Math.cos(yaw), rx: -Math.cos(yaw), rz: Math.sin(yaw) };
}
