extends Node3D

## The game loop: connects the pure logic (RunState/TypingState/Scoring) to the
## render layer (SceneComposer + UI) for playable band-1 beats.
##
## Seam discipline (brief B2/B3): the renderer reads observed state ("what is
## true") -- the typing cursor and the progress signal -- and derives its own
## visuals. Logic never receives render-shaped data. The protagonist motion is the
## progress signal expressed as travel (B3), not a second progress channel.

const Band1Arc = preload("res://content/band1/band1_arc.gd")
const LocaleNlBe = preload("res://axis/locale/nl_be.gd")
const SceneComposerScript = preload("res://render/scene_composer.gd")
const TypingState = preload("res://logic/typing.gd")
const RunState = preload("res://logic/run_state.gd")
const SceneActivity = preload("res://logic/scene_activity.gd")
const KeyboardInput = preload("res://input/keyboard_input.gd")
const KeyboardSettings = preload("res://game/keyboard_settings.gd")
const AppProgress = preload("res://game/app_progress.gd")
const IntroArc = preload("res://content/intro/intro_arc.gd")
const MEDIEVAL_FONT = preload("res://assets/fonts/MedievalSharp-Regular.ttf")
const TypeAlongPanel = preload("res://ui/type_along.gd")
const KeyboardGuide = preload("res://ui/keyboard_guide.gd")
const ChoiceBannerScript = preload("res://ui/choice_banner.gd")
const SiteLegendScript = preload("res://ui/site_legend.gd")
const MenuScreenScene = preload("res://scenes/menu/menu_screen.tscn")
const MenuBannerScene = preload("res://ui/menu_banner.tscn")
const Scenarios = preload("res://content/scenarios.gd")
const OverworldSites = preload("res://content/overworld.gd")
const Objectives = preload("res://content/objectives.gd")
const MusicPlayerScript = preload("res://audio/music_player.gd")

enum Phase { PROSE, CHOICE, PAUSE, WIN, DONE }
enum AppState { MAIN, OVERWORLD, PLAYING, PICKER }

const VIEW_HEIGHT := 680   # top: the 3D scene gets its OWN area (a SubViewport)
const BAND_HEIGHT := 400   # bottom: the UI band (680 + 400 = 1080 window)

# Follow camera: a fixed offset behind/above the hero, so the hero stays the same
# apparent size wherever it is on the path (and every scene frames the same).
const CAM_OFFSET := Vector3(0, 3.4, 7.5)
const CAM_LOOK_Y := 1.0
const CAM_LERP := 4.0

var _viewport: SubViewport
var _camera: Camera3D
var _locale
var _run
var _composer
var _activity := SceneActivity.Tracker.new()

# gaze (standing scenes)
var _gaze_yaw := 0.0
var _gaze_mode := "none"
var _links_idx := -1
var _rechts_idx := -1

var _phase: int = Phase.PROSE
var _prose := TypingState.new("")
var _candidates: Array = []     # [{ word, choice }]
var _picked = null
var _buffer := ""

# archery: per-sentence landing points; the crosshair homes to each as it is typed,
# a longer sentence lands closer to the bullseye, and an arrow fires per sentence.
var _arch_ring: Array = []   # Vector2 landing offset (metres on the target) per sentence
var _arch_span: Array = []   # [start, end) char range per sentence
var _arch_fired := 0
var _arch_t := 0.0

# house intro: one sentence = one leg of a waypoint walk (rise, fetch sword, fetch key,
# leave). The knight glides toward the current leg's waypoint as its sentence is typed,
# and picks up the sword/key when he arrives (the cursor passes that leg's end).
var _house_span: Array = []      # [start, end) char range per sentence
var _house_way: Array = []       # Vector3 waypoint per sentence (leg s ends here)
var _house_pickups: Array = []   # [sentence_index, "sword"/"key"] events, in order
var _house_pick := 0
var _house_stood_up := false     # the intro get-up (Lie_StandUp) fires once
var _house_getup_started := false
var _house_getup_gp := 0.0       # monotonic get-up progress (never dips -> no bed clip)
var _house_bed := Vector3.ZERO   # the bed lie spot (steps off to path_near as he rises)
var _house_bedside := Vector3.ZERO   # where he stands after the get-up; the walk starts here
# house return visit (not the intro): a simple walk in, door -> room, over the prose
var _house_visit_from := Vector3.ZERO
var _house_visit_to := Vector3.ZERO
var _house_visit_fetch := ""   # item id to pick up on arrival ("" = plain look-around)

# UI
var _type_along
var _keyboard
var _narration: Label
var _message: Label
var _hud: Label
var _choice_layer: Control
var _banners: Array = []
# a short walk toward the chosen path before the scene cut (fork: cave/bridge)
var _walkoff: Dictionary = {}
var _bridge_lower: Dictionary = {}
const CHOICE_WALK_DUR := 1.4
const EXIT_WALK_DUR := 2.6      # stroll off the far path at the end of a crossing (minimum)
const EXIT_WALK_SPEED := 1.3    # units/sec -- a farther cross_exit = a longer walk, same pace
const EXIT_FADE_DUR := 0.8      # soft fade-to-black on either side of the island swap
const SCENE_FADE_DUR := 0.28    # quick fade-to-black that cushions a scene CUT (fork->cave,
								# island<->scenario, win->island) so nothing snaps
const BRIDGE_LOWER_DUR := 1.6   # the crystal-lowering drop before the crossing walk
var _ui: Control
var _menu_layer: Control
var _menu_screen: Control
var _band: Control
var _viewport_container: SubViewportContainer
var _app_state := AppState.MAIN
var _picker_index := 0
var _picker_after := Callable()   # what to do once a hero is confirmed
var _music
var _top_bar: NinePatchRect   # small brown bar at the top (the overworld prompt)
var _top_prompt: Label
var _brief_label: Label       # intro briefing text (typed out, kept on screen)
var _brief_tween: Tween       # drives the briefing typewriter (killed on bail-out)

const BRIEF_W := 1040.0       # briefing text box width (wraps long sentences to ~2 lines)
var _back_button: TextureButton   # leave a scenario, back to the island

# overworld (the walkable scenario picker)
var _ow_candidates: Array = []   # unlocked sites: [{ word, site }]
var _ow_buffer := ""
var _legend: SiteLegend          # right-side colour key (replaces the floating site banners)
var _ow_walk = null              # { legs: [{route, reverse}], leg, dist, site }
var _ow_entering := false        # true during the brief "al gedaan" ack beat before a replay
var _ow_at := "hub"              # anchor the hero stands at on the island
var _walk_capture := false       # debug: hold at the route end instead of starting the scenario
var _topcam := false             # debug: overhead overworld camera for tracing roads
var _hidebanners := false        # debug: hide site banners (judge clouds/tiles cleanly)
var _ow_mouse_active := false    # true once the mouse has moved (enables map panning)
const OW_PAN_RANGE := 15.0       # how far the mouse can push the idle island view
const OW_IDLE_BIAS := 5.0        # shift the idle focus south so the far windmill is in frame
const OW_IDLE_ZOOM_DEFAULT := 1.5   # default island pull-back (bigger = more zoomed out)
const OW_ZOOM_MIN := 0.8
const OW_ZOOM_MAX := 3.0
const OW_ZOOM_STEP := 0.12
var _ow_zoom := OW_IDLE_ZOOM_DEFAULT       # mouse-wheel adjustable + persisted (settings.cfg)
const OW_WALK_SPEED := 4.5

# Overworld site colour coding: each site gets a coloured flag ON the map and a matching pill
# in the right-side legend (SiteLegend), so no text floats over the island. 5 sites, 4 native
# KayKit flag colours; molen uses a tinted (orange) flag -- no native asset for it. The pill
# colour matches the flag so the legend reads as a key. Re-colouring a site is a one-liner.
const SITE_FLAGS := {
	"bos": {"model": "flag_green", "color": Color("5aa84b")},
	"smidse": {"model": "flag_red", "color": Color("c0392b")},
	"boog": {"model": "flag_yellow", "color": Color("e2b53a")},
	"thuis": {"model": "flag_blue", "color": Color("3778b8")},
	"molen": {"model": "flag_yellow", "color": Color("e07d22"), "tint": Color("e07d22")},
}

# demo / capture
var _demo := false
var _in_intro := false      # the wake-up-and-leave-the-house intro is running
var _intro_briefing := false  # the intro explanation is rolling (typing is disabled)
var _force_intro := false   # --intro dev flag: replay the intro even once seen
# Dev tools are HIDDEN on the shipped build (web/AppImage) so a child can't reset or flip
# their own progress. Reveal them by typing DEV_CODE on the main menu; a debug build (the
# editor) shows them without the code. Session-only -- re-type each launch.
var _dev_unlocked := false
var _dev_code_buf := ""
var _intro_reset := false   # options: intro-seen was just cleared (confirmation label)
var _demo_accum := 0.0
const DEMO_INTERVAL := 0.10


func _ready() -> void:
	_locale = LocaleNlBe.new()
	var args := OS.get_cmdline_user_args()
	# debug: force a keyboard layout for this run (--layout=azerty|qwerty), transient
	# so it does not overwrite the persisted choice; must run BEFORE the UI is built.
	var layout_arg := _arg_value(args, "--layout")
	if layout_arg != "":
		KeyboardSettings.set_transient(layout_arg)
	_force_intro = "--intro" in args   # replay the intro regardless of the seen flag
	var flag_arg := _arg_value(args, "--flag")   # debug: set an unlock flag transiently
	if flag_arg != "":
		AppProgress.set_flag_transient(flag_arg)
	var hero_arg := _arg_value(args, "--hero")   # debug: preview a chosen hero (e.g. --hero=witch)
	if hero_arg != "":
		AppProgress.set_choice("hero", hero_arg)
	_build_layout()
	_ow_zoom = AppProgress.get_setting("ow_zoom", OW_IDLE_ZOOM_DEFAULT)   # restore saved island zoom
	_topcam = "--topcam" in args
	_hidebanners = "--nobanner" in args
	_demo = "--demo" in args
	# debug: walk a single overworld route hub->site and HOLD at the end (no scenario cut)
	# so the drift at the arrival can be inspected. e.g. --walk=bos --burst
	var walk_arg := _arg_value(args, "--walk")
	if walk_arg != "":
		_walk_capture = true
		_show_overworld("hub")
		for s in OverworldSites.sites():
			if s.id == walk_arg:
				_begin_ow_travel(s)
				break
		if "--burst" in args:
			_capture_burst(20, 0.3)
		elif "--shot" in args:
			_capture_after(4.0)
		return
	# debug: pick a scenario (--scenario=ID), jump to a node (--scene=ID), and
	# pre-type N chars (--type=N)
	var jump := _arg_value(args, "--scene")
	var scen := _arg_value(args, "--scenario")
	if _demo or jump != "" or scen != "":
		if scen == "intro":
			_start_intro()
		elif jump != "" or scen != "":
			_start_scenario(scen if scen != "" else "band1")
		else:
			_show_overworld()   # a bare --demo plays from the island, like a child
		if jump != "":
			_run.current_id = jump
			_enter_node()
		var pretype := int(_arg_value(args, "--type"))
		# debug: skip the intro briefing so --type / --demo / --burst can drive the walk
		if _intro_briefing and (pretype > 0 or _demo or "--burst" in args):
			_end_briefing()
		for i in range(pretype):
			if _phase == Phase.PROSE and not _prose.is_complete():
				_on_char(_prose.target.substr(_prose.cursor, 1))
		if "--shot" in args:
			_capture_after(2.0 if jump != "" else 6.0)
		if "--burst" in args:
			_capture_burst()
	else:
		if _arg_value(args, "--menu") in ["world", "scenarios"]:
			_show_overworld()
		elif _arg_value(args, "--menu") == "options":
			_compose_backdrop()
			_show_main_menu()
			_show_options()   # debug: jump straight to the options screen
		elif _arg_value(args, "--menu") == "dev":
			_compose_backdrop()
			_show_main_menu()
			_show_dev()   # debug: jump straight to the dev screen
		elif _arg_value(args, "--menu") == "picker":
			_show_character_picker(_show_main_menu)   # debug: jump to the hero picker
		else:
			_compose_backdrop()
			_show_main_menu()
		if "--burst" in args:
			_capture_burst()
		if "--shot" in args:
			_capture_after(1.0)


