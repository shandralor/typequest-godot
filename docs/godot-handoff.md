# TypeQuest (Godot) -- Implementation Handoff

For a fresh Claude Code session with NO conversation history. This explains where
things are, how they work, and how to extend them. Pair it with:
- `CLAUDE.md` -- cross-device context + guardrails (read first).
- `docs/MIGRATION-TO-GODOT.md` -- THE design brief and source of truth (the "why").
- `docs/working-context.md` -- the live state + next step (update it each session).
- `HANDOFF.md`, `docs/schemas.md`, `docs/visual-checks.md` -- carried TS-era docs
  (the migration brief wins on any conflict).

House style (enforce): no em/en dashes, use `--`; no emojis in code/docs/commits;
Conventional Commits with a scope; end commit messages with the Co-Authored-By
trailer. Credentials only from the environment, never committed.

---

## 0. TL;DR

A gamified touch-typing tutor for kids (~6+) disguised as a branching fantasy
gamebook. The child types Flemish (nl-BE, Belgian AZERTY) prose to reveal a 3D
story and types a choice word to pick forks. Godot 4.7. Art is KayKit + Kenney
(CC0). The whole thing is playable: a menu -> pick a scenario -> play -> win ->
back to the menu.

- Engine: Godot **4.7** (`godot` on PATH). Main scene: `scenes/game.tscn`.
- Remote: `https://github.com/shandralor/typequest-godot` (branch `main`).
- Canonical path: `/mnt/professional/projects/code/typequest-godot/typequest`.

---

## 1. Run / test / screenshot

Always pass game args after `--` (they arrive via `OS.get_cmdline_user_args()`).

- Play (opens a window): `godot --path .`
- Headless import (after adding assets/scripts): `godot --headless --import --path .`
- Tests (6 suites, headless, ~10s): `bash tests/run.sh` (non-zero exit on failure).
- A single test: `godot --headless --script res://tests/test_logic.gd`

Debug / capture flags (handled in `game/game_controller.gd::_ready`):
- `--demo` -- autoplay (auto-types the correct keys). A bare `--demo` starts at the
  OVERWORLD like a child would (types the first site word, walks there, plays);
  with `--scenario`/`--scene` it starts that scenario directly.
- `--scenario=ID` -- start a scenario directly (`band1`, `grind`). Skips the island.
- `--scene=NODE` -- jump to a story node id (only valid for the started scenario).
- `--type=N` -- pre-type N correct characters synchronously at start.
- `--shot` -- after a delay, save one frame to `.shots/` (gitignored) and quit.
- `--burst` -- save 12 frames at 0.25s to `.shots/burst_NN.png` (find flicker).
- `--menu=world` -- open the overworld island directly (`--menu=scenarios` is a
  back-compat alias).

Examples:
- The island + travel + band1, screenshot: `godot --path . -- --demo --shot`
- The overworld island: `godot --path . -- --menu=world --shot`
- A specific node: `godot --path . -- --scene=kruispunt --type=35 --shot`
- The grinding scenario: `godot --path . -- --demo --scenario=grind --shot`

Visual-check discipline (brief C): graphics drive this game; any change that adds or
moves something on screen gets a quick screenshot pass. `Read` the PNG in `.shots/`.
Rendering needs a display (Wayland/X present on the dev box); headless renders a
blank (dummy) frame, so `--shot` must run WITHOUT `--headless`.

---

## 2. Architecture -- the layers

The brief's three-axis decoupling and pure-core isolation are real here.

```
logic/    pure GDScript: no Node/Input/render/network. Headless-testable. (B2/B7/B8)
axis/     engine-independent DATA: locale, keyboard layout, asset vocabulary. (A3)
content/  the band-1 arc, the grind arc, band spec, scene descriptors, scenarios,
          overworld.gd (the island's site registry: word -> scenario). (A7)
render/   scene_composer.gd -- builds the 3D scene from a descriptor; also the
          overworld island composer. (B4)
input/    azerty_input.gd -- physical key -> AZERTY char (render side of B1).
ui/       type-along (reveal window), keyboard guide, choice + menu banners.
game/     game_controller.gd -- the loop + menu shell + overworld + camera.
scenes/   game.tscn (main), start.tscn (composition demo), menu/, sets/ (baked).
tests/    headless suites + run.sh.
tools/    bake_sets.gd -- bakes NAMED editable location .tscn sets.
```

