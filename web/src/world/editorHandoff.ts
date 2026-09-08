// Editor -> game playtest handoff (the world-of-claudecraft shape): the editor stashes the
// working IslandDef in sessionStorage and opens the game; the game reads the key ONCE (and
// removes it) and boots into that island instead of the authored one. The game imports only
// this small module, never the editor, so editor code stays out of the game bundle.

import type { IslandDef } from "./hexGrid";
import { sanitizeIslandDef } from "../editor/island_doc";

export const EDITOR_ISLAND_KEY = "tq_editor_island";

export function stashEditorIsland(def: IslandDef): void {
  sessionStorage.setItem(EDITOR_ISLAND_KEY, JSON.stringify(def));
}

/** Take (read + remove) a stashed island, or null. Never throws. */
export function takeEditorIsland(): IslandDef | null {
  try {
    const raw = sessionStorage.getItem(EDITOR_ISLAND_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(EDITOR_ISLAND_KEY);
    return sanitizeIslandDef(JSON.parse(raw));
  } catch {
    return null;
  }
}
