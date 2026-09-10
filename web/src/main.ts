// TypeQuest -- the game entry and its state machine, mirroring game_controller.gd's app states:
// MENU (title over the island as a backdrop), PICKER (choose your hero on a turntable), ISLAND
// (type a site word, walk there) and SCENARIO (type the prose, pick forks). First run picks a
// hero and plays the wake-up intro once, then hands off to the island.

import * as THREE from "three";
import * as nlBe from "./axis/locale/nlBe";
import * as Characters from "./content/characters";
import { OVERWORLD } from "./content/island/overworld";
import { takeEditorIsland } from "./world/editorHandoff";
import { World } from "./game/world";
import { Hud } from "./ui/hud";
import { Menu, stepHero } from "./ui/menu";
import { MusicPlayer } from "./audio/musicPlayer";
import { OverworldMode } from "./game/overworldMode";
import { ScenarioMode } from "./game/scenarioMode";
import { getChoice, setChoice, getFlag, setFlag, resetProgress, allStats } from "./game/flags";
import { active as activeLayout, available as availableLayouts, setActive as setLayout, setActiveTransient } from "./game/keyboardSettings";
import { ISLAND_FOV, OW_IDLE_BIAS, OW_IDLE_ZOOM } from "./game/cameraRigs";

const locale = { resolve: nlBe.resolve, fillTokens: nlBe.fillTokens };
type State = "menu" | "picker" | "island" | "scenario";
/** the picker's close, slightly-raised hero shot (game_controller PICKER rig) */
const PICKER_RIG = { off: [0, 2.1, 6.4] as [number, number, number], look: [0, 1.15, 0] as [number, number, number], fov: 40, fixed: true };
/**
 * The menu framing. Retuned when the menu went fullscreen: at 1.5 the island overflowed the
 * left and bottom edges of the taller frame (measured: land spanned -0.14..0.96 across and
 * 0.16..0.99 down). Pulled back and the focus lifted so the whole island sits inside the
 * frame with the title above it. Menu only -- the playing island view is untouched.
 */
const MENU_ZOOM = 1.95;
/** the menu widens a touch so the title floats above the island (game_controller MAIN rig) */
const MENU_FOV = 34;
/** the menu looks at the island a little further north than the playing view does */
const MENU_BIAS = 1.5;
/** the picker stands the hero on a small grass pad, not the island (composer.compose_character) */
const PICKER_SCENE = { tiles: [], props: [], shapes: [{ kind: "plane" as const, size: [9, 9], color: "#5f7d42", x: 0, z: 0, name: "Ground" }] };

