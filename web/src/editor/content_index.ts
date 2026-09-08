// Every authored scene module the editor can open, discovered at build time. This module is its
// own HMR boundary (self-accepting) so an editor save -- which rewrites one of these files --
// re-executes only this index, never the running editor (its working copy is the truth).
import type { SceneDef } from "../world/sceneDef";

export interface AuthoredScene {
  /** file stem, also the save name */
  name: string;
  /** content sub-folder: island | scenes */
  dir: "island" | "scenes";
  def: SceneDef;
}

const mods = import.meta.glob<Record<string, SceneDef>>("../content/{island,scenes}/*.ts", { eager: true });

export const AUTHORED: AuthoredScene[] = Object.entries(mods)
  .map(([path, mod]) => {
    const m = /\.\.\/content\/(island|scenes)\/([a-z0-9_]+)\.ts$/.exec(path);
    const def = Object.values(mod).find((v) => v && typeof v === "object" && Array.isArray((v as SceneDef).tiles));
    return m && def ? { name: m[2], dir: m[1] as "island" | "scenes", def } : null;
  })
  .filter((s): s is AuthoredScene => s !== null)
  .sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir === "island" ? -1 : 1));

export function findAuthored(name: string): AuthoredScene | undefined {
  return AUTHORED.find((s) => s.name === name);
}

if (import.meta.hot) import.meta.hot.accept();
