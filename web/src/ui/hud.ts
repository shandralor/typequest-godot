// The playing HUD as DOM: a top prompt bar, the type-along band (typed / next / rest), a
// message panel, the island's site legend (with the typed-prefix highlight) and an on-screen
// keyboard that lights the next key in ITS FINGER'S colour, flanked by the two finger legends
// (ui/keyboard_guide.gd + ui/finger_hand.gd). Pure presentation; the modes drive it.
//
// The key rows come from the active keyboard-layout axis, not a hardcoded board, so switching
// to QWERTY re-letters the keyboard and re-aims the finger guidance with no logic change.

import { guidanceForChar, keyboardRows } from "../game/keyboardSettings";
import { visibleEnd, windowStart } from "../logic/revealWindow";
import { FingerHand } from "./fingerHand";

/** finger id -> colour (ui/keyboard_guide.gd FINGER_COLORS, carried verbatim) */
export const FINGER_COLORS: Record<string, string> = {
  left_pinky: "#e57373",
  left_ring: "#ffb74d",
  left_middle: "#fff176",
  left_index: "#81c784",
  right_index: "#4dd0e1",
  right_middle: "#64b5f6",
  right_ring: "#9575cd",
  right_pinky: "#f06292",
  thumb: "#bdbdbd",
};

function $<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

export interface LegendItem {
  id: string;
  word: string;
  color: string;
  locked: boolean;
  /** objective finished -- still open, and still worth practising */
  done?: boolean;
}

export class Hud {
  private keys = new Map<string, HTMLElement>();
  private leftHand: FingerHand;
  private rightHand: FingerHand;

  constructor() {
    this.leftHand = new FingerHand("left_", FINGER_COLORS, false);
    this.rightHand = new FingerHand("right_", FINGER_COLORS, true);
    this.buildKeyboard();
  }

  /**
   * Lay out the on-screen board from the ACTIVE layout axis. Called again when the child
   * switches layout in the options, which is the whole point of the axis: re-lettering the
   * board and re-aiming the finger guidance is this one call, with no logic change (A3).
   */
  buildKeyboard(): void {
    const kb = $<HTMLElement>("keyboard");
    kb.innerHTML = "";
    this.keys.clear();
    kb.appendChild(this.leftHand.el);
    const board = document.createElement("div");
    board.className = "kboard";
    kb.appendChild(board);
    for (const row of keyboardRows()) {
      const r = document.createElement("div");
      r.className = "krow";
      for (const ch of row) r.appendChild(this.makeKey(ch, ch));
      board.appendChild(r);
    }
    // space + the period are layout-neutral, so the guide adds them itself
    const extra = document.createElement("div");
    extra.className = "krow";
    extra.appendChild(this.makeKey(" ", "spatie", "space"));
    extra.appendChild(this.makeKey(".", "."));
    board.appendChild(extra);
    kb.appendChild(this.rightHand.el);
  }

  private makeKey(ch: string, label: string, extraClass = ""): HTMLElement {
    const k = document.createElement("span");
    k.className = `key ${extraClass}`.trim();
    k.textContent = label;
    // the home-row anchor f/j keeps its one scaffold: a marked label, from the start (A1/A8)
    if (guidanceForChar(ch)?.isHomeAnchor) k.classList.add("anchor");
    this.keys.set(ch, k);
    return k;
  }

  /** XP + stars, top-right (the Godot build shows the same counters). */
  score(xp: number, stars: number): void {
    const el = $<HTMLElement>("score");
    el.hidden = false;
    el.textContent = `XP ${xp}    sterren ${stars}`;
  }

  hideScore(): void {
    $<HTMLElement>("score").hidden = true;
  }

  /** A wrong key: nudge the band so the child sees the game noticed, without punishing them. */
  reject(): void {
    const band = $<HTMLElement>("band");
    band.classList.remove("reject");
    void band.offsetWidth; // restart the animation
    band.classList.add("reject");
  }

  prompt(text: string): void {
    $<HTMLElement>("prompt").textContent = text;
    $<HTMLElement>("prompt").hidden = text === "";
  }

