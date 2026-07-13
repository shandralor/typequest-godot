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

Likely next: the archery scenario (its island site + teaser banner already exist:
boog -- follow handoff section 5, unlock by filling in its scenario id), or
profiles (A5) so XP/stars persist and island sites can be EARNED, or the queued
small fixes above. Keep adventures short.

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