func _arg_value(args: PackedStringArray, key: String) -> String:
	for a in args:
		if a.begins_with(key + "="):
			return a.substr(key.length() + 1)
	return ""


# Layout: the 3D scene renders into a SubViewport that occupies the TOP region; the
# UI band sits in its OWN region BELOW it. The full scene is always visible -- the
# UI never paints over it. Everything lives under one CanvasLayer so Controls anchor
# reliably to the screen.
func _build_layout() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var ui := Control.new()
	ui.set_anchors_preset(Control.PRESET_FULL_RECT)
	ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(ui)
	_ui = ui

	# background music (crossfading playlist per context; silent if a folder is empty)
	_music = MusicPlayerScript.new()
	_music.name = "Music"
	add_child(_music)

	# --- 3D scene area (top) ---
	var container := SubViewportContainer.new()
	container.stretch = true
	container.set_anchors_preset(Control.PRESET_TOP_WIDE)
	container.offset_top = 0
	container.offset_bottom = VIEW_HEIGHT
	container.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(container)
	_viewport_container = container
	_viewport = SubViewport.new()
	_viewport.own_world_3d = true
	_viewport.transparent_bg = false
	_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	_viewport.msaa_3d = Viewport.MSAA_2X
	container.add_child(_viewport)
	_composer = SceneComposerScript.new()
	_composer.name = "Composer"
	_viewport.add_child(_composer)
	_camera = Camera3D.new()
	_camera.position = CAM_OFFSET
	_viewport.add_child(_camera)
	_camera.current = true

	# HUD overlay (top-right, over the scene)
	_hud = _make_label(28, HORIZONTAL_ALIGNMENT_RIGHT)
	_hud.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_hud.offset_left = -460
	_hud.offset_right = -28
	_hud.offset_top = 18
	ui.add_child(_hud)

	# transient message (over the scene, upper area). A dark translucent stylebox
	# keeps it legible over a bright sky (the win/setback text).
	_message = _make_label(48, HORIZONTAL_ALIGNMENT_CENTER)
	_message.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_message.offset_top = 170
	_message.offset_left = 40
	_message.offset_right = -40
	_message.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_message.add_theme_constant_override("outline_size", 10)
	var msg_bg := StyleBoxFlat.new()
	msg_bg.bg_color = Color(0, 0, 0, 0.5)
	msg_bg.content_margin_top = 14
	msg_bg.content_margin_bottom = 14
	msg_bg.content_margin_left = 28
	msg_bg.content_margin_right = 28
	msg_bg.corner_radius_top_left = 12
	msg_bg.corner_radius_top_right = 12
	msg_bg.corner_radius_bottom_left = 12
	msg_bg.corner_radius_bottom_right = 12
	_message.add_theme_stylebox_override("normal", msg_bg)
	_message.visible = false   # the stylebox only shows when there is a message
	ui.add_child(_message)

	# small brown bar at the TOP for a standing instruction (the overworld prompt),
	# so the bottom band is free for the typed text. Hidden unless a prompt is set.
	_top_bar = NinePatchRect.new()
	_top_bar.texture = load("res://assets/kenney/ui_rpg/panel_brown.png")
	for side in ["left", "top", "right", "bottom"]:
		_top_bar.set("patch_margin_" + side, 20)
	_top_bar.anchor_left = 0.5
	_top_bar.anchor_right = 0.5
	_top_bar.offset_left = -370.0
	_top_bar.offset_right = 370.0
	_top_bar.offset_top = 14.0
	_top_bar.offset_bottom = 80.0
	_top_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_top_bar.visible = false
	ui.add_child(_top_bar)
	_top_prompt = _make_label(28, HORIZONTAL_ALIGNMENT_CENTER)
	_top_prompt.set_anchors_preset(Control.PRESET_FULL_RECT)
	_top_prompt.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_top_bar.add_child(_top_prompt)

	# intro briefing text: typed out sentence by sentence before typing starts,
	# centered and wrapped to a couple of lines so a beginning reader can follow
	_brief_label = _make_label(38, HORIZONTAL_ALIGNMENT_CENTER)
	_brief_label.size = Vector2(BRIEF_W, 400.0)
	_brief_label.position = Vector2((1920.0 - BRIEF_W) * 0.5, 100.0)
	_brief_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_brief_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_brief_label.add_theme_color_override("font_color", Color("fdf5e6"))
	_brief_label.add_theme_color_override("font_outline_color", Color(0.12, 0.08, 0.05))
	_brief_label.add_theme_constant_override("outline_size", 10)
	_brief_label.add_theme_constant_override("line_spacing", 8)
	_brief_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_brief_label.visible = false
	ui.add_child(_brief_label)


	# --- UI band (bottom): opaque, holds narration + type-along + keyboard ---
	var band := Control.new()
	band.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	band.offset_top = -BAND_HEIGHT
	ui.add_child(band)
	_band = band
	var bg := ColorRect.new()
	bg.color = Color("241c14")
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	band.add_child(bg)
	var rule := ColorRect.new()
	rule.color = Color("4a3a28")
	rule.set_anchors_preset(Control.PRESET_TOP_WIDE)
	rule.offset_bottom = 4
	band.add_child(rule)

	_narration = _make_label(28, HORIZONTAL_ALIGNMENT_CENTER)
	_narration.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_narration.offset_top = 8
	_narration.offset_left = 40
	_narration.offset_right = -40
	band.add_child(_narration)

	_type_along = TypeAlongPanel.new()
	_type_along.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_type_along.offset_top = 66
	_type_along.offset_bottom = 168
	_type_along.offset_left = 220
	_type_along.offset_right = -220
	band.add_child(_type_along)

	_keyboard = KeyboardGuide.new()
	_keyboard.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_keyboard.offset_top = -226
	_keyboard.offset_bottom = -6
	band.add_child(_keyboard)

	# back button in the band's lower-left (a child of the band, so it draws ON TOP
	# of the band background). Leaves the current scenario, back to the island.
	# Shown only while playing.
	_back_button = TextureButton.new()
	_back_button.texture_normal = load("res://assets/kenney/ui_rpg/buttonLong_brown.png")
	_back_button.texture_pressed = load("res://assets/kenney/ui_rpg/buttonLong_brown_pressed.png")
	_back_button.ignore_texture_size = true
	_back_button.stretch_mode = TextureButton.STRETCH_SCALE
	_back_button.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	_back_button.offset_left = 24
	_back_button.offset_top = -70
	_back_button.offset_right = 190
	_back_button.offset_bottom = -16
	_back_button.visible = false
	_back_button.pressed.connect(_on_back_pressed)
	band.add_child(_back_button)
	var back_label := _make_label(26, HORIZONTAL_ALIGNMENT_CENTER)
	back_label.set_anchors_preset(Control.PRESET_FULL_RECT)
	back_label.offset_bottom = -6   # sit above the button's bottom lip
	back_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	back_label.text = "Terug"
	back_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_back_button.add_child(back_label)

	# choice banners float over the lower part of the scene, above the band
	_choice_layer = Control.new()
	_choice_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	_choice_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(_choice_layer)

	_menu_layer = Control.new()
	_menu_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	_menu_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(_menu_layer)


func _make_label(size: int, align: int) -> Label:
	var l := Label.new()
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", Color.WHITE)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.7))
	l.add_theme_constant_override("outline_size", 6)
	l.horizontal_alignment = align
	return l


# --- beat lifecycle ----------------------------------------------------------

## Resolve a typed-prose key with the per-hero tokens ({held} subject, {wapen} weapon) filled
## for the CHOSEN hero ("de {held} pakt je {wapen}" -> "de heks pakt je bezem"). Every typing
## target routes through here so the child types the character they picked; token-free prose
## is unaffected.
func _held_prose(key: String) -> String:
	return _locale.fill_tokens(_locale.resolve(key), _chosen_hero_id())


## The saved hero id, guarded: an unknown/stale id falls back to the default so a token
## never leaks and the wall weapon always resolves.
func _chosen_hero_id() -> String:
	var hero_id: String = AppProgress.get_choice("hero", Characters.DEFAULT_ID)
	if _locale.resolve("hero." + hero_id) == "":
		hero_id = Characters.DEFAULT_ID
	return hero_id


func _enter_node() -> void:
	var node = _run.current()
	_clear_banners()
	_bridge_lower = {}
	_type_along.visible = true
	_composer.compose(node.scene, node.id)
	if _in_intro:
		_composer.show_hero_weapon(_chosen_hero_id())   # the chosen hero's weapon on the wall rack
	_update_camera(0.0, not _composer.did_restage())   # snap on a fresh scene; ease a continuous re-stage
	_activity.reset()
	_set_top_prompt(_locale.resolve(node.narration_key))   # instruction in the top bar
	if node.prerevealed:
		_prose = TypingState.new("")
		_type_along.set_plain(_held_prose(node.prose_key))
		_begin_choice()
	else:
		_prose = TypingState.new(_held_prose(node.prose_key))
		_phase = Phase.PROSE
		_type_along.set_prose(_prose.target, 0)
		_highlight_prose()
		if _composer.is_archery_scene():
			_setup_archery(_prose.target)
		if _composer.is_house_scene():
			if _in_intro:
				_setup_house(_prose.target)         # a morning walk; only the chosen weapon shows
			else:
				_apply_house_locks()                # ghost bows until their flag is set (fetch visit)
				_setup_house_visit(_prose.target)   # a return visit: just walk in
		if node.exit_walk:
			_setup_crossing()                        # the crystal drops the drawbridge first
	_setup_gaze(node)
	_update_hud()


# A Callable wrapper over the flag store, passed to the pure Choice helpers (is_available /
# resolved_target) so the logic layer can gate + branch without touching AppProgress.
func _flag(name: String) -> bool:
	return AppProgress.get_flag(name)


func _begin_choice() -> void:
	var node = _run.current()
	if node.choices.is_empty():
		_resolve_ending()
		return
	_candidates = []
	for ch in node.choices:
		# a gated choice (e.g. the bridge before the crystal + tip) is hidden until ALL its
		# required flags are set
		if not ch.is_available(_flag):
			continue
		# at home, only offer gear not yet collected (choice target is a take_* node)
		var it: Dictionary = _house_item_for_node(ch.target)
		if not it.is_empty() and AppProgress.get_flag(it.flag):
			continue
		_candidates.append({"word": _locale.resolve(ch.word_key), "choice": ch})
	if _candidates.is_empty():
		# nothing left to take -- a short "you have everything" beat, then leave
		_set_message(_locale.resolve("home.nothing") + "\n(druk op enter)")
		_type_along.visible = false
		_keyboard.highlight("")
		_phase = Phase.WIN
		_composer.play_lead_loop("Cheering")
		return
	_picked = null
	_buffer = ""
	_phase = Phase.CHOICE
	_set_top_prompt("Typ je keuze.")
	_show_banners()
	_highlight_choice()


