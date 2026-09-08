// AppProgress-lite: the non-identifying progress flags + choices (brief A5), in localStorage.
// Only flags (strings), the decorative hero id and coarse stats live here -- never identity.
const KEY = "tq_progress";

interface Store {
  flags: Record<string, boolean>;
  choices: Record<string, string>;
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Store;
      return { flags: s.flags ?? {}, choices: s.choices ?? {} };
    }
  } catch {
    /* fall through */
  }
  return { flags: {}, choices: {} };
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
/** Debug: wipe progress (the `?reset` query does this). */
export function resetProgress(): void {
  store = { flags: {}, choices: {} };
  persist();
}