  /**
   * The type-along band, through the REVEAL WINDOW (B5): a little already-typed text behind the
   * cursor, the next character, and only a few words of runway ahead. The child never faces the
   * whole passage at once, and the panel stays a stable couple of lines instead of growing.
   */
  prose(target: string, cursor: number): void {
    const start = windowStart(target, cursor);
    const end = visibleEnd(target, cursor);
    const done = target.slice(start, cursor);
    const next = target[cursor] ?? "";
    const runway = target.slice(cursor + 1, Math.max(cursor + 1, end));
    const band = $<HTMLElement>("band");
    band.hidden = false;
    band.innerHTML = `<span class="done">${esc(done)}</span><span class="next">${esc(next)}</span><span class="rest">${esc(runway)}</span>`;
    this.highlightKey(next);
  }

  /** Plain text in the band (the typed site word, or held prose). */
  plain(text: string): void {
    const band = $<HTMLElement>("band");
    band.hidden = false;
    band.innerHTML = `<span class="done">${esc(text)}</span>`;
  }

  hideBand(): void {
    $<HTMLElement>("band").hidden = true;
  }

  message(text: string): void {
    const m = $<HTMLElement>("message");
    m.textContent = text;
    m.hidden = text === "";
  }

  /**
   * The RPG item-get banner: "Je hebt nu je bijl!". It rides under the 3D puff for a beat and
   * then clears itself, so the pickup reads as an event rather than as a prop quietly vanishing.
   */
  itemGet(text: string): void {
    const el = $<HTMLElement>("itemget");
    if (text === "") {
      el.hidden = true;
      return;
    }
    const inner = $<HTMLElement>("itemget-inner");
    inner.innerHTML = `${esc(text)}<small>(druk op enter)</small>`;
    el.hidden = false;
    // restart the pop even when a second pickup lands while the first is still up
    inner.style.animation = "none";
    void inner.offsetWidth;
    inner.style.animation = "";
  }

  /** Right-side pills for the island's sites; `prefix` highlights what has been typed. */
  legend(items: LegendItem[] | null, prefix = ""): void {
    const el = $<HTMLElement>("legend");
    if (!items) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.innerHTML = items
      .map((it) => {
        const hit = prefix && it.word.startsWith(prefix);
        const word = hit ? `<b>${esc(prefix)}</b>${esc(it.word.slice(prefix.length))}` : esc(it.word);
        const mark = it.locked ? ' <small>&#128274;</small>' : it.done ? ' <span class="done-tick">&#10003;</span>' : "";
        return `<div class="pill ${it.locked ? "locked" : ""} ${it.done ? "done" : ""} ${hit ? "hit" : ""}" style="--c:${it.color}">${word}${mark}</div>`;
      })
      .join("");
  }

  /** Choice banners (the fork words); `picked`+`typed` highlight the one being typed. */
  choices(words: string[] | null, picked = "", typed = ""): void {
    const el = $<HTMLElement>("choices");
    if (!words) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.innerHTML = words
      .map((w) => {
        const on = w === picked;
        const body = on ? `<b>${esc(typed)}</b>${esc(w.slice(typed.length))}` : esc(w);
        return `<div class="banner ${on ? "on" : ""}">${body}</div>`;
      })
      .join("");
  }

  /**
   * Light the key for the next expected character (or "" to clear), in its finger's colour,
   * and pop the matching fingertip on the legend beside the keyboard.
   */
  highlightKey(ch: string): void {
    for (const [k, el] of this.keys) {
      const on = k === ch && ch !== "";
      el.classList.toggle("lit", on);
      el.style.background = on ? FINGER_COLORS[guidanceForChar(k)?.finger ?? ""] ?? "" : "";
    }
    const finger = ch === "" ? "" : guidanceForChar(ch)?.finger ?? "";
    // the thumb is shared (space) -- light it on both hands
    if (finger === "thumb") {
      this.leftHand.highlight("thumb");
      this.rightHand.highlight("thumb");
    } else {
      this.leftHand.highlight(finger.startsWith("left") ? finger : "");
      this.rightHand.highlight(finger.startsWith("right") ? finger : "");
    }
  }

  keyboard(visible: boolean): void {
    $<HTMLElement>("keyboard").hidden = !visible;
  }

  /**
   * Show/hide the finger legend without touching the keys. The overworld types site names,
   * where per-finger coaching is just noise -- the hands stay hidden there.
   */
  hands(visible: boolean): void {
    this.leftHand.setVisible(visible);
    this.rightHand.setVisible(visible);
  }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