A guard test (`tests/test_purity.gd`) fails if anything in `logic/ axis/ content/`
references `extends Node`, `Input.`, `get_tree(`, `PackedScene`, `MeshInstance`,
etc. Keep those layers pure.

---

## 3. The pure logic layer (`logic/`)

- `scene_descriptor.gd` -- SceneDescriptor + ActorPlacement/PropPlacement (the data a
  story node carries: location, mood, actors[asset,anchor,pose,facing], props, path).
- `story_graph.gd` -- StoryGraph + StoryNode + Choice. Nodes carry KEYS (prose/
  narration/word) and IDS (assets), never words/models. Fields incl. ending
  ("|neutral|win"), win_key, return_to (setback, A9), prerevealed (A9), safety
  (per-locale hash), scene (SceneDescriptor).
- `run_state.gd` -- traversal + per-run accumulation. choose(word), resolve_ending()
  (win/neutral/setback), score_current() (score-once-per-run, pre-revealed = no
  score), progress_snapshot().
- `typing.gd` -- TypingState: type_char advances cursor on a correct key; progress()
  = cursor/len (B7 primitive); accuracy() = correct/typed.
- `scoring.gd` -- A6: completion + accuracy, ZERO speed. Pure static `score()`.
- `fnv1a.gd` -- the FNV-1a 32-bit content-safety hash (A4). `hash_prose`, `matches`.
- `seeded_rng.gd` -- injected seeded RNG (B8).
- `reveal_window.gd` -- B5 pure helpers: `visible_end` (N words ahead) + `window_start`
  (slide so the panel shows a stable ~2 lines, older text scrolls off).
- `scene_activity.gd` -- SceneActivity + Tracker (idle/moving/arrived with hysteresis,
  B3); time is injected so it stays pure.
- `content_validator.gd` -- the build gate: text keys resolve, choice/return targets
  exist, safety hash matches resolved prose, band limits hold, ids resolve, band has
  no key/finger term, prose typeable on the layout. Add new LOCATION_IDS here.

SAFETY HASH RULE (A4): a failing hash means the PROSE encoding differs from what was
signed off -- fix the prose to be byte-identical; NEVER regenerate the hash. For NEW
content you author, computing its hash (via `Fnv1a.hash_prose`) IS the sign-off; store
it in the node's `safety`.

---

## 4. Axis data (`axis/`)

- `locale/nl_be.gd` -- text key -> string (prose, narration, choice words, win
  messages). Prose strings are byte-identical to the brief A7 so their hashes verify.
- `layout/be_azerty.gd` -- Belgian AZERTY: US-position label -> (char, finger). f/j
  home anchors. Engine-independent; the input adapter maps Godot keycodes to labels.
- `vocabulary/fantasy_poc.gd` -- asset id -> Godot resource path. Locations are NOT
  here (they are composed). Add new props/characters here.

---

## 5. Content (`content/`)

- `scenarios.gd` -- the menu's scenario registry: `list()` (id+title, reorder to
  reorder the menu), `build(id)` -> StoryGraph, `backdrop_scene()` (menu backdrop).
- `band1/band1_arc.gd` -- the 6-node band1-arc (start, kruispunt, grot[setback->
  naGrot], naGrot[prerevealed], brug, schat[win]). Safety records carry the A7 hashes.
- `band1/scene_descriptors.gd` -- the per-node SceneDescriptors (ids + anchors).
- `band1/band_spec.gd` -- A2 band-1 metadata (maxWordLen 7, etc.); carries NO
  key/finger term.
- `grind/grind_arc.gd` -- the "Slijp je zwaard" scenario (one node `slijpen`, win;
  location `forge`; song hash `fnv1a:8842050f`).

### Add a new scenario (the common task)
1. Write the song/prose in `axis/locale/nl_be.gd` (lowercase, words <=7, <=10
   words/sentence to pass the band-1 validator). Compute its hash:
   `godot --headless --script` a one-off calling `Fnv1a.hash_prose(...)`.
2. Make a `content/<name>/<name>_arc.gd` returning a StoryGraph (set prose_key,
   narration_key, win_key, ending, safety {nl-BE: {hash,...}}, scene).
3. Add any new location to `scene_composer` (`_set_for`, `build_static`,
   `_static_<name>`) and `content_validator.LOCATION_IDS`; bake its editable set
   (`tools/bake_sets.gd` -- OWNER RULE: every location gets a hand-editable set).
