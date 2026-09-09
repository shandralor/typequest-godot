// Asset vocabulary `fantasy-poc` (brief A7/B4): id -> asset path. Faithful port of
// axis/vocabulary/fantasy_poc.gd. Content names scene elements BY ID; swap the paths
// to swap the art pack. Unknown id -> "" (the composer renders a loud placeholder).
// Location ids (forest_path, dungeon) are NOT here -- a location is composed, not a model.

export const ID = "fantasy-poc";

export const ASSETS: Record<string, string> = {
  // characters
  hero: "assets/kaykit/adventurers/Knight.glb",
  skeleton: "assets/kaykit/skeletons/Skeleton_Warrior.glb",
  molenaar: "assets/kaykit/heroes/Farmer_A.glb",
  // props
  chest: "assets/kaykit/dungeon/chest_gold.gltf",
  bridge: "assets/kaykit/resource_bits/Wood_Planks_Stack_Large.gltf",
  grindstone: "assets/kaykit/rpgtools_bits/grindstone.gltf",
  anvil: "assets/kaykit/rpgtools_bits/anvil.gltf",
  sword: "assets/kaykit/adventurers/sword_1handed.gltf",
  bow: "assets/kaykit/adventurers/bow_withString.gltf",
  // per-class ranged weapons + projectiles (C-mini)
  crossbow: "assets/kaykit/adventurers/crossbow_1handed.gltf",
  wand: "assets/kaykit/adventurers/wand.gltf",
  staff: "assets/kaykit/adventurers/staff.gltf",
  spellbook: "assets/kaykit/adventurers/spellbook_open.gltf",
  arrows: "assets/kaykit/adventurers/arrow_bow_bundle.gltf",
  axe: "assets/kaykit/fantasy_weapons_bits/axe_C.gltf",
  dagger: "assets/kaykit/fantasy_weapons_bits/dagger_A.gltf",
  arrow: "assets/kaykit/adventurers/arrow_bow.gltf",
  bolt: "assets/kaykit/adventurers/arrow_crossbow.gltf",
};

export function resolve(assetId: string): string {
  return ASSETS[assetId] ?? "";
}
