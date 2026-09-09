// A scenario (the band-1 arc): RunState walks the story graph; each node's SceneDescriptor is
// staged on the World (set, hero at an anchor or walking travel_from -> travel_to as the prose
// is typed: progress IS travel, brief B3); a fork is picked by typing its word (first letter
// picks, then exact); endings set flags and hand back to the island. Port of the PLAYING half
// of game_controller.gd. Logic stays in the pure layer (RunState / TypingState / Choice).

import * as THREE from "three";
import { RunState } from "../logic/runState";
import { TypingState } from "../logic/typing";
import { PATH_STRAIGHT, type SceneDescriptor } from "../logic/sceneDescriptor";
import type { Choice } from "../logic/storyGraph";
import { build as buildScenario } from "../content/scenarios";
import { HOUSE_ITEMS } from "../content/home/homeArc";
import { AUTHORED } from "../editor/content_index";
import { resolve as resolveAsset } from "../axis/vocabulary/fantasyPoc";
import { rangedFor, meleeFor, weaponGroupFor, WORK_CLIPS, WORK_PROPS, type RangedLoadout } from "../content/characters";
import { startFor as forgeStartFor } from "../content/grind/grindArc";
import { addStat, getChoice, setChoice, getFlag, setFlag, wordCount } from "./flags";
import { HeroRig, ensureClips } from "./hero";
import type { World } from "./world";
import type { Hud } from "../ui/hud";
import type { SceneDef } from "../world/sceneDef";
import { rigFor } from "./cameraRigs";
import { buildShape } from "../render/sceneObjects";
import { BRIDGE_LEAF } from "../render/islandScene";
import { Sparks, Arrow, arrowRings, magicBolt } from "../render/effects";
import { setupGaze, targetYaw, lerpAngle, type GazeState, type GazeTargets } from "./gaze";

export interface Locale {
  resolve(key: string): string;
  fillTokens(text: string, heroId: string): string;
}

type Phase = "prose" | "choice" | "win" | "pause";
/** descriptor.location -> set when the descriptor names no set */
const LOCATION_SETS: Record<string, string> = { forest_path: "forest_straight", dungeon: "dungeon", house: "house", forge: "forge", archery_range: "archery", mill: "mill" };
/** descriptor pose -> looping clip (the shared KayKit vocabulary) */
// Godot's HERO_WORK / HERO_AIM. Both live in rig packs that load lazily (game/hero.ts), so
// the pose is prefetched when the scene is staged rather than popping in mid-beat.
// `aim` is a PLACEHOLDER: the practice yard overrides it per hero class, so a mage casts and a
// barbarian stands ready to throw instead of everyone miming a bowstring (characters.RANGED).
const POSE_CLIPS: Record<string, string> = { idle: "Idle_A", work: "Sawing", aim: "Ranged_Bow_Aiming_Idle" };
/** the angle the drawbridge leaf is authored at, standing up out of the water */
const BRIDGE_RAISED = (65 * Math.PI) / 180;
/** the island's cloud, reused small as the haze the spellbook rides on */
const HAZE_MODEL = "kaykit/hexagon/cloud_big.gltf";
/** the weapon on the grinding wheel is scaled to this length, so every blade reads the same */
const BLADE_LEN = 1.15;
/** how high the caster's spellbook hangs, and how far it drifts up and down while it hangs */
const BOOK_HEIGHT = 1.02;
const BOOK_BOB = 0.06;
/** the intro hero is asleep on the bed at this height, then rises and steps off (HOUSE_LIE_Y) */
const HOUSE_LIE_Y = 1.2;
/** he is off the bed and on the floor by this much of the prose (Godot drops over sentence 0) */
const BED_DROP_END = 0.2;
const IDLE_AFTER = 0.6; // s without a correct key before the walking hero settles to idle
/** the hero strolls this long toward the path he picked before the scene cuts */
const CHOICE_WALK_DUR = 1.4;
/** The archery target is not in the set -- Godot builds it in code at the "target" anchor. */
const TARGET_MODEL = "kaykit/hexagon/target.gltf";
const TARGET_SCALE = 8.5;
/** how far off-centre the shortest sentence lands */
const ARCH_MAX_RADIUS = 1.0;

/**
 * Walk a polyline by overall progress 0..1, spending time on each leg in proportion to its
 * length so the pace stays even however the waypoints are spaced.
 */
export function pointOnRoute(points: THREE.Vector3[], p: number): THREE.Vector3 {
  if (points.length === 0) return new THREE.Vector3();
  if (points.length === 1) return points[0].clone();
  const legs = points.slice(1).map((pt, i) => pt.distanceTo(points[i]));
  const total = legs.reduce((a, b) => a + b, 0);
  if (total <= 0) return points[points.length - 1].clone();
  let want = Math.min(Math.max(p, 0), 1) * total;
  for (let i = 0; i < legs.length; i++) {
    if (want <= legs[i] || i === legs.length - 1) {
      return points[i].clone().lerp(points[i + 1], legs[i] > 0 ? Math.min(1, want / legs[i]) : 1);
    }
    want -= legs[i];
  }
  return points[points.length - 1].clone();
}