func _resolve_ending() -> void:
	var completing = _run.current()
	if completing != null and completing.sets_flag != "":
		for fl in completing.sets_flag.split(" ", false):
			AppProgress.set_flag(fl)   # e.g. the cave flee sets met_skeleton
		# fully_trained (both weapons practised) gates the armed cave fight -- derived, so the
		# forge and range BOTH matter and neither alone is enough.
		if AppProgress.get_flag("sword_sharp") and AppProgress.get_flag("archery_done"):
			AppProgress.set_flag("fully_trained")
	var ending = _run.resolve_ending()
	if _in_intro:
		# the knight has reached the door: it swings open, a beat, then out into the world
		_composer.house_open_door()
		_set_message(_win_message())
		_type_along.visible = false
		_keyboard.highlight("")
		_phase = Phase.PAUSE
		_flash()
		_after(3.0, _finish_intro)
		return
	match ending.type:
		"setback":
			_set_message("De grot is eng. Terug naar het pad!")
			_phase = Phase.PAUSE
			_after(1.8, _enter_node)
		"win":
			if completing != null and completing.exit_walk:
				_begin_exit_walk()   # cross + stroll off the far path, soft-fade to the island
				return
			var celebrate: bool = completing == null or completing.celebrate
			_set_message(_win_message() + "\n(druk op enter)")
			_type_along.visible = false   # no empty panel at the win
			_keyboard.highlight("")
			_phase = Phase.WIN
			if not celebrate:
				pass   # a somber beat (the cave-scare) -- just the message + enter, no fanfare
			elif _composer.is_work_scene():
				_composer.stop_sparks()
				_composer.vanish_grindstone()            # poof the wheel, reveal the knight
				_composer.play_lead_loop("Cheering")    # raise the held sword in triumph
			elif _composer.is_archery_scene():
				_composer.play_lead_loop("Cheering")    # bullseye! celebrate (archery_done set via sets_flag)
			elif _composer.is_house_scene():
				if _house_visit_fetch != "":
					var item: Dictionary = _house_item_by_id(_house_visit_fetch)
					_composer.house_pickup_item(item.node)   # take the item off the wall
					AppProgress.set_flag(item.flag)         # prerequisite for its training site
					if AppProgress.get_flag("has_sword") and AppProgress.get_flag("has_bow"):
						AppProgress.set_flag("has_gear")    # completes the "get your gear" objective
				else:
					_composer.play_lead_loop("Cheering")   # a plain visit: a small wave
			elif _composer.has_skeleton():
				_composer.topple_skeleton()             # the beaten skeleton crumples
				_composer.play_lead_oneshot("PickUp")   # the hero picks up the crystal
			else:
				_composer.open_chest()                  # treasure win: open the chest
				_composer.play_lead_oneshot("PickUp")
			# accumulate persistent effort stats for a real, CELEBRATED adventure (not a
			# home chore, not the cave-flee). Words are counted per node as they are typed.
			if celebrate and not _composer.is_house_scene():
				AppProgress.add_stat("adventures", 1)
				AppProgress.add_stat("xp", _run.xp)
				AppProgress.add_stat("stars", _run_total_stars())
			if celebrate:
				_flash()
		_:
			_set_message("Einde.")
			_phase = Phase.DONE


# --- input -------------------------------------------------------------------

func _input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		_ow_mouse_active = true   # enable island panning once the cursor moves
	# character picker: cycle with arrows / scroll, Enter to choose
	if _app_state == AppState.PICKER:
		if event is InputEventMouseButton and event.pressed:
			var mb: int = (event as InputEventMouseButton).button_index
			if mb == MOUSE_BUTTON_WHEEL_UP:
				_picker_step(-1)
			elif mb == MOUSE_BUTTON_WHEEL_DOWN:
				_picker_step(1)
		elif event is InputEventKey and event.pressed and not event.echo:
			match (event as InputEventKey).keycode:
				KEY_LEFT, KEY_UP:
					_picker_step(-1)
				KEY_RIGHT, KEY_DOWN:
					_picker_step(1)
				KEY_ENTER, KEY_KP_ENTER:
					_picker_confirm()
		return
	# mouse wheel zooms the island (idle overworld only); persisted so it sticks
	if event is InputEventMouseButton and event.pressed and _app_state == AppState.OVERWORLD:
		var b: int = (event as InputEventMouseButton).button_index
		if b == MOUSE_BUTTON_WHEEL_UP or b == MOUSE_BUTTON_WHEEL_DOWN:
			var d: float = -OW_ZOOM_STEP if b == MOUSE_BUTTON_WHEEL_UP else OW_ZOOM_STEP
			_ow_zoom = clampf(_ow_zoom + d, OW_ZOOM_MIN, OW_ZOOM_MAX)
			AppProgress.set_setting("ow_zoom", _ow_zoom)
			return
	if not (event is InputEventKey) or not event.pressed or event.echo:
		return
	if event.keycode == KEY_ESCAPE:
		if _app_state == AppState.PLAYING:
			_show_overworld(_ow_at)   # leave the scenario, back to the island
		elif _app_state == AppState.OVERWORLD:
			_show_main_menu()         # back out of the island to the main menu
		else:
			get_tree().quit()         # main menu -> quit
		return
	if _app_state == AppState.OVERWORLD:
		if _ow_walk == null and not _ow_entering:   # ignore keys while traveling / mid-ack
			var oc := KeyboardInput.char_for_physical(event.physical_keycode)
			if oc != "":
				get_viewport().set_input_as_handled()
				_ow_char(oc)
		return
	if _app_state == AppState.MAIN and not _dev_unlocked and event.keycode >= KEY_A and event.keycode <= KEY_Z:
		# watch the main menu for the secret DEV_CODE -> reveal the (otherwise hidden) Dev tools
		_dev_code_buf = (_dev_code_buf + char(event.keycode).to_lower()).right(DEV_CODE.length())
		if _dev_code_buf == DEV_CODE:
			_dev_unlocked = true
			_dev_code_buf = ""
			_show_dev()   # jump straight in as confirmation
		return
	if _app_state != AppState.PLAYING:
		return  # the main menu is mouse-driven
	if _phase == Phase.WIN and event.keycode == KEY_ENTER:
		_phase = Phase.PAUSE                       # a second Enter during the fade is ignored
		_fade_cut(_show_overworld.bind(_ow_at))    # finishing + enter returns to the island
		return
	var c := KeyboardInput.char_for_physical(event.physical_keycode)
	if c != "":
		get_viewport().set_input_as_handled()
		_on_char(c)


func _on_char(c: String) -> void:
	if _intro_briefing:
		return   # typing is inert while the intro explanation is rolling
	match _phase:
		Phase.PROSE:
			_prose_char(c)
		Phase.CHOICE:
			_choice_char(c)


func _prose_char(c: String) -> void:
	_prose.type_char(c)
	_type_along.set_prose(_prose.target, _prose.cursor)
	_highlight_prose()
	if _composer.is_archery_scene():
		_archery_check_fire()
	if _composer.is_house_scene():
		_house_check_pickup()
	if _prose.is_complete():
		_run.score_current(_prose.correct_chars(), _prose.accuracy(), true)
		AppProgress.add_stat("words", _word_count(_prose.target))   # cumulative effort (G9)
		_update_hud()
		if _run.current().is_ending():
			if _composer.is_archery_scene():
				# let the final arrow land and sit in the bullseye for a beat before
				# the win message + cheer take over (they would hide the moment)
				_phase = Phase.PAUSE
				_composer.hide_crosshair()
				_keyboard.highlight("")
				_after(ARCH_WIN_DELAY, _resolve_ending)
			else:
				_resolve_ending()
		else:
			_begin_choice()


func _choice_char(c: String) -> void:
	if _picked == null:
		for cand in _candidates:
			if cand.word.substr(0, 1) == c:
				_picked = cand
				_buffer = c
				break
		if _picked == null:
			return
	else:
		var expected: String = _picked.word.substr(_buffer.length(), 1)
		if c != expected:
			return
		_buffer += c
	_update_banner_highlight()
	_highlight_choice()
	if _picked != null and _buffer == _picked.word:
		var hint: String = _picked.choice.hint
		_run.choose(_locale.resolve(_picked.choice.word_key), _flag)   # advances to the RESOLVED target
		if _composer.has_fork() and (hint == "left" or hint == "right"):
			# If the chosen path continues on the SAME set as a walking scene (the bridge
			# crossing), stroll ALL the way to where it begins so the next beat re-stages with
			# no teleport. Otherwise (the cave -> dungeon) amble toward the landmark, then cut.
			var tgt = _run.current()   # the node choose() advanced to (may be the alt target)
			var same_set_walk: bool = tgt != null and tgt.scene != null \
				and tgt.scene.set_name == _composer.current_set() \
				and tgt.scene.path == SceneDescriptor.PATH_STRAIGHT
			if same_set_walk:
				_begin_choice_walk(_composer.anchor_pos(tgt.scene.travel_from), true)
			else:
				_begin_choice_walk(_composer.fork_pos(hint), false)
		else:
			_enter_node()


# --- view helpers ------------------------------------------------------------

func _show_banners() -> void:
	# keep the pre-revealed prose readable in the panel during the choice (it is the
	# beat's content, not a typing target); a normal fork hides the panel
	var node = _run.current()
	var prerevealed: bool = node != null and node.prerevealed
	_type_along.visible = prerevealed
	if prerevealed:
		_type_along.set_plain(_held_prose(node.prose_key))
	_clear_banners()
	var single := _candidates.size() == 1
	var cx := 960.0
	var y := 430.0
	for i in _candidates.size():
		var cand = _candidates[i]
		var banner = ChoiceBannerScript.new()
		_choice_layer.add_child(banner)
		banner.size = Vector2(380, 120)
		banner.configure(cand.word, cand.choice.hint, float(i) * 1.3)
		var x := cx - 190.0
		if not single:
			if cand.choice.hint == "left":
				x = cx - 420.0
			elif cand.choice.hint == "right":
				x = cx + 40.0
		banner.set_base_position(Vector2(x, y))
		_banners.append({"banner": banner, "cand": cand})
	_update_banner_highlight()


func _update_banner_highlight() -> void:
	for e in _banners:
		if _picked == null:
			e.banner.set_typed(0)
			e.banner.set_active(true)
		elif e.cand == _picked:
			e.banner.set_typed(_buffer.length())
			e.banner.set_active(true)
		else:
			e.banner.set_typed(0)
			e.banner.set_active(false)


