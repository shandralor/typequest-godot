// The hero rig: a KayKit adventurer on the shared Rig_Medium. The character GLB carries the
// skinned mesh but NO clips; clips live in the shared rig GLBs and bind BY BONE NAME, so one
// mixer plays Idle_A / Walking_A on any adventurer with no retargeting (docs/woc-playbook.md).
// Anti-foot-slide: the walk clip's timeScale follows the actual travel speed.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { assetUrl } from "../assetPath";

// The two packs every scene needs (idle, walk, pickup, throw). They load with the hero.
export const RIGS = ["kaykit/adventurers/Rig_Medium_General.glb", "kaykit/adventurers/Rig_Medium_MovementBasic.glb"];

/**
 * The rest of the KayKit clip library, loaded ONLY when a scene first asks for one of its
 * clips. Godot grafts all five packs up front (godot/render/hero_rig.gd); on the web that
 * would put 3.25 MB of animation on the critical path just to show the menu, so instead the
 * pack arrives with the scene that needs it. Same shared Rig_Medium skeleton either way, so
 * the clips bind by bone name with no retargeting.
 *
 * Only the clips the game actually plays are listed -- an unlisted clip simply never triggers
 * a fetch, which is the safe direction. Add the name here when a scene starts using one.
 */
export const EXTRA_RIGS: Record<string, string[]> = {
  // the win celebration, and the intro's asleep-in-bed + get-up
  "kaykit/characters/Rig_Medium_Simulation.glb": ["Cheering", "Lie_Idle", "Lie_Down", "Lie_StandUp"],
  // the forge: a looped horizontal saw for grinding a blade, and a generic work loop for the
  // beats that are not grinding at all (fletching arrows, studying over the spellbook)
  "kaykit/characters/Rig_Medium_Tools.glb": ["Sawing", "Working_A"],
  // the practice yard, per weapon class
  "kaykit/characters/Rig_Medium_CombatRanged.glb": [
    "Ranged_Bow_Aiming_Idle", "Ranged_Bow_Release",
    "Ranged_Magic_Spellcasting", "Ranged_Magic_Shoot",
    "Ranged_1H_Aiming", "Ranged_1H_Shoot",
  ],
};

/** clip name -> the extra pack that carries it (built once from the table above) */
const packForClip = new Map<string, string>();
for (const [pack, names] of Object.entries(EXTRA_RIGS)) for (const n of names) packForClip.set(n, pack);
/** the Walking_A clip is authored for roughly this ground speed (world units / s) */
const WALK_REF_SPEED = 2.4;

// ONE loader and ONE promise per URL, shared by the hero and every NPC (docs/woc-playbook.md).
// Before this, each HeroRig built its own loader and re-fetched + re-parsed the character GLB
// AND both shared rig GLBs -- so a scene with two NPCs parsed the rigs six times over, and
// every hero swap in the picker paid for them again.
const loader = new GLTFLoader();
const gltfCache = new Map<string, Promise<THREE.Object3D & { animations?: THREE.AnimationClip[] }>>();

function loadGltf(path: string): Promise<THREE.Object3D & { animations?: THREE.AnimationClip[] }> {
  let p = gltfCache.get(path);
  if (!p) {
    p = loader.loadAsync(assetUrl("/assets/" + path)).then((gltf) => {
      const root = gltf.scene as THREE.Object3D & { animations?: THREE.AnimationClip[] };
      root.animations = gltf.animations;
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false; // skinned parts can report stale bind-pose bounds and vanish
      });
      return root;
    });
    gltfCache.set(path, p);
  }
  return p;
}

/**
 * The clip library, shared by every rig and GROWING as extra packs arrive. One map for the
 * whole app: a pack fetched for the forge is already there when the practice yard asks.
 */
const sharedClips = new Map<string, THREE.AnimationClip>();
let clipsPromise: Promise<Map<string, THREE.AnimationClip>> | null = null;

function mergeClips(root: { animations?: THREE.AnimationClip[] }): void {
  for (const c of root.animations ?? []) if (!sharedClips.has(c.name)) sharedClips.set(c.name, c);
}

function loadClips(): Promise<Map<string, THREE.AnimationClip>> {
  clipsPromise ??= Promise.all(RIGS.map(loadGltf)).then((rigs) => {
    for (const r of rigs) mergeClips(r);
    return sharedClips;
  });
  return clipsPromise;
}

/**
 * Make sure `names` are playable, fetching whichever extra packs carry them. Safe to call
 * repeatedly: loadGltf caches per URL, so a second ask for the same pack is the same promise.
 * Call it when a scene is staged so the clip is ready before the beat needs it.
 */
