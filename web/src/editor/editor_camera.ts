// Orbit editor camera (copied from world-of-claudecraft 3d/editor_camera.ts, retuned for a
// 60-unit island). Owns yaw/pitch/dist around a free target; the viewport writes the derived
// pose to the scene camera each frame. Hand-rolled (not OrbitControls) so nothing fights it.

import * as THREE from "three";
import { cameraAxes } from "./camera_axes";

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export class EditorCamera {
  target = new THREE.Vector3(0, 0, 0);
  yaw = Math.PI; // camera on +z looking toward -z: matches the game's overworld view
  pitch = 0.72;
  dist = 62;

  private readonly minPitch = 0.12;
  private readonly maxPitch = 1.5;
  private readonly minDist = 8;
  private readonly maxDist = 900;
  private readonly poseOut = { pos: new THREE.Vector3(), target: new THREE.Vector3() };

  pose(): { pos: THREE.Vector3; target: THREE.Vector3 } {
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    this.poseOut.pos.set(
      this.target.x - Math.sin(this.yaw) * cp * this.dist,
      this.target.y + sp * this.dist,
      this.target.z - Math.cos(this.yaw) * cp * this.dist
    );
    this.poseOut.target.copy(this.target);
    return this.poseOut;
  }

  orbit(dxPx: number, dyPx: number): void {
    this.yaw -= dxPx * 0.005;
    this.pitch = clamp(this.pitch + dyPx * 0.005, this.minPitch, this.maxPitch);
  }

  zoom(deltaY: number): void {
    this.dist = clamp(this.dist * Math.exp(deltaY * 0.001), this.minDist, this.maxDist);
  }

  pan(dxPx: number, dyPx: number): void {
    const speed = this.dist * 0.0016;
    const { fx, fz, rx, rz } = cameraAxes(this.yaw);
    this.target.x += (-dxPx * rx + dyPx * fx) * speed;
    this.target.z += (-dxPx * rz + dyPx * fz) * speed;
  }

  /** Frame a ground-plane box. */
  frame(minX: number, minZ: number, maxX: number, maxZ: number): void {
    this.target.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    this.dist = clamp(Math.max(maxX - minX, maxZ - minZ) * 1.15 + 20, this.minDist, this.maxDist);
  }
}
