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
import { rangedFor, meleeFor, weaponGroupFor, primaryIsRanged, WORK_CLIPS, WORK_PROPS, type RangedLoadout } from "../content/characters";
import { startFor as forgeStartFor } from "../content/grind/grindArc";
import { FIGHT_BEATS, sentenceEnds, type FightBeat } from "../content/band1/fightBeats";
import { addStat, getChoice, setChoice, getFlag, setFlag, wordCount } from "./flags";
import { HeroRig, ensureClips, isHoldPose } from "./hero";
import type { World } from "./world";
import type { Hud } from "../ui/hud";
import type { SceneDef } from "../world/sceneDef";
import { rigFor } from "./cameraRigs";
import { buildShape } from "../render/sceneObjects";
import { BRIDGE_LEAF } from "../render/islandScene";
import { Sparks, Arrow, ImpactBurst, arrowRings, magicBolt } from "../render/effects";
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
/** how fast an ambling NPC walks its loop, in world units a second (Godot MILLER_WALK_SPEED) */
const PACE_SPEED = 1.4;
/** the angle the drawbridge leaf is authored at, standing up out of the water */
const BRIDGE_RAISED = (65 * Math.PI) / 180;
/** how long the RPG item-get puff plays, and how big the weapon reads inside it */
const ITEM_GET_RISE = 0.5;
const ITEM_GET_CARRY = 0.9;
const ITEM_GET_LEN = 0.95;
const ITEM_GET_HOLD = 2.1;
/** the island's cloud, reused small as the haze the spellbook rides on */
const HAZE_MODEL = "kaykit/hexagon/cloud_big.gltf";
/** the weapon on the grinding wheel is scaled to this length, so every blade reads the same */
const BLADE_LEN = 1.15;
/**
 * The staged cave fight: which nodes are fight beats, and everything they can play. Prefetched
 * together, because a phase that has to wait for its pack arrives after the child has already
 * typed their word.
 */
const FIGHT_NODES = /^(grot_fight|strijd_)/;
/** how far apart the two of them stand once the fight starts */
const FIGHT_GAP = 2.1;
/** the warm fill over the duel (colour, intensity): the cave's own key leaves it unreadable */
const FIGHT_TORCH = 0xffc58a;
const FIGHT_TORCH_I = 6;
export function isFightNode(id: string): boolean {
  return FIGHT_NODES.test(id);
}
/** The skeleton's attack: an overhead chop with its blade. */
const SKEL_ATTACK = "Melee_1H_Attack_Chop";
/**
 * How far into the chop the blade is RAISED (where it freezes while the child answers) and
 * where it comes down. The freeze is the telegraph: band-1 scores no speed, so the threat waits
 * for the word instead of punishing a slow typist.
 */
const SKEL_WINDUP = 0.32;
const SKEL_CONTACT = 0.52;
/** where in the hero's own strike the weapon meets the skeleton */
const HERO_CONTACT = 0.42;
/** how far the hero steps into a blow, so a swing reaches instead of cutting air */
const LUNGE = 0.75;
/** the skeleton's hearts on ENTERING each phase: each landed blow takes one, the fall the last */
const FIGHT_HEARTS: Record<string, number> = {
  strijd_slag: 3, strijd_open: 3, strijd_raak: 3, strijd_mis: 3, strijd_wankel: 2, strijd_herrijst: 2, strijd_val: 1,
};
const HEARTS_MAX = 3;
const FIGHT_CLIPS = [
  "Skeletons_Inactive_Floor_Pose", "Skeletons_Awaken_Floor", "Skeletons_Idle", "Skeletons_Taunt",
  "Skeletons_Death", "Skeletons_Death_Pose", "Skeletons_Death_Resurrect",
  "Melee_Block", "Melee_Block_Hit", "Melee_2H_Idle", "Dodge_Backward", "Hit_A",
  SKEL_ATTACK, "Skeletons_Walking",
];
/**
 * The hero's resting pose during the fight. Idle_A is a stroll: arms down, and a sword in that
 * hand sticks straight out sideways, which is what made the grip look wrong. The guard stance
 * holds the weapon up in front of him, which is both readable and what the beat is about.
 */
const FIGHT_IDLE = "Melee_2H_Idle";
/**
 * How far below the grindstone prop's highest point the blade's edge rides. It is not a small
 * bite into the stone: the prop's top is its CRANK HANDLE, not the wheel, so a blade seated on
 * the measured max hovered a visible gap above the rim it is supposed to be grinding on.
 */