export async function ensureClips(names: string[]): Promise<void> {
  const packs = new Set<string>();
  for (const n of names) {
    if (sharedClips.has(n)) continue;
    const pack = packForClip.get(n);
    if (pack) packs.add(pack);
  }
  if (packs.size === 0) return;
  const loaded = await Promise.all([...packs].map((p) => loadGltf(p).catch(() => null)));
  for (const r of loaded) if (r) mergeClips(r);
}

export class HeroRig {
  readonly node = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private clips: Map<string, THREE.AnimationClip> = sharedClips;
  private actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private moving = false;
  /** bumped per load; a slow load that resolves after a newer one discards itself */
  private loadGen = 0;
  private loadedPath = "";
  /** the loop we last asked for -- a clip that arrives late only plays if it is still wanted */
  private wantedLoop = "";
  /** resolves when the running one-shot settles, so a caller can pace a beat to the animation */
  private oneShotDone: Promise<void> = Promise.resolve();

  /**
   * Drop the currently-shown model (and everything bound to it) so a reload replaces it.
   * Nothing is disposed: a clone SHARES its geometry and materials with the cached template,
   * so disposing here would blank every other character using that model.
   */
  private clearModel(): void {
    this.loadedPath = "";
    this.mixer?.stopAllAction();
    this.mixer = null;
    this.actions.clear();
    this.current = null;
    for (const child of [...this.node.children]) this.node.remove(child);
  }

  async load(modelPath: string): Promise<void> {
    // Replacing, not adding: the picker cycles heroes and the island reloads the chosen one, so
    // without this every model stayed in the rig and they rendered stacked through each other.
    // The generation guard covers the RACE: on a cold cache two picks overlap, both clear, then
    // both add -- which stacked a knight+barbarian+mage chimera stuck in bind pose.
    if (modelPath === this.loadedPath) return; // already showing this hero
    const gen = ++this.loadGen;
    this.clearModel();
    const [template, clips] = await Promise.all([loadGltf(modelPath), loadClips()]);
    if (gen !== this.loadGen) return; // a newer load won while this one was in flight
    // SkeletonUtils.clone gives this rig its OWN skeleton over the template's shared geometry,
    // which is what lets two NPCs of the same model animate independently.
    const model = cloneSkinned(template);
    // pivot at the feet: seat the measured lowest point on y = 0
    model.position.y -= new THREE.Box3().setFromObject(model).min.y;
    this.node.add(model);
    this.loadedPath = modelPath;
    this.mixer = new THREE.AnimationMixer(model);
    this.clips = clips;
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

  /**
   * Cross-fade to a looping clip. If the clip lives in a rig pack that has not been fetched
   * yet, the fetch starts here and the clip plays when it lands -- unless something else was
   * asked for meanwhile. Silently doing nothing (the old behaviour for an unloaded pack) is
   * how the win cheer and the archery aim went missing.
   */
  play(name: string, fade = 0.25): void {
    this.wantedLoop = name;
    const next = this.action(name);
    if (!next) {
      if (packForClip.has(name)) {
        void ensureClips([name]).then(() => {
          if (this.wantedLoop === name) this.play(name, fade);
        });
      }
      return;
    }
    if (next === this.current) return;
    next.reset().setLoop(THREE.LoopRepeat, Infinity).setEffectiveWeight(1).play();
    if (this.current) next.crossFadeFrom(this.current, fade, false);
    this.current = next;
  }

  /**
   * Play a one-shot (clamped at its last frame), then settle back to `then`. Returns a promise
   * that resolves when it has settled, so a caller can pace a beat to the animation rather
   * than to a guessed duration. Fetches the clip's pack if it is not loaded yet.
   */
  playOneShot(name: string, then = "Idle_A"): Promise<void> {
    const a = this.action(name);
    if (!a) {
      if (!packForClip.has(name)) return Promise.resolve();
      this.oneShotDone = ensureClips([name]).then(() => this.playOneShot(name, then));
      return this.oneShotDone;
    }
    let settled = (): void => void 0;
    this.oneShotDone = new Promise<void>((res) => (settled = res));
    a.reset().setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.play();
    if (this.current) a.crossFadeFrom(this.current, 0.2, false);
    this.current = a;
    const onDone = (e: { action: THREE.AnimationAction }): void => {
      if (e.action !== a) return;
      this.mixer?.removeEventListener("finished", onDone);
      this.play(then, 0.3);
      settled();
    };
    this.mixer?.addEventListener("finished", onDone);
    return this.oneShotDone;
  }

  /** Resolves when the one-shot in flight has settled (already-resolved when none is). */
  get oneShotSettled(): Promise<void> {
    return this.oneShotDone;
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
