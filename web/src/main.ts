// TypeQuest -- the game entry. One World (the shared island renderer), a HUD, and two modes:
// the island (type a site word, walk there) and a scenario (type the prose, pick forks). The
// editor's playtest stash, when present, replaces the island for a look.

import * as nlBe from "./axis/locale/nlBe";
import * as Characters from "./content/characters";
import { OVERWORLD } from "./content/island/overworld";
import { takeEditorIsland } from "./world/editorHandoff";
import { World } from "./game/world";
import { Hud } from "./ui/hud";
import { OverworldMode } from "./game/overworldMode";
import { ScenarioMode } from "./game/scenarioMode";
import { getChoice, resetProgress } from "./game/flags";

const locale = { resolve: nlBe.resolve, fillTokens: nlBe.fillTokens };

async function main(): Promise<void> {
  if (location.search.includes("reset")) resetProgress();
  const canvas = document.getElementById("app") as HTMLCanvasElement;
  const world = new World(canvas, document.getElementById("fade")!);
  const hud = new Hud();
  const heroId = getChoice("hero", Characters.DEFAULT_ID);
  await world.loadHero(Characters.modelFor(heroId).replace(/^(res:\/\/)?assets\//, ""));

  let active: "island" | "scenario" = "island";
  let scenario: ScenarioMode | null = null;
  const backBtn = document.getElementById("back") as HTMLButtonElement;

  const island = new OverworldMode(world, hud, locale, (site) => {
    void world.fadeCut(async () => {
      active = "scenario";
      backBtn.hidden = false;
      scenario = new ScenarioMode(world, hud, locale, heroId, () => void backToIsland());
      await scenario.start(site.scenario);
    });
  });
  const backToIsland = (): Promise<void> =>
    world.fadeCut(async () => {
      scenario?.exit();
      scenario = null;
      active = "island";
      backBtn.hidden = true;
      await island.enter(island.at);
    });
  backBtn.onclick = () => void backToIsland();

  // an editor playtest stash shows that island instead of the authored one (look only)
  const stash = takeEditorIsland();
  if (stash) {
    await world.loadScene(stash, false);
    world.useSceneCamera(stash.camera ?? OVERWORLD.camera);
    world.hero.node.position.copy(world.anchor("hub"));
    world.hero.face(0, 1);
    hud.prompt("Playtest: island preview");
  } else {
    await island.enter("hub");
  }

  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape" && active === "scenario") return void backToIsland();
    if (e.key === "Enter") return scenario?.key("Enter");
    if (e.key.length !== 1) return;
    const c = e.key.toLowerCase();
    if (!/^[a-z .'\-]$/.test(c)) return;
    e.preventDefault();
    if (active === "island") island.char(c);
    else scenario?.char(c);
  });

  if (!location.search.includes("nopost")) world.s.setupPost();
  let last = performance.now();
  const tick = (): void => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (active === "island") island.update(dt);
    else scenario?.update(dt);
    world.update(dt);
  };
  tick();
  document.body.setAttribute("data-ready", "1");
  world.s.renderer.setAnimationLoop(tick);
  // harness hooks: drive the game from a script + pause the loop for captures
  const w = window as unknown as Record<string, unknown>;
  w.__game = { world, island, get scenario() { return scenario; }, get active() { return active; }, char: (c: string) => (active === "island" ? island.char(c) : scenario?.char(c)), enter: () => scenario?.key("Enter"), type: (s: string) => { for (const c of s) (active === "island" ? island.char(c) : scenario?.char(c)); } };
  w.__pause = () => world.s.renderer.setAnimationLoop(null);
  w.__resume = () => world.s.renderer.setAnimationLoop(tick);
}

main().catch((err) => {
  console.error(err);
  document.body.setAttribute("data-error", String(err));
});