# Walk the hero a couple of steps toward the chosen fork path, then cut to the scene.
func _begin_choice_walk(dest: Vector3, full: bool = false) -> void:
	_clear_banners()
	_set_top_prompt("")
	_keyboard.highlight("")
	_phase = Phase.PAUSE
	var from: Vector3 = _composer.lead_position()
	# `full` walks all the way to dest (a same-set crossing entry) and re-stages continuously
	# (no cut). Otherwise a couple of steps toward the landmark, then a quick fade covers the
	# cut to a DIFFERENT set (e.g. forest -> the dark cave), so the tonal jump never snaps.
	var done: Callable = Callable() if full else _fade_cut.bind(_enter_node, SCENE_FADE_DUR)
	_walkoff = {"from": from, "to": from.lerp(dest, 1.0 if full else 0.5), "t": 0.0, "dur": CHOICE_WALK_DUR, "on_done": done}
	var d: Vector3 = dest - from
	if d.length() > 0.001:
		_composer.set_lead_facing(atan2(d.x, d.z))
	_composer.set_lead_animation(true)


# End a crossing scene "nicely": bank the effort, then walk the hero off the `cross_exit`
# marker (owner-placed at the end of the lengthened path) and soft-fade back to the island.
func _begin_exit_walk() -> void:
	AppProgress.add_stat("adventures", 1)
	AppProgress.add_stat("xp", _run.xp)
	AppProgress.add_stat("stars", _run_total_stars())
	_clear_banners()
	_type_along.visible = false
	_keyboard.highlight("")
	_set_top_prompt(_win_message())
	_phase = Phase.PAUSE
	var from: Vector3 = _composer.lead_position()
	var dest: Vector3 = _composer.anchor_pos("cross_exit")
	var d: Vector3 = dest - from
	if d.length() > 0.001:
		_composer.set_lead_facing(atan2(d.x, d.z))
	# duration scales with distance so moving cross_exit farther makes him walk FARTHER at the
	# same pace (not a faster stroll)
	var dur: float = maxf(EXIT_WALK_DUR, d.length() / EXIT_WALK_SPEED)
	_walkoff = {"from": from, "to": dest, "t": 0.0, "dur": dur, "on_done": _fade_to_overworld}
	_composer.set_lead_animation(true)


# A reusable soft cut: fade to black, run `midpoint` under cover of the black (swap the
# scene / view), then fade back in. Softens the hard cuts that otherwise SNAP -- the camera
# jump + compose hitch both happen while the screen is black. `midpoint` runs even with no
# UI layer (headless/tests) so the state change is never skipped.
func _fade_cut(midpoint: Callable, dur: float = SCENE_FADE_DUR) -> void:
	if _ui == null:
		midpoint.call()
		return
	var f := ColorRect.new()
	f.color = Color(0, 0, 0, 0.0)
	f.set_anchors_preset(Control.PRESET_FULL_RECT)
	f.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_ui.add_child(f)
	var t := create_tween()
	t.tween_property(f, "color:a", 1.0, dur)
	t.tween_callback(midpoint)
	t.tween_property(f, "color:a", 0.0, dur)
	t.tween_callback(f.queue_free)


# Soft fade-to-black, swap to the island under cover of the black, then fade back in.
func _fade_to_overworld() -> void:
	_fade_cut(_show_overworld.bind(_ow_at), EXIT_FADE_DUR)


# Crossing opening beat: if he has the crystal, drop it into the socket and lower the
# drawbridge as a short cutscene, THEN release the crossing prose. No crystal (shouldn't
# happen in normal play, since brug is reached only after the cave) -> the prose just runs.
func _setup_crossing() -> void:
	if not _composer.has_bridge() or not AppProgress.get_flag("has_crystal"):
		return
	_composer.stage_bridge_crystal()
	_composer.set_bridge_lower(0.0)             # hold it fully raised to start
	_composer.set_lead_animation(false)
	var fd: Vector3 = _composer.anchor_pos("path_far") - _composer.anchor_pos("path_near")
	if fd.length() > 0.001:
		_composer.set_lead_facing(atan2(fd.x, fd.z))   # face the bridge as it comes down
	_type_along.visible = false
	_keyboard.highlight("")
	_set_top_prompt(_locale.resolve("brug.lower"))
	_phase = Phase.PAUSE
	_bridge_lower = {"t": 0.0}


# The drawbridge has finished lowering: release the crossing prose (he walks across now).
func _begin_crossing_prose() -> void:
	var node = _run.current()
	_type_along.visible = true
	_phase = Phase.PROSE
	_set_top_prompt(_locale.resolve(node.narration_key))
	_type_along.set_prose(_prose.target, 0)
	_highlight_prose()


func _clear_banners() -> void:
	for e in _banners:
		e.banner.queue_free()
	_banners.clear()


func _highlight_prose() -> void:
	if _prose.is_complete():
		_keyboard.highlight("")
	else:
		_keyboard.highlight(_prose.target.substr(_prose.cursor, 1))


# --- archery: crosshair + arrows driven by typing ----------------------------

const ARCH_MAX_RADIUS := 1.0   # metres on the target for the shortest sentence
const ARCH_WIN_DELAY := 4.5     # hold on the arrow in the bullseye before the win


# Compute each sentence's char range + landing point. A longer sentence lands its
# arrow closer to the bullseye; the points are spread around by angle.
func _setup_archery(prose: String) -> void:
	_arch_ring = []
	_arch_span = []
	_arch_fired = 0
	_arch_t = 0.0
	var spans: Array = []
	var start := 0
	for i in prose.length():
		if prose[i] == ".":
			spans.append([start, i + 1])
			start = i + 1
	if spans.is_empty():
		spans.append([0, prose.length()])
	# normalise sentence length -> radius (longest = bullseye, shortest = outer ring)
	var min_len := 9999
	var max_len := 0
	for sp in spans:
		var l: int = sp[1] - sp[0]
		min_len = mini(min_len, l)
		max_len = maxi(max_len, l)
	var span_len: int = maxi(1, max_len - min_len)
	for i in spans.size():
		var sp = spans[i]
		var l: int = sp[1] - sp[0]
		var radius: float = ARCH_MAX_RADIUS * float(max_len - l) / float(span_len)
		var angle := float(i) * 2.399963   # golden angle, so arrows spread out
		_arch_ring.append(Vector2(cos(angle), sin(angle)) * radius)
		_arch_span.append(sp)


func _update_archery(delta: float) -> void:
	if _phase != Phase.PROSE:
		return   # freeze the reticle during the win hold (it is hidden by then)
	_arch_t += delta
	if _arch_ring.is_empty():
		return
	var i := _arch_current_sentence()
	var ring: Vector2 = _arch_ring[i]
	var prog := _arch_sentence_progress(i)
	# home to the ring as the sentence is typed; wander (steadies) early
	var drift := Vector2(sin(_arch_t * 1.7), cos(_arch_t * 2.3)) * ARCH_MAX_RADIUS * 0.7 * (1.0 - prog)
	_composer.set_crosshair(ring * prog + drift)


func _arch_current_sentence() -> int:
	for i in _arch_span.size():
		if _prose.cursor < _arch_span[i][1]:
			return i
	return _arch_span.size() - 1


func _arch_sentence_progress(i: int) -> float:
	var sp = _arch_span[i]
	var len: int = sp[1] - sp[0]
	if len <= 0:
		return 1.0
	return clampf(float(_prose.cursor - sp[0]) / float(len), 0.0, 1.0)


# Fire an arrow for each sentence whose end the cursor has now passed.
func _archery_check_fire() -> void:
	while _arch_fired < _arch_span.size() and _prose.cursor >= _arch_span[_arch_fired][1]:
		_composer.fire_arrow(_arch_ring[_arch_fired])
		_arch_fired += 1


# --- house intro: one sentence = one leg of a waypoint walk -------------------

# Map each sentence to a leg + its destination waypoint (see the `stops` list below). The
# intro is a MORNING WALK: he steps off the bed, walks to the weapon rack and LOOKS at his
# weapon, then to the key wall and looks at the key, then out the door -- no pickups (H1).
func _setup_house(prose: String) -> void:
	_house_span = _sentence_spans(prose)
	_house_pickups = []
	_house_pick = 0
	_house_stood_up = false
	_house_getup_started = false
	# campaign v2: the intro is a MORNING WALK -- he walks past his sword + keys (LOOKS,
	# does not take them; a hint says they are for later) and heads out to the woods.
	# So the waypoints stay (rise -> sword wall -> keys -> door) but there are NO pickups.
	_house_bed = _composer.anchor_pos("bed_point")   # where he lies AND gets up (in place)
	_house_bedside = _house_bed                       # no step-off; the walk starts here
	_house_getup_gp = 0.0
	# start the get-up NOW (during the briefing) so he is already standing before the
	# child types -- the walk then tracks the typing with no rushed catch-up
	_house_getup_started = true
	_composer.house_stand_up()
	# END position per typed sentence, one waypoint per sentence of intro.prose (6 beats):
	#   0 "het is morgen"            -> step off the bed (forward_point), the wake-up
	#   1 "loopt naar het rek"       -> the weapon rack on the wall (sword_point)
	#   2 "hier hangt je {wapen}"    -> STAY at the rack (zero-length leg = a LOOK beat)
	#   3 "aan de andere kant ... sleutel" -> the key wall (key_point)
	#   4 "deze komt later van pas"  -> STAY at the key (a LOOK beat)
	#   5 "nu is het tijd ... dag"   -> the door (path_far); it opens at the win
	# A repeated waypoint makes a zero-length leg, which _house_walk_yaw keeps facing -- so he
	# pauses and looks while the child types the "hier hangt / komt later" lines.
	var stops := ["forward_point", "sword_point", "sword_point", "key_point", "key_point", "path_far"]
	_house_way = []
	for i in _house_span.size():
		var anchor: String = stops[i] if i < stops.size() else "path_far"
		_house_way.append(_composer.anchor_pos(anchor))


func _update_house(delta: float) -> bool:
	if _house_way.is_empty():
		return false
	var stand: float = _composer.house_stand_y()
	var lie: float = _composer.house_lie_y()
	# --- GET-UP: stand up IN PLACE on the bed, facing forward (PI). The origin stays at
	#     bed height the WHOLE time -- NO drop here, so no sink. (The drop to the floor
	#     happens on the first forward step below, reading as stepping off the bed.)
	if not _house_stood_up:
		_house_getup_gp = maxf(_house_getup_gp, _composer.house_getup_progress())
		_composer.house_move_to(Vector3(_house_bed.x, lie, _house_bed.z), delta, PI)
		if _house_getup_gp >= 0.999:
			_house_stood_up = true
		return false
	# --- WALK: sentence 0 steps FORWARD off the bed, descending bed height -> floor as he
	#     goes (stepping down, not sinking in place); later legs glide on the floor.
	var s := _house_current_sentence()
	var from: Vector3 = _house_way[s - 1] if s > 0 else _house_bed
	var to: Vector3 = _house_way[s]
	# LOOK beat (a repeated waypoint -> zero-length leg): he has arrived; HOLD him exactly at
	# the rack/key and only keep facing. Return FALSE so the caller plays IDLE, not the walk
	# clip -- otherwise he walks in place while typing "hier hangt je .." / "komt later ..".
	if s > 0 and from.distance_to(to) < 0.01:
		_composer.house_move_to(to, 0.0, _composer.lead_yaw())
		return false
	var prog := _house_sentence_progress(s)
	var walk := from.lerp(to, prog)
	var wy: float = lerpf(lie, stand, prog) if s == 0 else stand   # step down off the bed
	_composer.house_move_to(Vector3(walk.x, wy, walk.z), delta, _house_walk_yaw(from, to))
	return true


