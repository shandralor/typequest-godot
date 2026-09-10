# Working context (LIVE)

Update this at the end of every session: current state + next step. This plus
CLAUDE.md is how another device picks up the work (git pull -> read these).

## Character choice + variant prose ({held} subject token) (2026-07-19)

Character choice (roadmap G1/G2) + the dynamic-subject-noun design knot are now BUILT.

- **Roster** (`game/characters.gd`): 6 heroes -- Knight, Barbarian, Mage, Ranger, Rogue,
  Witch. Each = { id, model, label }. All share KayKit Rig_Medium so the grafted
  animation set resolves for every one. The 15 other purchased hero models were removed
  from `assets/kaykit/heroes/` (only Witch.glb stays there; the rest are Adventurers).
- **Picker** (game_controller PICKER state + `_show_character_picker`): a turntable
  carousel, arrows/scroll to spin, Enter to choose. Shown first-run (before the intro)
  and from a "Kies je held" main-menu entry. Choice persists via AppProgress [profile]
  hero / hero_chosen. Debug: `--menu=picker`, and `--hero=<id>` to preview any hero.
- **Variant prose (the A4/band knot, RESOLVED via the template-hash approach)**: typed
  prose now carries a **{held} token** for the hero subject ("de {held} stapt..."). The
  subject NOUN per hero lives in the LOCALE (`nl_be.gd` "hero.<id>" keys: ridder,
  barbaar, magier [not "tovenaar", 8>7], jager, dief, heks) -- band-1 nl-BE content.
  - Runtime: `game_controller._held_prose(key)` fills {held} with the chosen hero's noun
    at every typing target (`resolve_held` on the locale).
  - **Safety hash is over the TEMPLATE** (with the token). The 8 affected hashes were
    recomputed as the sign-off for this deliberate authored change (start a69bd641, grot
    07954cfa, naGrot 68a2ee24, brug 360036c6, schat 4c6d879d, slijpen e7256a7d,
    boogschieten 03a2617e, thuiskeuze 8f19de48). NOTE: the noun set is NOT hash-guarded
    (only the template is) -- it is instead guarded by the validator checking every
    variant is band-1 + typeable. Adding a hero = add a "hero.<id>" noun; the validator
    re-checks all variants automatically.
  - `logic/content_validator.gd` + `tests/test_layouts.gd` are now VARIANT-AWARE: they
    substitute every hero noun (from `locale.hero_nouns()`) and check band + typeability
    on each concrete string, never the raw braces. Validator stays pure (nouns come from
    the locale, not game/Characters).
  - `test_menu_flow.gd` marks hero_chosen transiently (new `AppProgress.set_choice_transient`)
    so Start -> overworld skips the first-run picker.
- All 7 headless tests PASS. Screenshots were NOT captured this session: a windowed
  `--shot` run cannot grab the GPU while the Godot EDITOR is open (it holds the Vulkan
  device) -- close the editor, then `--menu=picker --shot` / `--hero=witch --scenario=band1
  --type=45 --shot` writes res://.shots/game.png. The witch-on-island render was verified
  visually in the prior session.
