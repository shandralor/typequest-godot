// The island: the child TYPES a site word (prefix-matched across all sites), the hero walks the
// authored route there (reversing home first when standing at another site), and the scenario
// starts. Port of the overworld half of game_controller.gd on the World stage.

import * as THREE from "three";
import { OVERWORLD } from "../content/island/overworld";
import { SITES, siteByAnchor, type Site } from "../content/overworld";
import { getFlag } from "./flags";
import { SiteTyper } from "./siteTyper";
import type { World } from "./world";
import type { Hud } from "../ui/hud";
import { ISLAND_FOV, OW_IDLE_BIAS, OW_IDLE_ZOOM, OW_TRAVEL_ZOOM } from "./cameraRigs";
import { lerpAngle } from "./gaze";

export interface Locale {
  resolve(key: string): string;
  fillTokens(text: string, heroId: string): string;
}

const OW_WALK_SPEED = 4.5;
const SITE_COLORS: Record<string, string> = { bos: "#27ae60", smidse: "#c0392b", boog: "#f1c40f", thuis: "#2980b9", molen: "#e67e22" };

interface Leg {
  curve: THREE.CatmullRomCurve3;
  length: number;
  reverse: boolean;
}

export class OverworldMode {
  at = "hub";
  private typer: SiteTyper<Site> | null = null;
  private walk: { legs: Leg[]; leg: number; dist: number; site: Site } | null = null;
  private entering = false;
  private hintTimer: number | null = null;

  /** whose island this is -- the gear hints name the hero's OWN weapon, via {wapen} */
  heroId = "";

  constructor(private readonly world: World, private readonly hud: Hud, private readonly locale: Locale, private readonly onArrive: (site: Site) => void) {}

  /** resolve a key AND fill its per-hero tokens; a raw "{wapen}" reaching the child is a bug */
  private text(key: string): string {
    return this.locale.fillTokens(this.locale.resolve(key), this.heroId);
  }

  siteLocked(s: Site): boolean {
    return s.scenario === "" || (!!s.unlockFlag && !getFlag(s.unlockFlag));
  }

  async enter(atAnchor = "hub"): Promise<void> {
    this.at = atAnchor;
    this.walk = null;
    this.entering = false;
    await this.world.loadScene(OVERWORLD, "island");
    this.world.useIslandCamera(OVERWORLD.camera, { zoom: OW_IDLE_ZOOM, bias: OW_IDLE_BIAS, fov: ISLAND_FOV, snap: true });
    const pos = this.world.anchor(atAnchor);
    this.world.hero.node.position.copy(pos);
    this.world.hero.face(0, 1); // face the camera (it sits at +z)
    this.world.hero.setMoving(false);
    this.typer = new SiteTyper(SITES.filter((s) => s.scenario !== "").map((s) => ({ word: this.locale.resolve(s.wordKey), site: s })));
    this.hud.prompt(this.locale.resolve("overworld.narration"));
    this.hud.message("");
    this.hud.choices(null);
    this.hud.plain("");
    this.hud.keyboard(true);
    this.renderLegend();
  }

  private renderLegend(): void {
    this.hud.legend(
      SITES.map((s) => ({
        id: s.id,
        word: this.locale.resolve(s.wordKey),
        color: SITE_COLORS[s.id] ?? "#888",
        locked: this.siteLocked(s),
        done: !!s.doneFlag && getFlag(s.doneFlag),
      })),
      this.typer?.buffer ?? ""
    );
    this.hud.highlightKey(this.typer?.nextKey() ?? "");
  }

  private showHint(text: string): void {
    this.hud.message(text);
    if (this.hintTimer !== null) window.clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => this.hud.message(""), 2200);
    this.typer?.reset();
    this.hud.plain("");
    this.renderLegend();
  }

  char(c: string): void {
    if (!this.typer || this.walk || this.entering) return;
    const done = this.typer.typeChar(c);
    this.hud.plain(this.typer.buffer);
    this.renderLegend();
    if (!done) return;
    const site = done.site;
    if (this.siteLocked(site)) return this.showHint(this.text("overworld.locked"));
    if (site.requiresFlag && !getFlag(site.requiresFlag)) return this.showHint(this.text(site.hintKey ?? "overworld.locked"));
    this.beginTravel(site);
  }

  private leg(routeName: string, reverse: boolean): Leg | null {
    const curve = this.world.route(routeName);
    if (!curve) {
      console.warn(`Missing overworld route '${routeName}'`);
      return null;
    }
    return { curve, length: curve.getLength(), reverse };
  }

  private beginTravel(site: Site): void {
    const legs: Leg[] = [];
    if (this.at !== "hub") {
      const here = siteByAnchor(this.at);
      const back = here && this.leg(here.route, true);
      if (back) legs.push(back);
    }
    const there = this.leg(site.route, false);
    if (there) legs.push(there);
    this.hud.legend(null);
    this.hud.highlightKey("");
    this.hud.plain(this.locale.resolve(site.wordKey));
    if (legs.length === 0) return this.arrive(site);
    this.walk = { legs, leg: 0, dist: 0, site };
  }

  update(dt: number): void {
    if (!this.walk) return;
    const w = this.walk;
    const leg = w.legs[w.leg];
    w.dist += OW_WALK_SPEED * dt;
    const d = Math.min(w.dist, leg.length);
    const u = leg.reverse ? 1 - d / leg.length : d / leg.length;
    const prev = this.world.hero.node.position.clone();
    const pos = leg.curve.getPointAt(Math.min(1, Math.max(0, u)));
    this.world.hero.node.position.copy(pos);
    // ease toward the path tangent: taking it raw snapped the hero 150 degrees on the first
    // frame of a straight route and popped him round corners
    const dx = pos.x - prev.x;
    const dz = pos.z - prev.z;
    if (Math.hypot(dx, dz) > 1e-4) {
      const want = Math.atan2(dx, dz);
      this.world.hero.node.rotation.y = lerpAngle(this.world.hero.node.rotation.y, want, Math.min(1, dt * 6));
    }
    this.world.hero.setMoving(true, OW_WALK_SPEED);
    // dolly in and track the hero along the path (the lerp makes it a smooth dolly)
    this.world.useIslandCamera(OVERWORLD.camera, { zoom: OW_TRAVEL_ZOOM, bias: 0, fov: ISLAND_FOV, follow: pos, snap: false });
    if (w.dist >= leg.length) {
      w.leg += 1;
      w.dist = 0;
      if (w.leg >= w.legs.length) this.arrive(w.site);
    }
  }

  private arrive(site: Site): void {
    this.walk = null;
    this.at = site.anchor;
    this.world.hero.setMoving(false);
    this.entering = true;
    if (site.doneFlag && getFlag(site.doneFlag)) {
      this.hud.prompt(this.locale.resolve("overworld.again"));
      window.setTimeout(() => this.onArrive(site), 2500);
      return;
    }
    this.onArrive(site);
  }
}
