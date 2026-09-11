// The main menu and the character picker, as DOM over the live 3D view (the island is the menu
// backdrop, the picker shows the hero on a turntable). Port of the MAIN / PICKER app states in
// game_controller.gd. Pure presentation + callbacks; main.ts owns the state machine.

import * as Characters from "../content/characters";

function $<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

export interface MenuItem {
  text: string;
  onPress: () => void;
  secondary?: boolean;
}

export class Menu {
  /** Show the titled button menu. */
  show(title: string, items: MenuItem[]): void {
    const el = $<HTMLElement>("menu");
    el.hidden = false;
    $<HTMLElement>("menu-title").textContent = title;
    const list = $<HTMLElement>("menu-buttons");
    list.innerHTML = "";
    for (const it of items) {
      const b = document.createElement("button");
      b.textContent = it.text;
      b.className = it.secondary ? "secondary" : "";
      b.onclick = it.onPress;
      list.appendChild(b);
    }
  }

  hide(): void {
    $<HTMLElement>("menu").hidden = true;
    this.totals(null);
  }

  /**
   * The cumulative effort line under the title: everything the child has typed so far, across
   * every run. Effort only adds up, so this is the one number that never goes down (G9).
   */
  totals(stats: Record<string, number> | null): void {
    const el = $<HTMLElement>("totals");
    if (!stats || (stats.words ?? 0) === 0) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const parts = [
      count(stats.words ?? 0, "woord", "woorden") + " getypt",
      count(stats.adventures ?? 0, "avontuur", "avonturen"),
      count(stats.stars ?? 0, "ster", "sterren"),
      `${stats.xp ?? 0} XP`,
    ];
    el.textContent = parts.join("  -  ");
  }

  /**
   * A line under the title, where the totals normally sit -- used for the reset warning. It
   * belongs INSIDE the menu rather than in the hud's message panel, which is positioned for the
   * playing view and lands on top of the title here.
   */
  note(text: string): void {
    const el = $<HTMLElement>("totals");
    el.hidden = text === "";
    el.textContent = text;
    el.classList.toggle("warn", text !== "");
  }

  /** The picker caption: which hero is centred, and how to choose. */
  picker(label: string | null): void {
    const el = $<HTMLElement>("picker");
    el.hidden = label === null;
    if (label !== null) el.innerHTML = `<div class="pick-name">${label}</div><div class="pick-hint">&lt; pijltjes &gt; &nbsp; Enter om te kiezen</div>`;
  }
}

/** "1 avontuur" / "3 avonturen" -- a 6-year-old reads this line, so the Dutch has to be right. */
export function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Cycle helper for the picker carousel. */
export function stepHero(index: number, dir: number): number {
  const n = Characters.ALL.length;
  return (index + dir + n) % n;
}
