// The stage the game plays on: ONE island renderer, the current SceneDef built on it, the hero,
// a follow camera, a fade curtain, and lookups for the authored anchors / routes. Scene
// descriptors name sets and anchors; this is where those names become positions.

import * as THREE from "three";
import { createIslandScene, buildIslandGroup, type IslandScene } from "../render/islandScene";
import { placedPosition } from "../world/hexGrid";
import type { SceneDef, CameraDef } from "../world/sceneDef";
import { HeroRig } from "./hero";

// scene camera: a fixed offset behind/above the lead, easing toward it (game_controller CAM_*)
const CAM_OFFSET = new THREE.Vector3(0, 3.4, 7.5);
const CAM_LOOK_Y = 1.0;
const CAM_LERP = 4.0;

export class World {
  readonly s: IslandScene;
  readonly hero = new HeroRig();
  def: SceneDef | null = null;
  private group: THREE.Group | null = null;
  private camMode: "fixed" | "follow" = "fixed";
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private fadeEl: HTMLElement;

  constructor(canvas: HTMLCanvasElement, fadeEl: HTMLElement) {
    this.s = createIslandScene(canvas);
    new ResizeObserver(() => this.s.resize()).observe(canvas);
    this.fadeEl = fadeEl;
    this.s.scene.add(this.hero.node);
  }

  async loadHero(modelPath: string): Promise<void> {
    await this.hero.load(modelPath);
  }

  /** Replace the staged scene with `def`. */
  async loadScene(def: SceneDef, fog: boolean): Promise<void> {
    if (this.group) {
      this.s.scene.remove(this.group);
      this.group = null;
    }
    this.def = def;
    const built = await buildIslandGroup(this.s, def);
    this.group = built.group;
    this.s.scene.fog = fog ? new THREE.Fog(0xa6c6e0, 60, 220) : null;
    this.s.sun.target.position.copy(built.land.getCenter(new THREE.Vector3()));
  }

  anchor(name: string): THREE.Vector3 {
    const a = this.def?.anchors?.find((x) => x.name === name);
    if (!a) {
      console.warn(`Unknown anchor '${name}' -- placing at origin`);
      return new THREE.Vector3();
    }
    return placedPosition(a);
  }

  /** A route as a smooth curve through its authored points (Godot samples a baked Bezier). */
  route(name: string): THREE.CatmullRomCurve3 | null {
    const r = this.def?.routes?.find((x) => x.name === name);
    if (!r || r.points.length < 2) return null;
    return new THREE.CatmullRomCurve3(r.points.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, "centripetal", 0.5);
  }

  /** The authored fixed camera of the current scene (the island), snapped. */
  useSceneCamera(cam?: CameraDef): void {
    this.camMode = "fixed";
    if (cam) {
      this.s.camera.fov = cam.fov ?? 30;
      this.camPos.set(cam.pos[0], cam.pos[1], cam.pos[2]);
      this.camLook.set(cam.look[0], cam.look[1], cam.look[2]);
    } else {
      this.s.camera.fov = 30;
      this.camPos.set(0, 30, 34);
      this.camLook.set(0, 0, -2);
    }
    this.s.camera.updateProjectionMatrix();
    this.s.camera.position.copy(this.camPos);
    this.s.camera.lookAt(this.camLook);
  }

  /** Follow the hero from behind/above; `snap` jumps instead of easing (a fresh scene). */
  useFollowCamera(snap: boolean): void {
    this.camMode = "follow";
    this.s.camera.fov = 45;
    this.s.camera.updateProjectionMatrix();
    if (snap) {
      this.camPos.copy(this.hero.node.position).add(CAM_OFFSET);
      this.camLook.copy(this.hero.node.position).add(new THREE.Vector3(0, CAM_LOOK_Y, 0));
      this.s.camera.position.copy(this.camPos);
      this.s.camera.lookAt(this.camLook);
    }
  }

  update(dt: number): void {
    this.hero.update(dt);
    if (this.camMode === "follow") {
      const want = this.hero.node.position.clone().add(CAM_OFFSET);
      const look = this.hero.node.position.clone().add(new THREE.Vector3(0, CAM_LOOK_Y, 0));
      const k = 1 - Math.exp(-CAM_LERP * dt);
      this.camPos.lerp(want, k);
      this.camLook.lerp(look, k);
      this.s.camera.position.copy(this.camPos);
      this.s.camera.lookAt(this.camLook);
    }
    this.s.render();
  }

  /** Fade to black, run `swap`, fade back in. */
  async fadeCut(swap: () => Promise<void> | void, dur = 0.45): Promise<void> {
    this.fadeEl.style.transitionDuration = `${dur}s`;
    this.fadeEl.style.opacity = "1";
    await new Promise((r) => setTimeout(r, dur * 1000));
    await swap();
    this.s.render();
    this.fadeEl.style.opacity = "0";
    await new Promise((r) => setTimeout(r, dur * 1000));
  }
}
