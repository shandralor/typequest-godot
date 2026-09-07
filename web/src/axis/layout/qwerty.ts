// Keyboard-layout axis (brief A3/A8): US QWERTY, the second supported layout.
// Faithful port of axis/layout/qwerty.gd. Same DATA contract as beAzerty. On QWERTY
// the position label IS the letter for letters; `m` sits on the bottom row.

const L_PINKY = "left_pinky";
const L_RING = "left_ring";
const L_MIDDLE = "left_middle";
const L_INDEX = "left_index";
const R_INDEX = "right_index";
const R_MIDDLE = "right_middle";
const R_RING = "right_ring";
const R_PINKY = "right_pinky";
const THUMB = "thumb";

export const LAYOUT_ID = "qwerty";
export const DISPLAY_NAME = "QWERTY";
export const HOME_ANCHORS = ["F", "J"];

const ROWS: [string, string, string][] = [
  ["Q", "q", L_PINKY], ["W", "w", L_RING], ["E", "e", L_MIDDLE], ["R", "r", L_INDEX],
  ["T", "t", L_INDEX], ["Y", "y", R_INDEX], ["U", "u", R_INDEX], ["I", "i", R_MIDDLE],
  ["O", "o", R_RING], ["P", "p", R_PINKY],
  ["A", "a", L_PINKY], ["S", "s", L_RING], ["D", "d", L_MIDDLE], ["F", "f", L_INDEX],
  ["G", "g", L_INDEX], ["H", "h", R_INDEX], ["J", "j", R_INDEX], ["K", "k", R_MIDDLE],
  ["L", "l", R_RING],
  ["Z", "z", L_PINKY], ["X", "x", L_RING], ["C", "c", L_MIDDLE], ["V", "v", L_INDEX],
  ["B", "b", L_INDEX], ["N", "n", R_INDEX], ["M", "m", R_INDEX],
  ["SPACE", " ", THUMB], ["PERIOD", ".", R_RING],
];

export const KEYBOARD_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
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

export function supportsText(text: string): boolean {
  for (const ch of text) {
    if (!charMap.has(ch)) return false;
  }
  return true;
}

export function keyboardRows(): string[][] {
  return KEYBOARD_ROWS;
}

export const qwerty = { LAYOUT_ID, DISPLAY_NAME, supportsText, guidanceForChar, charAtPosition, keyboardRows };
