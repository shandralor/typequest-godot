// The stage the game plays on: ONE island renderer, the current SceneDef built on it, the hero,
// a follow camera, a fade curtain, and lookups for the authored anchors / routes. Scene
// descriptors name sets and anchors; this is where those names become positions.

import * as THREE from "three";
import { createIslandScene, buildIslandGroup, type IslandScene } from "../render/islandScene";
import { placedPosition } from "../world/hexGrid";
import type { SceneDef, CameraDef } from "../world/sceneDef";
import { HeroRig } from "./hero";

import { WALKING, type Rig } from "./cameraRigs";

const CAM_LERP = 4.0; // game_controller CAM_LERP: how fast the frame eases to a new pose

const ORIGIN = new THREE.Vector3();
const WANT_POS = new THREE.Vector3();
const WANT_LOOK = new THREE.Vector3();

export class World {
  readonly s: IslandScene;
  readonly hero = new HeroRig();
  def: SceneDef | null = null;
  private group: THREE.Group | null = null;
  private camMode: "fixed" | "follow" = "fixed";
  private rig: Rig = WALKING;
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

  /**
   * Replace the staged scene with `def`. `mood` follows the descriptor: "day" gets a bright sky
   * and aerial haze, "dark" a near-black cave; the island passes "island" for its dark backdrop
   * (the floating island reads against a void, like the Godot set).
   */
  async loadScene(def: SceneDef, mood: "day" | "dark" | "island", activeTags: ReadonlySet<string> = new Set()): Promise<void> {
    if (this.group) {
      this.s.scene.remove(this.group);
      this.group = null;
    }
    this.def = def;
    const built = await buildIslandGroup(this.s, def, activeTags);
    this.group = built.group;
    // Light per mood. The island wants the warm golden key (its hex grass is chartreuse by
    // design); a story set is lit near-neutral, or the green ground goes yellow -- Godot's mill
    // reads clean green. Dark = a cool, dim cave.
    const rig = mood === "island"
      ? { sun: 0xffd99a, sunI: 3.2, hemiSky: 0xdcefff, hemiGround: 0x465f39, hemiI: 0.5, env: 0.42 }
      : mood === "dark"
        // a cave is COOL grey, not gold: with the key dimmed the warm PMREM environment took
        // over and tinted the rock, so keep the key doing the work and the environment near nil
        ? { sun: 0xa9bede, sunI: 2.2, hemiSky: 0x3b4666, hemiGround: 0x0e1014, hemiI: 0.85, env: 0.05 }
        : { sun: 0xfff4e6, sunI: 2.5, hemiSky: 0xdcefff, hemiGround: 0x5a7048, hemiI: 0.75, env: 0.5 };
    this.s.sun.color.setHex(rig.sun);
    this.s.sun.intensity = rig.sunI;
    this.s.hemi.color.setHex(rig.hemiSky);
    this.s.hemi.groundColor.setHex(rig.hemiGround);
    this.s.hemi.intensity = rig.hemiI;
    this.s.scene.environmentIntensity = rig.env;
    const sky = mood === "dark" ? 0x08080a : mood === "island" ? 0x0b0e12 : 0xa6c6e0;
    this.s.scene.background = new THREE.Color(sky);
    this.s.scene.fog = mood === "island" ? null : new THREE.Fog(sky, mood === "dark" ? 10 : 60, mood === "dark" ? 48 : 220);
    // Aim the sun at where the ACTION is (the anchors), not the raw bounding box: a set can hold
    // a vast backdrop plate (the mill's water is 10000 units across) that would drag the target
    // thousands of units away and leave the whole scene outside the shadow frustum.
    this.s.sun.target.position.copy(this.actedCentre(def, built.land));
  }

  /** The centre of the anchors (where actors stand); falls back to the land box. */
  private actedCentre(def: SceneDef, land: THREE.Box3): THREE.Vector3 {
    const anchors = def.anchors ?? [];
    if (anchors.length === 0) return land.getCenter(new THREE.Vector3());
    const c = new THREE.Vector3();
    for (const a of anchors) c.add(placedPosition(a));
    return c.divideScalar(anchors.length);
  }

  /** Is this anchor authored in the current set? (asking is not a warning-worthy miss) */
  hasAnchor(name: string): boolean {
    return !!this.def?.anchors?.some((x) => x.name === name);
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

  /**
   * The island view, from the set's authored camera markers. `zoom` scales the iso offset
   * (Godot's idle view pulls back 1.5x) and `bias` shifts the focus south so the far windmill
   * stays in frame. With `follow`, dolly in and track that point instead (travel).
   */
  useIslandCamera(cam: CameraDef | undefined, opts: { zoom: number; bias: number; fov: number; follow?: THREE.Vector3; snap: boolean }): void {
    this.camMode = "fixed";
    const p = cam?.pos ?? [0, 30, 34];
    const l = cam?.look ?? [0, 0, -2];
    const iso = new THREE.Vector3(p[0] - l[0], p[1] - l[1], p[2] - l[2]).multiplyScalar(opts.zoom);
    const focus = opts.follow ? opts.follow.clone() : new THREE.Vector3(l[0], l[1], l[2] + opts.bias);
    this.s.camera.fov = cam?.fov ?? opts.fov;
    this.s.camera.updateProjectionMatrix();
    const want = focus.clone().add(iso);
    const look = opts.follow ? focus.clone().add(new THREE.Vector3(0, 0.6, 0)) : focus;
    if (opts.snap) {
      this.camPos.copy(want);
      this.camLook.copy(look);
    } else {
      const k = 1 - Math.exp(-CAM_LERP * 0.016);
      this.camPos.lerp(want, k);
      this.camLook.lerp(look, k);
    }
    this.s.camera.position.copy(this.camPos);
    this.s.camera.lookAt(this.camLook);
  }

  /** Frame the scene with a rig (relative to the hero, or absolute when the rig is `fixed`). */
  useRig(rig: Rig, snap: boolean): void {
    this.camMode = "follow";
    this.rig = rig;
    this.s.camera.fov = rig.fov;
    this.s.camera.updateProjectionMatrix();
    if (snap) {
      this.rigPose(this.camPos, this.camLook);
      this.s.camera.position.copy(this.camPos);
      this.s.camera.lookAt(this.camLook);
    }
  }

  /** The rig's world pose right now. */
  private rigPose(pos: THREE.Vector3, look: THREE.Vector3): void {
    const base = this.rig.fixed ? ORIGIN : this.hero.node.position;
    pos.set(base.x + this.rig.off[0], base.y + this.rig.off[1], base.z + this.rig.off[2]);
    look.set(base.x + this.rig.look[0], base.y + this.rig.look[1], base.z + this.rig.look[2]);
  }

  update(dt: number): void {
    this.hero.update(dt);
    if (this.camMode === "follow") {
      this.rigPose(WANT_POS, WANT_LOOK);
      const want = WANT_POS;
      const look = WANT_LOOK;
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