4. Register it in `content/scenarios.gd` (`list()` + a `build()` branch).
5. Give it a SITE on the island: a site word in the locale (`site.<word>` --
   discuss the word with the owner; no word may be a PREFIX of another, the
   content test enforces it), a row in `content/overworld.gd`, and a building +
   `site_<id>` Marker3D + `route_<id>` Path3D in `scenes/sets/overworld.tscn`
   (hand-edit the set, or extend `_static_overworld` and re-bake ONLY if the set
   was never hand-edited).
6. Validate: `tests/test_content.gd` validates every graph + the overworld sites,
   then `bash tests/run.sh`.
7. Screenshot it: `godot --path . -- --demo --scenario=<id> --shot` and the island
   `godot --path . -- --menu=world --shot`.

---

## 6. Render: the scene composer (`render/scene_composer.gd`)

`compose(descriptor, variant)` builds the scene. It is IMPERATIVE (B4) -- hand-staged
per scene type. Flow: pick a location set -> instance it -> read anchors -> mood
lighting -> place actors (hero special) -> place props -> per-type effects.

### Locations: hybrid editable sets
Static staging lives in editable `scenes/sets/<name>.tscn` (forest_straight,
forest_fork, forest_bridge, dungeon, forge, overworld -- OWNER RULE: every location
gets one). `_instance_set` loads the `.tscn` if present, else falls back to the
procedural `build_static(name)`. Bake with
`godot --headless --script res://tools/bake_sets.gd -- <set> [<set> ...]` -- the
tool only bakes the sets you NAME (baking OVERWRITES; never re-bake a hand-edited
set). Set the gltf/glb as instance references (scene_file_path) so the `.tscn`
stays small.

Scene-type behaviour the controller keys off:
- walking (path straight + hero at `path_near`): hero walks the travel path; camera
  follows close. (start, brug)
- fork (path == fork): cave mouth (left) + bridge landmark (right); `has_landmarks()`;
  hero stands and GAZES (controller turns it to the cave then bridge by prose
  keywords). Wide establishing camera. (kruispunt, naGrot)
- treasure (a `chest` prop): bloom on, closer hero-shot camera; win opens the gold
  chest lid (a child node) + flash. `is_treasure()`. (schat)
- work (location == `forge`): grindstone + anvil + sparks; `is_work_scene()`. The hero
  grinds (Sawing) while typing; sparks heat with progress; win = Cheering. (grind)

### The hero (animated KayKit Knight)
`_build_hero()` instances `assets/kaykit/adventurers/Knight.glb` (already textured,
Rig_Medium 23-bone skeleton, no animations) and attaches an AnimationPlayer, grafting
clips from the shared Rig_Medium animation glbs (same skeleton -> tracks resolve):
- `Idle_A`, `PickUp` from `Rig_Medium_General` (adventurers)
- `Walking_A` from `Rig_Medium_MovementBasic` (adventurers)
- `Sawing` from `characters/Rig_Medium_Tools`
- `Cheering` from `characters/Rig_Medium_Simulation`
Idle/Walk/Work/Cheer are set to loop. To add a clip: graft it in `_build_hero`. The
controller drives clips via `set_lead_animation`, `set_lead_work`, `play_lead_oneshot`,
`play_lead_loop`.

Held weapons attach to the `handslot.r` bone via a `BoneAttachment3D` (see the
`sword` case in `_place_prop`) with a small local offset to position the blade; the
hand animation then moves it. Other props instance by id at their anchor; unknown id
-> a loud RED placeholder (`_red_placeholder`, never silent -- B4).

---

## 7. The game loop (`game/game_controller.gd`)

Root is a `Node3D`. `_build_layout` makes: a CanvasLayer > full-rect Control `ui` with
a `SubViewportContainer` (3D scene, top), an opaque bottom band (narration +
type-along + keyboard), a HUD, a transient message, a `_choice_layer`, and a
`_menu_layer`. The 3D renders in the SubViewport so the UI band never overlaps it.

States:
- `AppState { MAIN, OVERWORLD, PLAYING }` -- menu shell + the island.
- `Phase { PROSE, CHOICE, PAUSE, WIN, DONE }` -- within a playing beat.

Flow: `_show_main_menu` (Start / Stoppen, over the island backdrop) ->
`_show_overworld` (the walkable island picker, below) -> arrival calls
`_start_scenario(id)`, which builds a `RunState` and calls `_enter_node()`. A
node: compose its scene, set narration, then PROSE (type the prose, reveal window
B5, finger guidance B6) or, if prerevealed, straight to CHOICE. On prose complete:
score, then choices -> `_begin_choice` (waving choice banners), or ending ->
`_resolve_ending` (setback bounces to return_to; win shows `win_key` message + the
scene's flourish + flash, then ENTER returns to the island, knight standing at the
finished site). ESC on the island returns to the main menu.