- NOT committed yet (owner verifies each change; owner's overworld.tscn/forge.tscn editor
  edits + adventurers *.import reimport churn are intermixed in the tree -- commit only the
  feature files + the heroes/ deletions, leave the owner's tscn work).
- NEXT: character-specific GEAR (a Mage holding a sword reads odd -- G1 gear sets); read-
  aloud strings still say "De ridder" (not typed, so free -- adapt later for flavour);
  Gem_Large crystal; then Wave 2 surfaces (quest log, progress screen).

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

## Keyboard layout switch -- AZERTY / QWERTY (2026-07-15)

The keyboard-layout AXIS now has a second layout and a runtime switch. Because we
deliberately do NOT teach one row at a time (volume of motivated typing, not
drills), a second layout drops in safely; the child picks the one matching their
physical board.

- `axis/layout/qwerty.gd` (new): US QWERTY, same pure-data contract as
  `be_azerty.gd` (char_at_position / guidance_for_char / supports_text +
  LAYOUT_ID / DISPLAY_NAME / KEYBOARD_ROWS / keyboard_rows()). `m` lives on the
  bottom row here (vs SEMICOLON on AZERTY). f/j stay the home anchor.
- Both layouts now expose `KEYBOARD_ROWS` / `keyboard_rows()` so the on-screen
  keyboard (B6) renders from the ACTIVE layout instead of a hardcoded row list.
- `game/keyboard_settings.gd` (new, NOT pure -- kept out of axis/): holds the
  active layout id, persists to `user://settings.cfg`, and delegates
  char_at_position / guidance_for_char / keyboard_rows to the active layout. This
  is the single place the render/input side asks "which layout".
- `input/keyboard_input.gd` (renamed from azerty_input.gd, class KeyboardInput):
  physical keycode -> neutral US position -> ACTIVE layout char. KEY_TO_POSITION
  now also maps KEY_M (QWERTY's m) alongside KEY_SEMICOLON (AZERTY's m).
- `ui/keyboard_guide.gd`: builds rows + guidance from KeyboardSettings; gained a
  `rebuild()` called when the layout is switched.
- Main menu has an "Opties" item -> options screen with a "Toetsenbord: AZERTY/
  QWERTY" toggle (cycles, persists, rebuilds the board) + "Terug".
- Debug flags: `--layout=azerty|qwerty` (transient, does not clobber the saved
  choice) and `--menu=options` (jump to the options screen for screenshots).
- `tests/test_layouts.gd` (new, in run.sh): round-trips every char on each layout,
  asserts both layouts type all content (swap never breaks typeability, A3), and
  that keyboard rows cover the 26 letters once each. NOTE: also fixed a stale
  assertion in test_menu_flow left over from the archery commit (boog is now
  unlocked, so all three sites are selectable).
- Content validator still checks typeability against AZERTY as the canonical
  charset -- both layouts cover a-z + space + period, so this stays valid.
- Reference renders: `.shots/kb_qwerty.png`, `.shots/kb_options.png`.

## Finger legend beside the keyboard (2026-07-15)

The on-screen keyboard (B6) now has a finger LEGEND flanking it: two staggered
groups of Kenney "nail" sprites stand in for the fingertips (no drawn hand), each
tinted with its finger colour and captioned with the Dutch finger name
(pink/ring/middel/wijs/duim). The fingertip needed right now pops (full colour +
scale); the rest sit dimmed. Doubles as a colour->finger legend and a live guide.

- `ui/finger_hand.gd` (new, FingerHand): absolute-positioned nail sprites + labels,
  one instance per hand (right mirrored). `configure(prefix, colors, mirror)` +
  `highlight(finger_id)`.
- `ui/keyboard_guide.gd`: `_build` now lays out [left hand][keys][right hand] in a
  centered HBox; `highlight()` drives the matching fingertip via `_drive_hands`
  (thumb = space lights BOTH hands); `set_hands_visible()` hides the legend where it
  is noise.
- The legend shows only DURING a scenario -- hidden in the overworld (site-name
  typing), via `_set_playing_ui` -> `set_hands_visible(playing)`.
- Asset: Kenney Monster Builder Pack (CC0), `assets/kenney/monster/body_whiteC.png`
  (fingers) + `body_whiteD.png` (thumb), tinted via modulate. Credited in CREDITS.md.
- Reference renders: `.shots/nails_v1.png` (right middel active), `.shots/nails_thumb.png`
  (both thumbs on space), `.shots/nails_overworld.png` (legend hidden).

## Intro scenario -- wake up + leave the house (2026-07-15)

A one-time onboarding that plays before the overworld on the first Start. The knight
wakes in a house interior, a short explanation ROLLS across the screen, then the
child types a few practice words and he walks out the door into the overworld.

- `content/intro/intro_arc.gd`: single WALKING node, location "house", short prose
  (hash fnv1a:9ff934d5). Prose "ik sta op. ik loop naar de deur." (few practice
  words); narration "Typ de woorden." (short top-bar prompt during typing).
- Briefing sentences: `axis/locale/nl_be.gd` `INTRO_BRIEFING` (a plain, editable
  list -- read-aloud, so NO hash/band/layout constraints; edit/add/reorder freely).
  game_controller rolls each in from the right, holds ~2.6s, slides off left, THEN
  reveals the typing UI (`_begin_briefing`/`_play_brief`/`_end_briefing`,
  `_brief_label`, `_intro_briefing` gates input).
- House interior: `render/scene_composer.gd` `_static_house()` -- big, TALL, enclosed
  (walls + ceiling + door lintel) so only the inside is ever seen; KayKit Dungeon
  pieces (bed, doorway, torch, tables, barrel) + warm OmniLights. Baked to an
  editable `scenes/sets/house.tscn` (also `archery.tscn`); bake_sets SETS extended.
  IMPORTANT: house.tscn has OWNER EDITS (wall shield, shelves) -- do NOT re-bake it
  without asking (would overwrite them).
- Getting-up: the knight starts sunk below the floor (`HOUSE_SINK_DROP`) and RISES
  over the first `HOUSE_RISE_FRAC` of typing, then WALKS; position is SMOOTHED
  (`set_house_progress(p, delta)` lerp, `HOUSE_MOVE_SPEED`) so it reads fluid. He
  stands on the floor TOP (`HOUSE_STAND_Y` = 0.2, the box floor's top) so his feet
  do not sink; always faces the door. Fixed interior camera (is_house_scene branch).
- Persistence: `game/app_progress.gd` -- `intro_seen` in user://settings.cfg (the
  A5 seed). Start plays the intro once, then goes straight to the island; `--intro`
  forces a replay; Opties has "Intro opnieuw tonen" (resets the flag);
  `--scenario=intro` / `--menu=options` are debug entries.
- Also: overworld now has a "Terug" button -> main menu (`_on_back_pressed` handles
  OVERWORLD); the top bar auto-sizes to its text (`_set_top_prompt`).
- test_content + test_layouts include IntroArc; test_menu_flow sets intro_seen
  transiently so Start -> island regardless of machine state.
- Reference renders: `.shots/intro_brief.png`, `.shots/intro_start2.png`,
  `.shots/intro_neardoor.png`, `.shots/intro_exit.png`.

## Composer refactor + intro briefing + fonts (2026-07-15)

**render/ refactor (Phases 1-3, committed):** scene_composer.gd was a 1397-line
god-object; now 787 and a COORDINATOR. Extracted, behaviour-identical:
- `render/scene_kit.gd` (SceneKit): generic primitives (mat, make_ground/box/
  path_segment, instance_path/asset, red_placeholder, face) + the colour palette.
- `render/locations/*.gd`: one builder per location (forest/dungeon/forge/house/
  archery/overworld) + `nature.gd` (treeline, grass_tint). `build_static` dispatches
  to them -- a NEW scene is a new file. Note: runtime scenes load the baked
  scenes/sets/*.tscn; the builders are the fallback + bake source.
- `render/hero_rig.gd` (HeroRig): the Knight node, its AnimationPlayer + grafted
  clips, and all lead motion/animation. The composer holds `_hero` and delegates its
  public API, so game_controller.gd is UNCHANGED. Scenario mechanics reach the hero
  via `_hero.node` / `_hero.anim`.
- Phase 4 (mechanics -> effect components) was DEFERRED on purpose: B4 says don't
  generalise until a SECOND consumer exists, and it would not shrink the composer
  (game_controller API must stay stable). Revisit when a 2nd archery/forge-like scene
  appears.

**Intro briefing = a typewriter (game_controller `_play_brief`):** the explanation
sentences (`INTRO_BRIEFING` in nl_be.gd) TYPE OUT character by character, wrapped to
~2 centred lines (`_brief_label`, width `BRIEF_W`=1040), then hold + fade. Reveal
speed is ~1/4 (0.24 s/char, clamp 4-18 s) so a beginning reader can follow; hold
scales with word count. Typing input stays disabled until the briefing ends.

**Fonts (SIL OFL, assets/fonts/, credited):** app-wide default is **Andika**
(`project.godot` gui/theme/custom_font) -- a literacy/early-reader face for ALL
prose/keyboard/HUD. **MedievalSharp** is applied ONLY to decorative headings (the
menu title + menu banners) via `add_theme_font_override` -- kept off the prose so it
never hurts a beginning reader.

## Intro fetch-quest: sword + key, then exit (2026-07-16)

The intro is now a 4-leg waypoint walk (one typed sentence = one leg), not a single
bed->door walk. Prose `intro.prose` = "ik sta op. ik pak mijn zwaard. ik pak de
sleutel. ik ga naar buiten." (hash fnv1a:ca6010db): rise -> walk to the shelves + take
the sword -> walk to the cabinet + take the key -> walk to the door -> overworld.

- Reused the ARCHERY per-sentence pattern: `_setup_house`/`_update_house`/
  `_house_check_pickup`/`_house_current_sentence`/`_house_sentence_progress` +
  shared `_sentence_spans` in game_controller.gd, mirroring `_setup_archery` etc.
  Waypoints come from anchors `path_near`, `sword_point`, `key_point`, `path_far`.
- Composer: `house_move_to(target, delta, yaw)` (generalized the old
  set_house_progress), `set_house_start()` (sunk init), `house_pickup_sword()` /
  `house_pickup_key()` (hide the shelf/cabinet display prop by name via
  SceneKit.find_child_containing, attach sword to handslot.r, play PickUp). Extracted
  a shared `_attach_to_hand(node, bone, offset)` helper (sword + bow now use it).
- HeroRig: added a `_oneshot` lock so a PickUp one-shot is not stomped by the
  per-frame walk/idle driver during the walk (set in play_oneshot, cleared in
  _on_oneshot_done; set_animation early-returns while locked). Safe for existing
  one-shots (they fired when the driver was inactive).
- scenes/sets/house.tscn (hand-edited, NOT re-baked -- has owner's shelves2 +
  shield): added `cabinet` (the `shelves` model, id 6_37gw0, mirrored from the
  owner's right-wall shelves to the left wall), `shelf_sword` (adventurers
  sword_1handed on the right shelves), `cabinet_key` (keyring_hanging on the cabinet),
  and Marker3D anchors `sword_point`/`key_point`. NOTE: `shelf_large` is a thin wall
  PLANK (not a standing cabinet) -- the tall `shelves` model is the cabinet.
- Debug: `--type=N` on the intro now calls `_end_briefing()` first so screenshots can
  drive the walk (the briefing otherwise blocks input). Beats verified:
  `.shots/house_sword.png`, `.shots/house_cab4.png`, `.shots/house_exit.png`.

## Revisitable house -- "thuis" overworld site (2026-07-16)

The house is now a REVISITABLE overworld site, reusing the SAME editable set as the
intro (scenes/sets/house.tscn) -- NO mirrored/rebaked variant. This is the foundation
for later "fetch an item from home" visits (shield, cloak, ...): add the item + a
`*_point` anchor in the editor + a leg to the walk; track collected items in
AppProgress (the profile seed).

KEY PRINCIPLE (why no orientation rebake): "orientation" is not geometry -- it is just
which ANCHORS the walk uses + where the camera sits. The intro walks bed(path_near) ->
door(path_far) and rises; a return visit walks door(path_far) -> center and does NOT
rise. Same room, different anchors. NEVER re-bake house.tscn (it has owner edits;
re-baking regenerates from the procedural builder and wipes them).

- content/home/home_arc.gd (HomeArc): one node, location "house", PATH_STRAIGHT, hero
  at "path_far" (the door), facing into the room. Prose "de ridder is weer thuis. hij
  loopt naar binnen en kijkt rond." (hash fnv1a:70f31056). Registered in scenarios.gd
  ("home"). site.thuis word + home.narration/win in nl_be.gd.
- content/overworld.gd: new `thuis` site (word site.thuis, scenario home, anchor
  site_home, route route_home, unlocked). overworld.tscn: added site_home Marker3D
  (~-1.6,0,2.3, near the owner's home building) + route_home Path3D/Curve3D (hub->site,
  3-point, copied from route_bos). Missing route/anchor degrades gracefully (jumps to
  the scenario) -- see _ow_walk_tick.
- INTRO vs VISIT split (game_controller): gated on `_in_intro`. _enter_node/_process
  call _setup_house/_update_house (intro: rise+fetch) when _in_intro, else
  _setup_house_visit/_update_house_visit (walk door->center via _composer.house_move_to,
  no rise/fetch). compose() only sinks the knight when `_hero.walking` (intro is a
  walking scene starting at path_near; the visit starts at path_far, not walking).
  Win: house scenes play Cheering (no chest).
- Tests: HomeArc added to test_content + test_layouts; test_menu_flow now expects 4
  unlocked sites. All 7 green. Reference: .shots/home_enter.png, .shots/home_ow.png.
- NEXT for real items: an inventory flag in AppProgress (has_shield, ...), an item +
  `*_point` anchor in house.tscn, and a fetch leg in _update_house_visit.

## Conditional house items -- unlock flags (2026-07-16)

Owner added two bows to house.tscn (bow_A/bow_B, back-left wall) that unlock on
conditions. Design (owner): completing the archery RANGE unlocks a bow; a harder
archery difficulty (not built yet) unlocks the other. Star totals are reserved for
costumes/upgrades, NOT these. Locked look: "visible but not takeable" (ghosted).

- AppProgress: added a generic persistent flag store -- `get_flag(name)` /
  `set_flag(name, v)` (persisted under [flags] in user://settings.cfg) +
  `set_flag_transient` (tests/--flag). Names are semantic events (the EVENT), so many
  items can key off one flag.
- The archery win sets `archery_done` (game_controller win branch).
- The house ghosts a locked item: composer `set_house_item_locked(name_contains,
  locked)` sets GeometryInstance3D.transparency (LOCKED_GHOST=0.55) on the item's
  meshes; render stays decoupled -- the CONTROLLER drives it via `_apply_house_locks`
  (bow_a <- archery_done; bow_b <- archery_hard_done, which is never set yet). Runs for
  ANY house scene (intro + home visit).
- Debug: `--flag=NAME` sets an unlock flag transiently for screenshots.
- NEXT (the payoff, not built): a return-home FETCH -- when a bow is unlocked AND not
  yet collected, the home visit walks the knight to a `bow_point` anchor and takes it
  (reuse house_pickup_*/_attach_to_hand), setting a `has_bow_x` flag so it is gone
  after. That is where the ghost reads clearly (knight right next to it).

## Mist is now AUTHORED in the set (editor-controlled) (2026-07-18)

The coastal mist moved from a procedural code ring to AUTHORED clouds in overworld.tscn, so
the owner places/orients/scales cloud cover in the editor like tiles, while the game still
removes parts on unlock. Mechanism = node GROUPS:
  - group "mist"           -> permanent cloud (never lifts)
  - group "reveal_<flag>"  -> cloud that fades + drifts away when AppProgress <flag> is set
    (e.g. "reveal_crossed_bridge"; set via the dev "Brug over" toggle or crossing the bridge).