function sceneDefFor(name: string): SceneDef | null {
  return AUTHORED.find((s) => s.name === name)?.def ?? null;
}

export class ScenarioMode {
  private run: RunState | null = null;
  private prose = new TypingState("");
  private phase: Phase = "pause";
  private candidates: { word: string; choice: Choice }[] = [];
  private picked: { word: string; choice: Choice } | null = null;
  private buffer = "";
  private currentSet = "";
  /**
   * The hero's route for this beat as a POLYLINE, walked in step with the typing. A straight
   * from/to could not honour the intro, whose prose sends him past the weapon rack and the key
   * before the door -- Godot walks the same waypoints (game_controller _house_way).
   */
  private travel: { points: THREE.Vector3[]; dropFrom?: number } | null = null;
  /** the cloud bank the caster's book rides on */
  private haze: THREE.Object3D | null = null;
  /** the crystal on the cave floor, so the hero has something to actually pick up */
  private crystal: THREE.Object3D | null = null;
  /** the caster's spellbook, hanging in mid-air and bobbing while the spell is read */
  private book: THREE.Object3D | null = null;
  private bookT = 0;
  /** the intro get-up is still folding him upright -- hold him on the bed until it settles */
  private risingFromBed = false;
  /** bumped on every staged beat, so a slow animation callback from a past beat is ignored */
  private stageGen = 0;
  private sinceKey = 0;
  private npcs: HeroRig[] = [];
  private scenarioId = "";
  /** the item this home beat is collecting (walk to it, grant its flag on the win) */
  private pickup: { anchor: string; flag: string; ranged?: string } | null = null;
  /** a short stroll toward the chosen path, then `done` (softens the fork cut) */
  private walkoff: { from: THREE.Vector3; to: THREE.Vector3; t: number; done: () => void } | null = null;
  private gaze: GazeState = { mode: "none", links: -1, rechts: -1 };
  private gazeTargets: GazeTargets = {};
  private gazeYaw = 0;
  private sparks: Sparks | null = null;
  /** archery: where each sentence's arrow lands, and how many have flown */
  private rings: { span: [number, number]; offset: THREE.Vector2 }[] = [];
  private fired = 0;
  private arrows: Arrow[] = [];
  private targetFace = new THREE.Vector3();
  private stagedProps: THREE.Object3D[] = [];
  private heldProps: THREE.Object3D[] = [];
  /** the chosen hero's ranged loadout, while the practice-yard set is up (C-mini) */
  private ranged: RangedLoadout | null = null;

  constructor(
    private readonly world: World,
    private readonly hud: Hud,
    private readonly locale: Locale,
    private readonly heroId: string,
    private readonly onExit: () => void
  ) {}

  private flag = (name: string): boolean => getFlag(name);

  async start(id: string): Promise<void> {
    this.scenarioId = id;
    this.run = new RunState(buildScenario(id), this.locale);
    this.run.heroId = this.heroId; // choice words carry {wapen}; the match needs it filled
    // revisit skip (forest): once the cave has been met, land straight at the crossroads
    if (getFlag("met_skeleton") && this.run.graph.hasNode("kruispunt")) this.run.currentId = "kruispunt";
    // the forge beat depends on what the hero carries: blades grind, the ranger fletches,
    // casters study -- three authored nodes, one per group (characters.weaponGroupFor)
    if (id === "grind") this.run.currentId = forgeStartFor(weaponGroupFor(this.heroId));
    this.hud.legend(null);
    this.hud.keyboard(true);
    await this.enterNode(true);
  }

  private setFor(d: SceneDescriptor): string {
    return d.setName || LOCATION_SETS[d.location] || d.location;
  }

  private clearEffects(): void {
    this.book = null;
    this.haze = null;
    this.crystal = null;
    if (this.sparks) {
      this.world.s.scene.remove(this.sparks.group);
      this.sparks.dispose();
      this.sparks = null;
    }
    for (const a of this.arrows) this.world.s.scene.remove(a.obj);
    this.arrows = [];
    this.rings = [];
    this.fired = 0;
  }

  private clearNpcs(): void {
    this.clearEffects();
    for (const n of this.npcs) this.world.s.scene.remove(n.node);
    this.npcs = [];
    for (const p of this.stagedProps) this.world.s.scene.remove(p);
    this.stagedProps = [];
    for (const p of this.heldProps) this.world.hero.node.remove(p);
    this.heldProps = [];
  }

