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
  /**
   * Yaw correction, in radians, for how the model sits in the grip. MEASURED off the model, not
   * guessed: a crossbow's stock runs along its local +Z, and in the hand that put the bolt
   * pointing 90 degrees across the lane while the hero aimed down it. A bow's aim is its local
   * -X and needs nothing. Check a new weapon's local bounding box before adding a number here.
   */
  gripTurn?: number;
}

export const RANGED: Record<string, RangedLoadout> = {
  knight: { weapon: "bow", hand: "handslot.l", spin: true, aim: "Ranged_Bow_Aiming_Idle", fire: "Ranged_Bow_Release", projectile: "arrow" },
  ranger: { weapon: "crossbow", hand: "handslot.r", spin: false, aim: "Ranged_1H_Aiming", fire: "Ranged_1H_Shoot", projectile: "bolt", gripTurn: Math.PI / 2 },
  mage: { weapon: "staff", hand: "handslot.r", spin: false, aim: "Ranged_Magic_Spellcasting", fire: "Ranged_Magic_Shoot", projectile: "magic" },
  witch: { weapon: "staff", hand: "handslot.r", spin: false, aim: "Ranged_Magic_Spellcasting", fire: "Ranged_Magic_Shoot", projectile: "magic" },
  barbarian: { weapon: "axe", hand: "handslot.r", spin: false, aim: "Idle_A", fire: "Throw", projectile: "" },
  rogue: { weapon: "dagger", hand: "handslot.r", spin: false, aim: "Idle_A", fire: "Throw", projectile: "" },
};

/**
 * The ranged loadout. `choice` is what the child picked up at home ("bow" / "crossbow") and it
 * WINS over the class default, because the owner's call is that the ranged weapon belongs to the
 * player, not the class. A caster keeps casting: a staf is the magic focus, not a bow rack.
 */
export function rangedFor(id: string, choice = ""): RangedLoadout {
  const base = RANGED[id] ?? RANGED.knight;
  if (weaponGroupFor(id) === "caster") return base;
  if (choice === "bow") return RANGED.knight;
  if (choice === "crossbow") return RANGED.ranger;
  return base;
}

/**
 * What the hero does at the forge, and which weapon hangs on their wall. A staf and a
 * kruisboog cannot be sharpened, so the smidse beat comes in three flavours rather than six:
 * blades grind on the stone, the ranger fletches arrows, casters study over the spellbook.
 * `melee` is the vocabulary id of the primary weapon (the {wapen} noun's model).
 */
export type WeaponGroup = "blades" | "ranged" | "caster";

const GROUPS: Record<string, { group: WeaponGroup; melee: string }> = {
  knight: { group: "blades", melee: "sword" },
  barbarian: { group: "blades", melee: "axe" },
  rogue: { group: "blades", melee: "dagger" },
  ranger: { group: "ranged", melee: "crossbow" },
  mage: { group: "caster", melee: "staff" },
  witch: { group: "caster", melee: "staff" },
};

/**
 * The looping animation for the forge beat. Only blades grind, so only they get the sawing
 * motion (and the spark shower that goes with it); fletching and studying are generic work.
 */
export const WORK_CLIPS: Record<WeaponGroup, string> = {
  blades: "Sawing",
  ranged: "Working_A",
  caster: "Working_A",
};

/**
 * What lies in front of the hero during the forge beat -- the thing the prose is about. Blades
 * put the weapon itself on the wheel; the ranger has a bundle of arrows; a caster has the open
 * spellbook. Without this the text named an object that was not on screen.
 */
export const WORK_PROPS: Record<WeaponGroup, string> = {
  blades: "",          // "" -> the hero's own melee weapon (meleeFor)
  ranged: "arrows",
  caster: "spellbook",
};

export function weaponGroupFor(id: string): WeaponGroup {
  return GROUPS[id]?.group ?? "blades";
}

/** Vocabulary id of the hero's primary weapon -- what {wapen} names, and what is staged. */
export function meleeFor(id: string): string {
  return GROUPS[id]?.melee ?? "sword";
}

/**
 * Does this hero's PRIMARY weapon already serve as their ranged weapon?
 *
 * A jager's kruisboog and a magier's staf are ranged weapons. Only the blade classes need a
 * separate bow or crossbow. Without this the practice yard demanded `has_ranged`, which only
 * the bow/crossbow fetch granted -- so a mage was told "Haal eerst een boog thuis!" and had to
 * carry a bow to cast with, and a jager fetched a plain boog on top of his crossbow.
 */
export function primaryIsRanged(id: string): boolean {
  return weaponGroupFor(id) !== "blades";
}