composer: _register_authored_mist() scans _location children for _is_mist_node (in "mist" or
any "reveal_*" group), applies the translucent fadeable material + gentle bob, records the
flag. _spawn_clouds skips mist nodes (so they don't drift). reveal_mist(flag, animate) fades
the matching clouds; mist_reveal_flags() lists the flags PRESENT so the controller reveals
only what exists (adding a region = pure editor work, no code). Removed the procedural
_spawn_mist + MIST_RADIUS/COUNT/GAPS. Seeded a starter ring (31 cloud_big nodes, windmill
sea-gap, west sector tagged reveal_crossed_bridge) into overworld.tscn via a one-off script
-- the owner refines positions to hug the (now irregular/grown) coast. Verified: ring masks,
west lifts on crossed_bridge. All 7 suites pass.
EDITOR WORKFLOW: duplicate a cloud_big, position it, add it to group "mist" (permanent) or
"reveal_<flag>" (liftable) in the Node dock -> Groups. That's it.

## Mist tuning + island camera pan + maximized window (2026-07-17)

Follow-up tuning after the mist landed. (1) Mist ring was swallowing edge buildings (smidse,
windmill): pushed MIST_RADIUS 17.5->21.5 (past the water), shrank puffs (scale 1.7-2.5),
lowered MIST_Y->0.9, denser (34) -- now a clean island->water->mist band, buildings clear.
(2) 1920x1080 window is small on a 4K screen -> project.godot window/size/mode=2 (maximized)
+ resizable, so it fills the screen (stretch canvas_items/expand scales the 1920x1080 base up
crisply). (3) Idle overworld camera now CENTRES on the island (dropped the 1.12 pull-back) and
MOUSE-PANS: cursor offset from screen centre past a 0.3 dead-zone pushes the focus up to
OW_PAN_RANGE(15) so a child can look around the revealed/growing map without walking
(_ow_pan_offset/_pan_curve; enabled once the mouse first moves, _ow_mouse_active). Walking
still follows the knight. All 7 suites pass. NOTE: the windmill sits right at the bottom frame
edge in the default view -- the pan reveals it; can add a small south focus bias if wanted.

## Coastal mist ring: mask + reveal unexplored regions (2026-07-17)

To avoid "magical" pop-in when the island grows, a soft MIST RING now hugs the whole coast
so anything beyond the current tiles reads as unexplored (the land is hidden IN the mist,
not spawned). Unlocking a region LIFTS the mist over that angular sector (fade + drift
seaward, ~2s) instead of popping tiles in. All in CODE (compose-time, like the clouds), so
overworld.tscn (owner-authored) is untouched.
- composer: _spawn_mist() rings MIST_COUNT(28) cloud_big puffs at MIST_RADIUS(17.5), each
  with its OWN transparent material (so sectors fade independently) + a gentle bob;
  reveal_mist(center_angle, half_width, animate) lifts a sector. _mist reset in _clear;
  hide_clouds() also hides mist (topcam).
- controller: MIST_REGIONS data list {flag, angle, half} (angle: 0=E, PI/2=S, PI=W, -PI/2=N);
  _reveal_unlocked_regions() (called in _show_overworld) lifts each unlocked sector, ANIMATING
  the first time seen (persisted saw_<flag>), instant after. First region: crossed_bridge ->
  angle PI (west, past the bos forest/bridge).
- triggers (BOTH, for testing): brug.sets_flag="crossed_bridge" (crossing the bridge lifts it)
  AND a dev toggle "Brug over". _dev_toggle clears saw_<flag> so the reveal re-animates each
  toggle. Growth in any direction = another MIST_REGIONS row. All 7 suites pass; verified the
  ring masks all directions + the west sector parts on crossed_bridge.

## KayKit full library integrated (device-local) (2026-07-17)

Bought + extracted the KayKit Complete Collection v6.1 (23 packs, ~28.9k files, 1.4 GB) to
the SHARED device-local folder `/mnt/professional/projects/game-dev/_kaykit-assets/` (mirrors
`_music-assets`). Deliberately OUTSIDE the Godot project so the editor never imports 28k
files. Repo still carries only ACTIVE assets under `assets/kaykit/<pack>/`. Catalog +
promote-an-asset workflow committed at `docs/kaykit-library.md` (this IS in the repo -- a
lightweight text index of the full library, so any device knows what exists even without the
1.4 GB). Handy pick noted: the bridge crystal placeholder can become
`Resource Bits/Assets/gltf/Gem_Large.gltf`. See [[kaykit-asset-library]].

## Crystal-lower mechanic: the drawbridge drops (2026-07-17)

The crossing now reads fully. On entering brug, if has_crystal: a glowing crystal drops into
the socket, top bar "De kristal laat de brug zakken!", and the drawbridge leaf swings from
its authored raised angle down to flat over BRIDGE_LOWER_DUR (1.6s); THEN the crossing prose
releases and he walks across the now-flat deck -> exit-walk -> fade.
- Composer: grabs `bridge_leaf` + `crystal_socket` handles in compose(), remembers the leaf's
  authored raised angle. New has_bridge(), set_bridge_lower(t) [0=raised..1=flat], and
  stage_bridge_crystal() (an emissive teal box-gem placeholder in the socket; swap for a real
  model later -- the purchased KayKit pack may have a crystal).
- Controller: _setup_crossing() (called from _enter_node for exit_walk nodes) stages the
  crystal, holds the bridge raised, faces the hero at it, and runs a PAUSE lowering beat
  (`_bridge_lower` ticked in _process); on done _begin_crossing_prose() releases typing.
- Crystal SOURCE (provisional, testable): the cave grants it. StoryNode.sets_flag now accepts
  SPACE-SEPARATED flags; grot.sets_flag = "met_skeleton has_crystal" (he grabs a crystal
  before fleeing). Dev menu gained a Kristal/has_crystal toggle. Easy to rewire the source.
- brug.lower locale string added (read-aloud, no hash).
Tested end-to-end via --scene=brug --flag=has_crystal (burst): crystal + lower + cross all
render. All 7 suites pass.

## Crossing on the fork set + walk-off/fade terminator (2026-07-17)

The brug (crossing) beat now REUSES the fork set (owner lengthened its far path past the
bridge). New plumbing:
- SceneDescriptor.set_name -- an explicit editable-set override; composer._set_for honors
  it first. brug() uses set_name="forest_fork" while staying PATH_STRAIGHT + hero path_near
  (so _is_walking_scene stays true and the prose still drives the path walk). Dropped the
  bridge/chest props.
- StoryNode.exit_walk -- a win that, instead of chest/cheer/enter, strolls the hero off the
  `cross_exit` marker and soft-fades to the island. _resolve_ending win branch checks it
  FIRST and calls _begin_exit_walk (banks adventures/xp/stars quietly, walks to cross_exit
  via _walkoff with a new on_done callback), then _fade_to_overworld (black ColorRect fade
  in over EXIT_FADE_DUR, swap to island under the black, fade back out). _walkoff now carries
  an optional on_done Callable (defaults to _enter_node).
- brug node: ending=win, exit_walk=true, choice->schat DROPPED; prose reworked to the
  crossing ("de brug ligt naar beneden. de ridder stapt over de brug en gaat verder.", new
  A4 hash fnv1a:a585a423). schat + forest_bridge.tscn are now ORPHANED (unreferenced; leave
  for now, safe to delete once the fork-crossing is confirmed).
- OWNER-PLACEABLE MARKERS in forest_fork.tscn: `cross_exit` (added at (5,0,-12) -- move it to
  the end of the lengthened path; the hero walks here then the screen fades). Also move
  `path_near`/`path_far` to route the crossing walk over the bridge. crystal_socket group
  still there.
Provisional: the bridge stays visually RAISED during the crossing until the crystal-lower
mechanic lands (next). Tests updated (test_logic brug is exit-walk win; test_fnv1a start+brug
vectors refreshed). All 7 suites pass; burst-captured the walk-off + fade.

## Forest reframe + raised drawbridge + crystal socket (2026-07-17)

Campaign v2 continues. (1) start.prose reframed: he no longer hunts treasure, he just
walks/explores -- "de kleine ridder wandelt door het bos. hij volgt het pad en stapt
verder." (owner-picked; band-1 OK; new A4 hash fnv1a:dff7ec80 in band1_arc.gd, computed via
Fnv1a as the sign-off). (2) The bridge is now a RAISED drawbridge: render/locations/forest.gd
_build_bridge rebuilt so the deck leaf (deck+rails+slats) hangs off a pivot hinged at the
NEAR bank and swings UP ~65deg (param `raised`, default 65); water+banks+the 4 corner piers
stay planted. Applied to BOTH the fork landmark (right path) and the brug crossing. (3) A
crystal SOCKET pedestal (_build_crystal_socket: stone plinth + dark inset recess) sits at the
near foot; the brug scene also gets a `crystal_socket` Marker3D anchor for future code to
stage the crystal + lowering. Re-baked forest_bridge + forest_fork (deterministic foliage
seed, so only the bridge diffs). All 7 suites pass; screenshotted both scenes.
OPEN/NEXT: the brug crossing prose ("stapt over de smalle brug") + the brug->schat flow now
need the crystal-lower mechanic (G5/C4) to make sense -- place the earned crystal in the
socket -> lower the leaf -> cross. That is the next campaign task.

## Fix: gate the weapon-fetch loop behind met_skeleton (2026-07-17)

Two bugs from owner play-test, both because the "fetch your weapons" loop was live from
the first house exit (before the cave): (1) the knight could take the sword/bow off the
wall before doing the forest; (2) an "!" objective badge showed on `thuis` right after the
intro. Root: `thuis` had no unlock_flag (always open) and objective `haal_wapens` had
active_flag="" (always active). Both DATA fixes: overworld.gd thuis gets
unlock_flag="met_skeleton"; objectives.gd haal_wapens active_flag ""->"met_skeleton". Now
the house-fetch site is dimmed + no badge until the cave-scare, then unlocks with the
smidse/boog. Verified: fresh overworld shows only bos bright, no "!". All 7 suites pass.

## Campaign v2: C3 cave-scare beat (2026-07-17)