  private async enterNode(fresh: boolean): Promise<void> {
    this.stageGen++;
    this.risingFromBed = false;
    const node = this.run!.current();
    if (!node || !node.scene) return this.resolveEnding();
    // Drop the previous beat's gaze BEFORE any await: staging this scene loads models, and
    // update() keeps running meanwhile -- a stale gaze would go on steering the hero and win
    // over the facing set below (the crossroads gaze followed him into the cave).
    this.gaze = { mode: "none", links: -1, rechts: -1 };
    this.gazeTargets = {};
    const d = node.scene;
    const setName = this.setFor(d);
    const restage = d.continuous && setName === this.currentSet;
    const def0 = sceneDefFor(setName);
    if (!restage) {
      const def = def0;
      if (!def) {
        this.hud.message(`Onbekende set '${setName}'`);
        return;
      }
      this.clearNpcs();
      // the chosen hero's weapon is the one that hangs on the house rack (Godot show_hero_weapon)
      // the set is dressed for this hero: their weapon on the house rack, and at the forge the
      // grinding wheel or the reading desk depending on what their beat is about
      await this.world.loadScene(def, d.mood === "dark" ? "dark" : "day",
        new Set([`weapon_${this.heroId}`, `forge_${weaponGroupFor(this.heroId)}`]));
      this.currentSet = setName;
    }
    // Pull in any rig pack this beat needs before posing anyone: the poses on stage, the
    // cheer if this beat can end in a win, and the loose if this is the practice yard. Missing
    // it is not fatal (the clip just arrives late and plays then), but prefetching means the
    // hero is already aiming when the child starts typing.
    // the practice yard arms the hero per class, which decides both his pose and his clips
    this.ranged = setName === "archery" ? rangedFor(this.heroId, getChoice("ranged", "")) : null;
    const workClip = WORK_CLIPS[weaponGroupFor(this.heroId)];
    const poseClip = (pose: string): string =>
      pose === "aim" && this.ranged ? this.ranged.aim : pose === "work" ? workClip : POSE_CLIPS[pose] ?? "Idle_A";
    const wanted = d.actors.filter((a) => a.asset === "hero").map((a) => poseClip(a.pose));
    if (node.isEnding()) wanted.push("Cheering");
    if (this.ranged) wanted.push(this.ranged.aim, this.ranged.fire);
    if (this.scenarioId === "intro") wanted.push("Lie_Idle", "Lie_StandUp");
    await ensureClips(wanted);

    // actors
    this.travel = null;
    this.pickup = null;
    const item = HOUSE_ITEMS.find((i) => i.takeNode === node.id);
    for (const a of d.actors) {
      if (a.asset === "hero") {
        const hero = this.world.hero;
        if (d.path === PATH_STRAIGHT && (a.pose === "walk" || this.scenarioId === "intro")) {
          const from = this.world.anchor(d.travelFrom);
          const to = this.world.anchor(d.travelTo);
          // crossing: go OVER the deck rather than through the water, ramping up at the near
          // edge and down at the far one (Godot _apply_bridge_lift)
          const deck = getFlag("has_crystal") && this.world.hasAnchor("bridge_near")
            ? ["bridge_near", "bridge_far"].map((n) => this.world.anchor(n))
            : [];
          this.travel = { points: [from, ...deck, to] };
          if (!restage) hero.node.position.copy(from);
          // The intro opens ASLEEP ON THE BED, not standing beside it (Godot set_house_start):
          // he lies at bed height, folds upright with a real get-up, then the walk steps him
          // off onto the floor. The walk starts from the bed, so `from` is replaced here.
          if (!restage && this.scenarioId === "intro" && this.world.hasAnchor("bed_point")) {
            const bed = this.world.anchor("bed_point").clone();
            bed.y = HOUSE_LIE_Y;
            // past the rack and the key on his way out, because that is what the prose says
            // he does: "loopt naar het rek aan de muur ... aan de andere kant hangt de sleutel"
            const via = ["sword_point", "key_point"].filter((n) => this.world.hasAnchor(n)).map((n) => this.world.anchor(n));
            this.travel = { points: [bed, ...via, to], dropFrom: HOUSE_LIE_Y };
            this.gazeYaw = hero.node.rotation.y; // so the first turn eases instead of snapping
            hero.node.position.copy(bed);
            hero.node.rotation.y = Math.PI;
            hero.play("Lie_Idle");
            this.risingFromBed = true;
            const gen = this.stageGen;
            void hero.playOneShot("Lie_StandUp", "Idle_A").then(() => {
              if (gen === this.stageGen) this.risingFromBed = false;
            });
          }
        } else if (item) {
          // home pickup: this beat walks him from where he stands to the item on the wall
          this.pickup = { anchor: item.anchor, flag: item.flag, ranged: item.ranged };
          this.travel = { points: [hero.node.position.clone(), this.world.anchor(item.anchor)] };
        } else if (!restage) {
          hero.node.position.copy(this.world.anchor(a.anchor));
        }
        if (!this.risingFromBed) {
          this.faceActor(hero, a.facing, this.travel?.points[this.travel.points.length - 1]);
          hero.setMoving(false);
          hero.play(poseClip(a.pose));
        }
      } else if (!restage) {
        const npc = new HeroRig();
        const path = resolveAsset(a.asset).replace(/^assets\//, "");
        await npc.load(path);
        npc.node.position.copy(this.world.anchor(a.anchor));
        this.faceActor(npc, a.facing);
        this.world.s.scene.add(npc.node);
        this.npcs.push(npc);
      }
    }
    // held / staged props (the sword on the grindstone, the bow in hand)
    // The descriptor authors "bow in hand" because that is the knight's kit; every other class
    // brings its own (a crossbow, a wand, a thrown axe or dagger), so the practice yard swaps
    // the asset AND the grip here rather than making the content carry six variants.
    if (!restage) {
      for (const p of d.props) {
        const held = p.anchor === "hand" && this.ranged;
        await this.stageProp(held ? this.ranged!.weapon : p.asset, p.anchor, held ? this.ranged! : null);
      }
    }
    if (!restage && setName === "archery") await this.buildArcheryTarget();
    if (setName === "forge" && !restage) {
      // what the beat is ABOUT lies in front of him -- his own weapon, a bundle of arrows or
      // the open spellbook. The descriptor cannot name it (it has no hero), so it is staged
      // here, like the archery target.
      const group = weaponGroupFor(this.heroId);
      await this.stageProp(WORK_PROPS[group] || meleeFor(this.heroId), "grind_point");
      // A caster's book is not put down anywhere -- it HANGS in the air in front of her,
      // tilted so the open pages face the child, with the spell guttering underneath it.
      if (group === "caster") this.floatBook();
    }
    if (setName === "forge" && weaponGroupFor(this.heroId) === "blades") {
      // the shower sits on the wheel in front of him and heats up as the song is typed --
      // only the grinding beat throws sparks; fletching and studying do not
      const at = this.world.anchor("grind_point").clone().add(new THREE.Vector3(0, 0.7, 0));
      this.sparks = new Sparks(at);
      this.world.s.scene.add(this.sparks.group);
    }
    // "daar ligt een glanzend kristal" -- so there has to BE one. It lies on the cave floor
    // beside the skeleton and the hero picks it up at the win.
    if (setName === "dungeon" && node.setsFlag?.includes("has_crystal") && !restage) {
      await this.stageProp("crystal", "far_right");
      const gem = this.stagedProps[this.stagedProps.length - 1];
      if (gem) {
        gem.position.y = 0.12;
        gem.position.x -= 0.9;
        gem.scale.setScalar(0.8);
        this.crystal = gem;
      }
    }
    // The drawbridge stands raised until the crystal opens it (Godot lower_bridge). The leaf's
    // shapes are authored at the raised angle, so lowering is rotating the pivot back by it.
    const leaf = this.world.s.scene.getObjectByName(BRIDGE_LEAF);
    if (leaf) leaf.rotation.x = getFlag("has_crystal") ? -BRIDGE_RAISED : 0;

    if (setName === "archery") {
      this.rings = arrowRings(this.locale.fillTokens(this.locale.resolve(node.proseKey), this.heroId), ARCH_MAX_RADIUS);
      this.fired = 0;
      const flying = this.projectileModel();
      if (flying) await this.world.s.loadModel(flying).catch(() => null);
    }
    // framing follows the scene type, exactly as the Godot rig does
    const landmarks = !!def0?.anchors?.some((a) => a.name === "bridge_near") && !this.travel;
    // only blades work over the grinding wheel; the others need the framing that is not
    // pitched down at one
    const reading = setName === "forge" && weaponGroupFor(this.heroId) !== "blades";
    this.world.useRig(rigFor(setName, { walking: !!this.travel, win: false, landmarks, reading }), fresh || !restage);
    // the gaze owns a STANDING lead's yaw: at the fork he looks ahead, then at the cave when the
    // prose says "links", then at the bridge at "rechts" (walking beats keep their travel facing)
    const anchorAt = (n: string): { x: number; z: number } | undefined => {
      const a = def0?.anchors?.find((x) => x.name === n);
      if (!a) return undefined;
      const v = this.world.anchor(n);
      return { x: v.x, z: v.z };
    };
    this.gazeTargets = { cave: anchorAt("far_left"), bridge: anchorAt("far_right"), treasure: anchorAt("treasure") };
    this.gaze = setupGaze({
      walking: !!this.travel,
      archery: setName === "archery",
      landmarks,
      prerevealed: node.prerevealed,
      hasChest: d.props.some((p) => p.asset === "chest"),
      prose: this.locale.resolve(node.proseKey),
    });
    if (this.gaze.mode !== "none") {
      const h = this.world.hero.node.position;
      this.gazeYaw = targetYaw(this.gaze, 0, { x: h.x, z: h.z }, this.gazeTargets);
      this.world.hero.node.rotation.y = this.gazeYaw;
    }
    this.hud.prompt(node.narrationKey ? this.locale.resolve(node.narrationKey) : "");
    this.hud.message("");
    if (node.prerevealed) {
      this.prose = new TypingState("");
      this.hud.plain(this.heldProse(node.proseKey));
      this.beginChoice();
    } else {
      this.prose = new TypingState(this.heldProse(node.proseKey));
      this.phase = "prose";
      this.hud.choices(null);
      this.hud.prose(this.prose.target, 0);
    }
  }

  private heldProse(key: string): string {
    return key ? this.locale.fillTokens(this.locale.resolve(key), this.heroId) : "";
  }

  /**
   * Point an actor the way the descriptor asks: "camera" faces the follow camera (behind, +z),
   * "downrange"/"walk" faces the travel target, "left"/"right" turn a quarter from the camera.
   */
  private faceActor(rig: HeroRig, facing: string, target?: THREE.Vector3): void {
    switch (facing) {
      case "downrange": {
        const t = target ?? this.world.anchor("target");
        rig.lookAtPoint(t);
        break;
      }
      case "left":
        rig.face(-1, 0);
        break;
      case "right":
        rig.face(1, 0);
        break;
      case "away":
        rig.face(0, -1); // down the room / path, back to the camera
        break;
      default:
        if (target) rig.lookAtPoint(target);
        else rig.face(0, 1); // "camera"
    }
  }

  /** Put a vocabulary prop at an anchor (or in the hero's hands for "hand"). */
  /**
   * Hang the caster's spellbook in the air in front of her, tilted toward the child so the open
   * pages read, with the spell sparking underneath. The book is the LAST staged prop, so it is
   * lifted off the ground here rather than in stageProp, which places things on the floor.
   */
  private floatBook(): void {
    const book = this.stagedProps[this.stagedProps.length - 1];
    if (!book) return;
    const at = this.world.anchor("grind_point");
    // toward the camera as well as up: at head height and flush with her it masked her face
    book.position.set(at.x, at.y + BOOK_HEIGHT, at.z + 0.35);
    // Tipped 45 degrees with the BOTTOM edge toward her, so the open pages face the reader --
    // tilted the other way the top leaned in and she was staring at the back of the book.
    book.rotation.set(Math.PI / 4, Math.PI, 0);
    book.scale.setScalar(0.8);
    this.book = book;
    this.bookT = 0;
    void this.hazeUnder(book.position.clone());
  }

  /**
   * A little bank of haze under the floating book, so it reads as being CARRIED on the cloud
   * rather than just hanging there. Reuses the island's cloud model at small scale -- a
   * particle wisp would not match the chunky low-poly art anywhere else in the game.
   * The materials are cloned before going transparent: they are shared with the island's real
   * clouds, and editing them in place would turn the whole sky see-through.
   */
  private async hazeUnder(at: THREE.Vector3): Promise<void> {
    const base = await this.world.s.loadModel(HAZE_MODEL).catch(() => null);
    if (!base || !this.book) return;
    const group = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const puff = base.clone(true);
      puff.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const mat = (Array.isArray(m.material) ? m.material[0] : m.material).clone() as THREE.MeshStandardMaterial;
        mat.transparent = true;
        mat.opacity = 0.42;
        mat.depthWrite = false; // otherwise the puffs punch holes in each other
        m.material = mat;
        m.castShadow = false;
      });
      const a = (i / 3) * Math.PI * 2;
      puff.position.set(Math.cos(a) * 0.22, -0.06 * i, Math.sin(a) * 0.16);
      puff.scale.setScalar(0.11 + i * 0.015);
      group.add(puff);
    }
    group.position.set(at.x, at.y - 0.34, at.z);
    this.world.s.scene.add(group);
    this.stagedProps.push(group);
    this.haze = group;
  }

  /** Which model flies to the target for this class ("" when it is the code-built magic orb). */
  private projectileModel(): string {
    if (!this.ranged) return "";
    const kind = this.ranged.projectile;
    if (kind === "magic") return "";
    // "" means the weapon itself is what gets thrown (the axe, the dagger)
    return resolveAsset(kind === "" ? this.ranged.weapon : kind).replace(/^assets\//, "");
  }

  private async stageProp(assetId: string, anchor: string, held: RangedLoadout | null = null): Promise<void> {
    const path = resolveAsset(assetId).replace(/^assets\//, "");
    if (!path) return;
    const base = await this.world.s.loadModel(path).catch(() => null);
    if (!base) return;
    const obj = base.clone(true);
    obj.name = assetId; // findable later (a cloned gltf root is otherwise called "Scene")
    // A ranged weapon is really HELD -- it hangs off the class's hand bone so the aim and
    // release animations carry it (KayKit grips are handslot.l / handslot.r).
    if (anchor === "hand") {
      // Per-class grip: the bow goes in the LEFT hand, everything else in the right.
      // NOTE: the loadout's `spin` flag is deliberately NOT applied. It compensates for how
      // Godot's BoneAttachment3D orients a child, which is not how three.js orients a bone
      // child -- copying it flipped the knight's already-approved bow. Correct a weapon here
      // only after looking at it, never by porting the Godot value on faith.
      if (this.world.hero.attachToHand(obj, held?.hand ?? "handslot.l")) {
        this.heldProps.push(obj);
        return;
      }
    }
    // The sword rests ON the grindstone rather than in the hand: held, it disappears behind the
    // wheel from this camera. Canted over so it lies against the stone instead of standing
    // bolt upright, and angled to the hero's left where he is working it.
    obj.position.copy(this.world.anchor(anchor === "hand" ? "center" : anchor));
    obj.position.y += 0.95;
    if (assetId === "sword" || assetId === "axe" || assetId === "dagger") {
      // canted against the wheel rather than standing upright, and seated on the MEASURED top
      // of it -- at a guessed height the blade sank into the stone and vanished from the shot
      obj.rotation.set(0, 0.25, -1.15);
      obj.position.x -= 0.15;
      // and forward onto the NEAR face of the wheel: sat at the wheel's own centre the blade
      // was buried inside the stone and never appeared in the shot at all
      // Normalise the SIZE too: sword, axe and dagger are authored at wildly different scales,
      // and axe_C at its native size covered the hero's head. Scale so the longest edge is
      // BLADE_LEN whatever the model, then seat it on the measured wheel.
      const box = new THREE.Box3().setFromObject(obj);
      const longest = Math.max(...box.getSize(new THREE.Vector3()).toArray());
      if (longest > 0) obj.scale.setScalar(BLADE_LEN / longest);
      const wheel = this.world.s.scene.getObjectByName("kaykit/rpgtools_bits/grindstone.gltf");
      if (wheel) {
        obj.position.y = new THREE.Box3().setFromObject(wheel).max.y - 0.22;
        obj.position.z += 0.45;
      }
    } else if (assetId === "arrows") {
      // a bundle LYING on the workbench. The height is measured off the bench, not guessed:
      // never trust a model's origin (docs/woc-playbook.md).
      obj.rotation.set(-Math.PI / 2, 0, Math.PI);
      obj.scale.setScalar(1.3);
      const bench = this.world.s.scene.getObjectByName("kaykit/dungeon/table_medium.gltf");
      if (bench) obj.position.y = new THREE.Box3().setFromObject(bench).max.y + 0.02;
    } else {
      obj.rotation.set(0, 0, -0.45);
    }
    this.world.s.scene.add(obj);
    this.stagedProps.push(obj);
  }

  /**
   * The bullseye the archery prose aims at, on its post. Ported from the composer's
   * _build_archery_target: the model's origin is at its base, the disc sits a little up and
   * forward, and a wooden post runs from the ground up behind it.
   */
  private async buildArcheryTarget(): Promise<void> {
    const pos = this.world.anchor("target");
    const base = await this.world.s.loadModel(TARGET_MODEL).catch(() => null);
    if (base) {
      const t = base.clone(true);
      t.position.copy(pos);
      t.scale.setScalar(TARGET_SCALE);
      this.world.s.scene.add(t);
      this.stagedProps.push(t);
    }
    const discY = pos.y + 0.15 * TARGET_SCALE;
    // just in front of the disc, toward the shooter -- where the arrows land
    this.targetFace.set(pos.x, discY, pos.z + 0.04 * TARGET_SCALE + 0.25);
    const post = buildShape({
      kind: "box",
      size: [0.22, discY, 0.22],
      color: "#734d2b",
      x: pos.x,
      y: discY * 0.5,
      z: pos.z - 0.35,
    });
    this.world.s.scene.add(post);
    this.stagedProps.push(post);
  }

  char(c: string): void {
    if (this.phase === "prose") this.proseChar(c);
    else if (this.phase === "choice") this.choiceChar(c);
  }

  /** Enter at a win/setback message returns to the island. */
  key(k: string): void {
    if (k === "Enter" && this.phase === "win") {
      this.phase = "pause";
      this.onExit();
    }
  }

  private proseChar(c: string): void {
    const ok = this.prose.typeChar(c);
    this.hud.prose(this.prose.target, this.prose.cursor);
    if (!ok) this.hud.reject();
    if (this.currentSet === "archery") this.checkFire();
    if (ok) {
      this.sinceKey = 0;
      if (this.travel) this.world.hero.setMoving(true, 2.0);
    }
    if (this.prose.isComplete()) {
      this.run!.scoreCurrent(this.prose.correctChars(), this.prose.accuracy(), true);
      addStat("words", wordCount(this.prose.target)); // cumulative effort, counted per beat
      this.hud.score(this.score().xp, this.score().stars);
      this.world.hero.setMoving(false);
      if (this.run!.current()?.isEnding()) this.resolveEnding();
      else this.beginChoice();
    }
  }

  /** One shot per finished sentence (Godot _archery_check_fire), in the class's own style. */
  private checkFire(): void {
    while (this.fired < this.rings.length && this.prose.cursor >= this.rings[this.fired].span[1]) {
      const ring = this.rings[this.fired];
      const shot = this.buildProjectile();
      if (shot) {
        const o = ring.offset.clone();
        if (o.length() > 1) o.setLength(1);
        const land = this.targetFace.clone().add(new THREE.Vector3(o.x, o.y, -0.5));
        const from = this.world.hero.node.position.clone().add(new THREE.Vector3(0.35, 1.2, 0));
        // a thrown blade tumbles end over end; an arrow, bolt or orb flies true
        const thrown = this.ranged?.projectile === "";
        const arrow = new Arrow(shot, from, land, thrown ? { spin: 26, scale: 1 } : undefined);
        this.world.s.scene.add(arrow.obj);
        this.arrows.push(arrow);
      }
      if (this.ranged) this.world.hero.playOneShot(this.ranged.fire, this.ranged.aim);
      this.fired += 1;
    }
  }

  /** The thing that flies: a vocabulary model, the thrown weapon itself, or a magic orb. */
  private buildProjectile(): THREE.Object3D | null {
    if (this.ranged?.projectile === "magic") return magicBolt();
    const path = this.projectileModel();
    return path ? this.world.s.getModel(path)?.clone(true) ?? null : null;
  }

  private beginChoice(): void {
    const node = this.run!.current();
    if (!node || node.choices.length === 0) return this.resolveEnding();
    this.candidates = node.choices
      .filter((ch) => ch.isAvailable(this.flag))
      // at home, only offer gear not yet collected (the choice target is a take_* node)
      .filter((ch) => {
        const it = HOUSE_ITEMS.find((i) => i.takeNode === ch.target);
        return !it || !getFlag(it.flag);
      })
      // fillTokens as well as resolve: the melee fetch word IS the class's weapon noun,
      // so an unresolved "{wapen}" would otherwise be what the child is asked to type
      .map((ch) => ({ word: this.locale.fillTokens(this.locale.resolve(ch.wordKey), this.heroId), choice: ch }))
      // never show the same word twice: the ranger's primary weapon IS a kruisboog, so the
      // kruisboog branch of the ranged choice would otherwise duplicate their own banner and
      // the child would have two identical words to pick between
      .filter((c, i, all) => all.findIndex((o) => o.word === c.word) === i);
    if (this.candidates.length === 0) {
      // nothing left to take -- a short "you have everything" beat, then leave
      this.hud.hideBand();
      this.hud.highlightKey("");
      this.hud.message(this.locale.resolve("home.nothing") + "\n(druk op enter)");
      this.world.hero.playOneShot("Cheering");
      this.phase = "win";
      return;
    }
    this.picked = null;
    this.buffer = "";
    this.phase = "choice";
    this.hud.prompt("Typ je keuze.");
    this.hud.choices(this.candidates.map((c) => c.word));
    this.hud.highlightKey("");
  }

  private choiceChar(c: string): void {
    if (!this.picked) {
      const p = this.candidates.find((cand) => cand.word.charAt(0) === c);
      if (!p) return this.hud.reject(); // no choice starts with that letter
      this.picked = p;
      this.buffer = c;
    } else {
      if (c !== this.picked.word.charAt(this.buffer.length)) return this.hud.reject();
      this.buffer += c;
    }
    this.hud.choices(this.candidates.map((x) => x.word), this.picked.word, this.buffer);
    this.hud.highlightKey(this.picked.word.charAt(this.buffer.length));
    if (this.buffer === this.picked.word) {
      const hint = this.picked.choice.hint;
      this.run!.choose(this.picked.word, this.flag);
      const tgt = this.run!.current();
      const sameSetWalk = !!tgt?.scene && this.setFor(tgt.scene) === this.currentSet && tgt.scene.continuous;
      this.hud.choices(null);
      this.hud.prompt("");
      this.hud.highlightKey("");
      // walk him a couple of steps toward the path he picked before the scene changes, so a
      // fork never snaps (Godot _begin_choice_walk)
      const landmark = hint === "left" ? this.gazeTargets.cave : hint === "right" ? this.gazeTargets.bridge : undefined;
      const after = sameSetWalk ? () => void this.enterNode(false) : () => void this.world.fadeCut(() => this.enterNode(true));
      if (landmark) {
        this.phase = "pause";
        const from = this.world.hero.node.position.clone();
        const to = from.clone().lerp(new THREE.Vector3(landmark.x, from.y, landmark.z), sameSetWalk ? 1 : 0.5);
        this.world.hero.face(to.x - from.x, to.z - from.z);
        this.world.hero.setMoving(true, 2.2);
        this.gaze = { mode: "none", links: -1, rechts: -1 };
        this.walkoff = { from, to, t: 0, done: after };
      } else after();
    }
  }

  private resolveEnding(): void {
    const node = this.run!.current();
    if (node?.setsFlag) for (const f of node.setsFlag.split(" ")) if (f) setFlag(f);
    if (this.pickup) {
      setFlag(this.pickup.flag); // the gear is his now: the island's gear gate opens
      // and WHICH ranged weapon he took, so the practice yard arms him with it
      if (this.pickup.ranged) setChoice("ranged", this.pickup.ranged);
      this.world.hero.playOneShot("PickUp");
      this.pickup = null;
    } else if (node?.ending === "win") {
      // The prose says the skeleton falls and the crystal is taken, so both have to HAPPEN.
      // Godot topples the skeleton (topple_skeleton) and plays a pickup on the lead. ONLY on
      // the armed fight: the first cave visit is a scare the hero flees, and toppling the
      // skeleton there both spoils the fright and contradicts "rent snel terug naar het licht".
      const beaten = this.npcs.length > 0 && this.currentSet === "dungeon" && !!node?.setsFlag?.includes("has_crystal");
      if (beaten) for (const n of this.npcs) n.playOneShot("Death_A", "Death_A_Pose");
      if (this.crystal) {
        this.crystal.visible = false; // he picks it up -- it should not still be lying there
        this.crystal = null;
        this.world.hero.playOneShot("PickUp", "Cheering");
      } else {
        // a LOOPED cheer, like Godot's play_lead_loop -- he holds the celebration while the
        // win message sits on screen, rather than clapping once and dropping back to idle
        this.world.hero.play("Cheering");
      }
    }
    if (getFlag("sword_sharp") && getFlag("archery_done")) setFlag("fully_trained");
    const ending = this.run!.resolveEnding();
    const text = node?.winKey ? this.locale.resolve(node.winKey) : ending.type === "setback" ? "Snel terug!" : "Goed gedaan!";
    this.hud.prompt("");
    this.hud.hideBand();
    this.hud.highlightKey("");
    this.hud.message(this.locale.fillTokens(text, this.heroId) + "\n(druk op enter)");
    if (this.currentSet === "forge") this.world.useRig(rigFor("forge", { walking: false, win: true, landmarks: false }), false);
    // bank the persistent effort for a real adventure only: a home chore (fetching gear) and
    // the cave setback are not one, so they do not add to the totals (Godot's `celebrate`)
    if (ending.type === "win" && this.currentSet !== "house") {
      const run = this.score();
      addStat("adventures", 1);
      addStat("xp", run.xp);
      addStat("stars", run.stars);
    }
    this.phase = "win";
  }

  update(dt: number): void {
    if (this.walkoff) {
      const w = this.walkoff;
      w.t += dt;
      const k = Math.min(1, w.t / CHOICE_WALK_DUR);
      this.world.hero.node.position.copy(w.from).lerp(w.to, k);
      if (k >= 1) {
        this.walkoff = null;
        this.world.hero.setMoving(false);
        w.done();
      }
      for (const n of this.npcs) n.update(dt);
      return;
    }
    if (this.book) {
      this.bookT += dt;
      this.book.position.y = this.world.anchor("grind_point").y + BOOK_HEIGHT + Math.sin(this.bookT * 1.6) * BOOK_BOB;
      this.book.rotation.y = Math.PI + Math.sin(this.bookT * 0.7) * 0.06;
      if (this.haze) {
        this.haze.position.y = this.book.position.y - 0.34;
        this.haze.rotation.y = this.bookT * 0.25; // turns slowly the other way, so it breathes
      }
    }
    if (this.sparks) {
      this.sparks.emitting = this.phase === "prose";
      this.sparks.progress = this.prose.progress();
      this.sparks.update(dt);
    }
    for (const a of this.arrows) a.update(dt);
    if (this.gaze.mode !== "none") {
      const h = this.world.hero.node.position;
      const want = targetYaw(this.gaze, this.prose.cursor, { x: h.x, z: h.z }, this.gazeTargets);
      this.gazeYaw = lerpAngle(this.gazeYaw, want, Math.min(1, dt * 3));
      this.world.hero.node.rotation.y = this.gazeYaw;
    }
    if (this.travel) {
      // he does not set off until he is upright -- the get-up plays out in place on the bed
      const p = this.risingFromBed ? 0 : Math.min(1, this.prose.progress());
      const pos = pointOnRoute(this.travel.points, p);
      // Face along the CURRENT leg. The facing was set once, at the final destination, so on a
      // multi-leg route he crabbed sideways through every turn -- which is what read as jank.
      // Only while actually moving, or a paused hero spins to face a stale direction.
      if (this.travel.points.length > 2 && !this.risingFromBed) {
        const ahead = pointOnRoute(this.travel.points, Math.min(1, p + 0.02));
        const dx = ahead.x - pos.x;
        const dz = ahead.z - pos.z;
        if (dx * dx + dz * dz > 1e-6) {
          this.gazeYaw = lerpAngle(this.gazeYaw, Math.atan2(dx, dz), Math.min(1, dt * 6));
          this.world.hero.node.rotation.y = this.gazeYaw;
        }
      }
      // stepping off the bed: the drop to floor height happens over the first stretch of the
      // walk, so it reads as a step down rather than a slow glide across the room
      if (this.travel.dropFrom !== undefined) {
        pos.y = this.travel.dropFrom * (1 - Math.min(1, p / BED_DROP_END));
      }
      this.world.hero.node.position.copy(pos);
      this.sinceKey += dt;
      if (this.sinceKey > IDLE_AFTER && this.world.hero.isMoving) this.world.hero.setMoving(false);
    }
    for (const n of this.npcs) n.update(dt);
  }

  exit(): void {
    this.clearNpcs();
    this.clearEffects();
    this.phase = "pause";
    this.travel = null;
    this.walkoff = null;
  }

  /** XP + stars so far this run (the HUD reads it after every scored beat). */
  score(): { xp: number; stars: number } {
    if (!this.run) return { xp: 0, stars: 0 };
    const snap = this.run.progressSnapshot();
    let stars = 0;
    for (const v of Object.values(snap.starsByNode)) stars += v;
    return { xp: snap.xp, stars };
  }
}