# Yaw that faces along leg `s` (from waypoint s-1 to s); falls back to the door.
func _house_leg_yaw(s: int) -> float:
	if s <= 0 or s >= _house_way.size():
		return PI
	var dir: Vector3 = _house_way[s] - _house_way[s - 1]
	if dir.length() < 0.001:
		return PI
	return atan2(dir.x, dir.z)


# Yaw facing from -> to; a zero-length leg (a "look" beat) keeps his current facing.
func _house_walk_yaw(from: Vector3, to: Vector3) -> float:
	var dir: Vector3 = to - from
	if dir.length() < 0.001:
		return _composer.lead_yaw()
	return atan2(dir.x, dir.z)


func _house_current_sentence() -> int:
	for i in _house_span.size():
		if _prose.cursor < _house_span[i][1]:
			return i
	return _house_span.size() - 1


func _house_sentence_progress(i: int) -> float:
	var sp = _house_span[i]
	var span_len: int = sp[1] - sp[0]
	if span_len <= 0:
		return 1.0
	return clampf(float(_prose.cursor - sp[0]) / float(span_len), 0.0, 1.0)


# Pick up the sword / key when the cursor passes the end of that leg's sentence.
func _house_check_pickup() -> void:
	while _house_pick < _house_pickups.size():
		var ev = _house_pickups[_house_pick]
		var s: int = ev[0]
		if s < _house_span.size() and _prose.cursor >= _house_span[s][1]:
			if ev[1] == "sword":
				_composer.house_pickup_sword()
			else:
				_composer.house_pickup_key()
			_house_pick += 1
		else:
			break


# A RETURN visit (not the intro): the knight enters at the door and walks into the room
# as the whole prose is typed -- no rise, no fetch. This is the foundation for later
# "get an item from home" visits (add an item + a `*_point` anchor + a leg).
func _setup_house_visit(_prose_text: String) -> void:
	_house_visit_from = _composer.anchor_pos("path_far")   # the door
	# a take_* node (neem_zwaard/neem_boog) walks to that item and collects it at the win;
	# the choice node just walks in to the room centre
	var node = _run.current()
	var item: Dictionary = _house_item_for_node(node.id) if node != null else {}
	if not item.is_empty():
		_house_visit_fetch = item.id
		_house_visit_to = _composer.anchor_pos(item.anchor)
	else:
		_house_visit_fetch = ""
		_house_visit_to = _composer.anchor_pos("center")
	var stand: float = _composer.house_stand_y()
	_composer.house_move_to(Vector3(_house_visit_from.x, stand, _house_visit_from.z), 0.0, _house_visit_yaw())


func _update_house_visit(delta: float) -> bool:
	var prog := _prose.progress()
	var stand: float = _composer.house_stand_y()
	var base := _house_visit_from.lerp(_house_visit_to, prog)
	_composer.house_move_to(Vector3(base.x, stand, base.z), delta, _house_visit_yaw())
	return prog > 0.001


# Ghost the house bows until their unlock condition is met (visible but not takeable):
# bow_A unlocks when the archery range is completed; bow_B waits on a harder archery
# difficulty (not added yet, so it stays locked for now).
# The collectable house gear (campaign v2): visible on the wall until collected, then
# gone. Each is a PREREQUISITE for its training site (sword->smidse, bow->boog). Data,
# so adding an item (shield, keys, ...) is a row here + a wall node + a *_point anchor.
const HOUSE_ITEMS := [
	{"id": "sword", "node": "shelf_sword", "anchor": "sword_point", "flag": "has_sword", "take_node": "neem_zwaard"},
	{"id": "bow", "node": "bow_a", "anchor": "bow_point", "flag": "has_bow", "take_node": "neem_boog"},
]


func _house_item_by_id(item_id: String) -> Dictionary:
	for it in HOUSE_ITEMS:
		if it.id == item_id:
			return it
	return {}


func _house_item_for_node(node_id: String) -> Dictionary:
	for it in HOUSE_ITEMS:
		if it.take_node == node_id:
			return it
	return {}


func _apply_house_locks() -> void:
	# each item: gone once collected, else solid on the wall (collectable)
	for it in HOUSE_ITEMS:
		if AppProgress.get_flag(it.flag):
			_composer.set_house_item_hidden(it.node, true)
		else:
			_composer.set_house_item_locked(it.node, false)
	# bow_b still waits on a future harder-archery flag (kept ghosted)
	_composer.set_house_item_locked("bow_b", not AppProgress.get_flag("archery_hard_done"))


func _house_visit_yaw() -> float:
	var dir: Vector3 = _house_visit_to - _house_visit_from
	if dir.length() < 0.001:
		return 0.0
	return atan2(dir.x, dir.z)


# Split prose into [start, end) char ranges, one per sentence (ends after each '.').
func _sentence_spans(prose: String) -> Array:
	var spans: Array = []
	var start := 0
	for i in prose.length():
		if prose[i] == ".":
			spans.append([start, i + 1])
			start = i + 1
	if spans.is_empty():
		spans.append([0, prose.length()])
	return spans


func _highlight_choice() -> void:
	var next_char := ""
	if _picked == null:
		# a SINGLE choice may be guided; at an open fork stay neutral so the guidance
		# does not steer the child into one branch (matches the overworld behaviour)
		if _candidates.size() == 1:
			next_char = _candidates[0].word.substr(0, 1)
	elif _buffer.length() < _picked.word.length():
		next_char = _picked.word.substr(_buffer.length(), 1)
	_keyboard.highlight(next_char)


func _hint_nl(hint: String) -> String:
	match hint:
		"left": return "links"
		"right": return "rechts"
		"forward": return "vooruit"
		_: return hint


func _set_message(text: String) -> void:
	# all scene text (win / setback / prompts) lives in the top brown bar -- NEVER a
	# translucent overlay on the 3D scene (immersion; standardised everywhere)
	_set_top_prompt(text)


func _update_hud() -> void:
	var snap = _run.progress_snapshot()
	var stars := 0
	for v in snap.starsByNode.values():
		stars += v
	_hud.text = "XP %d    sterren %d" % [snap.xp, stars]


# --- per-frame: drive protagonist motion from observed state -----------------

func _process(delta: float) -> void:
	if _app_state == AppState.OVERWORLD:
		if _ow_walk != null:
			_ow_walk_tick(delta)
		elif _composer.has_lead():
			_composer.set_lead_animation(false)
		if _topcam:
			_composer.hide_clouds()   # debug road-tracing view: clear the sky
		_position_legend()
		_update_camera(delta, false)
		if _demo:
			_demo_tick(delta)
		return
	if _app_state != AppState.PLAYING:
		if _composer.has_lead():
			_composer.set_lead_animation(false)
		_update_camera(delta, false)
		return
	if not _bridge_lower.is_empty():
		# the crystal-lowering cutscene: swing the drawbridge leaf down before the walk
		_bridge_lower.t += delta
		var bl: float = clampf(_bridge_lower.t / BRIDGE_LOWER_DUR, 0.0, 1.0)
		_composer.set_bridge_lower(bl)
		_update_camera(delta, false)
		if bl >= 1.0:
			_bridge_lower = {}
			_begin_crossing_prose()
		return
	if not _walkoff.is_empty():
		# the hero strolls a couple of steps toward the chosen path before the scene
		# cuts -- softens the fork transition (no brutal switch)
		_walkoff.t += delta
		var wf: float = clampf(_walkoff.t / _walkoff.dur, 0.0, 1.0)
		_composer.set_lead_position(_walkoff.from.lerp(_walkoff.to, wf))
		var wdir: Vector3 = _walkoff.to - _walkoff.from
		if wdir.length() > 0.001:
			_composer.set_lead_facing(atan2(wdir.x, wdir.z))   # face where he is being walked
		_composer.set_lead_animation(true)
		_update_camera(delta, false)
		if wf >= 1.0:
			var on_done: Callable = _walkoff.get("on_done", Callable())
			_walkoff = {}
			if on_done.is_valid():
				on_done.call()
			else:
				_enter_node()
		return
	var p := _typing_progress()
	var act := _activity.update(p, delta)
	# Don't drive idle/walk during WIN/PAUSE -- a one-shot (e.g. PickUp) is playing.
	var drive_anim := _phase == Phase.PROSE or _phase == Phase.CHOICE
	if _composer.is_house_scene():
		# intro: rise, then glide leg by leg to the shelves / cabinet / door as each
		# sentence is typed; a return visit just walks in. Walk clip gated by the
		# activity hysteresis (fluid).
		var in_walk: bool = _update_house(delta) if _in_intro else _update_house_visit(delta)
		# while he is still lying (before the get-up fires), hold the Lie_Idle pose --
		# do not let idle/walk stomp it; the standup one-shot then locks it until done
		var lying: bool = _in_intro and not _house_stood_up
		if drive_anim and not lying:
			_composer.set_lead_animation(_phase == Phase.PROSE and in_walk and act == SceneActivity.Activity.MOVING)
	elif _composer.is_walking():
		_composer.set_lead_progress(p)
		# Face the travel direction the WHOLE time on a walking scene -- including before the
		# first keystroke -- so he never spawns facing the camera and then spins to the path
		# (janky). The walk vs idle CLIP is separate (driven below by typing activity).
		_composer.set_lead_moving(true)
		if drive_anim:
			_composer.set_lead_animation(_phase == Phase.PROSE and act == SceneActivity.Activity.MOVING)
	elif _composer.is_archery_scene():
		_update_archery(delta)
	else:
		_update_gaze(delta)
		if drive_anim:
			if _composer.is_work_scene():
				_composer.set_lead_work(act == SceneActivity.Activity.MOVING, p)
			else:
				_composer.set_lead_animation(false)
	_update_camera(delta, false)
	if _demo:
		_demo_tick(delta)


func _typing_progress() -> float:
	if _phase == Phase.PROSE:
		return _prose.progress()
	if _phase == Phase.CHOICE or _phase == Phase.PAUSE or _phase == Phase.WIN:
		return 1.0
	return 0.0


# --- gaze (standing scenes): turn the hero to look at landmarks ---------------

func _setup_gaze(node) -> void:
	_gaze_mode = "none"
	_links_idx = -1
	_rechts_idx = -1
	if _composer.is_walking() or _composer.is_archery_scene():
		return   # archery keeps its render-authored downrange facing (no gaze)
	if _composer.has_landmarks():
		if node.prerevealed:
			_gaze_mode = "bridge"   # naGrot: look at the safe bridge it will take
		else:
			_gaze_mode = "fork"     # kruispunt: look at cave, then bridge, as typed
			var t: String = _locale.resolve(node.prose_key)
			_links_idx = t.find("links")
			_rechts_idx = t.find("rechts")
	elif _has_prop(node, "chest"):
		_gaze_mode = "chest"        # schat: face the won treasure
	_gaze_yaw = _standing_target_yaw()
	_composer.set_lead_yaw(_gaze_yaw)


func _update_gaze(delta: float) -> void:
	if _gaze_mode == "none":
		return
	_gaze_yaw = lerp_angle(_gaze_yaw, _standing_target_yaw(), clampf(delta * 3.0, 0.0, 1.0))
	_composer.set_lead_yaw(_gaze_yaw)


func _standing_target_yaw() -> float:
	match _gaze_mode:
		"fork":
			var c := _prose.cursor
			if _links_idx >= 0 and c < _links_idx:
				return PI   # look ahead into the fork
			if _rechts_idx >= 0 and c < _rechts_idx:
				return _yaw_to(_composer.cave_pos())
			return _yaw_to(_composer.bridge_pos())
		"bridge":
			return _yaw_to(_composer.bridge_pos())
		"chest":
			return _yaw_to(_composer.anchor_pos("treasure"))
		_:
			return 0.0