const BLADE_BITE = 0.2;
/** how far back from the wheel's centre the grip end sits, toward the hero working it */
const GRIND_GRIP = 0.48;
/** the colour of the light the caster's spell wakes on her staf */
const STAFF_GLOW = 0x9fe8ff;
/** the caster's staf stands this tall beside her, at this (x, z) offset from her feet */
const STAFF_HEIGHT = 1.35;
const STAFF_SIDE: [number, number] = [0.62, -0.05];
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
  /** an NPC ambling a closed authored loop while the child types (the miller round his mill) */
  private pacer: { npc: HeroRig; curve: THREE.CatmullRomCurve3; length: number; t: number } | null = null;
  /** the skeleton rises ONCE per visit to the cave, not once per phase */
  private fightAwake = false;
  /** how many of this passage's sentences have had their fight beat, and the chain they play on */
  private fightBeatAt = 0;
  private fightChain: Promise<void> = Promise.resolve();
  /** the skeleton's raised blade, frozen until the child's answer lets it fall */
  private skelWindup: (() => Promise<void>) | null = null;
  /** it is lying on the floor (fell, or has not risen yet) */
  private skelDown = false;
  /** where the duel stood each fighter this phase: lunges and knockbacks come back here */
  private heroSpot = new THREE.Vector3();
  private skelSpot = new THREE.Vector3();
  /** hearts shown over the skeleton (-1 = none) */
  private heartsLeft = -1;
  private fightSpots = false;
  /** exited: a load still in flight must not stage into the scene the next mode now owns */
  private gone = false;
  /**
   * Where the skeleton's BODY must stay while it falls, lies and gets up. KayKit's death clip
   * throws the hips about 1.8 m backwards and the resurrect slides them all the way back, so
   * unpinned it flew off, drifted while lying and skated forward as it rose -- which read as
   * it jumping up and falling down. Measured on the hips bone, corrected every frame.
   */
  private skelPin: THREE.Vector3 | null = null;
  private bursts: ImpactBurst[] = [];
  private tweens: { obj: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; done: () => void }[] = [];
  private falling: { obj: THREE.Object3D; v: THREE.Vector3; spin: THREE.Vector3; floor: number }[] = [];
  /** the RPG item-get: the weapon held aloft in a puff of cloud while the wall goes empty */
  private itemGet: { group: THREE.Object3D; t: number; from: THREE.Vector3; hold: THREE.Vector3; k: number } | null = null;
  /** the cloud bank the caster's book rides on */
  private haze: THREE.Object3D | null = null;
  /** the crystal on the cave floor, so the hero has something to actually pick up */
  private crystal: THREE.Object3D | null = null;
  /** the caster's spellbook, hanging in mid-air and bobbing while the spell is read */
  private book: THREE.Object3D | null = null;
  private bookT = 0;
  /** the light at the top of the caster's staff, which the spell she reads wakes up */
  private staffGlow: { orb: THREE.Mesh; light: THREE.PointLight } | null = null;
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

  /**
   * Read-only handles for the dev harness (`?dev`). A narrow getter rather than loosening the
   * fields: the harness needs to see where it is and what is staged, not to reach in and steer.
   */
  get dev(): { scenarioId: string; nodeId: string; phase: string; npcs: readonly HeroRig[]; remaining: string } {
    return {
      scenarioId: this.scenarioId,
      nodeId: this.run?.currentId ?? "",
      phase: this.phase,
      npcs: this.npcs,
      remaining: this.prose.target.slice(this.prose.cursor),
    };
  }

  async start(id: string, atNode = ""): Promise<void> {
    this.scenarioId = id;
    this.run = new RunState(buildScenario(id), this.locale);
    this.run.heroId = this.heroId; // choice words carry {wapen}; the match needs it filled
    // revisit skip (forest): once the cave has been met, land straight at the crossroads
    if (getFlag("met_skeleton") && this.run.graph.hasNode("kruispunt")) this.run.currentId = "kruispunt";
    // the forge beat depends on what the hero carries: blades grind, the ranger fletches,
    // casters study -- three authored nodes, one per group (characters.weaponGroupFor)
    if (id === "grind") this.run.currentId = forgeStartFor(weaponGroupFor(this.heroId));
    // dev harness: land on one beat instead of playing up to it (?dev panel)
    if (atNode && this.run.graph.hasNode(atNode)) this.run.currentId = atNode;
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
    this.staffGlow = null; // its orb is a staged prop, removed with the rest
    for (const b of this.bursts) {
      this.world.s.scene.remove(b.group);
      b.dispose();
    }
    this.bursts = [];
    for (const t of this.tweens) t.done();
    this.tweens = [];
    this.falling = [];
    this.skelWindup = null;
    this.skelPin = null;
    this.setHearts(null);
    if (this.itemGet) this.world.s.scene.remove(this.itemGet.group);
    this.itemGet = null;
    this.hud.itemGet("");
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
    this.pacer = null;
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
      if (this.gone) return;
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
    if (isFightNode(node.id)) wanted.push(...FIGHT_CLIPS, this.meleeClip());
    await ensureClips(wanted);
    if (this.gone) return; // closed while this was loading: add nothing to a scene it no longer owns

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
        } else if (setName === "dungeon" && node.setsFlag?.includes("met_skeleton") && this.world.hasAnchor("path_near")) {
          // The scare: "de {held} rent snel terug naar het licht." He has to actually RUN for
          // it, back toward the mouth of the cave, or the beat says one thing and shows a hero
          // standing calmly beside the thing that is meant to be frightening him.
          this.travel = { points: [this.world.anchor(a.anchor), this.world.anchor("path_near")] };
          if (!restage) hero.node.position.copy(this.travel.points[0]);
        } else if (!restage) {
          hero.node.position.copy(this.world.anchor(a.anchor));
        }
        if (!this.risingFromBed) {
          this.faceActor(hero, a.facing, this.travel?.points[this.travel.points.length - 1]);
          hero.setMoving(false);
          const clip = poseClip(a.pose);
          if (isHoldPose(clip)) hero.hold(clip);
          else hero.play(clip);
        }
      } else if (!restage) {
        const npc = new HeroRig();
        const path = resolveAsset(a.asset).replace(/^assets\//, "");
        await npc.load(path);
        if (this.gone) return;
        npc.node.position.copy(this.world.anchor(a.anchor));
        this.faceActor(npc, a.facing);
        this.world.s.scene.add(npc.node);
        this.npcs.push(npc);
        // The miller AMBLES a loop round his mill while the beat is typed -- the route is
        // already authored as "miller_path"; the port simply never walked it, so he stood
        // frozen while the prose talked about him (Godot _tick_miller).
        const route = a.asset === "molenaar" ? this.world.route("miller_path") : null;
        if (route) {
          this.pacer = { npc, curve: route, length: route.getLength(), t: 0 };
          npc.setMoving(true, PACE_SPEED);
        }
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
    // Arm him. He walks into the cave carrying nothing otherwise, and "sla" with empty hands is
    // the same defect the forge had: the prose names a weapon that is not on screen.
    if (isFightNode(node.id) && this.heldProps.length === 0) {
      await this.stageProp(meleeFor(this.heroId), "hand", { ...rangedFor(this.heroId), hand: "handslot.r" });
    }
    // and arm the skeleton: a duel where only one side has a weapon is a beating, and the
    // telegraphed chop needs a blade to raise
    const skel = this.npcs[0];
    if (isFightNode(node.id) && skel && !skel.node.getObjectByName("skeleton_blade")) {
      const base = await this.world.s.loadModel(resolveAsset("skeleton_blade").replace(/^assets\//, "")).catch(() => null);
      if (this.gone) return;
      if (base) {
        const blade = base.clone(true);
        blade.name = "skeleton_blade";
        skel.attachToHand(blade, "handslot.r");
      }
      for (const b of ["bone_a", "bone_b"]) void this.world.s.loadModel(resolveAsset(b).replace(/^assets\//, "")).catch(() => null);
    }
    if (setName === "forge" && !restage) {
      // what the beat is ABOUT lies in front of him -- his own weapon, a bundle of arrows or
      // the open spellbook. The descriptor cannot name it (it has no hero), so it is staged
      // here, like the archery target.
      const group = weaponGroupFor(this.heroId);
      if (group === "blades") await this.stageWorkBlade();
      else await this.stageProp(WORK_PROPS[group], "grind_point");
      // A caster's book is not put down anywhere -- it HANGS in the air in front of her,
      // tilted so the open pages face the child, with the spell guttering underneath it.
      if (group === "caster") {
        this.floatBook();
        // "het licht danst om je staf" -- so the staf has to be there, and the light has to
        // grow on it while the spell is read. With only the book on stage the prose and the
        // win ("je staf gloeit weer") named a thing nobody could see. It STANDS beside her
        // rather than in her hand: the reading pose holds the hand flat, which laid the staf
        // sideways straight through the book.
        await this.standStaff();
      }
    }
    if (setName === "forge" && weaponGroupFor(this.heroId) === "blades") {
      // the shower sits on the wheel in front of him and heats up as the song is typed --
      // only the grinding beat throws sparks; fletching and studying do not
      // on the MEASURED top of the wheel, not a guessed height -- the wheel is scaled to
      // working height in the authored scene and a magic number would drift from it
      const stone = this.world.s.scene.getObjectByName("kaykit/rpgtools_bits/grindstone.gltf");
      const at = this.world.anchor("grind_point").clone();
      if (stone) {
        // on the MEASURED wheel, not at the generic anchor: the stone is authored away from
        // grind_point (which the ranger's bench and the caster's book still use) and scaled to
        // working height, so any guessed offset would drift from it
        const box = new THREE.Box3().setFromObject(stone);
        at.set((box.min.x + box.max.x) / 2, box.max.y - 0.1, (box.min.z + box.max.z) / 2);
      } else at.y += 0.7;
      this.sparks = new Sparks(at);
      this.world.s.scene.add(this.sparks.group);
    }
    // "daar ligt een glanzend kristal" -- so there has to BE one. It lies on the cave floor
    // beside the skeleton and the hero picks it up at the win. The fight is staged ONCE on its
    // approach (the phases re-stage the same set), so it has to be laid down there, not on the
    // payoff node that sets the flag -- that one never loads the set.
    // The duel needs light the scare did not: in the cave's cool dim key the exchange the child
    // is steering -- the swing, the block, the skeleton reeling -- read as two dark shapes.
    // A warm torch-like fill over the two of them, toward the camera, staged once with the set
    // and kept through the phases.
    if (setName === "dungeon" && isFightNode(node.id) && !restage) {
      const hero = this.world.hero.node.position;
      const torch = new THREE.PointLight(FIGHT_TORCH, FIGHT_TORCH_I, 6, 1.6);
      torch.position.set(hero.x + FIGHT_GAP / 2, hero.y + 2.6, hero.z + 1.8);
      this.world.s.scene.add(torch);
      this.stagedProps.push(torch);
    }
    if (setName === "dungeon" && (node.setsFlag?.includes("has_crystal") || isFightNode(node.id)) && !restage) {
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
      if (this.gone) return;
    }
    // framing follows the scene type, exactly as the Godot rig does
    const landmarks = !!def0?.anchors?.some((a) => a.name === "bridge_near") && !this.travel;
    // only blades work over the grinding wheel; the others need the framing that is not
    // pitched down at one
    const reading = setName === "forge" && weaponGroupFor(this.heroId) !== "blades";
    this.world.useRig(rigFor(setName, { walking: !!this.travel, win: false, landmarks, reading, fight: isFightNode(node.id) && node.id !== "grot_fight" }), fresh || !restage);
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
    this.hud.prompt(node.narrationKey ? this.locale.fillTokens(this.locale.resolve(node.narrationKey), this.heroId) : "");
    this.hud.message("");
    if (isFightNode(node.id)) this.stageFight(node.id);
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

  /**
   * The blade the hero is grinding, IN HIS HANDS rather than parked in front of the wheel.
   * Seated on the stone it read as floating: there is no contact, the Sawing arms swing behind
   * it, and any camera move breaks the illusion again. Held, the clip does the work for us.
   */
  private async stageWorkBlade(): Promise<void> {
    const path = resolveAsset(meleeFor(this.heroId)).replace(/^assets\//, "");
    const base = await this.world.s.loadModel(path).catch(() => null);
    if (this.gone) return;
    if (!base) return;
    const obj = base.clone(true);
    obj.name = meleeFor(this.heroId);
    // sword, axe and dagger are authored at wildly different scales -- axe_C at native size
    // covered the hero's head -- so normalise the longest edge first
    const box = new THREE.Box3().setFromObject(obj);
    const longest = Math.max(...box.getSize(new THREE.Vector3()).toArray());
    if (longest > 0) obj.scale.setScalar(BLADE_LEN / longest);
    // All three weapons are authored running up their local +Y from a grip at the origin. Using
    // the bbox CENTRE as the direction instead looks equivalent and is not: the axe's head hangs
    // out sideways, which tilted the whole weapon off the stone.
    const along = new THREE.Vector3(0, 1, 0);
    const stone = this.world.s.scene.getObjectByName("kaykit/rpgtools_bits/grindstone.gltf");
    if (!stone) return void this.stageProp(meleeFor(this.heroId), "grind_point");
    const wheel = new THREE.Box3().setFromObject(stone);
    const at = wheel.getCenter(new THREE.Vector3());
    // Turn him to the stone. Square to the camera the wheel sat between his hands and the lens,
    // so anything he held was behind it whatever its pose. (Render-authored hero pose, the
    // brief's one exception.)
    this.world.hero.face(at.x - this.world.hero.node.position.x, at.z - this.world.hero.node.position.z);
    // The blade lies ACROSS the rim, edge down, handle toward him -- a held weapon tracked the
    // hand into the stone and out of sight, and the hand is the one thing here the scene does
    // not control. On the measured rim it reads as being worked whatever the arms are doing.
    const toHero = this.world.hero.node.position.clone().sub(at).setY(0).normalize();
    // grip nearest him, blade running away across the rim and barely tipped: a steeper angle
    // only lifts one end off the stone, since the weapon is longer than the wheel is wide
    obj.quaternion.setFromUnitVectors(along, toHero.clone().negate().setY(-0.08).normalize());
    obj.updateWorldMatrix(true, true);
    // lay its MIDDLE across the wheel rather than an end -- measured, since the origin is the
    // grip and each model puts it at a different distance from the middle
    const here = new THREE.Box3().setFromObject(obj);
    obj.position.add(at).sub(here.getCenter(new THREE.Vector3())).addScaledVector(toHero, GRIND_GRIP);
    obj.updateWorldMatrix(true, true);
    obj.position.y += wheel.max.y - BLADE_BITE - new THREE.Box3().setFromObject(obj).min.y;
    this.world.s.scene.add(obj);
    this.stagedProps.push(obj);
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
   * The caster's staf, standing upright on the floor at her side with an orb of light on top.
   * Upright is MEASURED: whichever axis of the model is longest is turned to vertical, and it
   * is seated on the floor by its box, because the staf models are authored lying down and at
   * different sizes.
   */
  private async standStaff(): Promise<void> {
    const path = resolveAsset(meleeFor(this.heroId)).replace(/^assets\//, "");
    const base = path ? await this.world.s.loadModel(path).catch(() => null) : null;
    if (this.gone) return;
    if (!base) return;
    const staff = base.clone(true);
    const size = new THREE.Box3().setFromObject(staff).getSize(new THREE.Vector3());
    if (size.x >= size.y && size.x >= size.z) staff.rotation.z = Math.PI / 2;
    else if (size.z >= size.y) staff.rotation.x = Math.PI / 2;
    const long = Math.max(size.x, size.y, size.z);
    if (long > 0) staff.scale.setScalar(STAFF_HEIGHT / long);
    const hero = this.world.hero.node.position;
    staff.position.set(hero.x + STAFF_SIDE[0], 0, hero.z + STAFF_SIDE[1]);
    staff.rotation.y = 0.3; // a slight lean of the head toward her reads as hers, not a post
    staff.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(staff);
    staff.position.y += hero.y - box.min.y;
    this.world.s.scene.add(staff);
    this.stagedProps.push(staff);
    staff.updateWorldMatrix(true, true);
    const top = new THREE.Box3().setFromObject(staff);
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 12),
      new THREE.MeshBasicMaterial({ color: STAFF_GLOW, transparent: true, opacity: 0.85, depthWrite: false })
    );
    orb.position.set((top.min.x + top.max.x) / 2, top.max.y + 0.06, (top.min.z + top.max.z) / 2);
    const light = new THREE.PointLight(STAFF_GLOW, 0, 3.5);
    orb.add(light);
    this.world.s.scene.add(orb);
    this.stagedProps.push(orb);
    this.staffGlow = { orb, light };
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
    if (this.gone) return;
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

  /**
   * The classic RPG item-get: a puff of cloud at the rack, the weapon rising out of it and
   * turning. It also does honest work -- the wall prop is hidden UNDER the puff, so the weapon
   * leaving the wall reads as the pickup rather than as something popping out of existence.
   */
  private async playItemGet(
    assetId: string,
    anchor: string,
    primary: boolean,
    from?: THREE.Vector3,
    /** prize length, and where it comes to hang relative to the hero's feet */
    opts: { len?: number; hold?: THREE.Vector3 } = {}
  ): Promise<void> {
    const len = opts.len ?? ITEM_GET_LEN;
    const hold = opts.hold ?? new THREE.Vector3(0, ITEM_GET_HOLD, 0);
    const k = len / ITEM_GET_LEN; // the puff shrinks with the prize, or a small gem drowns in it
    // ONLY the primary fetch empties the class rack. A blade class fetching a boog leaves their
    // own zwaard hanging where it was -- they have not taken it yet.
    const wall = primary ? this.hideWallWeapon() : null;
    const at = from
      ? from.clone()
      : wall
      ? wall.getWorldPosition(new THREE.Vector3())
      : this.world.hasAnchor(anchor)
        ? this.world.anchor(anchor)
        : this.world.hero.node.position.clone();
    const path = resolveAsset(assetId).replace(/^assets\//, "");
    const [weapon, cloud] = await Promise.all([
      this.world.s.loadModel(path).catch(() => null),
      this.world.s.loadModel(HAZE_MODEL).catch(() => null),
    ]);
    if (!weapon) return;
    const group = new THREE.Group();
    group.position.set(at.x, at.y, at.z);
    // the puff: a few small clouds, materials CLONED before going transparent because they are
    // shared with the island's real sky
    if (cloud) {
      for (let i = 0; i < 4; i++) {
        const puff = cloud.clone(true);
        puff.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const mat = (Array.isArray(m.material) ? m.material[0] : m.material).clone() as THREE.MeshStandardMaterial;
          mat.transparent = true;
          mat.opacity = 0.85;
          mat.depthWrite = false;
          m.material = mat;
          m.castShadow = false;
        });
        const a = (i / 4) * Math.PI * 2;
        puff.position.set(Math.cos(a) * 0.45 * k, -0.5 * k, Math.sin(a) * 0.32 * k);
        puff.scale.setScalar(0.26 * k);
        group.add(puff);
      }
    }
    // the prize itself, scaled so it reads at a glance whatever the class carries
    const prize = weapon.clone(true);
    prize.name = "item_get_prize";
    const box = new THREE.Box3().setFromObject(prize);
    const longest = Math.max(...box.getSize(new THREE.Vector3()).toArray());
    if (longest > 0) prize.scale.setScalar(len / longest);
    // held up at a jaunty angle, and canted forward: a flat blade on a plain Y spin goes
    // invisible edge-on twice a turn, which is exactly when a child happens to look
    prize.rotation.set(-0.38, 0, Math.PI / 5);
    group.add(prize);
    // a weapon model's origin is its grip, not its middle, so an un-centred prize hangs off to
    // one side of the puff instead of rising out of it
    const centred = new THREE.Box3().setFromObject(prize).getCenter(new THREE.Vector3());
    prize.position.sub(centred);
    prize.position.y += 0.3 * k; // it rides ABOVE the puff, not inside it
    this.world.s.scene.add(group);
    this.stagedProps.push(group);
    this.itemGet = { group, t: 0, from: at, hold, k };
  }

  /**
   * Hide the weapon this hero just took off the wall. The house authors one variant per class
   * (tagged weapon_<id>) and only that one is visible, so the tag identifies it exactly.
   */
  private hideWallWeapon(): THREE.Object3D | null {
    const want = `weapon_${this.heroId}`;
    const authored = this.world.def?.props?.find((p) => p.tags?.includes(want));
    if (!authored) return null;
    let found: THREE.Object3D | null = null;
    this.world.s.scene.traverse((o) => {
      if (!found && o.name === authored.m && o.visible) found = o;
    });
    if (found) (found as THREE.Object3D).visible = false;
    return found;
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
    if (this.gone) return;
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
        if (held?.gripTurn) obj.rotateY(held.gripTurn);
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
    if (this.gone) return;
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
    this.fightBeats();
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

  /**
   * How this class swings. A staff jabs, a barbarian's axe comes down two-handed, a dagger
   * stabs -- one clip for everybody read as the wrong weapon entirely.
   */
  private meleeClip(): string {
    if (this.heroId === "barbarian") return "Melee_2H_Attack_Chop";
    if (this.heroId === "rogue" || weaponGroupFor(this.heroId) === "caster") return "Melee_1H_Attack_Stab";
    return "Melee_1H_Attack_Slice_Diagonal";
  }

  /**
   * Stand the two of them for a fight phase. The skeleton wakes ONCE, and only when the child
   * types it up ("het skelet komt langzaam overeind"); coming back to a phase after a setback
   * is the same skeleton still standing.
   */
  private stageFight(nodeId: string): void {
    const skel = this.npcs[0];
    if (!skel) return;
    // Close the distance. Authored at far_right the skeleton is three and a half metres away
    // across the room -- fine for the fright on the first visit, a thumbnail in a duel. Side by
    // side ACROSS the camera, at arm's length plus a lunge: facing him down the lens put the
    // hero's back to the child. Render-authored staging, where the brief allows it (B4).
    const hero = this.world.hero.node.position;
    // the spots are fixed ONCE per duel: re-reading them each phase let every step-in and
    // knockback creep the pair across the cave
    if (!this.fightSpots || nodeId === "grot_fight") {
      this.heroSpot.copy(hero);
      this.skelSpot.set(hero.x + FIGHT_GAP, hero.y, hero.z - 0.35);
      this.fightSpots = nodeId !== "grot_fight";
    } else if (hero.distanceTo(this.heroSpot) > 0.05) void this.moveTo(this.world.hero.node, this.heroSpot, 0.4);
    this.fightBeatAt = 0;
    this.fightChain = Promise.resolve();
    this.skelWindup = null;
    this.gaze = { mode: "none", links: -1, rechts: -1 }; // the gaze must not turn him back
    // the prize lies in the clear just past the skeleton, not behind its legs
    if (this.crystal) this.crystal.position.set(this.skelSpot.x + 1.0, 0.12, this.skelSpot.z - 0.35);
    if (nodeId === "grot_fight") {
      this.fightAwake = false;
      this.skelDown = true;
      skel.play("Skeletons_Inactive_Floor_Pose");
      this.setHearts(null);
      return;
    }
    this.world.hero.face(this.skelSpot.x - hero.x, this.skelSpot.z - hero.z);
    this.world.hero.play(FIGHT_IDLE);
    // hearts over a skeleton still lying in the dark would hang over nothing: they come up
    // with it (the "rise" beat)
    this.setHearts(this.fightAwake || nodeId !== "strijd_slag" ? FIGHT_HEARTS[nodeId] ?? null : null);
    // still lying where it fell on the first visit: it rises -- and comes for him -- on the
    // sentence that says so (the "rise" beat). Only strijd_slag has that sentence; landing on a
    // later phase directly (the dev harness) finds it already up.
    if (!this.fightAwake && nodeId === "strijd_slag") {
      // the scene re-poses its actors on every phase; it is still lying on the floor until then
      skel.play("Skeletons_Inactive_Floor_Pose");
      return;
    }
    this.fightAwake = true;
    this.skelDown = nodeId === "strijd_herrijst";
    // lying (herrijst, or felled for the payoff) it stays exactly where it fell
    if (this.skelPin) return;
    skel.node.position.copy(this.skelSpot);
    skel.face(hero.x - this.skelSpot.x, hero.z - this.skelSpot.z);
    if (nodeId === "strijd_herrijst") skel.play("Skeletons_Death_Pose");
    else skel.play("Skeletons_Idle");
  }

  /** Fire the beat of every sentence the child has finished (FIGHT_BEATS), in order. */
  private fightBeats(): void {
    const beats = FIGHT_BEATS[this.run?.currentId ?? ""];
    if (!beats) return;
    const ends = sentenceEnds(this.prose.target);
    while (this.fightBeatAt < ends.length && this.prose.cursor >= ends[this.fightBeatAt]) {
      const beat = beats[this.fightBeatAt++];
      if (beat) this.fightChain = this.fightChain.then(() => this.playBeat(beat));
    }
  }

  private async playBeat(beat: FightBeat): Promise<void> {
    const skel = this.npcs[0];
    const hero = this.world.hero;
    if (!skel) return;
    const toHero = (): void => skel.face(hero.node.position.x - skel.node.position.x, hero.node.position.z - skel.node.position.z);
    switch (beat) {
      case "rise": {
        if (this.fightAwake) return; // already up (back in this phase after a setback)
        this.fightAwake = true;
        this.skelDown = false;
        this.pinHere(); // it gets up where it lies, not a stride away
        await skel.playOneShot("Skeletons_Awaken_Floor", "Skeletons_Idle");
        this.skelPin = null;
        // up, and it comes for him: from where it lay to arm's length
        const d = skel.node.position.distanceTo(this.skelSpot);
        if (d > 0.1) {
          skel.face(this.skelSpot.x - skel.node.position.x, this.skelSpot.z - skel.node.position.z);
          skel.play("Skeletons_Walking");
          await this.moveTo(skel.node, this.skelSpot, d / 1.2);
        }
        toHero();
        skel.play("Skeletons_Idle");
        this.setHearts(HEARTS_MAX);
        return;
      }
      case "taunt":
        return skel.playOneShot("Skeletons_Taunt", "Skeletons_Idle");
      case "windup":
        toHero();
        this.skelWindup = skel.windUp(SKEL_ATTACK, SKEL_WINDUP, "Skeletons_Idle");
        return;
      case "step_in": {
        // "dit is het moment om te slaan" -- he edges in, guard up
        const to = this.heroSpot.clone().lerp(this.skelSpot, 0.12);
        await this.moveTo(hero.node, to, 0.35);
        return;
      }
      case "reel":
        this.knock(skel.node, this.skelSpot, 0.22);
        return skel.playOneShot("Hit_A", "Skeletons_Idle");
      case "bones":
        this.dropBones();
        return;
      case "topple": {
        this.skelDown = true;
        this.pinHere(); // it falls where it stands
        const fall = skel.playOneShot("Skeletons_Death", "Skeletons_Death_Pose");
        // the dust and the jolt when it HITS the floor, not when it starts to go
        await this.wait(skel.duration("Skeletons_Death") * 0.55);
        this.burst(this.skelPin!.clone().setY(0.15).add(new THREE.Vector3(0, 0, 0.2)), 0xd9c7a8, 1.1, 0.12);
        this.setHearts(0);
        return fall;
      }
      case "glint":
        if (this.crystal) this.burst(this.crystal.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.25, 0)), 0x9fe8ff, 0.55, 0);
        return;
      case "guard":
        return hero.playOneShot("Melee_Block", FIGHT_IDLE);
      case "resurrect":
        this.skelDown = false;
        if (!this.skelPin) this.pinHere();
        await skel.playOneShot("Skeletons_Death_Resurrect", "Skeletons_Idle");
        this.skelPin = null; // up again: its hips are back over its feet
        toHero();
        return;
    }
  }

  /** the duel's moving parts: eased moves, impact bursts, falling bones and the heart row */
  private updateFight(dt: number): void {
    for (const t of this.tweens) {
      t.t = Math.min(1, t.t + dt / t.dur);
      const e = t.t * t.t * (3 - 2 * t.t);
      t.obj.position.lerpVectors(t.from, t.to, e);
    }
    const finished = this.tweens.filter((t) => t.t >= 1);
    this.tweens = this.tweens.filter((t) => t.t < 1);
    for (const t of finished) t.done();
    for (const b of this.bursts) b.update(dt);
    for (const b of this.bursts.filter((x) => x.done)) {
      this.world.s.scene.remove(b.group);
      b.dispose();
    }
    this.bursts = this.bursts.filter((x) => !x.done);
    for (const f of this.falling) {
      f.v.y -= 9.8 * dt;
      f.obj.position.addScaledVector(f.v, dt);
      f.obj.rotation.x += f.spin.x * dt;
      f.obj.rotation.y += f.spin.y * dt;
      f.obj.rotation.z += f.spin.z * dt;
      if (f.obj.position.y <= f.floor) {
        f.obj.position.y = f.floor;
        f.v.set(0, 0, 0);
        f.spin.set(0, 0, 0);
      }
    }
    this.falling = this.falling.filter((f) => f.v.lengthSq() > 0);
    // the hearts ride over the skeleton's head
    const skel = this.npcs[0];
    if (this.heartsLeft >= 0 && skel) {
      // over the BODY (the hips), which is not where the node is while it lies or rises
      const hips = this.skelHips();
      const body = hips ? hips.getWorldPosition(new THREE.Vector3()) : skel.node.position.clone();
      const p = body.setY(skel.node.position.y + 2.3).project(this.world.s.camera);
      const c = this.world.s.renderer.domElement.getBoundingClientRect();
      const h = document.getElementById("hud")?.getBoundingClientRect() ?? c;
      this.hud.heartsAt(c.left - h.left + ((p.x + 1) / 2) * c.width, c.top - h.top + ((1 - p.y) / 2) * c.height);
    }
  }

  private setHearts(n: number | null): void {
    this.heartsLeft = n ?? -1;
    this.hud.hearts(n, HEARTS_MAX);
  }

  /** a flash and spray of sparks where two things meet, with an optional camera jolt */
  private burst(at: THREE.Vector3, color: number, strength: number, shake: number): void {
    const b = new ImpactBurst(at, color, strength);
    this.world.s.scene.add(b.group);
    this.bursts.push(b);
    if (shake > 0) this.world.shake(shake);
  }

  /** Ease `obj` to `to` over `secs`. A newer move of the same object replaces an older one. */
  private moveTo(obj: THREE.Object3D, to: THREE.Vector3, secs: number): Promise<void> {
    for (const t of this.tweens.filter((x) => x.obj === obj)) t.done();
    this.tweens = this.tweens.filter((x) => x.obj !== obj);
    return new Promise((done) => this.tweens.push({ obj, from: obj.position.clone(), to: to.clone(), t: 0, dur: Math.max(0.01, secs), done }));
  }

  /** Shove `obj` away from the other fighter by `dist`, then let it settle back on `home`. */
  private knock(obj: THREE.Object3D, home: THREE.Vector3, dist: number): void {
    const away = obj.position.clone().sub(obj === this.world.hero.node ? this.skelSpot : this.heroSpot).setY(0).setLength(dist);
    void this.moveTo(obj, home.clone().add(away), 0.12).then(() => this.moveTo(obj, home, 0.45));
  }

  private wait(secs: number): Promise<void> {
    return new Promise((r) => window.setTimeout(r, secs * 1000));
  }

  /** "er vallen botjes op de grond" -- a few bones drop off the skeleton and stay there */
  private dropBones(): void {
    const skel = this.npcs[0];
    if (!skel) return;
    // two, and small: a heap of them read as a second skeleton lying on the floor
    for (let i = 0; i < 2; i++) {
      const base = this.world.s.getModel(resolveAsset(i % 2 ? "bone_b" : "bone_a").replace(/^assets\//, ""));
      if (!base) continue;
      const bone = base.clone(true);
      const size = new THREE.Box3().setFromObject(bone).getSize(new THREE.Vector3());
      const long = Math.max(size.x, size.y, size.z);
      if (long > 0) bone.scale.setScalar(0.3 / long);
      bone.position.copy(skel.node.position).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 1.0 + Math.random() * 0.3, (Math.random() - 0.5) * 0.3));
      this.world.s.scene.add(bone);
      this.stagedProps.push(bone);
      const v = new THREE.Vector3((Math.random() - 0.3) * 1.6, 1.2 + Math.random(), 0.4 + Math.random() * 0.8);
      const spin = new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9);
      this.falling.push({ obj: bone, v, spin, floor: skel.node.position.y + 0.04 });
    }
  }

  /**
   * The exchange the typed word buys -- a real clash, not two animations side by side: the hero
   * steps INTO a blow, the weapons meet at a measured point in each swing, and what is hit
   * flashes, recoils and loses a heart. Whether it WORKED is read off the target node, not off
   * the word: the graph decides that, and duplicating the rule here is how the two drift apart.
   */
  private async fightExchange(word: string, fromId: string, target: string): Promise<void> {
    await this.fightChain; // the telegraph is up before it is answered
    const skel = this.npcs[0];
    const hero = this.world.hero;
    if (!skel) return;
    const sla = word === this.locale.resolve("word.sla");
    const blok = word === this.locale.resolve("word.blok");
    const duik = word === this.locale.resolve("word.duik");
    // "verder" -- on to the next phase after the approach or a setback -- is not a move. Treating
    // it as one ran the let-the-chance-pass reaction: the skeleton sprang up off the floor to
    // jeer and dropped down again, and the hero dodged at nothing.
    if (!sla && !blok && !duik) return;
    const between = this.heroSpot.clone().lerp(this.skelSpot, 0.5).add(new THREE.Vector3(0, 1.15, 0.15));
    if (fromId === "strijd_slag") {
      // The raised blade comes down whatever the answer; the word decides what it meets.
      const wound = this.skelWindup;
      this.skelWindup = null;
      const swing = wound ? wound() : skel.playOneShot(SKEL_ATTACK, "Skeletons_Idle");
      const toContact = skel.duration(SKEL_ATTACK) * (SKEL_CONTACT - (wound ? SKEL_WINDUP : 0));
      if (blok) {
        void hero.playOneShot("Melee_Block", FIGHT_IDLE);
        await this.wait(toContact);
        // steel on steel: sparks between them, and the block takes the weight of it
        this.burst(between, 0xfff1c4, 1, 0.07);
        void hero.playOneShot("Melee_Block_Hit", FIGHT_IDLE);
        this.knock(hero.node, this.heroSpot, 0.15);
      } else if (!sla) {
        // duik: out from under it -- the blade cuts the air where he stood
        void hero.playOneShot("Dodge_Backward", FIGHT_IDLE);
        const back = this.heroSpot.clone().lerp(this.skelSpot, -0.35);
        await this.moveTo(hero.node, back, Math.max(0.2, toContact));
        void this.moveTo(hero.node, this.heroSpot, 0.6);
      } else {
        // sla into a blow already falling: it lands first
        void hero.playOneShot(this.meleeClip(), FIGHT_IDLE);
        await this.wait(toContact);
        this.burst(this.heroSpot.clone().add(new THREE.Vector3(0.25, 1.1, 0.15)), 0xffd0c0, 1, 0.1);
        void hero.playOneShot("Hit_A", FIGHT_IDLE);
        this.knock(hero.node, this.heroSpot, 0.3);
      }
      await swing;
      await this.wait(0.35);
      return;
    }
    if (sla && /strijd_(wankel|val)/.test(target)) {
      // His turn, and it lands: step in, strike, and the skeleton takes it.
      const strike = this.meleeClip();
      const d = hero.duration(strike) || 1;
      const shot = hero.playOneShot(strike, FIGHT_IDLE);
      const reach = this.heroSpot.clone().lerp(this.skelSpot, LUNGE / FIGHT_GAP);
      await this.moveTo(hero.node, reach, d * HERO_CONTACT);
      this.burst(this.skelSpot.clone().add(new THREE.Vector3(-0.2, 1.1, 0.15)), 0xfff1c4, 1.2, 0.09);
      this.setHearts(FIGHT_HEARTS[target] ?? 0);
      void skel.playOneShot("Hit_A", "Skeletons_Idle");
      this.knock(skel.node, this.skelSpot, 0.35);
      await this.moveTo(hero.node, this.heroSpot, d * (1 - HERO_CONTACT));
      await shot;
      return;
    }
    if (target === "strijd_herrijst") {
      // blok/duik at a skeleton already wobbling: no blow comes, and it topples by itself --
      // which the herrijst passage needs, since it is about crawling back up
      void hero.playOneShot(blok ? "Melee_Block" : "Dodge_Backward", FIGHT_IDLE);
      this.skelDown = true;
      this.pinHere();
      const fall = skel.playOneShot("Skeletons_Death", "Skeletons_Death_Pose");
      await this.wait(skel.duration("Skeletons_Death") * 0.55);
      this.burst(this.skelPin!.clone().setY(0.15).add(new THREE.Vector3(0, 0, 0.2)), 0xd9c7a8, 0.9, 0.08);
      await fall;
      return;
    }
    // blok/duik when it stood open: the moment passes, and it jeers at him
    void hero.playOneShot(blok ? "Melee_Block" : "Dodge_Backward", FIGHT_IDLE);
    await skel.playOneShot("Skeletons_Taunt", "Skeletons_Idle");
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
      .filter((c, i, all) => all.findIndex((o) => o.word === c.word) === i)
      // the bow/crossbow branches are for the blade classes only; a jager and a caster already
      // carry their ranged weapon, so offering them one is a pointless extra errand
      .filter((c) => !(primaryIsRanged(this.heroId) && /neem_boog|neem_kruisboog/.test(c.choice.target)));
    if (this.candidates.length === 0) {
      // nothing left to take -- a short "you have everything" beat, then leave
      this.hud.hideBand();
      this.hud.highlightKey("");
      this.hud.message(this.locale.resolve("home.nothing") + "\n(druk op enter)", true);
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
      const fromId = this.run!.currentId;
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
      // A fight beat plays the exchange the word bought BEFORE the next phase is entered:
      // without the pause the animation is cut off by its own consequence.
      if (isFightNode(tgt?.id ?? "")) {
        this.phase = "pause";
        void this.fightExchange(this.picked.word, fromId, tgt?.id ?? "").then(after);
        return;
      }
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
    let gotItem = false;
    const node = this.run!.current();
    if (node?.setsFlag) for (const f of node.setsFlag.split(" ")) if (f) setFlag(f);
    if (this.pickup) {
      setFlag(this.pickup.flag); // the gear is his now: the island's gear gate opens
      // and WHICH ranged weapon he took, so the practice yard arms him with it
      if (this.pickup.ranged) setChoice("ranged", this.pickup.ranged);
      // a jager's kruisboog and a caster's staf ARE the ranged weapon, so fetching the primary
      // opens the practice yard too -- they should never be sent back for a bow
      if (this.pickup.flag === "has_sword" && primaryIsRanged(this.heroId)) setFlag("has_ranged");
      // and show it: the weapon rises out of a puff of cloud while the rack goes empty
      const got = this.pickup.ranged ?? meleeFor(this.heroId);
      void this.playItemGet(got, this.pickup.anchor, !this.pickup.ranged);
      // the RPG banner CARRIES this beat -- the ordinary win panel would say the same thing
      // twice and sit right over the puff
      this.hud.itemGet(this.heldProse(`itemget.${this.pickup.ranged ?? "wapen"}`));
      gotItem = true;
      this.world.hero.playOneShot("PickUp");
      this.pickup = null;
    } else if (node?.ending === "win") {
      // The prose says the skeleton falls and the crystal is taken, so both have to HAPPEN.
      // Godot topples the skeleton (topple_skeleton) and plays a pickup on the lead. ONLY on
      // the armed fight: the first cave visit is a scare the hero flees, and toppling the
      // skeleton there both spoils the fright and contradicts "rent snel terug naar het licht".
      const beaten = this.npcs.length > 0 && this.currentSet === "dungeon" && !!node?.setsFlag?.includes("has_crystal");
      // it normally went down on "valt met een klap om"; only topple one still standing
      if (beaten && !this.skelDown) for (const n of this.npcs) n.playOneShot("Death_A", "Death_A_Pose");
      this.setHearts(null);
      if (this.crystal) {
        // the same RPG item-get as the weapons at home: the crystal rises off the cave floor in
        // a puff and comes to hang over the hero's head. Before, he played a pickup three
        // metres from it and it simply vanished.
        const from = this.crystal.getWorldPosition(new THREE.Vector3());
        this.crystal.visible = false;
        this.crystal = null;
        // smaller than a weapon and hung in the open space between him and the fallen skeleton: the duel's frame
        // is tight, and at the weapons' height over the head it rose clean out of the shot
        void this.playItemGet("crystal", "", false, from, { len: 0.42, hold: new THREE.Vector3(1.0, 1.0, 0.3) });
        this.hud.itemGet(this.locale.resolve("itemget.kristal"));
        gotItem = true;
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
    if (!gotItem) this.hud.message(this.locale.fillTokens(text, this.heroId) + "\n(druk op enter)", true);
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
    this.updateFight(dt);
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
    if (this.itemGet) {
      const g = this.itemGet;
      g.t += dt;
      // beat one: the puff swells on the rack and the weapon rises out of it, hiding the gap.
      // beat two: it carries across to above the hero's head and HOLDS there, turning slowly,
      // until the child presses enter -- an RPG item-get is a pause, not a flourish to miss.
      const lift = Math.min(1, g.t / ITEM_GET_RISE);
      const carry = Math.max(0, Math.min(1, (g.t - ITEM_GET_RISE) / ITEM_GET_CARRY));
      const ease = carry * carry * (3 - 2 * carry);
      // the head position is read LIVE: the beat's walk is still easing him toward the rack
      // when the passage completes, so a snapshot taken then aims at the doorway he left
      const to = this.world.hero.node.position.clone();
      to.add(g.hold);
      g.group.position.lerpVectors(g.from, to, ease);
      g.group.position.y += (0.55 * lift + Math.sin(g.t * 2) * 0.05 * ease) * g.k;
      g.group.rotation.y = g.t * 0.55;
      g.group.scale.setScalar(0.4 + 0.6 * lift + 0.35 * ease);
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
    if (this.staffGlow) {
      // it wakes with the spell: dim at the first word, full and pulsing by the last, and it
      // stays lit through the win so "je staf gloeit weer" is what the child is looking at
      const p = this.phase === "prose" ? this.prose.progress() : 1;
      const pulse = 0.5 + 0.5 * Math.sin(this.bookT * 5);
      this.staffGlow.orb.scale.setScalar((0.04 + 0.07 * p) * (1 + 0.15 * pulse));
      (this.staffGlow.orb.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.6 * p;
      this.staffGlow.light.intensity = (0.3 + 3.2 * p) * (0.85 + 0.3 * pulse);
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
      // He does not set off until he is upright -- the get-up plays out in place on the bed.
      // BUT the hold is released once the passage is finished: a fast reader can type the whole
      // intro inside the 2-3s get-up, and pinning progress at 0 meant they watched the win fire
      // with the hero still on the mattress while the prose described him crossing the room.
      const p = this.risingFromBed && !this.prose.isComplete() ? 0 : Math.min(1, this.prose.progress());
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
      // ease toward the route point rather than snapping to it: normal typing moves it a hair
      // at a time (no visible difference), but it keeps the catch-up smooth when the hold above
      // is released all at once
      this.world.hero.node.position.lerp(pos, Math.min(1, dt * 6));
      this.sinceKey += dt;
      if (this.sinceKey > IDLE_AFTER && this.world.hero.isMoving) this.world.hero.setMoving(false);
    }
    this.pace(dt);
    for (const n of this.npcs) n.update(dt);
    this.pinSkeleton();
  }

  /** The skeleton's hips bone (its body's real position, whatever the clip does to it). */
  private skelHips(): THREE.Object3D | null {
    return this.npcs[0]?.node.getObjectByName("hips") ?? null;
  }

  /** Pin the skeleton's body where it is right now (see skelPin). */
  private pinHere(): void {
    const hips = this.skelHips();
    if (!hips) return;
    this.npcs[0].node.updateMatrixWorld(true);
    this.skelPin = hips.getWorldPosition(new THREE.Vector3());
  }

  private pinSkeleton(): void {
    const hips = this.skelHips();
    if (!this.skelPin || !hips) return;
    const node = this.npcs[0].node;
    node.updateMatrixWorld(true);
    const at = hips.getWorldPosition(new THREE.Vector3());
    node.position.x += this.skelPin.x - at.x;
    node.position.z += this.skelPin.z - at.z;
  }

  /** Walk the ambling NPC one step round its loop, facing the way it is going. */
  private pace(dt: number): void {
    const p = this.pacer;
    if (!p || p.length <= 0) return;
    p.t = (p.t + PACE_SPEED * dt) % p.length;
    const at = p.curve.getPointAt(p.t / p.length);
    const prev = p.npc.node.position;
    const dx = at.x - prev.x;
    const dz = at.z - prev.z;
    p.npc.node.position.set(at.x, prev.y, at.z); // stay grounded; ignore Y drift in the points
    // skip the wrap-around jump, which would spin him on the spot
    if (dx * dx + dz * dz > 1e-6 && dx * dx + dz * dz < 1) p.npc.face(dx, dz);
  }

  exit(): void {
    this.gone = true;
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
