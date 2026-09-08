// The overworld's adventure sites: pure DATA (port of content/overworld.gd). Each site is a
// spot on the island the child travels to by TYPING its word. `anchor` and `route` name an
// anchor / route authored in src/content/island/overworld.ts. Gating keys are progress flags:
// unlock_flag hard-locks the site until set; requires_flag + hint_key soft-gate it; done_flag
// marks the objective complete (the site stays open for practice).

export interface Site {
  id: string;
  wordKey: string;
  scenario: string;
  anchor: string;
  route: string;
  unlockFlag?: string;
  requiresFlag?: string;
  hintKey?: string;
  doneFlag?: string;
}

export const SITES: Site[] = [
  { id: "bos", wordKey: "site.bos", scenario: "band1", anchor: "site_bos", route: "route_bos" },
  { id: "smidse", wordKey: "site.smidse", scenario: "grind", anchor: "site_smidse", route: "route_smidse", unlockFlag: "met_skeleton", requiresFlag: "has_sword", hintKey: "hint.smidse", doneFlag: "sword_sharp" },
  { id: "boog", wordKey: "site.boog", scenario: "archery", anchor: "site_boog", route: "route_boog", unlockFlag: "met_skeleton", requiresFlag: "has_ranged", hintKey: "hint.boog", doneFlag: "archery_done" },
  { id: "thuis", wordKey: "site.thuis", scenario: "home", anchor: "site_home", route: "route_home", unlockFlag: "met_skeleton" },
  { id: "molen", wordKey: "site.molen", scenario: "mill", anchor: "site_molen", route: "route_molen", unlockFlag: "met_skeleton", doneFlag: "molen_tip" },
];

export function siteByAnchor(anchor: string): Site | undefined {
  return SITES.find((s) => s.anchor === anchor);
}
