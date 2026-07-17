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
