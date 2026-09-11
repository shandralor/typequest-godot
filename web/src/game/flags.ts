// AppProgress-lite: the non-identifying progress flags + choices (brief A5), in localStorage.
// Only flags (strings), the decorative hero id and coarse stats live here -- never identity.
const KEY = "tq_progress";

interface Store {
  flags: Record<string, boolean>;
  choices: Record<string, string>;
  /** cumulative effort counters that grow ACROSS runs (words, adventures, xp, stars) */
  stats: Record<string, number>;
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Store;
      return { flags: s.flags ?? {}, choices: s.choices ?? {}, stats: s.stats ?? {} };
    }
  } catch {
    /* fall through */
  }
  return { flags: {}, choices: {}, stats: {} };
}

let store = load();

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* storage blocked: progress stays in memory */
  }
}

export function getFlag(name: string): boolean {
  return !!store.flags[name];
}
export function setFlag(name: string, value = true): void {
  store.flags[name] = value;
  persist();
}
export function getChoice(name: string, def: string): string {
  return store.choices[name] ?? def;
}
export function setChoice(name: string, value: string): void {
  store.choices[name] = value;
  persist();
}
// --- cumulative stats (AppProgress.get_stat / add_stat) ------------------------
// Effort counters that add up across runs -- words typed, adventures finished, xp, stars.
// The semantics are CUMULATIVE (effort accumulates and is never spent), and privacy A5 holds:
// these are coarse counts, nothing identifying.

export function getStat(name: string): number {
  return store.stats[name] ?? 0;
}

export function addStat(name: string, delta: number): void {
  if (delta === 0) return;
  store.stats[name] = (store.stats[name] ?? 0) + delta;
  persist();
}

/** Every stat that has ever been counted (the menu totals read this). */
export function allStats(): Record<string, number> {
  return { ...store.stats };
}

/** Words in a piece of prose, the way the Godot build counts them (_word_count). */
export function wordCount(prose: string): number {
  return prose.split(" ").filter((w) => w !== "").length;
}

/**
 * Wipe progress: the `?reset` query and the Opties button. `keep` names choices that are NOT
 * progress and must survive -- the keyboard layout above all. A child starting the adventure
 * again has not moved to a different keyboard, and silently reverting them to AZERTY would
 * teach the wrong fingering from the next keystroke on.
 */
export function resetProgress(keep: readonly string[] = []): void {
  const kept: Record<string, string> = {};
  for (const k of keep) if (store.choices[k] !== undefined) kept[k] = store.choices[k];
  store = { flags: {}, choices: kept, stats: {} };
  persist();
}

/** The choices that are settings rather than progress, so a reset leaves them alone. */
export const SETTINGS_KEYS = ["layout", "muted"] as const;