func _yaw_to(target: Vector3) -> float:
	var dir: Vector3 = target - _composer.lead_position()
	return atan2(dir.x, dir.z)


func _has_prop(node, asset: String) -> bool:
	for p in node.scene.props:
		if p.asset == asset:
			return true
	return false


# Keep a fixed offset behind/above the hero. Snap on scene entry, smoothly follow
# during play, so the hero is the same apparent size wherever it is on the path.
func _update_camera(delta: float, snap: bool) -> void:
	if _camera == null or not _composer.has_lead():
		return
	var rig := _camera_rig()
	_camera.fov = rig.get("fov", 75.0)   # the overworld uses a tele lens
	_camera.v_offset = rig.get("v_offset", 0.0)   # shift the framing up/down
	if snap:
		_camera.position = rig.pos
	else:
		_camera.position = _camera.position.lerp(rig.pos, clampf(delta * CAM_LERP, 0.0, 1.0))
	_camera.look_at(rig.look, Vector3.UP)


# Framing adapts to the scene: a close follow while walking; a wide, raised
# establishing shot at the fork (so the cave on the left and the bridge on the
# right are both in view as the hero turns to look); medium otherwise.
# Mouse-driven pan for the idle island view: the cursor's offset from screen centre
# (past a centre dead-zone) pushes the camera focus, so a child can look around the
# revealed map without walking. Zero until the mouse first moves (a stable default view).
func _ow_pan_offset() -> Vector3:
	if not _ow_mouse_active:
		return Vector3.ZERO
	var vp: Vector2 = get_viewport().get_visible_rect().size
	if vp.x <= 0.0 or vp.y <= 0.0:
		return Vector3.ZERO
	var m: Vector2 = get_viewport().get_mouse_position()
	var nx: float = _pan_curve(clampf((m.x / vp.x - 0.5) * 2.0, -1.0, 1.0))
	var nz: float = _pan_curve(clampf((m.y / vp.y - 0.5) * 2.0, -1.0, 1.0))
	return Vector3(nx * OW_PAN_RANGE, 0.0, nz * OW_PAN_RANGE)


func _pan_curve(v: float) -> float:
	var dead := 0.3
	if absf(v) < dead:
		return 0.0
	return signf(v) * (absf(v) - dead) / (1.0 - dead)


func _camera_rig() -> Dictionary:
	if _app_state == AppState.PICKER:
		# a close, slightly-raised hero shot for the turntable (hero stands at origin)
		return {"pos": Vector3(0, 2.0, 5.2), "look": Vector3(0, 1.1, 0), "fov": 40.0}
	if _app_state == AppState.MAIN and _composer.is_overworld():
		# the main menu shows the island full-screen, zoomed out so the title floats
		# above it -- pull the camera back from the overworld framing and widen a touch
		var ow: Dictionary = _composer.overworld_cam()
		var look: Vector3 = ow.look
		var pos: Vector3 = look + (ow.pos - look) * 1.5
		# v_offset lifts the island up in the frame, leaving brown space at the bottom
		# for the buttons (like the title floats in the brown space at the top)
		return {"pos": pos, "look": look, "fov": 34.0, "v_offset": 2.2}
	if _composer.is_overworld():
		var ow2: Dictionary = _composer.overworld_cam()
		var look2: Vector3 = ow2.look
		if _ow_walk != null and _composer.has_lead():
			# once a site is chosen, zoom in a bit and follow the knight along the
			# path it walks (the camera lerp makes the dolly-in/out smooth)
			var knight: Vector3 = _composer.lead_position()
			var off: Vector3 = (ow2.pos - look2) * 0.62
			return {"pos": knight + off, "look": knight + Vector3(0, 0.6, 0), "fov": ow2.get("fov", 30.0)}
		if _topcam:
			# debug: straight overhead, for tracing the road layout to fit routes
			return {"pos": look2 + Vector3(0, 60, 0.01), "look": look2, "fov": 42.0}
		# idle picker: keep the set's iso angle, centre on the island (biased south so the
		# far windmill is in frame), zoom out a touch to fit, and let the MOUSE PAN the view
		# so a growing/revealed map can be inspected without walking
		var iso: Vector3 = (ow2.pos - look2) * _ow_zoom
		var focus: Vector3 = look2 + Vector3(0, 0, OW_IDLE_BIAS) + _ow_pan_offset()
		return {"pos": focus + iso, "look": focus, "fov": ow2.get("fov", 30.0)}
	var lead: Vector3 = _composer.lead_position()
	if _composer.is_house_scene():
		# a fixed frame from INSIDE the room, raised + pulled back and tilted DOWN toward the
		# front floor so the wake-up (near the bed) sits well up in the frame -- not mashed
		# into the bottom behind the keyboard -- while the doorway walk still reads down the room
		return {"pos": Vector3(0, 6.1, 11.2), "look": Vector3(0, 0.2, -2.4), "fov": 56.0}
	if _composer.is_walking():
		return {"pos": lead + CAM_OFFSET, "look": lead + Vector3(0, CAM_LOOK_Y, 0)}
	if _composer.has_landmarks():
		return {"pos": lead + Vector3(0, 5.5, 11.5), "look": lead + Vector3(0, 0.5, -4.5)}
	if _composer.is_treasure():
		# a closer hero shot of the knight + the opening chest at the win
		return {"pos": lead + Vector3(0, 2.7, 5.8), "look": lead + Vector3(0, 0.9, -2.4)}
	if _composer.is_work_scene():
		if _phase == Phase.WIN:
			# SAME frontal angle as grinding (the wheel poofs away at the win, so no
			# swing is needed -- a swing would expose the smithy walls from outside).
			# Just raised a touch to frame the cheering knight + raised sword. A tighter
			# FOV crops the smithy's open front-right edge (no outside showing at the win).
			return {"pos": lead + Vector3(0.3, 2.1, 4.0), "look": lead + Vector3(0.3, 1.3, 0.6), "fov": 46.0}
		# a near front view of the knight grinding the sword on the wheel in front
		return {"pos": lead + Vector3(0.5, 1.9, 4.0), "look": lead + Vector3(0.55, 0.95, 1.2)}
	if _composer.is_archery_scene():
		# over-the-shoulder down the lane: the knight sits in the foreground (bow
		# glimpsed at his side) and the target reads ahead down the range
		return {"pos": lead + Vector3(2.3, 3.0, 6.2), "look": lead + Vector3(-0.3, 1.2, -7.5), "fov": 46.0}
	return {"pos": lead + Vector3(0, 4.2, 9.5), "look": lead + Vector3(0, 1.0, -1.5)}


func _demo_tick(delta: float) -> void:
	_demo_accum += delta
	if _demo_accum < DEMO_INTERVAL:
		return
	_demo_accum = 0.0
	if _app_state == AppState.OVERWORLD:
		if _ow_walk == null and not _ow_entering and not _ow_candidates.is_empty():
			var target: String = _ow_candidates[0].word
			if _ow_buffer.length() < target.length():
				_ow_char(target.substr(_ow_buffer.length(), 1))
		return
	if _phase == Phase.PROSE and not _prose.is_complete():
		_on_char(_prose.target.substr(_prose.cursor, 1))
	elif _phase == Phase.CHOICE:
		var nc := ""
		if _picked == null and not _candidates.is_empty():
			nc = _demo_choice_word().substr(0, 1)
		elif _picked != null and _buffer.length() < _picked.word.length():
			nc = _picked.word.substr(_buffer.length(), 1)
		if nc != "":
			_on_char(nc)


# Demo prefers a choice that is NOT a setback (return_to), so the auto-play walks a
# scenario through to its win instead of looping the grot detour.
func _demo_choice_word() -> String:
	for cand in _candidates:
		var target = _run.graph.get_node_by_id(cand.choice.target)
		if target != null and target.return_to == "":
			return cand.word
	return _candidates[0].word


# --- utilities ---------------------------------------------------------------

func _after(seconds: float, cb: Callable) -> void:
	get_tree().create_timer(seconds).timeout.connect(cb, CONNECT_ONE_SHOT)


# A brief white flash over everything -- the win flourish (A9).
func _flash() -> void:
	if _ui == null:
		return
	var f := ColorRect.new()
	f.color = Color(1, 1, 1, 0.0)
	f.set_anchors_preset(Control.PRESET_FULL_RECT)
	f.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_ui.add_child(f)
	var t := create_tween()
	f.color.a = 0.75
	t.tween_property(f, "color:a", 0.0, 0.6)
	t.tween_callback(f.queue_free)


# --- menus -------------------------------------------------------------------

func _compose_backdrop() -> void:
	_composer.compose_overworld("hub")   # the island is the menu backdrop
	_update_camera(0.0, true)


func _set_playing_ui(playing: bool) -> void:
	# Hide the band's contents during menus (its dark background still fills the
	# bottom strip, so there is no bare gap). The 3D backdrop shows above it.
	if _narration != null:
		_narration.visible = false   # instructions now live in the top bar, not the band
	if _type_along != null:
		_type_along.visible = playing
	if _keyboard != null:
		_keyboard.visible = playing
		_keyboard.set_hands_visible(playing)   # finger legend only during a scenario
	if _hud != null:
		_hud.visible = playing
	if _message != null:
		_message.visible = false   # deprecated: scene text lives in the top bar now
	if _choice_layer != null:
		_choice_layer.visible = playing
	if _back_button != null:
		_back_button.visible = playing
	if not playing and _brief_label != null:
		if _brief_tween != null:
			_brief_tween.kill()   # cancel any in-flight briefing typewriter
		_brief_label.visible = false
		_intro_briefing = false


func _on_back_pressed() -> void:
	if _app_state == AppState.PLAYING:
		_show_overworld(_ow_at)   # leave a scenario, back to the island
	elif _app_state == AppState.OVERWORLD:
		_show_main_menu()         # leave the island, back to the main menu


func _clear_menu() -> void:
	if _menu_screen != null:
		_menu_screen.queue_free()
		_menu_screen = null


# The main menu shows the 3D scene FULL-SCREEN (no bottom band). Play and the
# overworld picker use the split (scene on top, UI band below).
func _set_menu_fullscreen(on: bool) -> void:
	if _viewport_container != null:
		# full-width either way; only the bottom edge differs (full screen vs the
		# top region above the UI band)
		_viewport_container.anchor_left = 0.0
		_viewport_container.anchor_top = 0.0
		_viewport_container.anchor_right = 1.0
		_viewport_container.anchor_bottom = 1.0 if on else 0.0
		_viewport_container.offset_left = 0.0
		_viewport_container.offset_top = 0.0
		_viewport_container.offset_right = 0.0
		_viewport_container.offset_bottom = 0.0 if on else float(VIEW_HEIGHT)
	if _band != null:
		_band.visible = not on



