// The finger guide (B6): which finger a key belongs to comes from the LAYOUT axis, so the
// guidance follows the board. Guards the two things a silent regression would break: the
// keyboard showing the wrong letters after a layout switch, and the legend's tint/geometry.

import { describe, expect, it } from "vitest";
import { FINGER_COLORS } from "../ui/hud";
import { HAND_W, darkened, nailX, FINGERS, THUMB_X, THUMB_W, IDLE_DIM } from "../ui/fingerHand";
import { guidanceForChar, keyboardRows, setActiveTransient, activeLayoutId } from "../game/keyboardSettings";

describe("layout-driven keyboard", () => {
  it("defaults to AZERTY, whose top row carries every vowel", () => {
    setActiveTransient("azerty");
    expect(activeLayoutId()).toBe("azerty");
    expect(keyboardRows()[0].join("")).toBe("azertyuiop");
    for (const v of "aeiou") expect(keyboardRows()[0]).toContain(v);
  });

  it("re-letters the board when the layout axis is switched", () => {
    setActiveTransient("qwerty");
    expect(keyboardRows()[0].join("")).toBe("qwertyuiop");
    setActiveTransient("azerty");
  });

  it("marks f and j as the home anchors on both layouts", () => {
    for (const id of ["azerty", "qwerty"]) {
      setActiveTransient(id);
      expect(guidanceForChar("f")?.isHomeAnchor).toBe(true);
      expect(guidanceForChar("j")?.isHomeAnchor).toBe(true);
      expect(guidanceForChar("e")?.isHomeAnchor).toBe(false);
    }
    setActiveTransient("azerty");
  });

  it("gives every key on the board a finger that has a colour", () => {
    setActiveTransient("azerty");
    for (const row of keyboardRows()) {
      for (const ch of row) {
        const finger = guidanceForChar(ch)?.finger ?? "";
        expect(FINGER_COLORS[finger], `no colour for '${ch}' -> '${finger}'`).toBeTruthy();
      }
    }
    expect(guidanceForChar(" ")?.finger).toBe("thumb");
  });

  it("splits the board between the two hands", () => {
    setActiveTransient("azerty");
    expect(guidanceForChar("a")?.finger).toBe("left_pinky");
    expect(guidanceForChar("m")?.finger).toBe("right_pinky");
  });
});

describe("finger legend geometry", () => {
  it("mirrors the right hand about the strip so the thumbs face inward", () => {
    expect(nailX(0, 44, false)).toBe(0);
    expect(nailX(0, 44, true)).toBe(HAND_W - 44);
    // the thumb is outermost on the left strip, so mirrored it lands at x = 0
    expect(nailX(THUMB_X, THUMB_W, true)).toBe(0);
  });

  it("bottom-aligns four fingertips of rising then falling height", () => {
    expect(FINGERS.map((f) => f[3])).toEqual([54, 74, 86, 76]);
  });

  it("dims an idle nail by halving its colour, the way Godot darkened() does", () => {
    expect(darkened("#ffffff", IDLE_DIM)).toBe("#808080");
    expect(darkened("#e57373", 0.5)).toBe("#733a3a");
    expect(darkened("#e57373", 0)).toBe("#e57373");
  });
});