async function main(): Promise<void> {
  if (location.search.includes("reset")) resetProgress();
  // ?layout=qwerty swaps the keyboard axis for this session only (debug), the way --layout does
  const layoutArg = new URLSearchParams(location.search).get("layout");
  if (layoutArg) setActiveTransient(layoutArg);
  const canvas = document.getElementById("app") as HTMLCanvasElement;
  const world = new World(canvas, document.getElementById("fade")!);
  const hud = new Hud();
  const menu = new Menu();
  const music = new MusicPlayer();
  const backBtn = document.getElementById("back") as HTMLButtonElement;

  let state: State = "menu";
  /** bumped on every state entry; async continuations bail when they are no longer current */
  let stateGen = 0;
  // remembered across runs, like the layout: a parent who turns the music off should not have
  // to turn it off again every time the child opens the game
  let muted = getChoice("muted", "") === "1";
  const enterState = (s: State): number => {
    state = s;
    return ++stateGen;
  };
  let scenario: ScenarioMode | null = null;
  let heroId = getChoice("hero", Characters.DEFAULT_ID);
  let pickerIndex = Math.max(0, Characters.ALL.findIndex((c) => c.id === heroId));
  let pickerAfter: () => void = () => void showMenu();

  const modelPath = (id: string): string => Characters.modelFor(id).replace(/^(res:\/\/)?assets\//, "");
  await world.loadHero(modelPath(heroId));

  /**
   * The menu and the picker have no typing UI, so they take the whole window; the playing
   * states letterbox the stage above the brown band again. Set on <body>, styled in index.html.
   */
  function cinema(on: boolean): void {
    if (on) document.body.setAttribute("data-cinema", "1");
    else document.body.removeAttribute("data-cinema");
  }

  /** Hide every overlay; each state turns back on what it needs. */
  function clearUi(): void {
    menu.hide();
    menu.picker(null);
    hud.prompt("");
    hud.message("");
    hud.legend(null);
    hud.choices(null);
    hud.hideBand();
    hud.keyboard(false);
    hud.hands(false);
    hud.hideScore();
    backBtn.hidden = true;
  }

  // --- MENU: the island as a backdrop, pulled back so the title floats above it ---
  async function showMenu(): Promise<void> {
    const gen = enterState("menu");
    music.playContext("menu");
    scenario?.exit();
    scenario = null;
    clearUi();
    cinema(true);
    await world.loadScene(OVERWORLD, "island");
    if (gen !== stateGen) return;
    world.hero.node.position.copy(world.anchor("hub"));
    world.hero.face(0, 1);
    world.hero.setMoving(false);
    world.useIslandCamera(OVERWORLD.camera, { zoom: MENU_ZOOM, bias: MENU_BIAS, fov: MENU_FOV, snap: true });
    menu.totals(allStats());
    menu.show("TypeQuest", [
      { text: "Start", onPress: () => void startPressed() },
      { text: "Kies je held", onPress: () => showPicker(() => void showMenu()) },
      { text: "Opties", onPress: () => showOptions() },
    ]);
  }

  /**
   * OPTIONS: the settings a grown-up sets once for this child. The keyboard layout is the one
   * that matters -- the finger guidance is only correct for the board actually under their
   * hands, and a QWERTY child taught AZERTY fingering is being taught the wrong thing.
   * Each row cycles its own value and re-renders in place, so there is no OK/Cancel to explain.
   */
  function showOptions(): void {
    const layouts = availableLayouts();
    menu.totals(null);
    menu.show("Opties", [
      {
        text: `Toetsenbord: ${activeLayout().DISPLAY_NAME}`,
        onPress: () => {
          const i = layouts.findIndex((l) => l.LAYOUT_ID === activeLayout().LAYOUT_ID);
          setLayout(layouts[(i + 1) % layouts.length].LAYOUT_ID);
          hud.buildKeyboard(); // re-letter the board and re-aim the finger colours
          showOptions();
        },
      },
      {
        text: `Muziek: ${muted ? "uit" : "aan"}`,
        onPress: () => {
          muted = !muted;
          music.setMuted(muted);
          setChoice("muted", muted ? "1" : "0");
          showOptions();
        },
      },
      { text: "Terug", secondary: true, onPress: () => void showMenu() },
    ]);
  }

  /** First run picks a hero before anything else, then flows into the intro / island. */
  async function startPressed(): Promise<void> {
    if (getChoice("hero_chosen", "") === "") return showPicker(() => void afterHeroChosen());
    await afterHeroChosen();
  }

  async function afterHeroChosen(): Promise<void> {
    if (!getFlag("intro_seen")) return void startScenario("intro");
    await enterIsland("hub");
  }

  // --- PICKER: a turntable of the roster; arrows cycle, Enter chooses ---
  function showPicker(after: () => void): void {
    enterState("picker");
    music.playContext("menu");
    pickerAfter = after;
    clearUi();
    cinema(true);
    pickerIndex = Math.max(0, Characters.ALL.findIndex((c) => c.id === heroId));
    void updatePicker();
  }

  async function updatePicker(): Promise<void> {
    const gen = stateGen;
    const index = pickerIndex;
    const c = Characters.ALL[index];
    if (world.def !== PICKER_SCENE) await world.loadScene(PICKER_SCENE, "day");
    await world.loadHero(modelPath(c.id));
    // bail if the player moved on: without the index check a burst of picks could leave the
    // caption naming one hero while a later load put a different model on the pad
    if (gen !== stateGen || state !== "picker" || index !== pickerIndex) return;
    world.hero.node.position.set(0, 0, 0);
    world.hero.face(0, 1);
    world.useRig(PICKER_RIG, true);
    menu.picker(c.label);
  }

  async function choosePicked(): Promise<void> {
    const c = Characters.ALL[pickerIndex];
    heroId = c.id;
    setChoice("hero", c.id);
    setChoice("hero_chosen", "1");
    island.heroId = c.id; // the island's gear hints name this hero's weapon
    menu.picker(null);
    pickerAfter();
  }

  // --- ISLAND / SCENARIO ---
  async function enterIsland(at: string): Promise<void> {
    const gen = enterState("island");
    music.playContext("overworld");
    scenario?.exit();
    scenario = null;
    clearUi();
    cinema(false);
    hud.keyboard(true);
    await world.loadHero(modelPath(heroId)); // the picked hero travels the island
    if (gen !== stateGen) return;
    await island.enter(at);
  }

  async function startScenario(id: string): Promise<void> {
    enterState("scenario");
    music.playContext("adventure");
    clearUi();
    cinema(false);
    hud.keyboard(true);
    hud.hands(true); // per-finger coaching belongs to the prose, not the island's site words
    hud.score(0, 0);
    backBtn.hidden = false;
    scenario = new ScenarioMode(world, hud, locale, heroId, () => {
      // the intro plays once, then hands off to the island
      if (id === "intro") setFlag("intro_seen");
      void world.fadeCut(() => enterIsland(island.at));
    });
    await scenario.start(id);
  }

  const island = new OverworldMode(world, hud, locale, (site) => {
    void world.fadeCut(() => startScenario(site.scenario));
  });
  island.heroId = heroId;
  backBtn.onclick = () => void world.fadeCut(() => enterIsland(island.at));

  // an editor playtest stash shows that island instead of the authored one (look only)
  const stash = takeEditorIsland();
  if (stash) {
    state = "island";
    clearUi();
    await world.loadScene(stash, "island");
    world.useIslandCamera(stash.camera ?? OVERWORLD.camera, { zoom: OW_IDLE_ZOOM, bias: OW_IDLE_BIAS, fov: ISLAND_FOV, snap: true });
    world.hero.node.position.copy(world.anchor("hub"));
    world.hero.face(0, 1);
    hud.prompt("Playtest: island preview");
  } else {
    await showMenu();
  }

  // browsers refuse to play audio before the user interacts, so the first key or click starts
  // whichever context is already pending
  music.setMuted(muted); // honour the remembered choice before a single note plays
  const unlockMusic = (): void => music.unlock();
  window.addEventListener("keydown", unlockMusic, { once: true });
  window.addEventListener("pointerdown", unlockMusic, { once: true });

  window.addEventListener("keydown", (e) => {
    // Mute is CTRL+m, never a bare "m": m is a letter on the home row (right pinky on AZERTY),
    // so a bare shortcut swallowed it and the child could not type any word containing an m.
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "m" && !e.repeat) {
      e.preventDefault();
      muted = !muted;
      music.setMuted(muted);
      setChoice("muted", muted ? "1" : "0");
      hud.message(muted ? "Muziek uit (ctrl+m)" : "Muziek aan (ctrl+m)");
      window.setTimeout(() => hud.message(""), 1400);
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (state === "picker") {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        pickerIndex = stepHero(pickerIndex, e.key === "ArrowRight" ? 1 : -1);
        return void updatePicker();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        return void choosePicked();
      }
      return;
    }
    if (e.key === "Escape" && state === "scenario") return void world.fadeCut(() => enterIsland(island.at));
    if (e.key === "Escape" && state === "island") return void showMenu();
    if (e.key === "Enter") return scenario?.key("Enter");
    if (e.key.length !== 1) return;
    const c = e.key.toLowerCase();
    if (!/^[a-z .'\-]$/.test(c)) return;
    e.preventDefault();
    if (state === "island") island.char(c);
    else if (state === "scenario") scenario?.char(c);
  });

  if (!location.search.includes("nopost")) world.s.setupPost();
  let last = performance.now();
  const tick = (): void => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (state === "island") island.update(dt);
    else if (state === "scenario") scenario?.update(dt);
    world.update(dt);
  };
  tick();
  document.body.setAttribute("data-ready", "1");
  world.s.renderer.setAnimationLoop(tick);
  // harness hooks: drive the game from a script + pause the loop for captures
  const w = window as unknown as Record<string, unknown>;
  w.__game = {
    world,
    island,
    menu,
    get scenario() {
      return scenario;
    },
    get state() {
      return state;
    },
    get active() {
      return state === "scenario" ? "scenario" : "island";
    },
    get heroId() {
      return heroId;
    },
    start: () => void startPressed(),
    pick: (dir: number) => {
      pickerIndex = stepHero(pickerIndex, dir);
      return updatePicker();
    },
    choose: () => choosePicked(),
    menuHome: () => showMenu(),
    goIsland: (at = "hub") => enterIsland(at),
    char: (c: string) => (state === "island" ? island.char(c) : scenario?.char(c)),
    enter: () => scenario?.key("Enter"),
    type: (s: string) => {
      for (const c of s) if (state === "island") island.char(c);
      else scenario?.char(c);
    },
    heroYaw: () => +(world.hero.node.rotation.y as number).toFixed(3),
    heroPos: () => world.hero.node.position.toArray().map((n: number) => +n.toFixed(2)),
    camInfo: () => ({ fov: world.s.camera.fov, pos: world.s.camera.position.toArray().map((n: number) => +n.toFixed(2)) }),
  };
  w.__THREE = THREE;
  w.__music = music;
  w.__pause = () => world.s.renderer.setAnimationLoop(null);
  w.__resume = () => world.s.renderer.setAnimationLoop(tick);
}

main().catch((err) => {
  console.error(err);
  document.body.setAttribute("data-error", String(err));
});