func _show_menu(title: String, items: Array) -> void:
	_clear_menu()
	var screen := MenuScreenScene.instantiate()
	_menu_layer.add_child(screen)
	_menu_screen = screen
	var title_label := screen.get_node_or_null("TitleWaver/TitleVP/Title") as Label
	if title_label != null:
		title_label.text = title
		title_label.add_theme_font_override("font", MEDIEVAL_FONT)   # decorative heading
	# wave the whole title plate (banner + text together): the banner and label are
	# rendered into TitleVP and the wave shader ripples the combined image
	var waver := screen.get_node_or_null("TitleWaver") as SubViewportContainer
	if waver != null:
		var sh := Shader.new()
		sh.code = ChoiceBannerScript.WAVE_SHADER
		var mat := ShaderMaterial.new()
		mat.shader = sh
		mat.set_shader_parameter("amplitude", 0.022)
		mat.set_shader_parameter("frequency", 4.0)
		mat.set_shader_parameter("speed", 1.7)
		waver.material = mat
	var vbox := screen.get_node("Items")
	for it in items:
		var banner := MenuBannerScene.instantiate()
		vbox.add_child(banner)
		banner.configure(it.text, it.get("secondary", false))
		if it.get("compact", false):
			banner.set_compact()   # dev/util rows: small so many fit
		banner.pressed.connect(it.on_press)


func _show_main_menu() -> void:
	_app_state = AppState.MAIN
	_intro_reset = false   # fresh options label next time
	_music.play_context("menu")
	_set_top_prompt("")
	_set_playing_ui(false)
	_set_menu_fullscreen(true)
	_hide_ow_legend()
	_update_camera(0.0, true)
	_show_menu("TypeQuest", [
		{"text": "Start", "on_press": _show_overworld_from_menu},
		{"text": "Kies je held", "on_press": _pick_hero_from_menu},
		{"text": "Opties", "on_press": _show_options},
		{"text": "Stoppen", "on_press": _quit_app, "secondary": true},
	])


func _pick_hero_from_menu() -> void:
	_show_character_picker(_show_main_menu)   # re-pick, then back to the menu


func _show_overworld_from_menu() -> void:
	# first-run: pick a hero before anything else, then flow into the intro/island
	if AppProgress.get_choice("hero_chosen", "") == "":
		_show_character_picker(_after_hero_chosen)
	else:
		_after_hero_chosen()


func _after_hero_chosen() -> void:
	# the wake-up intro plays once (unless --intro forces a replay); afterwards Start
	# goes straight to the island
	if _force_intro or not AppProgress.intro_seen():
		_start_intro()
	else:
		_show_overworld(_ow_at)


# --- character picker (rotating carousel: arrows/scroll to cycle, Enter to choose) -----

func _show_character_picker(after: Callable) -> void:
	_app_state = AppState.PICKER
	_picker_after = after
	_music.play_context("menu")
	_clear_menu()
	_hide_ow_legend()
	_set_playing_ui(false)
	_set_menu_fullscreen(false)
	if _back_button != null:
		_back_button.visible = false
	var cur: String = AppProgress.get_choice("hero", Characters.DEFAULT_ID)
	_picker_index = 0
	var roster: Array = Characters.all()
	for i in roster.size():
		if roster[i].id == cur:
			_picker_index = i
			break
	_update_picker()


func _update_picker() -> void:
	var c: Dictionary = Characters.all()[_picker_index]
	_composer.compose_character(c.id)
	_update_camera(0.0, true)
	_set_top_prompt("Kies je held:  %s\n(  <  pijltjes  >   --  Enter om te kiezen  )" % c.label)


func _picker_step(dir: int) -> void:
	var n: int = Characters.all().size()
	_picker_index = (_picker_index + dir + n) % n
	_update_picker()


func _picker_confirm() -> void:
	AppProgress.set_choice("hero", Characters.all()[_picker_index].id)
	AppProgress.set_choice("hero_chosen", "1")
	var after: Callable = _picker_after
	_picker_after = Callable()
	if after.is_valid():
		after.call()
	else:
		_show_main_menu()


# --- intro (wake up, walk out of the house, into the world) -------------------

func _start_intro() -> void:
	_clear_menu()
	_music.play_context("adventure")
	_set_top_prompt("")
	_set_menu_fullscreen(false)
	_set_playing_ui(true)
	_app_state = AppState.PLAYING
	_in_intro = true
	_ow_at = "hub"
	_run = RunState.new(IntroArc.build(), _locale)
	_enter_node()
	_begin_briefing()   # roll the explanation first, then reveal the typing box


func _finish_intro() -> void:
	_in_intro = false
	_intro_briefing = false
	AppProgress.set_intro_seen(true)
	_show_overworld("hub")


# --- intro briefing: explanation sentences roll across before typing ----------

func _begin_briefing() -> void:
	_intro_briefing = true
	# hide the typing UI + top prompt; the scene stays as the backdrop (knight asleep)
	_set_top_prompt("")
	_type_along.visible = false
	_keyboard.visible = false
	_choice_layer.visible = false
	# stack ALL sentences and type them out one after another, keeping them on screen
	# until the whole explanation is shown (then reveal the typing UI)
	var lines: Array = _locale.briefing()
	var full := ""
	var ends: Array = []
	for i in lines.size():
		if i > 0:
			full += "\n"
		full += _locale.fill_tokens(str(lines[i]), _chosen_hero_id())   # name the CHOSEN hero
		ends.append(full.length())
	_brief_label.text = full
	_brief_label.visible_ratio = 0.0
	_brief_label.modulate.a = 1.0
	_brief_label.visible = true
	var total: float = float(maxi(full.length(), 1))
	_brief_tween = create_tween()
	for i in lines.size():
		var seg_len: int = str(lines[i]).length()
		var dur: float = clampf(seg_len * 0.108, 1.8, 8.4)   # 5/9 speed, gentle for beginners
		_brief_tween.tween_property(_brief_label, "visible_ratio", float(ends[i]) / total, dur)
		_brief_tween.tween_interval(0.7)   # a beat between sentences
	_brief_tween.tween_interval(2.0)       # final hold, everything visible
	_brief_tween.tween_callback(_end_briefing)


func _end_briefing() -> void:
	if not _intro_briefing:
		return   # already ended / bailed out (ESC / back)
	_intro_briefing = false
	_brief_label.visible = false
	# reveal the typing UI so the child can move the knight
	_type_along.visible = true
	_keyboard.visible = true
	_keyboard.set_hands_visible(true)
	_choice_layer.visible = true
	_set_top_prompt(_locale.resolve(_run.current().narration_key))


# --- options (main menu) ------------------------------------------------------

## The options screen. Currently one setting: the keyboard layout (AZERTY/QWERTY),
## a parent/setup choice matching the child's physical keyboard. Persists across
## runs (KeyboardSettings -> user://settings.cfg).
func _show_options() -> void:
	_app_state = AppState.MAIN
	_set_playing_ui(false)
	_set_menu_fullscreen(true)
	var opts: Array = [
		{"text": _kbd_item_text(), "on_press": _toggle_keyboard_layout},
		{"text": _intro_item_text(), "on_press": _reset_intro},
	]
	# Dev tools only on a debug build (editor) or once unlocked by the secret code -- never
	# openly on the shipped web/AppImage build.
	if _dev_unlocked or OS.is_debug_build():
		opts.append({"text": "Dev", "on_press": _show_dev})
	opts.append({"text": "Terug", "on_press": _show_main_menu, "secondary": true})
	_show_menu("Opties", opts)


# --- dev screen: reset/jump progress for testing different scenario states -----------
# Secret unlock: type this on the main menu to reveal the Dev tools on a shipped build.
# Change it to whatever you like (lowercase letters only).
const DEV_CODE := "devmode"
const DEV_FLAGS := [
	{"label": "Cave", "flag": "met_skeleton"},
	{"label": "Zwaard", "flag": "has_sword"},
	{"label": "Boog", "flag": "has_bow"},
	{"label": "Wapens", "flag": "has_gear"},
	{"label": "Boog getr.", "flag": "archery_done"},
	{"label": "Kristal", "flag": "has_crystal"},
	{"label": "Brug over", "flag": "crossed_bridge"},
]


func _show_dev() -> void:
	_app_state = AppState.MAIN
	_set_playing_ui(false)
	_set_menu_fullscreen(true)
	var items: Array = [{"text": "Reset", "on_press": _dev_reset_all, "compact": true}]
	for d in DEV_FLAGS:
		var on: bool = AppProgress.get_flag(d.flag)
		items.append({"text": "%s: %s" % [d.label, "aan" if on else "uit"],
			"on_press": _dev_toggle.bind(d.flag), "compact": true})
	items.append({"text": "Terug", "on_press": _show_options, "secondary": true, "compact": true})
	_show_menu("Dev", items)


func _dev_toggle(flag: String) -> void:
	AppProgress.set_flag(flag, not AppProgress.get_flag(flag))
	AppProgress.set_flag("saw_" + flag, false)   # re-arm any mist reveal so it animates again
	_show_dev()   # rebuild so the aan/uit labels update


func _dev_reset_all() -> void:
	AppProgress.reset_all()
	_show_dev()


func _kbd_item_text() -> String:
	return "Toetsenbord: %s" % KeyboardSettings.active_name()


func _intro_item_text() -> String:
	return "Intro is gereset" if _intro_reset else "Intro opnieuw tonen"


# Clear the intro-seen flag so the wake-up intro plays again on the next Start.
func _reset_intro() -> void:
	AppProgress.set_intro_seen(false)
	_intro_reset = true
	_show_options()   # re-render with the confirmation label


func _toggle_keyboard_layout() -> void:
	KeyboardSettings.cycle()
	if _keyboard != null:
		_keyboard.rebuild()   # redraw the on-screen board for the new layout
	_show_options()           # re-render the item with the updated label


# --- overworld (the walkable scenario picker) ---------------------------------

## Show the island with the knight standing at `at_anchor` (the hub, or the site
## it just finished). The child TYPES a site word to travel there; typing uses
## prefix matching across the unlocked words (bos/boog style shared prefixes stay
## reachable), so no site is ever shadowed by another.
func _show_overworld(at_anchor: String = "hub") -> void:
	_app_state = AppState.OVERWORLD
	_music.play_context("overworld")
	_set_menu_fullscreen(false)
	_clear_menu()
	_set_playing_ui(false)
	# prompt goes in the top bar; the band shows only the typed word + keyboard
	_set_top_prompt(_locale.resolve("overworld.narration"))
	_narration.visible = false
	_type_along.visible = true
	_type_along.set_plain("")
	_keyboard.visible = true
	_choice_layer.visible = true
	if _back_button != null:
		_back_button.visible = true   # island -> main menu (also on ESC)
	_composer.compose_overworld(at_anchor)
	_ow_at = at_anchor
	_ow_buffer = ""
	_ow_walk = null
	_ow_entering = false
	_ow_candidates = []
	for s in OverworldSites.sites():
		if s.scenario != "":   # locked sites stay typeable so they can HINT ("nog niet open")
			_ow_candidates.append({"word": _locale.resolve(s.word_key), "site": s})
	_build_ow_legend()
	_update_ow_highlight()
	_update_camera(0.0, true)
	_reveal_unlocked_regions()  # lift the coastal mist over any region already opened
	_maybe_nudge_objective()   # announce a newly-unlocked objective once


# Lift the authored mist for every region flag that is set. Which clouds belong to which
# region is authored in the set via groups ("reveal_<flag>"), so growth in any direction is
# purely editor work -- no code change. Animate the parting the FIRST time it is seen
# (returning from the unlock), then just stay clear on later visits.
func _reveal_unlocked_regions() -> void:
	for flag in _composer.mist_reveal_flags():
		if not AppProgress.get_flag(flag):
			continue
		var seen_key: String = "saw_" + flag
		var animate: bool = not AppProgress.get_flag(seen_key)
		_composer.reveal_mist(flag, animate)
		if animate:
			AppProgress.set_flag(seen_key)