DONE (C3). The cave (grot) is no longer a setback that bounces to naGrot -- it is a
TERMINAL, non-celebratory WIN: he sees the skeleton, flees, and the read-aloud beat says
he must first get stronger + fetch his weapons (motivating the smidse/boog that met_skeleton
just unlocked). Mechanism: new StoryNode.celebrate (default true); grot now ending="win",
win_key="grot.win", celebrate=false, keeps sets_flag=met_skeleton, dropped return_to.
game_controller win branch gates cheer/chest/flash + the persisted adventure/xp/stars stats
on `completing.celebrate` -- a non-celebrated win is just the top-bar message + enter (the
knight stands, no fanfare). New string grot.win in nl_be.gd (read-aloud, no hash). naGrot is
now orphaned but left in place (harmless; its prose hash still verifies). test_logic updated:
grot asserts win + not celebrate + sets met_skeleton; the bridge->treasure path tested via a
second RunState (the flag gate lives in the controller, not the pure traversal). All 7 suites
pass; screenshotted the beat. NEXT campaign pieces: the MILL scenario (bag-carry + placement
choice), the active skeleton FIGHT (G10), the crystal + raised-bridge -> next region (G5), C4
treasure-becomes-collectible. The C2 fence PROP + jump-the-fence animation + naGrot/brug text
are still polish TODO.

## Campaign spine: cave-first gating (2026-07-17)

DONE (C1/C2). Generic progress-flag mechanism: story_graph Choice.requires_flag (choice
hidden until flag) + StoryNode.sets_flag (set on node completion); game_controller honours
both (_begin_choice filter; _resolve_ending sets it). C2: band1 kruispunt bridge choice
requires_flag=met_skeleton; grot sets_flag=met_skeleton -> first visit offers ONLY the cave,
then the bridge opens. C1: overworld smidse/boog get unlock_flag=met_skeleton (bos+thuis
always open); _site_locked() -> locked sites dim + hint "nog niet open" when typed; the
has_sword/has_bow item hint layers on after unlock. Verified end-to-end.
NEXT campaign pieces: C3 post-cave cutscene ("must train"), the MILL scenario (bag-carry +
choice), the active skeleton fight (G10), the crystal + raised-bridge -> next region (G5).
The C2 fence PROP + jump-the-fence animation + naGrot/brug text are still polish TODO.

## Intro get-up: real Lie_StandUp animation (2026-07-17)

