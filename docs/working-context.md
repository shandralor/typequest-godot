# Working context (LIVE)

Update this at the end of every session: current state + next step. This plus
CLAUDE.md is how another device picks up the work (git pull -> read these).

## Editable scenes (HOW TO TWEAK VISUALS)

Static scenery is authored as **editable scenes** in `scenes/sets/` (owner rule:
EVERY location gets one):
- `forest_straight.tscn` (start, schat), `forest_fork.tscn` (kruispunt, naGrot --
  includes the cave mouth + bridge landmark), `forest_bridge.tscn` (brug -- river +
  bridge), `dungeon.tscn` (grot), `forge.tscn` (slijpen -- grindstone + anvil yard),
  `overworld.tscn` (the island: hex tiles, buildings, site_* arrival markers,
  route_* Path3D walk curves, camera_pos/camera_look framing markers).

Open any of these in the Godot editor and move/add/delete the ground, path, trees,
cave rocks, bridge, walls, tiles, buildings, or the named Marker3D **anchors** --
the game instances the set and reads those anchors (and the overworld's Path3D
routes: bend a curve and the knight follows your road). Dynamic things (the hero,
the chest + its glow, mood lighting, walking/gaze/camera) stay in code and are NOT
in these sets.

Bake sets from code with
`godot --headless --script res://tools/bake_sets.gd -- <set> [<set> ...]` -- the
tool only bakes the sets you NAME and lists them when run bare, so a hand-edited
set is never overwritten by accident. Baking OVERWRITES the named set. If a set
file is missing, the composer falls back to building it procedurally.

## Slijplied extended + spark ramp (2026-07-13)

The grinding song (slijpen.prose) was tripled (4 -> 12 short sentences, still words
<=7 / <=10 words per sentence; new safety hash fnv1a:4519ccbd -- recomputed as the
sign-off for the new authored prose, A4). The grind sparks now intensify with typing
progress: bigger + flung higher/wider toward the end, and the emission colour ramps
red-orange -> gold -> white-hot -> BLUE in the final third (scene_composer
set_lead_work + _spark_color). Note: the sparks are unshaded+emissive, so the glow
reads from _spark_mat.emission -- drive that, not just CPUParticles3D.color.

## Music (2026-07-14)

