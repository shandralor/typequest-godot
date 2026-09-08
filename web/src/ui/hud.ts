// The playing HUD as DOM: a top prompt bar, the type-along band (typed / next / rest), a
// message panel, the island's site legend (with the typed-prefix highlight) and an on-screen
// keyboard that lights the next key. Pure presentation; the modes drive it.

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

function $<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

export interface LegendItem {
  id: string;
  word: string;
  color: string;
  locked: boolean;
}

export class Hud {
  private keys = new Map<string, HTMLElement>();

  constructor() {
    const kb = $<HTMLElement>("keyboard");
    kb.innerHTML = "";
    for (const row of ROWS) {
      const r = document.createElement("div");
      r.className = "krow";
      for (const ch of row) {
        const k = document.createElement("span");
        k.className = "key";
        k.textContent = ch;
        this.keys.set(ch, k);
        r.appendChild(k);
      }
      kb.appendChild(r);
    }
    const r = document.createElement("div");
    r.className = "krow";
    const sp = document.createElement("span");
    sp.className = "key space";
    sp.textContent = "spatie";
    this.keys.set(" ", sp);
    r.appendChild(sp);
    const dot = document.createElement("span");
    dot.className = "key";
    dot.textContent = ".";
    this.keys.set(".", dot);
    r.appendChild(dot);
    kb.appendChild(r);
  }

  prompt(text: string): void {
    $<HTMLElement>("prompt").textContent = text;
    $<HTMLElement>("prompt").hidden = text === "";
  }

  /** The type-along band: done chars, the next char, the rest. */
  prose(target: string, cursor: number): void {
    const chars = [...target];
    const done = chars.slice(0, cursor).join("");
    const next = chars[cursor] ?? "";
    const rest = chars.slice(cursor + 1).join("");
    const band = $<HTMLElement>("band");
    band.hidden = false;
    band.innerHTML = `<span class="done">${esc(done)}</span><span class="next">${esc(next)}</span><span class="rest">${esc(rest)}</span>`;
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
        return `<div class="pill ${it.locked ? "locked" : ""} ${hit ? "hit" : ""}" style="--c:${it.color}">${word}${it.locked ? " <small>&#128274;</small>" : ""}</div>`;
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

  highlightKey(ch: string): void {
    for (const [k, el] of this.keys) el.classList.toggle("lit", k === ch && ch !== "");
  }

  keyboard(visible: boolean): void {
    $<HTMLElement>("keyboard").hidden = !visible;
  }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
