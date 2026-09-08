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
import { getFlag, setFlag } from "./flags";
import { HeroRig } from "./hero";
import type { World } from "./world";
import type { Hud } from "../ui/hud";
import type { SceneDef } from "../world/sceneDef";

export interface Locale {
  resolve(key: string): string;
  fillTokens(text: string, heroId: string): string;
}

type Phase = "prose" | "choice" | "win" | "pause";
/** descriptor.location -> set when the descriptor names no set */
const LOCATION_SETS: Record<string, string> = { forest_path: "forest_straight", dungeon: "dungeon", house: "house", forge: "forge", archery_range: "archery", mill: "mill" };
/** descriptor pose -> looping clip (the shared KayKit vocabulary) */
const POSE_CLIPS: Record<string, string> = { idle: "Idle_A", work: "Idle_A", aim: "Ranged_Bow_Aiming_Idle" };
const IDLE_AFTER = 0.6; // s without a correct key before the walking hero settles to idle

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
  private travel: { from: THREE.Vector3; to: THREE.Vector3 } | null = null;
  private sinceKey = 0;
  private npcs: HeroRig[] = [];
  private scenarioId = "";
  /** the item this home beat is collecting (walk to it, grant its flag on the win) */
  private pickup: { anchor: string; flag: string } | null = null;
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

  private clearNpcs(): void {
    for (const n of this.npcs) this.world.s.scene.remove(n.node);
    this.npcs = [];
    for (const p of this.stagedProps) this.world.s.scene.remove(p);
    this.stagedProps = [];
    for (const p of this.heldProps) this.world.hero.node.remove(p);
    this.heldProps = [];
  }

  private async enterNode(fresh: boolean): Promise<void> {
    const node = this.run!.current();
    if (!node || !node.scene) return this.resolveEnding();
    const d = node.scene;
    const setName = this.setFor(d);
    const restage = d.continuous && setName === this.currentSet;
    if (!restage) {
      const def = sceneDefFor(setName);
      if (!def) {
        this.hud.message(`Onbekende set '${setName}'`);
        return;
      }
      this.clearNpcs();
      await this.world.loadScene(def, true);
      this.currentSet = setName;
    }
    // actors
    this.travel = null;
    this.pickup = null;
    const item = HOUSE_ITEMS.find((i) => i.takeNode === node.id);
    for (const a of d.actors) {
      if (a.asset === "hero") {
        const hero = this.world.hero;
        if (a.pose === "walk" && d.path === PATH_STRAIGHT) {
          const from = this.world.anchor(d.travelFrom);
          const to = this.world.anchor(d.travelTo);
          this.travel = { from, to };
          if (!restage) hero.node.position.copy(from);
        } else if (item) {
          // home pickup: this beat walks him from where he stands to the item on the wall
          this.pickup = { anchor: item.anchor, flag: item.flag };
          this.travel = { from: hero.node.position.clone(), to: this.world.anchor(item.anchor) };
        } else if (!restage) {
          hero.node.position.copy(this.world.anchor(a.anchor));
        }
        this.faceActor(hero, a.facing, this.travel?.to);
        hero.setMoving(false);
        hero.play(POSE_CLIPS[a.pose] ?? "Idle_A");
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
    this.world.useFollowCamera(fresh || !restage);
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
    if (anchor === "hand") {
      obj.position.set(0.35, 1.0, 0.15);
      obj.rotation.set(0, Math.PI / 2, 0);
      this.world.hero.node.add(obj);
      this.heldProps.push(obj);
    } else {
      obj.position.copy(this.world.anchor(anchor));
      obj.position.y += 0.9;
      this.world.s.scene.add(obj);
      this.stagedProps.push(obj);
    }
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
    if (ok) {
      this.sinceKey = 0;
      if (this.travel) this.world.hero.setMoving(true, 2.0);
    }
    if (this.prose.isComplete()) {
      this.run!.scoreCurrent(this.prose.correctChars(), this.prose.accuracy(), true);
      this.world.hero.setMoving(false);
      if (this.run!.current()?.isEnding()) this.resolveEnding();
      else this.beginChoice();
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
      if (!p) return;
      this.picked = p;
      this.buffer = c;
    } else {
      if (c !== this.picked.word.charAt(this.buffer.length)) return;
      this.buffer += c;
    }
    this.hud.choices(this.candidates.map((x) => x.word), this.picked.word, this.buffer);
    this.hud.highlightKey(this.picked.word.charAt(this.buffer.length));
    if (this.buffer === this.picked.word) {
      this.run!.choose(this.picked.word, this.flag);
      const tgt = this.run!.current();
      const sameSetWalk = !!tgt?.scene && this.setFor(tgt.scene) === this.currentSet && tgt.scene.continuous;
      this.hud.choices(null);
      if (sameSetWalk) void this.enterNode(false);
      else void this.world.fadeCut(() => this.enterNode(true));
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
      this.world.hero.playOneShot("Cheering");
    }
    if (getFlag("sword_sharp") && getFlag("archery_done")) setFlag("fully_trained");
    const ending = this.run!.resolveEnding();
    const text = node?.winKey ? this.locale.resolve(node.winKey) : ending.type === "setback" ? "Snel terug!" : "Goed gedaan!";
    this.hud.prompt("");
    this.hud.hideBand();
    this.hud.highlightKey("");
    this.hud.message(this.locale.fillTokens(text, this.heroId) + "\n(druk op enter)");
    this.phase = "win";
  }

  update(dt: number): void {
    if (this.travel) {
      const p = Math.min(1, this.prose.progress());
      const pos = this.travel.from.clone().lerp(this.travel.to, p);
      this.world.hero.node.position.copy(pos);
      this.sinceKey += dt;
      if (this.sinceKey > IDLE_AFTER && this.world.hero.isMoving) this.world.hero.setMoving(false);
    }
    for (const n of this.npcs) n.update(dt);
  }

  exit(): void {
    this.clearNpcs();
    this.phase = "pause";
    this.travel = null;
  }
}
