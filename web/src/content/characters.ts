// Playable hero roster (roadmap G1/G2). Faithful port of game/characters.gd. Each
// hero is a KayKit model on the shared Rig_Medium. The TYPED subject word per hero
// (the {held} token) lives in the LOCALE, keyed "hero.<id>".

export const DEFAULT_ID = "knight";
const ADV = "assets/kaykit/adventurers/";
const HERO = "assets/kaykit/heroes/";

export interface Character {
  id: string;
  model: string;
  label: string;
}

export const ALL: Character[] = [
  { id: "knight", model: ADV + "Knight.glb", label: "Ridder" },
  { id: "barbarian", model: ADV + "Barbarian.glb", label: "Barbaar" },
  { id: "mage", model: ADV + "Mage.glb", label: "Tovenaar" },
  { id: "ranger", model: ADV + "Ranger.glb", label: "Jager" },
  { id: "rogue", model: ADV + "Rogue.glb", label: "Dief" },
  { id: "witch", model: HERO + "Witch.glb", label: "Heks" },
];

function find(id: string): Character {
  return ALL.find((c) => c.id === id) ?? ALL[0];
}

export function modelFor(id: string): string {
  return find(id).model;
}

export function labelFor(id: string): string {
  return find(id).label;
}

// Per-class RANGED loadout for the boog/archery site (C-mini). Clips live in the
// shared CombatRanged/General animation sets. projectile "" -> reuse the weapon model.
export interface RangedLoadout {
  weapon: string;
  hand: string;
  spin: boolean;
  aim: string;
  fire: string;
  projectile: string;
}

export const RANGED: Record<string, RangedLoadout> = {
  knight: { weapon: "bow", hand: "handslot.l", spin: true, aim: "Ranged_Bow_Aiming_Idle", fire: "Ranged_Bow_Release", projectile: "arrow" },
  ranger: { weapon: "crossbow", hand: "handslot.r", spin: false, aim: "Ranged_1H_Aiming", fire: "Ranged_1H_Shoot", projectile: "bolt" },
  mage: { weapon: "wand", hand: "handslot.r", spin: false, aim: "Ranged_Magic_Spellcasting", fire: "Ranged_Magic_Shoot", projectile: "magic" },
  witch: { weapon: "wand", hand: "handslot.r", spin: false, aim: "Ranged_Magic_Spellcasting", fire: "Ranged_Magic_Shoot", projectile: "magic" },
  barbarian: { weapon: "axe", hand: "handslot.r", spin: false, aim: "Idle_A", fire: "Throw", projectile: "" },
  rogue: { weapon: "dagger", hand: "handslot.r", spin: false, aim: "Idle_A", fire: "Throw", projectile: "" },
};

export function rangedFor(id: string): RangedLoadout {
  return RANGED[id] ?? RANGED.knight;
}
