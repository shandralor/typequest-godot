// A finger LEGEND beside the on-screen keyboard (brief B6 aid). Port of ui/finger_hand.gd.
// Not a drawn hand: five Kenney "nail" sprites (monster-builder body pieces) stand in for the
// fingertips, each tinted with its finger colour and captioned with the Dutch finger name, laid
// out staggered so the group reads as a left or right hand. The finger needed right now pops
// (full colour + scale); the rest sit dimmed. Purely presentational.
//
// The sprites are white PNGs used as CSS masks, so the tint is the finger colour itself --
// the same trick Godot's `modulate` plays on a white texture.

const NAIL_FINGER = "/assets/kenney/monster/body_whiteC.png"; // tapered fingertip
const NAIL_THUMB = "/assets/kenney/monster/body_whiteD.png"; // rounder, for the thumb

export const NAIL_BOTTOM = 96; // y where the four fingertips bottom-align
export const THUMB_DROP = 18; // the thumb sits lower than the fingers
export const FINGER_W = 44;
export const THUMB_W = 54;
export const LABEL_Y = 116;
/** idle nails are darkened by this much (Godot Color.darkened(0.5)) */
export const IDLE_DIM = 0.5;
export const ACTIVE_SCALE = 1.14;

// finger geometry, OUTER -> INNER: [suffix, dutch label, x, height]
export const FINGERS: [string, string, number, number][] = [
  ["pinky", "pink", 0, 54],
  ["ring", "ring", 50, 74],
  ["middle", "middel", 100, 86],
  ["index", "wijs", 150, 76],
];
export const THUMB_X = 208;
export const THUMB_H = 50;

export const HAND_W = THUMB_X + THUMB_W; // 262
export const HAND_H = LABEL_Y + 22; // 138

/** Multiply a #rrggbb toward black, the way Godot's Color.darkened(amount) does. */
export function darkened(hex: string, amount: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const f = 1 - amount;
  const ch = (shift: number): string =>
    Math.round(((n >> shift) & 0xff) * f)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

/**
 * Where a nail sits on the strip. Mirroring flips x about the hand's width so the right hand
 * reads outward-to-inward the other way (thumb inmost on both hands).
 */
export function nailX(x: number, w: number, mirror: boolean): number {
  return mirror ? HAND_W - x - w : x;
}

export class FingerHand {
  readonly el: HTMLElement;
  private nails = new Map<string, HTMLElement>();
  private colors: Record<string, string>;

  constructor(prefix: "left_" | "right_", colors: Record<string, string>, mirror: boolean) {
    this.colors = colors;
    this.el = document.createElement("div");
    this.el.className = "hand";
    const inner = document.createElement("div");
    inner.className = "hand-inner";
    this.el.appendChild(inner);
    for (const [suffix, label, x, h] of FINGERS) {
      this.addNail(inner, prefix + suffix, label, x, h, FINGER_W, NAIL_BOTTOM, NAIL_FINGER, mirror);
    }
    this.addNail(inner, "thumb", "duim", THUMB_X, THUMB_H, THUMB_W, NAIL_BOTTOM + THUMB_DROP, NAIL_THUMB, mirror);
    this.highlight(""); // start dimmed
  }

  private addNail(
    parent: HTMLElement,
    fid: string,
    label: string,
    x: number,
    h: number,
    w: number,
    bottom: number,
    tex: string,
    mirror: boolean
  ): void {
    const px = nailX(x, w, mirror);
    const nail = document.createElement("div");
    nail.className = "nail";
    nail.style.left = `${px}px`;
    nail.style.top = `${bottom - h}px`;
    nail.style.width = `${w}px`;
    nail.style.height = `${h}px`;
    nail.style.setProperty("mask-image", `url(${tex})`);
    nail.style.setProperty("-webkit-mask-image", `url(${tex})`);
    parent.appendChild(nail);
    this.nails.set(fid, nail);
    const lbl = document.createElement("div");
    lbl.className = "nail-label";
    lbl.textContent = label;
    lbl.style.left = `${px - 6}px`;
    lbl.style.top = `${LABEL_Y}px`;
    lbl.style.width = `${w + 12}px`;
    parent.appendChild(lbl);
  }

  /** Emphasise `active` (a finger id) and dim the rest ("" = all dim). */
  highlight(active: string): void {
    for (const [fid, nail] of this.nails) {
      const col = this.colors[fid] ?? "#ffffff";
      const on = fid === active;
      nail.style.background = on ? col : darkened(col, IDLE_DIM);
      nail.style.transform = on ? `scale(${ACTIVE_SCALE})` : "scale(1)";
    }
  }

  setVisible(v: boolean): void {
    this.el.hidden = !v;
  }
}
