// The dev harness: an overlay that jumps straight to any beat, sets the gate flags, swaps the
// hero and plays any animation clip on the hero or an NPC, so a beat can be judged in seconds
// instead of after a five-minute playthrough. Built ONLY when the page is opened with `?dev`,
// so nothing here is constructed, fetched or bound in the child's game.
//
// It exists because tuning the forge beat cost a full run per look, and the cave fight -- which
// is about to grow several staged phases -- would cost far more.

import * as Characters from "../content/characters";
import { LIST as SCENARIOS, build as buildScenario } from "../content/scenarios";
import { getFlag, setFlag } from "../game/flags";
import { EXTRA_RIGS, RIGS, allClipNames, loadClipPack } from "../game/hero";

/** The flags that gate what the game will let you reach. Ordered as the story reaches them. */
export const DEV_FLAGS = [
  "intro_seen",
  "met_skeleton",
  "has_sword",
  "has_ranged",
  "sword_sharp",
  "archery_done",
  "fully_trained",
  "molen_tip",
  "has_crystal",
] as const;

/** What the panel needs from main.ts. Kept narrow so the game does not grow a dev dependency. */
export interface DevHost {
  /** jump into a scenario, optionally landing on a specific node */
  jump(scenarioId: string, nodeId?: string): void | Promise<void>;
  /** back to the island */
  island(): void | Promise<void>;
  /** swap the playable hero and restart whatever is on screen */
  setHero(id: string): void | Promise<void>;
  heroId(): string;
  /** type the rest of the current passage instantly */
  finishTyping(): void;
  /** the rigs the panel can animate: the hero plus any staged NPC */
  rigs(): { label: string; play(clip: string): void }[];
  /** where we are, for the status line */
  status(): string;
}

