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
  // the cave fight: the hero's swings, blocks and dodges
  "kaykit/characters/Rig_Medium_CombatMelee.glb": [
    "Melee_1H_Attack_Chop", "Melee_1H_Attack_Slice_Diagonal", "Melee_1H_Attack_Slice_Horizontal",
    "Melee_1H_Attack_Stab", "Melee_2H_Attack_Chop", "Melee_2H_Attack_Spinning", "Melee_2H_Idle",
    "Melee_Block", "Melee_Block_Attack", "Melee_Block_Hit", "Melee_Blocking",
    "Melee_Unarmed_Attack_Punch_A", "Melee_Unarmed_Idle",
  ],
  // ... and the SKELETON's own vocabulary, which is what makes the fight a scene rather than a
  // paragraph: it wakes on the floor, taunts, walks in, staggers and finally falls
  "kaykit/characters/Rig_Medium_Special.glb": [
    "Skeletons_Awaken_Floor", "Skeletons_Awaken_Standing", "Skeletons_Idle", "Skeletons_Walking",
    "Skeletons_Taunt", "Skeletons_Taunt_Longer", "Skeletons_Death", "Skeletons_Death_Pose", "Skeletons_Death_Resurrect",
    "Skeletons_Inactive_Floor_Pose", "Skeletons_Spawn_Ground",
  ],
  // dodging out of the way is a real choice the child can type
  "kaykit/characters/Rig_Medium_MovementAdvanced.glb": [
    "Dodge_Backward", "Dodge_Left", "Dodge_Right",
  ],
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

/**
 * Load one clip pack by path and merge it into the shared library. The game never needs this --
 * it asks for clips by NAME through ensureClips. The dev panel does: to offer an animation that
 * nothing plays yet, it has to pull the packs whole.
 */
export async function loadClipPack(path: string): Promise<void> {
  const root = await loadGltf(path);
  mergeClips(root);
}

/** Every clip currently loaded. Dev panel only. */
export function allClipNames(): string[] {
  return [...sharedClips.keys()];
}

/**
 * Is this a pose to settle into rather than a loop to run? KayKit marks the loopable variants
 * with an "Idle" suffix (Ranged_Bow_Aiming_Idle, Melee_2H_Idle); the bare movement clips --
 * Ranged_1H_Aiming, Ranged_Magic_Spellcasting -- raise the weapon and end.
 */
export function isHoldPose(name: string): boolean {
  return /^Ranged_/.test(name) && !/Idle$/.test(name);
}

/**
 * A model that brings its OWN clips (a Meshy hero: Mixamo-style bones, a handful of library
 * animations) cannot bind the KayKit packs. The game asks for clips by KayKit name, so this
 * answers each name with the nearest clip the model has, first match wins, Idle otherwise.
 */
const OWN_CLIP_ALIASES: [RegExp, string][] = [
  [/^Lie_Idle$/, "Lie_Idle"], // the first frames of the stand-up, built in ownClips()
  [/^Lie_(StandUp|Down)$/, "Stand_Up1"],
  [/^(Walking|Running)/, "Casual_Walk"],
  [/^Melee_2H_Attack_Spinning$/, "Attack"],
  [/^Melee_.*Attack/, "Right_Hand_Sword_Slash"],
  [/^(Melee_Block|Melee_Blocking|Dodge_)/, "Sword_Parry"],
  [/^Hit_|^Death_/, "Hit_Reaction"],
  [/^Cheering$/, "Victory_Cheer"],
  [/^(Ranged_Bow_Release|Ranged_1H_Shoot|Ranged_Magic_Shoot|Throw)$/, "Archery_Shot"],
  [/^PickUp$/, "Big_Wave_Hello"],
];

/** The KayKit name -> own clip lookup for a model with its own animations. */
function ownClips(animations: THREE.AnimationClip[]): { get(name: string): THREE.AnimationClip | undefined } {
  const own = new Map(animations.map((c) => [c.name, c]));
  const stand = own.get("Stand_Up1");
  // lying still is the stand-up's opening pose, held
  if (stand) own.set("Lie_Idle", THREE.AnimationUtils.subclip(stand, "Lie_Idle", 0, 2, 30));
  const idle = own.get("Idle") ?? animations[0];
  return {
    get(name: string): THREE.AnimationClip | undefined {
      if (own.has(name)) return own.get(name);
      for (const [re, to] of OWN_CLIP_ALIASES) if (re.test(name) && own.has(to)) return own.get(to);
      return idle;
    },
  };
}

