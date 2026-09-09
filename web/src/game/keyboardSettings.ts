// Which keyboard-layout axis is active, plus its persistence. Port of
// game/keyboard_settings.gd. The pure layout DATA lives in axis/layout/*; this is the
// app-side selector that says which one the child is using and remembers it across runs.
// Consumers on the render side (the on-screen keyboard + finger guide) ask HERE instead of
// hardcoding a layout, so adding a layout stays a single-axis change (brief A3).

import { beAzerty } from "../axis/layout/beAzerty";
import { qwerty } from "../axis/layout/qwerty";
import { getChoice, setChoice } from "./flags";

export interface Guidance {
  position: string;
  finger: string;
  isHomeAnchor: boolean;
}

export interface Layout {
  LAYOUT_ID: string;
  DISPLAY_NAME: string;
  supportsText(text: string): boolean;
  guidanceForChar(character: string): Guidance | null;
  charAtPosition(position: string): string;
  keyboardRows(): string[][];
}

const LAYOUTS: Layout[] = [beAzerty, qwerty];
const DEFAULT_ID = beAzerty.LAYOUT_ID;

/** The available layouts, in menu order. */
export function available(): Layout[] {
  return LAYOUTS;
}

function forId(id: string): Layout {
  return LAYOUTS.find((l) => l.LAYOUT_ID === id) ?? beAzerty;
}

let activeId = "";

/** The active layout; the saved choice on first call, AZERTY when nothing is saved. */
export function active(): Layout {
  if (activeId === "") activeId = getChoice("layout", DEFAULT_ID);
  return forId(activeId);
}

export function activeLayoutId(): string {
  return active().LAYOUT_ID;
}

/** Persist + switch. An unknown id falls back to AZERTY (and is saved as such). */
export function setActive(id: string): void {
  activeId = forId(id).LAYOUT_ID;
  setChoice("layout", activeId);
}

/** Switch WITHOUT persisting (the ?layout= debug query, and tests). */
export function setActiveTransient(id: string): void {
  activeId = forId(id).LAYOUT_ID;
}

export function guidanceForChar(character: string): Guidance | null {
  return active().guidanceForChar(character);
}

export function keyboardRows(): string[][] {
  return active().keyboardRows();
}