Background music added: `audio/music_player.gd` (a crossfading, shuffled playlist
per CONTEXT; presentation layer, not pure logic). Tracks live in
`assets/audio/music/<context>/` -- `menu/`, `overworld/`, `adventure/` (5 .ogg each,
a curated calm/exploration selection). game_controller calls play_context on the
menu / overworld / scenario transitions. Empty context folder = silence, no error.
Music is **AlkaKrab** (royalty-free, https://alkakrab.itch.io) -- credited prominently
in the new root README.md + CREDITS.md for exposure (repo will be open-source). Full
65-track pack lives in the shared `game-dev/_music-assets/` (copy in more per the
workspace convention; the godot/ subfolder has .ogg/.wav ready to use). To add a
context: make a folder + one play_context call. Per-scenario music is an easy next
step (e.g. a smithy theme for the grind via City-Town Ambient).

## Main menu visual rework (2026-07-14)

The main menu (AppState.MAIN) now shows the island backdrop FULL-SCREEN (no bottom
UI band -- `_set_menu_fullscreen`), zoomed out + lifted (camera v_offset) so the
title floats above the island and the buttons sit below it. Start/Stoppen are equal
size + font (only the panel colour differs -- menu_banner.gd), side by side, low.
Title is a KayKit cloth banner (single banner_red laid horizontal, pole on the left)
BAKED to a transparent PNG (`tools/bake_title_banner.gd` -> `assets/ui/title_banner.png`),
shown as a 2D plate. Title text + banner are rendered together in a SubViewport
(scenes/menu/menu_screen.tscn: TitleWaver>TitleVP>{TitleBanner,Title}) and the cloth-
wave shader is applied to the container so text + banner ripple as ONE. Clouds drift
across the sky (composer _spawn_clouds/_process; wrap at +-62 so they never pop in
view; clouds matched by name OR instanced-scene path so set clouds aren't missed).
To re-bake the banner in another colour: edit BANNER in tools/bake_title_banner.gd
and run `godot --script res://tools/bake_title_banner.gd` (needs a GPU, not headless).

## Overworld picker polish + navigation (2026-07-14)

- Site labels (bos/smidse/boog) are smaller (ChoiceBanner.set_compact) and float
  higher (OW_BANNER_LIFT 7.2) so they clear the hexes; the island is zoomed out a
  touch (1.12) for sky room.
- The prompt moved to a small brown top bar (`_top_bar`/`_set_top_prompt`); the
  bottom band now shows only the typed word (`_type_along.set_plain(_ow_buffer)`) +
  the keyboard.
- Instructions are grammatically capitalised now (narration, win, prompt) -- these
  are read, never typed. The typed PROSE and choice/site words stay lowercase (no
  Shift in the PoC).
- Choosing a site: the camera does a small dolly-in and follows the knight along the
  path it walks (camera rig overworld branch, when `_ow_walk != null`).
- Leaving a scenario: a "Terug" back button (top-left, shown while PLAYING) returns
  to the island at the site you came from; ESC now navigates back too (PLAYING ->
  island -> main menu -> quit) instead of quitting mid-scenario.

## Archery scenario -- boogschieten (2026-07-14)

The `boog` island site now plays: a single-node WIN scenario where the child types
an archery rhyme (`boog.prose`) while a red crosshair drifts over a downrange target
and STEADIES toward a ring as each sentence is typed. Longer sentences land their
arrow CLOSER to the bullseye, so the four arrows march inward across the prose
(`_setup_archery` maps sentence length -> ring radius; golden-angle spread). Files:
`content/archery/archery_arc.gd` (START_ID boogschieten, location archery_range,
hash fnv1a:22c8fd9e), the composer's archery block (`_static_archery`,
`_build_archery_target`, `set_crosshair`, `fire_arrow`, `_make_crosshair`), and the
controller's `_setup_archery`/`_update_archery`/`_archery_check_fire`. Registered in
scenarios.gd, overworld.gd (unlocked), content_validator LOCATION_IDS, test_content.

Staging notes (learned the hard way, keep them):
- The knight uses the KayKit `Rig_Medium_CombatRanged.glb` clips
  (`Ranged_Bow_Aiming_Idle` held, `Ranged_Bow_Release` per shot), grafted like the
  other rigs. These clips are authored facing the OPPOSITE way from the idle/walk
  clips, so the archer faces downrange at yaw 180 (facing "downrange" in _face), NOT
  yaw 0.
- The B3 gaze system (`_setup_gaze`) forced `set_lead_yaw(0)` on standing scenes and
  overrode the archer's facing -- it now early-returns for archery (like walking) so
  the render-authored downrange facing holds.
- The bow model's default grip points the string downrange; the prop gets a 180 deg
  local-Y spin (`bow.rotate_object_local(Vector3.UP, PI)`) so the string faces the
  archer and the belly/arrow-rest faces the target.
- Camera: over-the-shoulder down the lane (knight foreground, bow glimpsed at his
  side, target ahead). Reference render: `.shots/arch_final.png`.

ROADMAP (owner deferred, do NOT build yet): an alternate/added mode where fewer
typing ERRORS land the shot closer to center (accuracy -> tighter grouping), on top
of the current sentence-length mapping. Must still respect A6 (no speed at band-1).

## START HERE

For a full implementation guide (architecture, how to run/test/screenshot, how to
add scenarios/scenes/clips), read **docs/godot-handoff.md**. This file is just the
rolling state + next step.

## Current state (2026-07-02, end of session)

THE OVERWORLD EXISTS. The scenario menu is replaced by a small hex ISLAND
(KayKit Medieval Hexagon, one screen): the knight stands at a road hub; the child
TYPES a site word to travel -- bos (forest -> band1 arc), smidse (blacksmith ->
grind), boog (archery range -- a greyed TEASER until that scenario exists). The
knight walks the editable Path3D route, the scenario starts on arrival, and the
win + Enter puts the knight back on the island at that site. ESC on the island ->
main menu (Start/Stoppen, island backdrop). Typed site selection is PREFIX-matched
so bos/boog style shared prefixes never shadow a site (content test enforces no
word is a prefix of another); the keyboard guide lights a key only once the prefix
singles a site out. A bare `--demo` now plays from the island like a child would.
Owner decisions captured: picker-first (unlocks bolt on with profiles A5), typed
navigation, knight walks the roads, small island now but nothing in code assumes
one screen (banners project from 3D anchors, camera framing lives in the set's
markers, fov 30 tele because the wide 1920x680 viewport makes fov 75 fisheye).

Also this session: bake_sets.gd now bakes ONLY named sets (protects hand-edited
ones); forge.tscn baked so the grind scene is hand-editable too (owner rule);
review findings from the fresh-clone verification pass captured as tasks.

## Queued small issues -- ALL FIXED (2026-07-13)

- FIXED: prerevealed prose (naGrot) now stays visible in the panel during the choice
  (_show_banners keeps the type-along shown + re-sets the plain prose when the node
  is prerevealed).
- FIXED: at an OPEN fork the keyboard guidance no longer lights a key (neutral, does
  not steer); a SINGLE choice is still guided. _highlight_choice.
- FIXED: WIN hides the empty type-along panel; the win/setback message has a dark
  translucent stylebox backdrop for legibility over bright sky (_set_message toggles
  it so it only shows when there is text).
- FIXED: --demo prefers a non-setback branch at a fork (_demo_choice_word), so
  autoplay walks through to the win instead of looping the grot detour.

## Smidse (forge) win -- FIXED (2026-07-13)

The owner added walls to forge.tscn (a 3-wall smithy, open toward the camera). The
old win camera swung far front-left and swept past the side wall, exposing its
exterior + the open field. Fix (owner's idea): keep the SAME frontal angle as the
grinding shot and, at the win, VANISH the grindstone in a puff of smoke to reveal the
cheering knight (composer.vanish_grindstone + _puff_smoke; _find_child_containing
locates the "grindstone*" node in the set). No camera swing = no exposed walls.

## Next step (pick up here)

The archery scenario (boog) is now DONE (see the section above). Likely next:
profiles (A5) so XP/stars persist and island sites can be EARNED, the accuracy ->
closer-to-center archery mode on the roadmap above, or porting the known-good logic
milestone. Keep adventures short.

## Older state (kept for reference)


**Milestone 1 -- COMPOSITION LOOP -- DONE (judged good by the owner).**
**Milestone 2 -- LOGIC PORT -- DONE (pure GDScript, all tests green).**
**Milestone 3 -- PLAYABLE GAME LOOP -- DONE (first full vertical slice).**

### Milestone 3: the playable loop (scenes/game.tscn, the main scene)

The whole band1-arc is playable: physical AZERTY input -> type-along with the
reveal window -> finger-guided on-screen keyboard -> scoring -> traversal ->
re-compose the next scene, through the grot setback, the pre-revealed naGrot, and
the win. Reference render: `.shots/game.png`.

- `input/azerty_input.gd` (B1): Godot physical_keycode -> position -> AZERTY char,
  OS-layout-independent. Engine-specific KEY_* map lives here; the layout stays pure.
- `ui/type_along.gd` (B5): reveal window on a Kenney panel -- typed text solid, next
  char highlighted, faint runway, hidden tail; cursor-following scroll.
- `ui/keyboard_guide.gd` (B6): on-screen keyboard, next key lit by finger colour,
  f/j home anchor marked; Kenney square buttons.
- `render/scene_composer.gd`: now progress-driven (set_lead_progress/_moving from
  observed state, B3) + a dungeon location builder for grot.
- `logic/{scene_activity,reveal_window}.gd`: pure B3/B5 helpers (tested in
  tests/test_render_logic.gd).
- `game/game_controller.gd` + `scenes/game.tscn`: the orchestrator. Layout = 3D
  scene on top, opaque UI band below (no overlap). `--demo` autoplays; `--shot`
  captures. Set as run/main_scene.
- UI art: Kenney UI Pack RPG (CC0) in `assets/kenney/ui_rpg/` (see CREDITS.md).

Owner feedback addressed this milestone: UI moved below the scene (was overlapping);
all keyboard rows now render; type-along scrolls past the first line.


### Milestone 2: the pure logic layer + axis data + band-1 content

Ported the known-good logic as pure GDScript (no Node/Input/render -- enforced by a
purity guard test). All four headless suites pass (`bash tests/run.sh`):
- `tests/test_fnv1a.gd` -- the six A7 safety hashes reproduce EXACTLY. No prose
  encoding fix was needed; nothing was re-stamped (brief A4 honored).
- `tests/test_logic.gd` -- scoring (A6, incl. fast-sloppy-cannot-win), typing +
  progress primitive (B7), full traversal incl. grot setback->naGrot, pre-revealed
  no-score, score-once-per-run.
- `tests/test_content.gd` -- ContentValidator: hashes match, choice/return targets
  exist, band limits hold, ids resolve, band carries no key/finger term, prose
  typeable on AZERTY.
- `tests/test_purity.gd` -- zero engine refs in logic/axis/content.

New files: `logic/{fnv1a,seeded_rng,typing,scoring,story_graph,run_state,content_validator}.gd`,
`axis/locale/nl_be.gd`, `axis/layout/be_azerty.gd`,
`content/band1/{band_spec,band1_arc}.gd`, all six scene descriptors in
`content/band1/scene_descriptors.gd`.

### Milestone 1: the composition loop (recap)

One band-1 scene (`start`, forest_path) composed from a scene descriptor resolved
through the asset vocabulary, with real CC0 KayKit models. Open `scenes/start.tscn`
in the editor; press F5 to see the knight walk the path. Owner judged it good;
known deferral: locomotion/animation is B3 (the walk currently slides, no clip).

What exists:
- `logic/scene_descriptor.gd` -- pure SceneDescriptor + ActorPlacement/PropPlacement.
- `content/band1/scene_descriptors.gd` -- the `start` scene descriptor only.
- `axis/vocabulary/fantasy_poc.gd` -- id -> KayKit resource (hero, skeleton, chest,
  chest_gold, bridge). Locations are composed, not single models.
- `render/scene_composer.gd` -- imperative composer: builds forest_path (ground +
  dirt path + named anchors + deterministic foliage scatter), mood lighting, places
  actors/props on anchors, walks the protagonist (B4 exception), RED placeholder for
  unknown ids.
- `scenes/start.{tscn,gd}` -- @tool harness; composes live in the editor and on run.
  Set as `run/main_scene`.
- `assets/kaykit/**` -- 7 CC0 packs, gltf/glb + atlas only (507 models). See CREDITS.md.

Still NOT done (next milestones): wiring the logic to the render layer -- the actual
game loop. That means: input reading physical key positions via Godot InputEvent ->
the AZERTY layout table (B1); the type-along text UI with the reveal window (B5);
finger-guidance on-screen keyboard (B6); driving the SceneComposer per story node as
the run advances; SceneActivity-driven character animation with hysteresis + real
walk clips (B3); the setback vignette + win flash/chest-open; and profiles (A5,
local in-memory/file ProfileStore first). The other five scenes (kruispunt, grot,
naGrot, brug, schat) also need composing (grot needs a dungeon location builder).

### Milestone 4: art/staging polish pass (2026-06-27)

- Window is now 1920x1080 (VIEW_HEIGHT 680 / BAND_HEIGHT 400). UI scaled up.
- Forest scenes are much larger than the camera view (56x140 ground + a treeline
  ring + distance fog) so the horizon edge is never visible (immersion). Each
  forest scene is seeded by node id, so they differ.
- Fork-in-the-road geometry for fork scenes (kruispunt, naGrot): the path splits,
  with a cave mouth on the left and a small bridge on the right.
- Hero GAZE on standing scenes: at kruispunt the hero turns to look at the cave
  while typing that part, then the bridge; naGrot looks at the bridge; schat faces
  the chest. Driven by cursor position vs prose keywords (game_controller gaze).
- Camera framing adapts per scene: close follow while walking, a wide raised
  establishing shot at the fork, medium otherwise.
- Real bridge scene (brug): a blue river crossing the path with a plank bridge
  deck/rails/posts the hero walks across (replaced the wrong Wood_Planks prop).
- Dungeon (grot) now has a ceiling -- no sky leak.
- Win (schat): a larger gold chest in a glowing clearing (OmniLight + bushes).
- Composer is still imperative (B4); `compose(descriptor, variant)` takes the node
  id only as a staging seed -- it never reaches the logic layer.

### B3 animation + choice banners (2026-06-27, later)

- The hero is now an ANIMATED rig (B3): built from KayKit Rig_Medium_General.glb
  (mesh + Idle_A) with Walking_A grafted in from Rig_Medium_MovementBasic.glb (same
  rig, tracks resolve). Driven by SceneActivity: walk while moving, idle at rest,
  cross-faded. The mannequin_texture is re-applied (the General mesh imports gray).
  Combined with progress-travel, the hero actually walks. See scene_composer
  _build_hero / set_lead_animation.
- Choices are waving banners now (ui/choice_banner.gd): Kenney blue panel + cloth
  wave shader + sway + direction arrow + typed highlight, not the prose box.

### Menu shell + Knight hero (2026-06-27, later)

- The hero is the KayKit Adventurers Knight (assets/kaykit/adventurers), animated by
  grafting Idle_A/PickUp/Walking_A onto its Rig_Medium (scene_composer _build_hero).
- Menu shell closes the loop: Main menu (Start) -> scenario menu (one entry, the
  band-1 arc) -> play -> at the win press Enter to return to the scenario menu.
  AppState in game_controller (MAIN/SCENARIOS/PLAYING). Menus are mouse-clickable
  waving banners (ui/menu_banner.{gd,tscn}) in an editable menu_screen.tscn
  (scenes/menu/) whose Items VBoxContainer can be reordered in the editor. Scenarios
  list: content/scenarios.gd (reorder there to reorder the menu). The 3D scene is the
  backdrop; the band's dark background fills the bottom during menus.

## Next step

Likely next milestones:
- Profiles (A5): a local in-memory/file ProfileStore behind the 3-op contract so XP/
  stars persist across runs; hero-name picker; multi-profile roster.
- Polish: win flash + chest-open (A9), setback vignette, narration audio toggle +
  reveal-window sync (B5 open question), arrived/cheer animation at the win.
- Hero is a gray->recoloured mannequin stand-in; a real knight model would drop in
  via the vocabulary + a rig with the same Rig_Medium animations.

No blocking watch-items; all five scenes compose (forest_path + dungeon builders),
all tests green via `bash tests/run.sh`.

## Open decisions / watch-items

- Hero is `Mannequin_Medium` as a knight stand-in (no knight in the free packs).
  Revisit if a proper knight model is wanted.
- Hero facing: `facing: camera` currently maps to rotation.y = 0; confirm the
  KayKit forward axis when judging (may need a 180 flip to truly face the camera).
- ~34MB of binary art committed to git; Git LFS is a later option if history bloats.
- All brief Section 6-7 open questions still stand; they live in
  `docs/MIGRATION-TO-GODOT.md` (do not re-litigate).
