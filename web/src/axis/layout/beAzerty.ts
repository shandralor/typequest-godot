// Keyboard-layout axis (brief A3/A8): Belgian AZERTY. Faithful port of
// axis/layout/be_azerty.gd. Maps a physical key POSITION (US-QWERTY label) to the
// character it produces and the finger that presses it. Swap this table for QWERTY
// and the same prose is taught on another layout with no logic change.

const L_PINKY = "left_pinky";
const L_RING = "left_ring";
const L_MIDDLE = "left_middle";
const L_INDEX = "left_index";
const R_INDEX = "right_index";
const R_MIDDLE = "right_middle";
const R_RING = "right_ring";
const R_PINKY = "right_pinky";
const THUMB = "thumb";

export const LAYOUT_ID = "azerty";
export const DISPLAY_NAME = "AZERTY";
export const HOME_ANCHORS = ["F", "J"];

// [US-position label, produced char, finger]
const ROWS: [string, string, string][] = [
  ["Q", "a", L_PINKY], ["W", "z", L_RING], ["E", "e", L_MIDDLE], ["R", "r", L_INDEX],
  ["T", "t", L_INDEX], ["Y", "y", R_INDEX], ["U", "u", R_INDEX], ["I", "i", R_MIDDLE],
  ["O", "o", R_RING], ["P", "p", R_PINKY],
  ["A", "q", L_PINKY], ["S", "s", L_RING], ["D", "d", L_MIDDLE], ["F", "f", L_INDEX],
  ["G", "g", L_INDEX], ["H", "h", R_INDEX], ["J", "j", R_INDEX], ["K", "k", R_MIDDLE],
  ["L", "l", R_RING], ["SEMICOLON", "m", R_PINKY],
  ["Z", "w", L_PINKY], ["X", "x", L_RING], ["C", "c", L_MIDDLE], ["V", "v", L_INDEX],
  ["B", "b", L_INDEX], ["N", "n", R_INDEX],
  ["SPACE", " ", THUMB], ["PERIOD", ".", R_RING],
];

export const KEYBOARD_ROWS = [
  ["a", "z", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["q", "s", "d", "f", "g", "h", "j", "k", "l", "m"],
  ["w", "x", "c", "v", "b", "n"],
];

const charMap = new Map<string, { position: string; finger: string }>();
const positionMap = new Map<string, string>();
for (const [position, character, finger] of ROWS) {
  charMap.set(character, { position, finger });
  positionMap.set(position, character);
}

export function charAtPosition(position: string): string {
  return positionMap.get(position) ?? "";
}

export function guidanceForChar(
  character: string
): { position: string; finger: string; isHomeAnchor: boolean } | null {
  const entry = charMap.get(character);
  if (!entry) return null;
  return { position: entry.position, finger: entry.finger, isHomeAnchor: HOME_ANCHORS.includes(entry.position) };
}

// True if every character of `text` is typeable on this layout (validator use).
export function supportsText(text: string): boolean {
  for (const ch of text) {
    if (!charMap.has(ch)) return false;
  }
  return true;
}

export function keyboardRows(): string[][] {
  return KEYBOARD_ROWS;
}

export const beAzerty = { LAYOUT_ID, DISPLAY_NAME, supportsText, guidanceForChar, charAtPosition, keyboardRows };