DONE (F2/H1 finished): the intro rise is a real KayKit get-up (Lie_StandUp grafted from
Rig_Medium_Simulation, + Lie_Idle), not the old sink trick. Key learning: that clip is
authored for FLOOR-level lying; on a raised bed the origin must drop bed->floor to plant
the feet, which reads as a "sink" if done in place. Solution: get up IN PLACE on the bed
(origin held at HOUSE_LIE_Y, no drop -> no sink), then the drop happens on the first
FORWARD step (sentence 0) so it reads as stepping off the bed; then forward_point -> sword
-> keys -> door. Rise paced by the animation timeline (composer.house_getup_progress, made
MONOTONIC so the finish-frame wrap can't dip). house_move_to now eases yaw
(HOUSE_TURN_SPEED) so leg turns glide. Anchors: bed_point + forward_point in house.tscn.
The intro is now complete (morning walk + no pickup + get-up + top-bar text). Owner
approved. NEXT: the campaign spine (cave-first gating etc.) or owner's pick.

## H1 intro rework + UI: text in the top bar (2026-07-17)

- H1 DONE: the intro is a MORNING WALK -- the sword + keys stay on the wall (looked at,
  not taken); prose reworded + re-hashed ("hij loopt naar de muur. hier hangt zijn zwaard.
  de sleutel heeft hij later nodig. nu gaat hij naar de deur."), win = "Hij maakt een
  ommetje in het bos!". _setup_house keeps the waypoints, drops the pickups. (Removes the
  contradiction with the item-prereq system.) F2 (rise-from-bed) STILL PENDING -- deferred.
- UI STANDARDISED: all scene text (win/setback/nothing/prompts) now renders in the TOP
  BROWN BAR, never a translucent overlay on the 3D scene (immersion). _set_message ->
  _set_top_prompt (auto-sizes height for 2-line "(druk op enter)"); central _message
  deprecated (hidden). Verified intro + smidse wins. STILL OVER-SCENE: the intro BRIEFING
  (_brief_label, the pre-typing rolling instructions) -- owner may want that moved too.

## Campaign v2 slice 1: item prerequisites (2026-07-17)

BUILT + verified: the bow + sword are now PREREQUISITES collected at home before their
training (inverts the Wave-1 bow-as-reward).
- HomeArc = a CHOICE (thuiskeuze -> neem_zwaard/neem_boog): walk in, type zwaard/boog,
  walk to that item, collect (per-item win hides the wall node + sets has_sword/has_bow).
  Controller filters the choice to uncollected items + a "nothing left" case (home.nothing).
- House items are DATA (game_controller HOUSE_ITEMS: node/anchor/flag/take_node) -- the G8
  hotspot generalised (2nd/3rd consumer). house_pickup_bow -> house_pickup_item. Old
  archery_done->bow reward flow removed (archery_done stays = training-done).
- Overworld gating: smidse needs has_sword, boog needs has_bow -> read-aloud hint
  (hint.smidse/hint.boog) via _ow_show_hint + buffer clear instead of travel. test_menu_flow
  has a regression check for it.
- Objective repurposed -> haal_wapens (always active until has_gear = both collected).
  _open_objectives supports active_flag "" = always active.
- Screens: .shots/home_choice.png (both), home_filtered.png (only boog + sword gone).
- NEXT campaign slices (still design-on-hold except this): cave-scare gating (only grot
  first -> unlocks training), the MILL bag scenario, the active skeleton fight (G10), the
  crystal + raised-bridge -> next region (G5). Keys still unassigned.

## Fixes pass + campaign v2 design (2026-07-17)

- Near-term fixes landed: F1 (snapped the eyeballed south hexes to the grid), F3 (smidse
  see-through cropped via a tighter work-scene win camera, FOV 46 -- forge.tscn untouched),
  F4 (fork choice now strolls ~1.4s toward cave/bridge before the cut -- feel wants a live
  check), O1-part (overworld windmill sails now turn). F2 (rise-from-bed) folds into H1.
- CAMPAIGN v2 designed + committed to docs/roadmap.md, BUILD ON HOLD (owner still owns the
  forest). Loop: intro morning-walk -> only the cave open -> skeleton FRIGHTENS (flee) ->
  train (bow@range, sword@smithy, strength@mill/bags) after collecting bow/sword at HOME
  via a house CHOICE, with overworld HINTS if you go to a site without its item -> beat the
  skeleton (active, G10) -> find a CRYSTAL -> lowers the raised drawbridge -> next region
  (island expansion). Items are PREREQUISITES now (inverts Wave-1 bow-as-reward). Pulls
  G5/G6/G10 into the core; windmill becomes a real (mill) scenario, not the O1 placeholder.
- Open: mill bag-choice right/wrong (decide at build); exact skeleton-fight shape; what the
  KEYS are for (unassigned "needed later"). NEXT build slice when un-paused: the
  item-prerequisite + house-choice + site-hint system (reworks existing pieces).

## Wave 1 cont'd: prose-design decision + persistence foundation (2026-07-16)

- **Design spike (#3)**: `docs/design-variant-prose.md` -- the recommended way to handle
  per-character subject nouns (G1) and per-flag scene variants (G6) vs. the A4 hash.
  Summary: G6 variants = just pick a different `prose_key` by flag (each key normally
  hashed, no new mechanism); G1 subject = a `{held}` TEMPLATE token + an approved,
  band-validated noun list, hash the TEMPLATE, enumerate (template x noun) for band +
  typeability at build time. Marked RECOMMENDATION -- confirm before character work
  (touches A4, owner's call).
- **Persistence foundation (#4, C/A5 seed)**: AppProgress now persists CUMULATIVE stats
  under [stats] -- `get_stat`/`add_stat`(/`add_stat_transient`). Hooks (game_controller):
  "words" += word count at every prose-node completion (all scenes = effort); at a REAL
  adventure win (not intro/home) "adventures"+=1, "xp"+= run xp, "stars"+= run stars.
  Verified persist across processes (words=28/adventures=1/stars=3/xp=159 after an
  archery run). These feed the encouraging progress screen (G9) + star cosmetics (G3).
  NOTE: still single-profile per-machine; the multi-profile roster + name picker + a
  ProfileStore contract are the rest of A5, later.

## Wave 1 DONE: objectives/discoverability + bow fetch (2026-07-16)

The first roadmap wave (see docs/roadmap.md) is built + verified:
- `content/objectives.gd` (pure DATA): each objective = { id, active_flag, done_flag,
  target_site, hint_key }. "Open" = active_flag set AND done_flag not. First:
  haal_je_boog (active archery_done, done has_bow_a, target thuis, hint objective.boog).
- Overworld BADGE: a "!" (ChoiceBanner.set_badge, pulsing) on any site with an open
  objective (`_site_has_open_objective`). NUDGE: a one-time read-aloud hint in the top
  bar when returning to the island (`_maybe_nudge_objective`, persists nudged_<id>).
- Bow FETCH payoff: a return-home visit where, if archery_done && !has_bow_a, the knight
  walks to the new `bow_point` anchor (in house.tscn) instead of centre and takes the
  bow at the win (composer `house_pickup_bow` hides the wall bow; sets has_bow_a; win
  text home.win_bow). `_apply_house_locks` now HIDES bow_a once collected (was: only
  ghost/solid). Loop verified: complete range -> badge+nudge on thuis -> go home ->
  "je hebt je boog gehaald" -> badge clears.
- Reused: home-visit walk (house_move_to), pickup one-shot, AppProgress flags, the
  overworld banners. test_content validates objectives (target_site exists, hint
  resolves). NOTE: hardcoded bow_a->has_bow_a for now; generalises to data (G8) when a
  2nd fetch item lands. NEXT (roadmap Wave 1): persistence/A5 + the prose/hash decision.

## Roadmap captured (2026-07-16)

A full brain-dump + ordered backlog now lives in **docs/roadmap.md** (10 new owner
ideas -- character variety, character picker, star cosmetics, scroll quest log, island
expansion, item-gated puzzles, ability-gated diversity, de-hardcoding, progress screen,
typing fight -- folded with the pre-existing backlog into 4 build waves). NEXT BUILD =
Wave 1: the objectives/discoverability layer (map badge + read-aloud nudge, "get your
bow") then the bow fetch payoff. Two foundations gate most of it: the objectives/flag
spine + real persistence (A5). One design knot to settle early: variant/dynamic prose
vs. the A4 safety hash + band limits.

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

## threejs-spike branch (2026-09-08) -- LIVE state on this branch

Godot `main` is untouched; this branch holds the Three.js rebuild spike (`web/`).
- Phase 1 DONE: logic/content/data ported to TS, FNV hashes byte-identical (tests).
- Phase 2 DONE: overworld renders on the WoC recipe (Neutral tonemap + grade + N8AO), hero
  idles at the hub with the authored Godot camera, roads/coast tessellate (Godot `.tscn`
  basis is ROW-major -- see `web/tools/layout_to_island.py`).
- Authoring DONE: islands are `IslandDef` data-as-code (`web/src/content/island/`), hex-grid
  math in `web/src/world/hexGrid.ts`; the island editor (`web/editor.html`, `npm run dev`)
  edits on the real renderer and writes the `.ts` back. Docs: `web/README.md`,
  `web/docs/editor-blueprint.md`, `web/docs/woc-playbook.md`.
- Editor confirmed working hands-on (Tom's edits round-tripped into the game).
- Scene editor DONE (2026-09-08): all nine Godot sets migrated to SceneDef data-as-code
  (web/src/content/scenes/*.ts) by web/tools/tscn_to_scene.py; every component (tiles, props,
  shapes, anchors, camera, routes, lights) is editable in web/editor.html with a placement
  ghost and a scene dropdown. Launch: ./editor.sh. Only the mill's two CSG polygons are not
  represented yet (rebuild them as shapes).
- Playable loop DONE (2026-09-08): web/src/game/ -- island (typed site words, route walk),
  scenario (RunState over band1, prose type-along drives the walk, first-letter choices,
  endings/setbacks set flags), HUD (prompt, band, legend, keyboard). Whole band-1 arc plays
  end to end in the browser: bos -> forest -> kruispunt -> grot -> setback -> island unlocks.
- ALL FIVE scenarios play (2026-09-08): band1, grind, archery, home, mill. Full campaign
  verified end to end in the browser: cave setback -> island unlocks -> home (choose zwaard /
  wapen, walk + pickup grants the gear flag) -> smidse + oefenplein gated on that gear ->
  fully_trained derived. Gate test src/tests/scenarios.test.ts checks every arc's frozen A4
  hash, that each scene's set + anchors exist, and hero-variant typeability.
- NEXT: (a) polish -- choice walk toward the fork before the cut, gaze at cave/bridge while
  typing, score/XP HUD, music, the crystal + drawbridge crossing (brug node), archery crosshair
  + arrows; (b) engine direction decision (Godot vs web); (c) later, package the editor standalone.

## Web build chosen; finger guide + cumulative stats ported (2026-09-09)

Decision (owner, after the Godot-vs-web comparison): **the web build is the direction** --
it runs far better in the browser and now matches the desktop visuals. The two gaps the
comparison named have been closed, so nothing Godot-only remains in band 1.

- **Finger guide** (port of `ui/keyboard_guide.gd` + `ui/finger_hand.gd`):
  - `web/src/game/keyboardSettings.ts` -- the active-layout selector (port of
    `game/keyboard_settings.gd`), persisted in the `layout` profile choice, `?layout=qwerty`
    switches transiently. The on-screen keyboard is now built from `keyboardRows()` of the
    ACTIVE layout instead of a hardcoded QWERTY string, so the board re-letters on a switch.
  - `web/src/ui/fingerHand.ts` -- the finger legend: the two Kenney nail sprites (now in
    `web/public/assets/kenney/monster/`, CC0) used as CSS **masks** so the tint is the finger
    colour, the same trick Godot's `modulate` plays on a white texture. Godot geometry carried
    verbatim (fingertips bottom-aligned at y=96, thumb dropped 18, labels at y=116, idle nails
    darkened 0.5, active scaled 1.14).
  - `web/src/ui/hud.ts` -- `FINGER_COLORS` carried verbatim; the lit key takes its finger's
    colour inline, f/j keep the marked home-anchor label, and `hud.hands(v)` mirrors
    `set_hands_visible` (hands ON in a scenario, OFF on the island where site words are typed).
  - CSS: `#keyboard` is now `[hand][kboard][hand]`; the hands scale via `--hs`
    (0.85 / 0.62 / 0.45 at the 820px + 620px height breakpoints).
- **Cumulative stats** (port of `AppProgress.add_stat`): `getStat` / `addStat` / `allStats` /
  `wordCount` in `web/src/game/flags.ts`, persisted in the same localStorage blob. Wired the
  way Godot wires it: `words` per finished prose beat, and `adventures` / `xp` / `stars` on a
  win that is NOT a house scene (a home chore and the cave setback are not adventures). The
  menu shows the running totals under the title, correctly pluralised.
- 97 tests pass (`npx vitest run`), typecheck clean. Verified in the browser at 1600x1000 and
  1024x600: AZERTY board, `h` lit right-index cyan with the matching nail popped, `o` lit
  right-ring purple, hands hidden on the island, `?layout=qwerty` re-letters the board and
  re-aims the guidance, and a full `bos` run banked 82 words / 1 avontuur / 9 sterren / 300 XP.
- NEXT: make the spike canonical (fold `web/` forward, decide what happens to the Godot tree),
  and the deferred perf/optimization pass.

## Godot stashed; the web build is main (2026-09-09)

Owner: "stash godot for now, three js is the main now, keep godot for reference." Done.

- **Branch**: `threejs-spike` fast-forwarded into `main` (no divergence). The pure Godot
  tree, at its last main tip `41f7fe5`, is preserved on the **`godot-reference`** branch.
- **Layout**: the whole Godot project moved to `godot/` (audio, axis, content, game, input,
  logic, render, scenes, tests, tools, ui, project.godot, export_presets.cfg, icon.svg).
  `assets/` STAYS at the repo root -- it is the shared art + music store, and both trees
  symlink into it (`godot/assets -> ../assets`, `web/public/assets/kaykit`,
  `web/public/audio/music`). Do not replace a symlink with a copy.
  `godot/README.md` marks the tree reference-only and says how to port from it.
  Godot still runs for reference: `godot --path godot`.
- **CI rewritten** (`.github/workflows/deploy.yml`): a push to main now builds
  `web/` (npm ci -> typecheck -> tests -> vite build) and publishes THAT to GitHub Pages.
  The Godot web export, the Linux export and the rolling AppImage release job are gone.
- **Pages base path**: the site is served on the CUSTOM DOMAIN
  **https://typequest.teckhawk.be/**, at its ROOT -- NOT the `github.io/<repo>/` subpath.
  So the build needs no prefix and CI leaves `TQ_BASE` unset (base "/"). (The first push
  set it to `/<repo>/` and briefly broke the live page; corrected the same session.)
  The indirection is kept for the day it moves: `vite.config.ts` takes `base` from
  `TQ_BASE`, and `web/src/assetPath.ts` -- `assetUrl()` -- is the ONE place that prefixes
  `import.meta.env.BASE_URL`. Four call sites use it: hero model loads, island scene model
  loads, music track src, and the finger-legend nail sprites.
- Docs updated: README (layout table + web run instructions), CLAUDE.md (a "where the live
  code is" section at the top; `godot/` marked reference-only), and the `content-check`
  skill now points at `web/src/axis/locale/nlBe.ts` + `web/src/content/` and `npx vitest run`.
- 97 tests pass, typecheck clean.
- NEXT: the deferred perf/optimization pass; fold the remaining Godot-era prose in
  `docs/godot-handoff.md` forward (it is still the best behaviour spec, but its paths are
  now `godot/...`); confirm the Pages deploy is green after the first push.

## Optimization pass (2026-09-09)

The pass the owner asked for long ago (it was gated on the intro landing). Measured first,
in the production build, with `renderer.info.autoReset = false` so the numbers are per-frame
and include the shadow + AO passes.

**Before -> after (draw calls / triangles / meshes):**

| scene | before | after |
| --- | --- | --- |
| island (menu + overworld) | 864 / 140,202 / 224 | **164** / 134,250 / **38** |
| house (intro) | 176 / 80,598 / 47 | **148** / 81,678 / **39** |
| forest fork (bos) | 3,132 / 990,026 / 970 | **292** / 1,225,506 / **72** |

1. **Instanced repeated models** (`render/islandScene.ts`). A model placed 2+ times is now one
   `InstancedMesh` per sub-mesh instead of a clone per placement -- the authored overworld
   places the same 24-triangle water tile 147 times, which cost 147 draw calls (and 147 more
   in the shadow pass) to move 3.5k triangles. Water no longer casts shadows (a flat plate at
   sea level shadows nothing).
   - The forest TRADES triangles for draw calls: an InstancedMesh is frustum-culled as one
     unit, so all 495 trees are submitted even when ~50 are on screen (+24% triangles, -91%
     draw calls). That is the right trade -- draw calls are CPU state changes, the extra
     vertex work is not -- but it is the reason the forest triangle count went UP.
   - Hidden props are NOT folded in: they stay individual hidden clones, because they are
     authored content a later feature turns on (the house wall carries a weapon per hero
     class, tagged and hidden). An invisible object costs nothing to draw.
   - The editor is untouched: it builds its own view (`editor/scene_view.ts`), so picking and
     gizmos still work per object.
2. **One shared GLTF cache** (`game/hero.ts`). Every `HeroRig` used to build its own loader and
   re-fetch + re-parse the character GLB AND both shared rig GLBs, so a scene with two NPCs
   parsed the rigs six times and every picker keypress paid for them again. Now: one loader,
   one promise per URL, clips parsed once, and characters come from `SkeletonUtils.clone`
   (own skeleton, shared geometry). **Six picker swaps: 145ms -> 8ms.** Corollary: `clearModel`
   must NOT dispose geometry/materials any more -- the cache owns them.
3. A regression test (`tests/instancing.test.ts`) pins `placement * local` against what the old
   clone path produced. It immediately caught a real bug: the first version measured sub-mesh
   transforms relative to the TEMPLATE, which silently drops a gltf root node's own transform
   and would misplace every instance of such a model. Fixed to measure relative to the
   template's PARENT.

Frame pacing on the island is a solid 60 (median 16.7ms, p95 17.0ms). First load is 3.1 MB
over 88 requests: 2.7 MB models, 316 kB JS (302 kB gzip of that is three.js itself, which is
normal and not worth splitting), 75 kB images.

**Found while measuring, NOT fixed here -- the web build is missing animation clips.** Godot
loads FIVE rig packs (`godot/render/hero_rig.gd`); the web build loads two, so these clips
resolve to nothing and the animation silently does not play:
`Cheering` (the win celebration), `Sawing` (the grinding work pose), `Lie_Idle` / `Lie_StandUp`
(the intro wake-up -- the hero stands beside the bed instead of getting out of it), and every
`Ranged_*` clip (the archery aim/release). The missing packs are
`assets/kaykit/characters/Rig_Medium_{Tools,Simulation,CombatRanged}.glb`.
Naive fix costs ~1.5 MB more on first load; the right fix is to load a rig pack LAZILY when a
scene first needs one of its clips -- cheap now that `hero.ts` has a promise cache.

- NEXT: the lazy rig packs (restores the missing animations without hurting first load); then
  the 1.48 MB of rig GLBs is the biggest remaining first-load item (they are clips only, and
  the game uses a handful of the 25 clips it downloads).

## Lazy rig packs -- the missing animations are back (2026-09-09)

Fixes the porting gap the optimization pass surfaced: Godot grafts FIVE KayKit rig packs, the
web port loaded two, so four sets of clips resolved to nothing and just silently did not play.

- `web/src/game/hero.ts` -- `EXTRA_RIGS` maps the clips the game uses to the pack that carries
  them, and `ensureClips(names)` fetches a pack ON DEMAND. `play()` / `playOneShot()` now start
  that fetch themselves when a clip is missing and play it when it lands (guarded, so a clip
  that arrives after the player moved on does not pop in). `playOneShot` returns a promise that
  resolves when the one-shot settles, so a beat can be paced to the animation.
- `scenarioMode.enterNode` prefetches what the beat can play (the actors' poses, `Cheering` if
  it can end in a win, the loose in the practice yard, the intro's bed clips) before staging,
  so the pose is right from the first frame.
- **Restored:** the win `Cheering` (a LOOP, as in Godot's `play_lead_loop` -- he holds the
  celebration while the message is up, instead of nothing at all); the forge `Sawing` grind
  pose (`POSE_CLIPS.work` was standing in with `Idle_A`); the archery `Ranged_Bow_Aiming_Idle`
  aim and the `Ranged_Bow_Release` loose per sentence; and the intro **wake-up** -- he now
  starts asleep on the bed at `bed_point` (HOUSE_LIE_Y 1.2, yaw 180), folds upright with
  `Lie_StandUp`, and only then sets off, dropping to floor height over the first fifth of the
  prose so it reads as stepping off the bed (Godot `set_house_start` / `house_stand_up`).
- **First load is unchanged**: the menu still fetches only the two base packs. Simulation
  arrives with the intro, Tools with the forge, CombatRanged with the practice yard. Loading
  all five eagerly would have put 3.25 MB of animation on the critical path.
- `web/src/tests/clips.test.ts` parses the real GLBs off disk and asserts that every clip the
  source plays exists in a pack the game will actually load. Verified it bites: pointing a pose
  at an undeclared clip fails the suite. `@types/node` is dev-only and referenced from that
  test alone, so the app's sources keep a browser-only global scope.
- 105 tests pass, typecheck clean.
- NEXT: the 1.48 MB of base rig GLBs is now the biggest first-load item (clips only, and the
  game plays a handful of the 26 it downloads) -- stripping them to the used clips is the next
  real win. The per-class ranged variants (`Ranged_Magic_*`, `Ranged_1H_*`) are declared and
  loadable but nothing selects them yet; wiring weapon class to pose is still open.

## Per-class ranged variants + a content check on the practice yard (2026-09-09)

The `characters.RANGED` table was already ported but nothing read it, so every class mimed a
bowstring at the oefenplein. Now wired (Godot C-mini):

| class | weapon (hand) | aim | fire | flies |
| --- | --- | --- | --- | --- |
| knight | bow (left) | Ranged_Bow_Aiming_Idle | Ranged_Bow_Release | arrow |
| ranger | crossbow (right) | Ranged_1H_Aiming | Ranged_1H_Shoot | bolt |
| mage / witch | wand (right) | Ranged_Magic_Spellcasting | Ranged_Magic_Shoot | a code-built glowing orb |
| barbarian / rogue | axe / dagger (right) | Idle_A | Throw | the weapon itself, tumbling |

- `scenarioMode` resolves the loadout when the archery set is staged, prefetches its two clips
  (they live in the lazily-loaded CombatRanged pack), swaps the descriptor's authored "bow in
  hand" for the class's weapon and grip, and looses the class's `fire` clip per sentence.
  `effects.magicBolt()` is the wand's projectile; `Arrow` gained a `spin` option for the
  tumbling axe/dagger.
- **Godot's `spin` flag is deliberately NOT applied.** It compensates for how Godot's
  BoneAttachment3D orients a child, which is not how three.js orients a bone child -- porting
  it on faith flipped the knight's already-approved bow. Correct a grip only after looking.
- All four styles verified in the browser (witch shares the mage row, rogue the barbarian one),
  and the knight's staging is byte-for-byte the look that was already signed off.

**Content check on the practice-yard text -- 1 issue, fixed.** `boog.prose` read "het schot
vliegt snel recht door de lucht", and "schot" is a SHOT: true for the bow, crossbow and wand,
wrong for the barbarian and rogue who THROW. Now "het vliegt snel en recht door de lucht",
which is true for all six. That is a deliberate authored change, so the A4 hash was re-signed
as the sign-off: `fnv1a:15ae56be` -> `fnv1a:2cb6ed08` in `archery/archeryArc.ts`.
Cross-checked clean: `boog.narration` / `boog.win` / `hint.boog` / `word.boog` / `site.boog`
are all weapon-neutral; "doel" still means only the target and "wapen" only the ranged weapon;
`{held}` everywhere with no hardcoded class and no gendered pronoun; band-1 holds (<= 10 words
a sentence, <= 9 letters a word, lowercase a-z + space + period, AZERTY with no Shift).

**The safety gate was only covering one arc of six.** `content.test.ts` validated band-1 alone,
so the approved hashes on grind, archery, home, mill and intro were never checked. It now loops
`scenarios.LIST`, so a new scenario is covered the day it is added. All six pass.

**Flagged, NOT changed (outside this scope, owner's call):**
- `grotFight.prose` hardcodes "spant de sterke boog", "een pijl" and "trekt het scherpe zwaard".
  That mislabels every non-knight -- a heks does not span a bow or draw a sword. Needs the same
  neutralising treatment plus a re-signed hash.
- `site.boog` = "oefenplein" is 10 letters against band-1's `maxWordLen` 9. Site words are typed
  by the child but are not run through the validator, so nothing catches it.
- 110 tests pass, typecheck clean.
- NEXT: the two base rig GLBs (1.48 MB, clips only) are still the biggest first-load item.

## Three fixes: the m key, the reveal window, the wall weapon (2026-09-09)

All three reported by the owner playing the live build.

1. **Typing "m" toggled the music instead of typing.** The mute shortcut was a bare `m`, and m
   is a LETTER (AZERTY home row, right pinky), so the handler swallowed it and no word
   containing an m could be typed. Mute is now **ctrl+m**, checked before the bare-modifier
   guard in `main.ts`. Verified with real keydown events, not the test harness (the harness
   calls `scenario.char` directly and bypasses the listener that had the bug -- which is why
   no test caught it).
2. **The whole paragraph was visible at once.** `logic/reveal_window.gd` was never ported --
   it is the B5 reveal window. Now `web/src/logic/revealWindow.ts` (faithful port: 40 chars of
   look-behind snapped to a word boundary, the current word plus 4 more ahead) and `hud.prose`
   renders through it. The band is a stable couple of lines instead of a growing wall of text:
   the intro's 176-character passage now shows ~26 characters at the start. Purely presentational
   -- typing still compares and scores against the FULL prose, exactly as Godot does.
3. **Every hero saw a crossbow on the house rack.** `house.ts` authors one weapon per class
   tagged `weapon_<id>`, but the `tags` field was declared in `SceneDef` and read by NOTHING,
   and the crossbow happened to be the one variant not marked hidden. `buildIslandGroup` now
   takes an `activeTags` set: a TAGGED prop is drawn only when one of its tags is active, and
   for a tagged prop the tags are authoritative -- the authored `hidden` flag does not apply,
   since the set marks every variant hidden so the editor is not a pile of stacked weapons.
   `scenarioMode` passes `weapon_<heroId>` (Godot `scene_composer.show_hero_weapon`).
   Verified: barbarian -> axe with "hier hangt je bijl", ranger -> crossbow with "kruisboog".
   The prose was already correct via the `{wapen}` token; only the prop was wrong.

New tests: `revealWindow.test.ts` (9) pins the window boundaries, and `weaponVariants.test.ts`
(5) asserts exactly one weapon hangs for every hero in the roster and that it is the one the
prose promises. 124 tests pass, typecheck clean.

- NEXT: the two base rig GLBs (1.48 MB, clips only) are still the biggest first-load item.
  Still open from the content check: `grotFight.prose` hardcodes bow/arrow/sword, and
  `site.boog` "oefenplein" is 10 letters against band-1's 9.

## QA sweep: all six classes played end to end (2026-09-09)

Six agents, one per class. Captures were scripted with a throwaway playwright-core harness in
the scratchpad (each class in its OWN browser process, so they ran in parallel), then a reviewer
agent read every screenshot against the exact prose for that beat. The brief was the owner's:
**does what the child is asked to TYPE match what is SHOWN.**

### The one root cause behind every class-fit blocker

`{wapen}` is only ever applied in `intro.prose` and `grotFight.prose`. Six strings hardcode
"zwaard", so every non-knight is told to type the knight's weapon while standing in front of
their own: `home.sword_prose`, `home.win_sword`, `word.zwaard` (the word the child TYPES),
`hint.smidse`, `slijpen.prose` (3x "zwaard" + "het staal") and `slijpen.win`.
**Inherited, not a port regression** -- `godot/axis/locale/nl_be.gd` has the identical text.
The models are already correct per class (the tag work landed): the mage walks to a staff, the
rogue to a dagger, the barbarian to an axe, the ranger to a crossbow, and no sword is in the
room at all. Art axis right, locale axis wrong.

### Scene/text mismatches confirmed on every class

- intro `"de {held} loopt naar het rek aan de muur"` -- he never walks to the rack; he rises and
  stays on/next to the bed. (The `thuis` visit DOES walk him to the wall, so the motion exists.)
- cave `"de {held} rent snel terug naar het licht"` -- he never retreats; on some runs he stands
  beside the skeleton with his arms raised while the text says he flees in fear.
- mill: `"hij ziet je bij de open deur"` (the door is shut), `"maalt het graan tot fijn meel"`
  (no grain, no milling), `"zwaait je vrolijk uit"` (no wave). Camera also frames hero + miller
  at ~60px in a 1440px shot.
- `"in de grot rammelt een wit skelet"` -- the model is a dark armoured skeleton warrior with a
  magenta cloak and glowing yellow eyes. "wit" does not read, and it is scarier than the register.
- The house's LEFT wall carries a decorative bow + quiver and a wand for every class, plus a
  crossed-swords crest over the door. Godot hides exactly these (`show_hero_weapon` also hides
  the standalone bows and the sword+shield); the web port does not, so the intro points the child
  at "het rek aan de muur" where another class's bow is the most legible object.
- Still open from the knight run: no crystal model in the cave, the drawbridge never lowers, the
  skeleton never falls, no smith NPC at the forge, and a fetched weapon never leaves the wall
  into the hand.

### Reported but NOT defects (checked, do not chase)

- Black capture frames = the `fadeCut` scene transition caught mid-fade by the screenshotter.
- `"aan de andere kant hangt de sleutel"` is CORRECT: the keyring is at x=-5.4 (left wall) and
  every weapon-rack variant at x=+5.2..5.9 (right wall). Two reviewers misread it because the
  decorative bows share the left wall with the key -- which is the bow-decor defect above, not a
  prose defect.
- "smidse / oefenplein never opened" in four runs was the capture harness re-picking already
  played sites, not a game lock; the knight agent reached both.

### Open CONTENT decisions (owner's call, deliberately not changed)

1. The forge song is built around SHARPENING: `"slijp slijp slijp het grote zwaard"`. A staf or
   a kruisboog cannot be sharpened, so a plain `{wapen}` swap fixes the grammar and breaks the
   sense. Needs either per-class phrasing or a neutral rewrite of the beat.
2. `word.zwaard` is one of TWO fetch banners at `thuis` ("zwaard" and "wapen"). For a knight both
   words mean the same object, and picking "wapen" hands him a bow. Tokenising one without
   redesigning the pair leaves the ambiguity.
3. `hero.rogue` = "dief". The reviewer argued it reads to a 6-year-old as the everyday word for a
   criminal, not a class ("de kleine dief wandelt door het bos"). Every other class names a role.
   Worth a kid-facing rename.

- NEXT: decide 1-3, then land the `{wapen}` tokenisation with re-signed hashes in one pass.

## The caster's forge beat: a floating spellbook (2026-09-09)

Follow-up to the three-group forge. The caster beat still played on the grinding set, so a
witch "read a spellbook" behind a grindstone wheel that filled the frame -- the same
text-does-not-match-picture defect the whole pass is about.

- The grindstone is TAGGED `forge_blades` / `forge_ranged`, so it is simply absent for a
  caster. This reuses the prop-variant mechanism built for the house weapon rack: the mode
  passes `forge_<group>` alongside `weapon_<heroId>` as the active tags.
- A pedestal was tried and dropped in favour of the owner's better idea: the book HANGS in the
  air in front of her, tipped 45 degrees so the open pages face the child, bobbing gently, with
  the forge's spark shower guttering underneath it as the spell is read.
  `scenarioMode.floatBook()` + `BOOK_HEIGHT` / `BOOK_BOB`.
- `WORK_READ` in cameraRigs frames it: the WORK rig sits low and pitched at the wheel, which
  buried the hero behind the bench once the wheel was gone.
- Sizing took two passes and both were caught by LOOKING, not by tests: scaled 1.9 the book was
  a magenta wall, and at head height it masked her face. It now sits at chest height, pushed
  0.35 toward the camera, at 0.8 scale.

Blades regression-checked in the same build: knight still gets `Sawing`, the grindstone, his
sword on the wheel, sparks, and "slijp slijp slijp je zwaard scherp".

- NEXT: the ranger's fletching beat has had no visual pass yet (it stages an arrow bundle on
  the old grind_point and keeps the WORK camera). The remaining scene/text gaps from the QA
  sweep are unchanged: no crystal in the cave, the bridge never lowers, the skeleton never
  falls, no smith NPC, the intro walk to the rack, and the mill door.

## Forge pass over all six classes (2026-09-09)

Iterated every hero through the smidse and looked at each one.

- **The ranger fletches at a WORKBENCH.** The grindstone is now tagged `forge_blades` alone;
  `table_medium` is tagged `forge_ranged`, and the arrow bundle sits on its measured top. A
  grinding wheel was no use for making arrows.
- **The grinding camera was wrong for everyone.** The ported Godot WORK rig (off y 1.9, fov 75)
  sat level with the wheel, which occluded the hero from the chin down and hid the very weapon
  the song is about -- QA had flagged this on three separate classes. Raised and narrowed to
  off y 2.45 / fov 66. `WORK_READ` covers both wheel-less beats (caster and ranger).
- **Blades are size-normalised.** sword, axe and dagger are authored at wildly different scales
  and `axe_C` at native size covered the hero's head, so the weapon is scaled to a fixed
  BLADE_LEN by measurement and seated on the measured top of the wheel, pushed to its near face.

**The bug under all of it:** `getObjectByName("<model path>")` never matched anything. Instanced
meshes carry the model path as their name, but a SINGLE-placement prop is a cloned gltf root
called "Scene", so every measurement lookup silently returned undefined and quietly did nothing
-- which is why the book and the blade both needed hand-tuned magic numbers earlier. Cloned
wrappers are now named by model path, and staged props by their vocabulary id, so measuring
against a prop actually works. Prefer measuring over guessing here; the models disagree wildly.

Verified per class: knight/zwaard, barbaar/bijl, verkenner/dolk all grind with their own weapon
legible on the wheel; jager/kruisboog fletches at the bench with arrows on it; magier and heks
read from the floating spellbook with no grindstone in the set.

Note: editing an authored scene by hand breaks `scenes.test.ts` ("serialises byte-identically").
Regenerate the file with `serializeIslandTs` instead of hand-formatting it.

- NEXT: unchanged from the QA sweep -- no crystal in the cave, the bridge never lowers, the
  skeleton never falls, no smith NPC, the intro walk to the rack, and the mill door.

## QA remediation: crystal, skeleton, mill, intro walk (2026-09-09)

Working the QA sweep's scene/text mismatches. Five of six closed.

- **The cave has a crystal.** `Gem_Large` copied in from the library (its texture was already
  here), staged on the cave floor beside the skeleton for the `has_crystal` beat, and hidden
  with a `PickUp` one-shot when the beat is won. The prose promised one for months.
- **The skeleton falls.** Every NPC in the dungeon plays `Death_A` clamped on `Death_A_Pose`
  at the win -- Godot's `topple_skeleton`. Verified in-game: it is on the floor at the win.
- **The mill tells the truth.** The windmill model's door is baked shut, the miller stands
  outside on the path, and nothing mills or waves, so "maalt het graan tot fijn meel", "bij de
  open deur" and "zwaait je vrolijk uit" were all inventions. Rewritten to the scene; the tip
  he gives is the point of the beat and is unchanged. Hash re-signed `fnv1a:d8422584`.
- **The intro walk happens.** `travel` is now a POLYLINE (`pointOnRoute`), not a straight
  from/to, so the intro walks bed -> weapon rack -> key -> door, which is the order the prose
  names them (Godot's `_house_way` waypoints). Time is spent per leg in proportion to LENGTH,
  so the pace stays even however the anchors are spaced. `route.test.ts` pins that.
  Verified: at 20% he is at the rack, at 70% at the key, at 100% at the door.
- **The missing smith is moot** -- the blades rewrite already dropped "roept de smid".

**Not done: the drawbridge never lowers.** `brug.prose` says "de brug ligt naar beneden", and
Godot lowers a `bridge_leaf` node from an authored raised rotation once the crystal is placed
(`scene_composer._apply_bridge_lift` also walks the hero over the deck via bridge_near/
bridge_far). The web fork set has the two anchors but NO bridge model at all -- nothing to
rotate. This needs a bridge authored into `forest_fork.ts` with a raised angle, the lower
animation, and the deck-walk, which is a scene-authoring job rather than a code fix.

- NEXT: the drawbridge, above.

## Instanced scenery was being culled while still on screen (2026-09-09)

Owner spotted the cave mouth at the forest fork "half gone on the outside". It was my
instancing, and it affected every set with repeated scenery.

`THREE.InstancedMesh.computeBoundingSphere()` produced bounds that were TOO SMALL and
off-centre for these scatters -- measured on the fork, every instanced set was short by 5-10
units with its centre out by up to 16. three then frustum-culled the whole InstancedMesh while
part of it was still in view, so lumps of rock and trees popped out at the edge of the frame.
Because an instanced set is culled as ONE unit, losing it loses everything at once, which is
why it read as half the cave disappearing rather than a few stones.

`fitInstanceBounds()` now unions the geometry box under each instance matrix and derives the
sphere from that -- conservative, so the worst case is drawing something just off-screen.
Verified against an instancing-disabled build: the fork now renders identically.

`instancing.test.ts` asserts every instance corner lies inside the culling bounds for a wide
scatter, and it FAILS when swapped back to three's own computation, so the regression cannot
come back quietly.

Lesson for the next time: three's built-in bounds helpers are not automatically right for
instanced scatters. Measure them.

## The cave frame, and a colour cast that was not real (2026-09-09)

Two follow-ups the owner raised.

**The cave was framed past its own ceiling.** The dungeon set has no roof -- its rubble tops out
at about y = 7.5 -- and it was using the shared STANDING rig, whose wide 75-degree lens looked
straight over the top into the empty background. The frame ended on a hard rock silhouette
against a void, which read as the set being cut off. It now has its own `CAVE` rig (off
[0, 2.9, 7.6], look [0, 1.15, -1.4], fov 50): the walls fill the shot, and the hero, the
skeleton and the crystal all read at the size the beat is about. STANDING is shared with other
sets so it was deliberately left alone.

**The warm/gold cast over the screenshots is NOT in the game.** Chased it properly rather than
"fixing" it: no CSS filter anywhere, computed styles identical between scenes, and the decisive
check is that the Terug button -- a fixed `#9c7b56` = (156,123,86) -- samples as (144,120,0)
in the affected captures and correct in others. A fixed CSS colour cannot change, and the same
crush appears on the MENU in the same session, so it is the headless capture path, not the
scene, not the grade and not the lighting. Do not go looking for it in the renderer.

- NEXT: the drawbridge still never lowers (needs a bridge model authored into forest_fork.ts;
  see the earlier entry). The mill still uses the wide STANDING rig, which QA flagged as framing
  the hero and the miller at ~60px -- worth the same treatment the cave just got.

## The drawbridge lowers, and the mill is framed (2026-09-09)

The last two QA items.

**The drawbridge.** It was never a missing model: the bridge is authored in `forest_fork.ts` as
ELEVEN primitive shapes (deck, two rails, eight slats) already tilted 65 degrees into the raised
pose, which is why searching for a bridge mesh found nothing. They now carry `name: "bridge_leaf"`
and `buildIslandGroup` collects them under a single pivot placed at the `bridge_near` anchor --
the hinge -- so the whole leaf swings as one. `scenarioMode` rotates it back by the authored
angle once `has_crystal` is set, and the crossing route now goes OVER the deck
(path_near -> bridge_near -> bridge_far -> path_far at deck height), which the polyline travel
added for the intro made a two-line change. Verified: 0 degrees raised, -65 lowered and lying
flat across the water, and the leaf has all 11 children.

**The mill.** Same fix as the cave, opposite cause: the wide shared STANDING rig left the hero
and the miller at about 60px in a 1440px frame, marooned in an empty field, so the one NPC the
beat is about was unreadable. It has its own `MILL` rig now (fov 46, closer) and the pair fill
the shot in front of the windmill -- which also makes the rewritten prose ("de molenaar staat
voor zijn molen") land, since you can now see that he does.

Re-authoring note: adding the `name` field meant regenerating `forest_fork.ts` through
`serializeIslandTs` rather than hand-editing, or the byte-identical round-trip test fails.

- NEXT: nothing outstanding from the QA sweep.

## Owner playtest: a total blocker, and four unported behaviours (2026-09-09)

Owner played as the barbaar and found the gear fetch unwinnable. Root cause and four more.

**BLOCKER -- the gear fetch could not be completed by ANY class.** `RunState.choose` compared
the typed word against `locale.resolve(wordKey)`, which for the gear fetch is the literal
`"{wapen}"`; the banner shows the FILLED word. Nothing matched, the fork looped, no flags were
set, and the forge and practice yard stayed shut. Not per-class -- the raw key is `"{wapen}"`
for all six, the knight included. `RunState` now carries `heroId` and matches the filled word.
Underneath it: the exported `nlBe` OBJECT omitted `fillTokens` while the module exported it, so
anything handed the object (the pure layer, tests, the validator) silently resolved tokens to
literals. `main.ts` happened to reach for the module export, which is why it only bit when the
pure layer needed it. `forkWords.test.ts` now walks every fork in every arc for every hero.

**The island hint printed `{wapen}` raw** -- overworld hints never filled tokens; the mode is
now told which hero it is.

**The skeleton toppled on the SCARE beat** (my regression from the QA pass): the topple was
gated on "dungeon + win", but the first cave visit is a win-type ending the hero flees. Gated
on the armed fight now.

**The intro swapped person mid-passage** -- "de barbaar loopt ... JE maakt een ommetje". Third
person throughout, using "een {wapen}", which also dodges the de/het trap. Re-signed:
intro `abed98f8`, home.sword `d06303cc`.

**Multi-leg walks looked janky** because the facing was set once, at the FINAL destination, so
the hero crabbed sideways through every turn. He now faces along the current leg, eased.

**Two behaviours Godot has that the port never had** (not regressions -- gaps):
- the miller AMBLES a loop round his mill. The route is authored in `mill.ts` as `miller_path`
  and was simply never walked (Godot `_tick_miller`). Ported: `pacer` + `PACE_SPEED` 1.4.
- the cave scare has the hero RUN back toward the light. The prose has always said "rent snel
  terug naar het licht" and neither build moved him; he now travels centre -> path_near as the
  beat is typed, so the fright reads.

- NEXT: re-run the six-class QA sweep against this build.

## The start screen goes fullscreen (2026-09-10)

Owner: the menu has no typing band and no keyboard, so the brown strip under the stage was
dead space there. The menu and the picker now take the WHOLE window; the playing states
letterbox as before.

- `body[data-cinema]` (set in `main.ts` on menu/picker, cleared on island/scenario) makes
  `#app` 100vh and hides `#stage-mask` + `#bottom`. The canvas already has a ResizeObserver,
  so the 3D view re-fits itself and nothing else needs to know.
- The framing had to be retuned: at the old zoom the island overflowed the taller frame
  (measured -- land spanned -0.14..0.96 across, 0.16..0.99 down). `MENU_ZOOM` 1.5 -> 1.95 and
  a menu-only `MENU_BIAS` 1.5 now put it fully inside (0.04..0.83, 0.26..0.92). Menu only; the
  playing island view is untouched.
- The flat 55% scrim was fine over a letterbox strip but muted the whole island at fullscreen.
  It is a radial pool behind the title and buttons now, so the map stays bright at the edges.

Measure the framing rather than eyeballing it: projecting the land bounding box to screen
fractions caught both the overflow and the off-centre in one step.

## The ranged gate sent casters and the jager on a pointless errand (2026-09-10)

The ranger and mage reviews found the same structural bug, and it is the clearest example yet
of a feature landing without its consequences being followed through the content.

The practice yard requires `has_ranged`, and ONLY the bow/crossbow fetch granted it. But a
jager's kruisboog and a caster's staf ARE ranged weapons -- so those classes were told
"Haal eerst een boog thuis!", made a second trip home for an off-class weapon, and then trained
with it: **a magier cast spells holding a bow**, and a jager shot a plain boog while the game
called his weapon a kruisboog.

- `primaryIsRanged()` (true for the ranged and caster groups) now decides this. Fetching the
  primary weapon sets `has_ranged` as well for those classes, and the bow/crossbow branches are
  filtered out of their home fork entirely -- the blade classes still get the choice, which is
  the point of that feature.
- Casters now train with the **staff**, not a wand. The wand was small enough that a reviewer
  read the mage's hands as empty, and the staff is what `{wapen}` names anyway.
- `gearGating.test.ts` pins the rule per hero, so a future change cannot quietly re-introduce
  the errand.

Verified: a mage is offered only "staf", taking it sets both flags, and the practice yard arms
him with the staff and fires a magic bolt into the target.

### Still open from the five reviews (owner's call)

- **A fetched weapon never leaves the wall into the hand** -- ALL FIVE reviewers, every class.
  The single most-reported defect in the sweep, and it undercuts the whole fetch scenario.
- **"een wit skelet" is a dark armoured warrior with glowing yellow eyes.** Every reviewer
  flagged both the wrong colour word and that it is the scariest asset in a game for six-year-olds.
- **Soft-gated sites lose their padlock** once `met_skeleton` unlocks them, so a child types a
  word the menu presents as available and is refused.
- The caster forge prose still names "je staf" while only the spellbook is staged.
- The archery camera sits close behind the hero; a mage's hat crowds the frame.
- 5-20 consecutive black frames on some scene loads (worst at the forge).
- The **throw path** (barbaar/verkenner axe or dolk at the yard) is STILL unexercised: both runs
  fetched a boog. Now that the blade classes keep the choice, a run that takes the melee-only
  path would finally cover it.
