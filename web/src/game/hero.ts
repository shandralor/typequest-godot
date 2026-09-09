// The hero rig: a KayKit adventurer on the shared Rig_Medium. The character GLB carries the
// skinned mesh but NO clips; clips live in the shared rig GLBs and bind BY BONE NAME, so one
// mixer plays Idle_A / Walking_A on any adventurer with no retargeting (docs/woc-playbook.md).
// Anti-foot-slide: the walk clip's timeScale follows the actual travel speed.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { assetUrl } from "../assetPath";

const RIGS = ["kaykit/adventurers/Rig_Medium_General.glb", "kaykit/adventurers/Rig_Medium_MovementBasic.glb"];
/** the Walking_A clip is authored for roughly this ground speed (world units / s) */
const WALK_REF_SPEED = 2.4;

/** Free a subtree's geometry and materials. */
function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry?.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}

export class HeroRig {
  readonly node = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private clips = new Map<string, THREE.AnimationClip>();
  private actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private moving = false;
  /** bumped per load; a slow load that resolves after a newer one discards itself */
  private loadGen = 0;
  private loadedPath = "";

  /** Drop the currently-shown model (and everything bound to it) so a reload replaces it. */
  private clearModel(): void {
    this.loadedPath = "";
    this.mixer?.stopAllAction();
    this.mixer = null;
    this.actions.clear();
    this.current = null;
    for (const child of [...this.node.children]) {
      this.node.remove(child);
      disposeTree(child);
    }
  }

  async load(modelPath: string): Promise<void> {
    // Replacing, not adding: the picker cycles heroes and the island reloads the chosen one, so
    // without this every model stayed in the rig and they rendered stacked through each other.
    // The generation guard covers the RACE: on a cold cache two picks overlap, both clear, then
    // both add -- which stacked a knight+barbarian+mage chimera stuck in bind pose.
    if (modelPath === this.loadedPath) return; // already showing this hero
    const gen = ++this.loadGen;
    this.clearModel();
    const loader = new GLTFLoader();
    const [hero, ...rigs] = await Promise.all([loader.loadAsync(assetUrl("/assets/" + modelPath)), ...RIGS.map((r) => loader.loadAsync(assetUrl("/assets/" + r)))]);
    if (gen !== this.loadGen) {
      disposeTree(hero.scene); // a newer load won while this one was in flight
      return;
    }
    const model = hero.scene;
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false; // skinned parts can report stale bind-pose bounds and vanish
      }
    });
    // pivot at the feet: seat the measured lowest point on y = 0
    model.position.y -= new THREE.Box3().setFromObject(model).min.y;
    this.node.add(model);
    this.loadedPath = modelPath;
    this.mixer = new THREE.AnimationMixer(model);
    for (const r of rigs) for (const c of r.animations) this.clips.set(c.name, c);
    this.play("Idle_A");
  }

  private action(name: string): THREE.AnimationAction | null {
    if (!this.mixer) return null;
    let a = this.actions.get(name);
    if (!a) {
      const clip = this.clips.get(name);
      if (!clip) return null;
      a = this.mixer.clipAction(clip);
      this.actions.set(name, a);
    }
    return a;
  }

  /** Cross-fade to a looping clip. */
  play(name: string, fade = 0.25): void {
    const next = this.action(name);
    if (!next || next === this.current) return;
    next.reset().setLoop(THREE.LoopRepeat, Infinity).setEffectiveWeight(1).play();
    if (this.current) next.crossFadeFrom(this.current, fade, false);
    this.current = next;
  }

  /** Play a one-shot (clamped at its last frame), then settle back to idle. */
  playOneShot(name: string, then = "Idle_A"): void {
    const a = this.action(name);
    if (!a) return;
    a.reset().setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.play();
    if (this.current) a.crossFadeFrom(this.current, 0.2, false);
    this.current = a;
    const onDone = (e: { action: THREE.AnimationAction }): void => {
      if (e.action !== a) return;
      this.mixer?.removeEventListener("finished", onDone);
      this.play(then, 0.3);
    };
    this.mixer?.addEventListener("finished", onDone);
  }

  /** Walk (with the clip paced to `speed`) or idle. */
  setMoving(moving: boolean, speed = WALK_REF_SPEED): void {
    if (moving) {
      this.play("Walking_A");
      const walk = this.action("Walking_A");
      if (walk) walk.timeScale = Math.min(1.8, Math.max(0.6, speed / WALK_REF_SPEED));
    } else this.play("Idle_A");
    this.moving = moving;
  }

  get isMoving(): boolean {
    return this.moving;
  }

  /**
   * Attach a prop to a rig bone so it is really HELD and the animation carries it (KayKit grips
   * are handslot.r / handslot.l). Returns false when the bone is missing, so the caller can
   * fall back to standing the prop on the ground.
   */
  attachToHand(obj: THREE.Object3D, boneName = "handslot.r", offset = new THREE.Vector3()): boolean {
    // the glTF import strips punctuation from bone names, so "handslot.r" arrives as
    // "handslotr" -- compare on letters and digits only
    const key = (n: string): string => n.toLowerCase().replace(/[^a-z0-9]/g, "");
    const want = key(boneName);
    let slot: THREE.Object3D | null = null;
    this.node.traverse((o) => {
      if (!slot && key(o.name) === want) slot = o;
    });
    if (!slot) return false;
    obj.position.copy(offset);
    (slot as THREE.Object3D).add(obj);
    return true;
  }

  /** Face a ground direction. KayKit's forward is +Z, so yaw = atan2(dx, dz) (Godot: atan2(dir.x, dir.z)). */
  face(dx: number, dz: number): void {
    if (Math.hypot(dx, dz) < 1e-4) return;
    this.node.rotation.y = Math.atan2(dx, dz);
  }

  /** Face a world point. */
  lookAtPoint(p: THREE.Vector3): void {
    this.face(p.x - this.node.position.x, p.z - this.node.position.z);
  }

  update(dt: number): void {
    this.mixer?.update(dt);
  }
}