const CSS = `
#devpanel { position: absolute; top: 8px; left: 8px; width: 290px; max-height: calc(100% - 16px);
  overflow-y: auto; background: rgba(16,12,8,.93); border: 1px solid #6b5636; border-radius: 8px;
  color: #e9dcc2; font: 12px/1.45 ui-monospace, Menlo, Consolas, monospace; padding: 8px 10px 10px;
  z-index: 99; }
#devpanel h4 { margin: 10px 0 4px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase;
  color: #b79a63; font-weight: 600; }
#devpanel h4:first-child { margin-top: 0; }
#devpanel .row { display: flex; flex-wrap: wrap; gap: 4px; }
#devpanel button { font: inherit; background: #3a2f1f; color: #e9dcc2; border: 1px solid #6b5636;
  border-radius: 4px; padding: 3px 7px; cursor: pointer; }
#devpanel button:hover { background: #51422b; }
#devpanel button.on { background: #7a6132; border-color: #d0ad63; color: #fff6df; }
#devpanel select { font: inherit; background: #3a2f1f; color: #e9dcc2; border: 1px solid #6b5636;
  border-radius: 4px; padding: 2px; max-width: 100%; }
#devpanel .status { color: #9d8a6a; margin-top: 8px; border-top: 1px solid #4a3d28; padding-top: 6px;
  word-break: break-word; }
#devpanel .hint { color: #8a7a5e; font-size: 11px; }
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
}

export class DevPanel {
  readonly root = el("div");
  private body = el("div");
  private statusLine = el("div", "status");
  private clipPick = el("select");
  private rigPick = el("select");
  private open = true;

  constructor(private readonly host: DevHost) {
    const style = el("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root.id = "devpanel";
    this.root.appendChild(this.body);
    this.root.appendChild(this.statusLine);
    document.getElementById("hud")?.appendChild(this.root);
    // the panel must never eat a keystroke: the game listens on window, and a focused button
    // would swallow the space bar the child (and the harness) types
    this.root.addEventListener("keydown", (e) => e.stopPropagation());
    this.root.addEventListener("mousedown", () => (document.activeElement as HTMLElement)?.blur());
    window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        this.toggle();
      }
    });
    void this.build();
    window.setInterval(() => {
      this.statusLine.textContent = this.host.status();
      // the NPC list changes with the staged scene, and a scene loads long after the panel is
      // built -- refreshing only on mousedown left the skeleton unreachable
      this.refreshRigs();
    }, 400);
  }

  toggle(): void {
    this.open = !this.open;
    this.body.hidden = !this.open;
    this.statusLine.hidden = !this.open;
    this.root.style.width = this.open ? "290px" : "auto";
  }

  private section(title: string): HTMLElement {
    this.body.appendChild(el("h4", "", title));
    const row = el("div", "row");
    this.body.appendChild(row);
    return row;
  }

  private button(into: HTMLElement, label: string, on: () => void, active = false): HTMLButtonElement {
    const b = el("button", active ? "on" : "", label);
    b.onclick = () => {
      on();
      // the flag buttons toggle state, so redraw rather than tracking each one
      window.setTimeout(() => this.refreshFlags(), 0);
    };
    into.appendChild(b);
    return b;
  }

  private flagRow: HTMLElement | null = null;

  private async build(): Promise<void> {
    const heroes = this.section("Held");
    for (const c of Characters.ALL) {
      this.button(heroes, c.label, () => void this.host.setHero(c.id), c.id === this.host.heroId());
    }

    const where = this.section("Sprong");
    this.button(where, "eiland", () => void this.host.island());
    for (const s of SCENARIOS) {
      this.button(where, s.id, () => void this.host.jump(s.id));
    }

    // Every node of every scenario, so any single beat can be opened on its own. This is the
    // whole point of the panel for a multi-phase fight: phase 3 is one click, not one run.
    const nodes = this.section("Beat");
    for (const s of SCENARIOS) {
      let graph;
      try {
        graph = buildScenario(s.id);
      } catch {
        continue;
      }
      for (const id of graph.nodes.keys()) {
        this.button(nodes, `${s.id}:${id}`, () => void this.host.jump(s.id, id));
      }
    }

    this.flagRow = this.section("Vlaggen");
    this.refreshFlags();

    const typing = this.section("Typen");
    this.button(typing, "maak af", () => this.host.finishTyping());

    const anim = this.section("Animatie");
    anim.appendChild(this.rigPick);
    anim.appendChild(this.clipPick);
    this.button(anim, "speel", () => {
      const rig = this.host.rigs()[this.rigPick.selectedIndex];
      if (rig && this.clipPick.value) rig.play(this.clipPick.value);
    });
    this.rigPick.onmousedown = () => this.refreshRigs();
    this.refreshRigs();
    // every pack, not just the ones a beat happens to use -- choosing a fight animation means
    // looking at the ones we are NOT using yet
    await Promise.all([...RIGS, ...Object.keys(EXTRA_RIGS)].map((p) => loadClipPack(p).catch(() => null)));
    for (const name of allClipNames().sort()) {
      const o = el("option", "", name);
      o.value = name;
      this.clipPick.appendChild(o);
    }

    const help = el("div", "hint", "ctrl+D verbergt dit paneel");
    this.body.appendChild(help);
  }

  private refreshRigs(): void {
    const rigs = this.host.rigs();
    if (this.rigPick.options.length === rigs.length && rigs.every((r, i) => this.rigPick.options[i].text === r.label)) return;
    this.rigPick.innerHTML = "";
    for (const r of rigs) this.rigPick.appendChild(el("option", "", r.label));
  }

  private refreshFlags(): void {
    if (!this.flagRow) return;
    this.flagRow.innerHTML = "";
    for (const f of DEV_FLAGS) {
      const on = getFlag(f);
      this.button(this.flagRow, f, () => setFlag(f, !on), on);
    }
  }
}

/** Small helper so main.ts can hand the panel a rig without importing three. */
export function rigEntry(label: string, node: { playOneShot(c: string, then?: string): unknown; play(c: string): void }): { label: string; play(clip: string): void } {
  return {
    label,
    play: (clip: string) => {
      // one-shots read better for judging a beat; looping clips fall back to play()
      const looped = /Idle|Walking|Running|Blocking|Working|Sawing|Aiming|Lie_Idle/.test(clip);
      if (looped) node.play(clip);
      else void node.playOneShot(clip, "Idle_A");
    },
  };
}