# Colour-code the island: a flag ON each site (via the composer) plus a matching pill in the
# right-side legend. Replaces the old per-site floating banners, so the map itself stays clear
# of text. Locked sites get a grey flag + a greyed pill; an open objective adds a "!" badge.
func _build_ow_legend() -> void:
	var flag_specs: Array = []
	var legend_specs: Array = []
	for s in OverworldSites.sites():
		var fc: Dictionary = SITE_FLAGS.get(s.id, {"model": "flag_red", "color": Color("c0392b")})
		var locked: bool = _site_locked(s)
		flag_specs.append({
			"anchor": s.anchor, "model": fc.model,
			"tint": fc.get("tint", Color(1, 1, 1)), "locked": locked,
		})
		legend_specs.append({
			"id": s.id, "word": _locale.resolve(s.word_key), "color": fc.color,
			"locked": locked, "badge": _site_has_open_objective(s.id),
		})
	_composer.stage_site_flags(flag_specs)
	if _legend == null:
		_legend = SiteLegendScript.new()
		_choice_layer.add_child(_legend)
	_legend.build(legend_specs)
	_legend.visible = not _hidebanners   # --nobanner debug still hides the key
	_position_legend()


# Pin the legend to the right edge, vertically centred. Uses the panel's laid-out size, so it
# stays correct once the container has measured itself (called every overworld frame + on build).
func _position_legend() -> void:
	if _legend == null or not _legend.visible:
		return
	var sz: Vector2 = _legend.size
	_legend.position = Vector2(1920.0 - sz.x - 44.0, (1080.0 - sz.y) * 0.5)


# --- objectives (discoverability) --------------------------------------------

# Objectives whose active_flag is set and done_flag is not -- the open ones.
func _open_objectives() -> Array:
	var open: Array = []
	for o in Objectives.all():
		var active: bool = o.active_flag == "" or AppProgress.get_flag(o.active_flag)
		if active and not AppProgress.get_flag(o.done_flag):
			open.append(o)
	return open


func _site_has_open_objective(site_id: String) -> bool:
	for o in _open_objectives():
		if o.target_site == site_id:
			return true
	return false


# Announce a newly-open objective ONCE (a short read-aloud nudge in the top bar); the
# site badge is the ongoing reminder. Persists nudged_<id> so it does not repeat.
func _maybe_nudge_objective() -> void:
	for o in _open_objectives():
		var nkey: String = "nudged_" + o.id
		if not AppProgress.get_flag(nkey):
			AppProgress.set_flag(nkey)
			_set_top_prompt(_locale.resolve(o.hint_key))
			_after(4.5, _restore_ow_prompt)
			return


func _restore_ow_prompt() -> void:
	if _app_state == AppState.OVERWORLD and _ow_walk == null:
		_set_top_prompt(_locale.resolve("overworld.narration"))


# Site needs gear first: clear the typed word, show the hint a few seconds, then revert.
func _ow_show_hint(text: String) -> void:
	_ow_buffer = ""
	_type_along.set_plain("")
	_update_ow_highlight()
	_set_top_prompt(text)
	_after(3.5, _restore_ow_prompt)


func _hide_ow_legend() -> void:
	if _legend != null:
		_legend.visible = false


func _set_top_prompt(text: String) -> void:
	if _top_bar == null:
		return
	_top_bar.visible = text != ""
	_top_prompt.text = text
	# size the bar to the text (width to the widest line, height to the line count) so
	# longer explanations and 2-line win messages ("<msg>\n(druk op enter)") both fit
	if text != "":
		var font := _top_prompt.get_theme_font("font")
		var fs := _top_prompt.get_theme_font_size("font_size")
		var lines := text.split("\n")
		var w := 0.0
		for line in lines:
			w = maxf(w, font.get_string_size(line, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x)
		var half: float = clampf(w * 0.5 + 46.0, 300.0, 900.0)
		_top_bar.offset_left = -half
		_top_bar.offset_right = half
		var line_h: float = float(fs) + 8.0
		_top_bar.offset_bottom = 14.0 + maxf(66.0, lines.size() * line_h + 24.0)


## Typed site selection: the buffer must stay a prefix of at least one unlocked
## word; a completed word starts the travel.
func _ow_char(c: String) -> void:
	var next := _ow_buffer + c
	var matches: Array = []
	for cand in _ow_candidates:
		if cand.word.begins_with(next):
			matches.append(cand)
	if matches.is_empty():
		return
	_ow_buffer = next
	_type_along.set_plain(_ow_buffer)   # show the typed word in the band
	_update_ow_highlight()
	for cand in matches:
		if cand.word == _ow_buffer:
			var site = cand.site
			# still locked (e.g. before the cave) -> "nog niet open"
			if _site_locked(site):
				_ow_show_hint(_locale.resolve("overworld.locked"))
				return
			# unlocked but the gear is not collected yet -> "haal eerst je zwaard/boog thuis"
			if site.get("requires_flag", "") != "" and not AppProgress.get_flag(site.requires_flag):
				_ow_show_hint(_locale.resolve(site.hint_key))
				return
			_begin_ow_travel(site)
			return


func _update_ow_highlight() -> void:
	var matches: Array = []
	for cand in _ow_candidates:
		if cand.word.begins_with(_ow_buffer):
			matches.append(cand)
	if _legend != null:
		_legend.set_prefix(_ow_buffer)
	# guide the next key only once the typed prefix singles a site out (an open
	# pick shows no bias -- the legend itself shows the words)
	if matches.size() == 1 and _ow_buffer.length() < matches[0].word.length():
		_keyboard.highlight(matches[0].word.substr(_ow_buffer.length(), 1))
	else:
		_keyboard.highlight("")


## Travel legs: routes are authored hub -> site, so from the hub it is one leg;
## from another site it is that site's route reversed back to the hub first.
# A site is locked if it has no scenario yet, or its unlock_flag is not set (earned
# progression -- e.g. the smithy + range stay locked until the cave: met_skeleton).
func _site_locked(s) -> bool:
	if s.scenario == "":
		return true
	var uf: String = s.get("unlock_flag", "")
	return uf != "" and not AppProgress.get_flag(uf)


func _begin_ow_travel(site) -> void:
	var legs: Array = []
	if _ow_at != "hub":
		for s in OverworldSites.sites():
			if s.anchor == _ow_at:
				legs.append({"route": s.route, "reverse": true})
	legs.append({"route": site.route, "reverse": false})
	_ow_walk = {"legs": legs, "leg": 0, "dist": 0.0, "site": site}
	_hide_ow_legend()
	_keyboard.highlight("")
	_narration.text = _locale.resolve(site.word_key)


func _ow_walk_tick(delta: float) -> void:
	var leg: Dictionary = _ow_walk.legs[_ow_walk.leg]
	var path: Path3D = _composer.overworld_route(leg.route)
	if path == null or path.curve == null:   # a missing route never strands the child
		push_warning("Missing overworld route '%s' -- starting scenario directly" % leg.route)
		_ow_arrive()
		return
	var length := path.curve.get_baked_length()
	_ow_walk.dist += OW_WALK_SPEED * delta
	var d: float = clampf(_ow_walk.dist, 0.0, length)
	var offset := (length - d) if leg.reverse else d
	var pos: Vector3 = path.curve.sample_baked(offset)
	var prev: Vector3 = _composer.lead_position()
	_composer.set_lead_position(pos)
	var dir := pos - prev
	if dir.length() > 0.001:
		_composer.set_lead_yaw(atan2(dir.x, dir.z))
	_composer.set_lead_animation(true)
	if _ow_walk.dist >= length:
		_ow_walk.leg += 1
		_ow_walk.dist = 0.0
		if _ow_walk.leg >= _ow_walk.legs.size():
			_ow_arrive()


func _ow_arrive() -> void:
	var site = _ow_walk.site
	_ow_walk = null
	_ow_at = site.anchor
	if _walk_capture:
		_composer.set_lead_animation(false)   # debug: rest at the route end, no scenario cut
		return
	# already-done site: a short "you can still practise" beat before the (optional) replay,
	# so a revisit does not feel like blind repetition. Input stays blocked (_ow_entering).
	var df: String = site.get("done_flag", "")
	if df != "" and AppProgress.get_flag(df):
		_composer.set_lead_animation(false)
		_ow_entering = true
		_set_top_prompt(_locale.resolve("overworld.again"))
		_after(2.5, _finish_ow_entry.bind(site.scenario))
		return
	_ow_entering = true   # block island input during the fade into the scenario
	_fade_cut(_start_scenario.bind(site.scenario))


func _finish_ow_entry(scenario: String) -> void:
	# _ow_entering stays true through the fade (reset when the island is next shown), so no
	# stray keystroke during the black starts another travel.
	_fade_cut(_start_scenario.bind(scenario))


func _quit_app() -> void:
	get_tree().quit()


func _win_message() -> String:
	var node = _run.current()
	if node != null and node.win_key != "":
		# fill {held} so a win line can name the CHOSEN hero (jouw jager/heks/...), never a
		# hardcoded "ridder" -- matches the prose + briefing (all reference the same character)
		return _locale.fill_tokens(_locale.resolve(node.win_key), _chosen_hero_id())
	return "goed gedaan."


# Word count of a prose string (space-separated tokens) -- cumulative effort stat.
func _word_count(prose: String) -> int:
	return prose.split(" ", false).size()


# Total stars earned this run (best-per-node summed).
func _run_total_stars() -> int:
	var total := 0
	for v in _run.stars_by_node.values():
		total += int(v)
	return total


func _start_scenario(id: String) -> void:
	_clear_menu()
	_music.play_context("adventure")
	_set_top_prompt("")
	_set_menu_fullscreen(false)
	_set_playing_ui(true)
	_app_state = AppState.PLAYING
	_run = RunState.new(Scenarios.build(id), _locale)
	# Revisit skip (forest): once the cave has been met, the `start` walk node is pure
	# repetition on every return -- the child re-types the same forest-walk sentence just to
	# reach a fork they already know. Land bos REVISITS straight at `kruispunt` (the genuine
	# grot/brug crossroads), keeping the fight + crossing prose (real typing practice) but
	# dropping the redundant walk-in. Mirrors the --scene debug jump above.
	if id == "band1" and AppProgress.get_flag("met_skeleton") and _run.graph.has_node("kruispunt"):
		_run.current_id = "kruispunt"
	_enter_node()


func _capture_burst(count: int = 12, interval: float = 0.25) -> void:
	var shots_dir := ProjectSettings.globalize_path("res://.shots")
	DirAccess.make_dir_recursive_absolute(shots_dir)
	for i in range(count):
		await get_tree().create_timer(interval).timeout
		get_viewport().get_texture().get_image().save_png(shots_dir.path_join("burst_%02d.png" % i))
	print("BURST_DONE")
	get_tree().quit()


func _capture_after(seconds: float) -> void:
	await get_tree().create_timer(seconds).timeout
	var shots_dir := ProjectSettings.globalize_path("res://.shots")
	DirAccess.make_dir_recursive_absolute(shots_dir)
	var img := get_viewport().get_texture().get_image()
	var out := shots_dir.path_join("game.png")
	img.save_png(out)
	print("SHOT_SAVED ", out)
	get_tree().quit()