/**
 * The posed bounds of a skinned model. Box3.setFromObject reads the raw geometry, which for a
 * Meshy export is in metres under a centimetre armature: it measured the knight 1/100th of his
 * drawn size, and scaling to that drew him a hundred times too big.
 */
function skinnedBox(model: THREE.Object3D): THREE.Box3 {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3();
  model.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    m.skeleton.update();
    m.computeBoundingBox();
    box.union(m.boundingBox!.clone().applyMatrix4(m.matrixWorld));
  });
  return box;
}

/** A model with its own clips is drawn at the KayKit adventurers' height, so scenes still fit. */
const HERO_HEIGHT = 2.54;

export class HeroRig {
  readonly node = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private clips: { get(name: string): THREE.AnimationClip | undefined } = sharedClips;
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
    const own = (template.animations?.length ?? 0) > 1;
    if (own) model.scale.multiplyScalar(HERO_HEIGHT / skinnedBox(model).getSize(new THREE.Vector3()).y);
    // pivot at the feet: seat the measured lowest point on y = 0
    model.position.y -= (own ? skinnedBox(model) : new THREE.Box3().setFromObject(model)).min.y;
    this.node.add(model);
    this.loadedPath = modelPath;
    this.mixer = new THREE.AnimationMixer(model);
    this.clips = own ? ownClips(template.animations!) : clips;
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
  /**
   * Settle INTO a pose and stay there: play the clip once and clamp on its last frame.
   *
   * play() loops, which is right for a walk or an idle and wrong for a pose that is a
   * MOVEMENT into a position. Ranged_1H_Aiming raises the crossbow; looped, the hero raised it,
   * dropped it and raised it again for the whole beat. The bow has a real Ranged_Bow_Aiming_Idle
   * to loop; the one-handed and magic sets do not, so they need holding.
   */
  hold(name: string): void {
    this.wantedLoop = name;
    const a = this.action(name);
    if (!a) {
      if (packForClip.has(name)) {
        void ensureClips([name]).then(() => {
          if (this.wantedLoop === name) this.hold(name);
        });
      }
      return;
    }
    if (a === this.current) return;
    a.reset().setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.setEffectiveWeight(1).play();
    if (this.current) a.crossFadeFrom(this.current, 0.25, false);
    this.current = a;
  }

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
      // return to a HOLD when that is what `then` is -- a shot that drops back into a looped
      // raise animation re-raises the weapon after every single arrow
      if (isHoldPose(then)) this.hold(then);
      else this.play(then, 0.3);
      settled();
    };
    this.mixer?.addEventListener("finished", onDone);
    return this.oneShotDone;
  }

  /** A loaded clip's length in seconds (0 when it is not loaded), to time an impact against. */
  duration(name: string): number {
    return this.action(name)?.getClip().duration ?? 0;
  }

  /**
   * A telegraphed attack: play `name` up to `frac` of its length and FREEZE there, weapon
   * raised, until the returned release() lets the blow come down. release() resolves when the
   * one-shot has settled into `then`. This is what lets the child answer an attack at their own
   * pace -- band-1 scores no speed, so the threat waits for the word.
   */
  windUp(name: string, frac: number, then = "Idle_A"): () => Promise<void> {
    const done = this.playOneShot(name, then);
    const a = this.action(name);
    let released = false;
    const timer = window.setTimeout(() => {
      if (!released && a && this.current === a) a.paused = true;
    }, this.duration(name) * frac * 1000);
    return () => {
      released = true;
      window.clearTimeout(timer);
      if (a) a.paused = false;
      return done;
    };
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
    // a Mixamo-style rig (the Meshy spike) has no handslots: hold it in the hand bone itself,
    // undoing that armature's centimetre scale so the prop keeps its size
    let rescale = false;
    if (!slot) {
      const hand = { handslotr: "righthand", handslotl: "lefthand" }[want];
      this.node.traverse((o) => {
        if (!slot && hand && key(o.name) === hand) slot = o;
      });
      rescale = true;
    }
    if (!slot) return false;
    obj.position.copy(offset);
    (slot as THREE.Object3D).add(obj);
    if (rescale) {
      this.node.updateMatrixWorld(true);
      const s = (slot as THREE.Object3D).getWorldScale(new THREE.Vector3());
      const n = this.node.getWorldScale(new THREE.Vector3());
      obj.scale.set(n.x / s.x, n.y / s.y, n.z / s.z);
    }
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
