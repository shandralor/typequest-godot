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
import { addStat, getFlag, setFlag, wordCount } from "./flags";
import { HeroRig, ensureClips } from "./hero";
import type { World } from "./world";
import type { Hud } from "../ui/hud";
import type { SceneDef } from "../world/sceneDef";
import { rigFor } from "./cameraRigs";
import { buildShape } from "../render/sceneObjects";
import { Sparks, Arrow, arrowRings } from "../render/effects";
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
const POSE_CLIPS: Record<string, string> = { idle: "Idle_A", work: "Sawing", aim: "Ranged_Bow_Aiming_Idle" };
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
/** the vocabulary arrow model, and how far off-centre the shortest sentence lands */
const ARROW_MODEL = "kaykit/adventurers/arrow_bow.gltf";
const ARCH_MAX_RADIUS = 1.0;

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
  private travel: { from: THREE.Vector3; to: THREE.Vector3; dropFrom?: number } | null = null;
  /** the intro get-up is still folding him upright -- hold him on the bed until it settles */
  private risingFromBed = false;
  /** bumped on every staged beat, so a slow animation callback from a past beat is ignored */
  private stageGen = 0;
  private sinceKey = 0;
  private npcs: HeroRig[] = [];
  private scenarioId = "";
  /** the item this home beat is collecting (walk to it, grant its flag on the win) */
  private pickup: { anchor: string; flag: string } | null = null;
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
    // revisit skip (forest): once the cave has been met, land straight at the crossroads
    if (getFlag("met_skeleton") && this.run.graph.hasNode("kruispunt")) this.run.currentId = "kruispunt";
    this.hud.legend(null);
    this.hud.keyboard(true);
    await this.enterNode(true);
  }

  private setFor(d: SceneDescriptor): string {
    return d.setName || LOCATION_SETS[d.location] || d.location;
  }

  private clearEffects(): void {
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
      await this.world.loadScene(def, d.mood === "dark" ? "dark" : "day");
      this.currentSet = setName;
    }
    // Pull in any rig pack this beat needs before posing anyone: the poses on stage, the
    // cheer if this beat can end in a win, and the loose if this is the practice yard. Missing
    // it is not fatal (the clip just arrives late and plays then), but prefetching means the
    // hero is already aiming when the child starts typing.
    const wanted = d.actors.filter((a) => a.asset === "hero").map((a) => POSE_CLIPS[a.pose] ?? "Idle_A");
    if (node.isEnding()) wanted.push("Cheering");
    if (setName === "archery") wanted.push("Ranged_Bow_Release");
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
          this.travel = { from, to };
          if (!restage) hero.node.position.copy(from);
          // The intro opens ASLEEP ON THE BED, not standing beside it (Godot set_house_start):
          // he lies at bed height, folds upright with a real get-up, then the walk steps him
          // off onto the floor. The walk starts from the bed, so `from` is replaced here.
          if (!restage && this.scenarioId === "intro" && this.world.hasAnchor("bed_point")) {
            const bed = this.world.anchor("bed_point").clone();
            bed.y = HOUSE_LIE_Y;
            this.travel = { from: bed, to, dropFrom: HOUSE_LIE_Y };
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
          this.pickup = { anchor: item.anchor, flag: item.flag };
          this.travel = { from: hero.node.position.clone(), to: this.world.anchor(item.anchor) };
        } else if (!restage) {
          hero.node.position.copy(this.world.anchor(a.anchor));
        }
        if (!this.risingFromBed) {
          this.faceActor(hero, a.facing, this.travel?.to);
          hero.setMoving(false);
          hero.play(POSE_CLIPS[a.pose] ?? "Idle_A");
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
    if (!restage) for (const p of d.props) await this.stageProp(p.asset, p.anchor);
    if (!restage && setName === "archery") await this.buildArcheryTarget();
    if (setName === "forge") {
      // the shower sits on the wheel in front of him and heats up as the song is typed
      const at = this.world.anchor("grind_point").clone().add(new THREE.Vector3(0, 0.7, 0));
      this.sparks = new Sparks(at);
      this.world.s.scene.add(this.sparks.group);
    }
    if (setName === "archery") {
      this.rings = arrowRings(this.locale.fillTokens(this.locale.resolve(node.proseKey), this.heroId), ARCH_MAX_RADIUS);
      this.fired = 0;
      await this.world.s.loadModel(ARROW_MODEL).catch(() => null);
    }
    // framing follows the scene type, exactly as the Godot rig does
    const landmarks = !!def0?.anchors?.some((a) => a.name === "bridge_near") && !this.travel;
    this.world.useRig(rigFor(setName, { walking: !!this.travel, win: false, landmarks }), fresh || !restage);
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
  private async stageProp(assetId: string, anchor: string): Promise<void> {
    const path = resolveAsset(assetId).replace(/^assets\//, "");
    if (!path) return;
    const base = await this.world.s.loadModel(path).catch(() => null);
    if (!base) return;
    const obj = base.clone(true);
    // A ranged weapon is really HELD -- it hangs off the class's hand bone so the aim and
    // release animations carry it (KayKit grips are handslot.l / handslot.r).
    if (anchor === "hand" && this.world.hero.attachToHand(obj, "handslot.l")) {
      this.heldProps.push(obj);
      return;
    }
    // The sword rests ON the grindstone rather than in the hand: held, it disappears behind the
    // wheel from this camera. Canted over so it lies against the stone instead of standing
    // bolt upright, and angled to the hero's left where he is working it.
    obj.position.copy(this.world.anchor(anchor === "hand" ? "center" : anchor));
    obj.position.y += 0.95;
    if (assetId === "sword") {
      obj.rotation.set(0, 0.25, -1.15);
      obj.position.x -= 0.15;
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

  /** One arrow per finished sentence (Godot _archery_check_fire). */
  private checkFire(): void {
    while (this.fired < this.rings.length && this.prose.cursor >= this.rings[this.fired].span[1]) {
      const ring = this.rings[this.fired];
      const base = this.world.s.getModel(ARROW_MODEL);
      if (base) {
        const o = ring.offset.clone();
        if (o.length() > 1) o.setLength(1);
        const land = this.targetFace.clone().add(new THREE.Vector3(o.x, o.y, -0.5));
        const from = this.world.hero.node.position.clone().add(new THREE.Vector3(0.35, 1.2, 0));
        const arrow = new Arrow(base.clone(true), from, land);
        this.world.s.scene.add(arrow.obj);
        this.arrows.push(arrow);
      }
      this.world.hero.playOneShot("Ranged_Bow_Release", "Ranged_Bow_Aiming_Idle");
      this.fired += 1;
    }
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
      .map((ch) => ({ word: this.locale.resolve(ch.wordKey), choice: ch }));
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
      this.world.hero.playOneShot("PickUp");
      this.pickup = null;
    } else if (node?.ending === "win") {
      // a LOOPED cheer, like Godot's play_lead_loop -- he holds the celebration while the win
      // message sits on screen, rather than clapping once and dropping back to idle
      this.world.hero.play("Cheering");
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
      const pos = this.travel.from.clone().lerp(this.travel.to, p);
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
