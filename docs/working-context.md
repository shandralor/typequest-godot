# Working context (LIVE)

Update this at the end of every session: current state + next step. This plus
CLAUDE.md is how another device picks up the work (git pull -> read these).

## Current state (2026-06-27)

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

## Next step

The core loop is playable end to end. Likely next milestones (owner to prioritise):
- B3 proper animation: drive an AnimationTree/AnimationPlayer with real KayKit walk/
  idle clips from `assets/kaykit/characters` (currently the hero slides along the
  path -- no clip yet). Orient + clip from SceneActivity.
- Profiles (A5): a local in-memory/file ProfileStore behind the 3-op contract so XP/
  stars persist across runs; hero-name picker; multi-profile roster.
- Polish: win flash + chest-open (A9), setback vignette, narration audio toggle +
  reveal-window sync (B5 open question), better dungeon art, scene framing.
- The choice UI could be clearer (currently a text prompt + typed word); consider a
  dedicated fork affordance.

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