### The overworld (the walkable scenario picker)
The island replaces the old scenario menu: sites are places, and the child TYPES a
site word (bos / smidse / boog) to send the knight walking there. Pieces:
- `content/overworld.gd` -- pure site registry: word key, scenario id, anchor +
  route names, `unlocked` (a plain flag until profiles A5 make it earned; a site
  with an empty scenario is a greyed TEASER, e.g. boog until archery exists).
- `scenes/sets/overworld.tscn` -- the EDITABLE island (KayKit hexagon tiles,
  buildings, decoration): `site_<id>` Marker3D arrival spots, `route_<id>` Path3D
  walk curves (bend them to follow your roads), and `camera_pos`/`camera_look`
  markers for the framing. Owner decoration goes here, in the editor.
- `scene_composer.compose_overworld()` -- instances the set + the animated knight;
  `overworld_cam()` reads the camera markers and adds a 30-degree tele fov (the
  1920x680 viewport turns the default 75-degree fov fisheye).
- Controller: `_ow_char` does PREFIX matching across unlocked words (bos/boog
  style shared prefixes never shadow a site; the keyboard guide only lights a key
  once the prefix singles a site out). `_begin_ow_travel` walks route legs (via
  the hub when starting from another site); arrival starts the scenario. Site
  banners are projected from the 3D anchors each frame, so a larger scrolling
  island later needs no banner changes -- the one-screen island is a STAGING
  choice, not a code assumption.

`_input` reads physical keys via `AzertyInput.char_for_physical` (B1, OS-layout-
independent). `_process` drives the hero (walk/idle/work/gaze) and the camera
(`_camera_rig` per scene type). Menus are mouse-click driven (banner `pressed` signal).

---

## 8. UI (`ui/`)

- `type_along.gd` -- the reveal window on a Kenney panel: typed text solid, next char
  highlighted, faint runway, sliding window (no scroll, never clips). (B5)
- `keyboard_guide.gd` -- on-screen AZERTY keyboard; lights the next key in its finger
  colour; f/j marked. (B6)
- `choice_banner.gd` -- a fork shown as a waving banner (cloth-wave shader + sway +
  direction arrow + typed highlight).
- `menu_banner.gd` + `menu_banner.tscn` -- clickable waving menu item (same wave).
  `secondary=true` makes a smaller brown variant (Stoppen/Terug).
- `scenes/menu/menu_screen.tscn` -- editable menu layout (Title + a `VBoxContainer`
  named `Items` you can reorder in the editor + a dark veil).

---

## 9. Conventions, tests, gotchas

- Commits: Conventional Commits w/ scope (e.g. `feat(grind): ...`), `--` not em-dash,
  Co-Authored-By trailer. Commit only when it builds + tests pass.
- Tests must stay green: `bash tests/run.sh` (fnv1a, logic, content, purity,
  render_logic, menu_flow). `test_purity` enforces logic/axis/content purity.
- After adding assets or scripts, run `godot --headless --import --path .` once.
- `.shots/` and `.godot/` are gitignored; the baked `.tscn` sets and the assets ARE
  committed (~80MB of CC0 art -- Git LFS is a future option).
- KayKit/Kenney import note: only gltf/glb + atlas textures are vendored (fbx/obj
  dropped). gltf reference textures by bare filename, so packs were flattened per dir.

---

## 10. Known issues / next steps

- The grind sword's exact on-wheel position + the win framing were hand-tuned from
  screenshots; fine if it looks right, easy to nudge (`_place_prop` sword offset,
  `_static_forge` anchors, `_camera_rig` work/win).
- Ideas queued: an archery scenario (its island site + teaser banner already
  exist: boog) and a morning-gymnastics scenario (type exercise words -> matching
  clips). Keep adventures SHORT.
- Profiles (A5) not built: XP/stars do not persist across runs yet. The schema +
  no-auth-coupled-to-non-identifying-data posture are specified in the brief A5;
  build a local in-memory/file ProfileStore behind the 3-op contract.
- Audio narration + reveal-window sync (B5 open question) not built.

---

## 11. Cross-device workflow

Conversation history does NOT sync between devices. Continuity is: `git pull`, then
read `CLAUDE.md` + `docs/working-context.md` (+ this file). END every working session
by updating `docs/working-context.md` (state + next step), then commit and push.
