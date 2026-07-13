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
const AzertyInput = preload("res://input/azerty_input.gd")
const TypeAlongPanel = preload("res://ui/type_along.gd")
const KeyboardGuide = preload("res://ui/keyboard_guide.gd")
const ChoiceBannerScript = preload("res://ui/choice_banner.gd")
const MenuScreenScene = preload("res://scenes/menu/menu_screen.tscn")
const MenuBannerScene = preload("res://ui/menu_banner.tscn")
const Scenarios = preload("res://content/scenarios.gd")
const OverworldSites = preload("res://content/overworld.gd")

enum Phase { PROSE, CHOICE, PAUSE, WIN, DONE }
enum AppState { MAIN, OVERWORLD, PLAYING }

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

# UI
var _type_along
var _keyboard
var _narration: Label
var _message: Label
var _hud: Label
var _choice_layer: Control
var _banners: Array = []
var _ui: Control
var _menu_layer: Control
var _menu_screen: Control
var _band: Control
var _viewport_container: SubViewportContainer
var _app_state := AppState.MAIN

# overworld (the walkable scenario picker)
var _ow_candidates: Array = []   # unlocked sites: [{ word, site }]
var _ow_buffer := ""
var _ow_banners: Array = []      # [{ banner, site, word, locked }]
var _ow_walk = null              # { legs: [{route, reverse}], leg, dist, site }
var _ow_at := "hub"              # anchor the hero stands at on the island
const OW_WALK_SPEED := 4.5
const OW_BANNER_LIFT := Vector3(0, 4.6, 0)   # banner floats this far above a site

# demo / capture
var _demo := false
var _demo_accum := 0.0
const DEMO_INTERVAL := 0.10


func _ready() -> void:
	_locale = LocaleNlBe.new()
	_build_layout()
	var args := OS.get_cmdline_user_args()
	_demo = "--demo" in args
	# debug: pick a scenario (--scenario=ID), jump to a node (--scene=ID), and
	# pre-type N chars (--type=N)
	var jump := _arg_value(args, "--scene")
	var scen := _arg_value(args, "--scenario")
	if _demo or jump != "" or scen != "":
		if jump != "" or scen != "":
			_start_scenario(scen if scen != "" else "band1")
		else:
			_show_overworld()   # a bare --demo plays from the island, like a child
		if jump != "":
			_run.current_id = jump
			_enter_node()
		for i in range(int(_arg_value(args, "--type"))):
			if _phase == Phase.PROSE and not _prose.is_complete():
				_on_char(_prose.target.substr(_prose.cursor, 1))
		if "--shot" in args:
			_capture_after(2.0 if jump != "" else 6.0)
		if "--burst" in args:
			_capture_burst()
	else:
		if _arg_value(args, "--menu") in ["world", "scenarios"]:
			_show_overworld()
		else:
			_compose_backdrop()
			_show_main_menu()
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

func _enter_node() -> void:
	var node = _run.current()
	_clear_banners()
	_type_along.visible = true
	_composer.compose(node.scene, node.id)
	_update_camera(0.0, true)   # snap to the new scene's framing
	_activity.reset()
	_narration.text = _locale.resolve(node.narration_key)
	_set_message("")
	if node.prerevealed:
		_prose = TypingState.new("")
		_type_along.set_plain(_locale.resolve(node.prose_key))
		_begin_choice()
	else:
		_prose = TypingState.new(_locale.resolve(node.prose_key))
		_phase = Phase.PROSE
		_type_along.set_prose(_prose.target, 0)
		_highlight_prose()
	_setup_gaze(node)
	_update_hud()


func _begin_choice() -> void:
	var node = _run.current()
	if node.choices.is_empty():
		_resolve_ending()
		return
	_candidates = []
	for ch in node.choices:
		_candidates.append({"word": _locale.resolve(ch.word_key), "choice": ch})
	_picked = null
	_buffer = ""
	_phase = Phase.CHOICE
	_narration.text = "typ je keuze:"
	_show_banners()
	_highlight_choice()


func _resolve_ending() -> void:
	var ending = _run.resolve_ending()
	match ending.type:
		"setback":
			_set_message("de grot is eng. terug naar het pad.")
			_phase = Phase.PAUSE
			_after(1.8, _enter_node)
		"win":
			_set_message(_win_message() + "\n(druk op enter)")
			_type_along.visible = false   # no empty panel at the win
			_keyboard.highlight("")
			_phase = Phase.WIN
			if _composer.is_work_scene():
				_composer.stop_sparks()
				_composer.vanish_grindstone()            # poof the wheel, reveal the knight
				_composer.play_lead_loop("Cheering")    # raise the held sword in triumph
			else:
				_composer.open_chest()                  # treasure win: open the chest
				_composer.play_lead_oneshot("PickUp")
			_flash()
		_:
			_set_message("einde.")
			_phase = Phase.DONE


# --- input -------------------------------------------------------------------

func _input(event: InputEvent) -> void:
	if not (event is InputEventKey) or not event.pressed or event.echo:
		return
	if event.keycode == KEY_ESCAPE:
		if _app_state == AppState.OVERWORLD:
			_show_main_menu()   # back out of the island to the main menu
		else:
			get_tree().quit()
		return
	if _app_state == AppState.OVERWORLD:
		if _ow_walk == null:   # ignore keys while the knight is traveling
			var oc := AzertyInput.char_for_physical(event.physical_keycode)
			if oc != "":
				get_viewport().set_input_as_handled()
				_ow_char(oc)
		return
	if _app_state != AppState.PLAYING:
		return  # the main menu is mouse-driven
	if _phase == Phase.WIN and event.keycode == KEY_ENTER:
		_show_overworld(_ow_at)   # finishing + enter returns to the island
		return
	var c := AzertyInput.char_for_physical(event.physical_keycode)
	if c != "":
		get_viewport().set_input_as_handled()
		_on_char(c)


func _on_char(c: String) -> void:
	match _phase:
		Phase.PROSE:
			_prose_char(c)
		Phase.CHOICE:
			_choice_char(c)


func _prose_char(c: String) -> void:
	_prose.type_char(c)
	_type_along.set_prose(_prose.target, _prose.cursor)
	_highlight_prose()
	if _prose.is_complete():
		_run.score_current(_prose.correct_chars(), _prose.accuracy(), true)
		_update_hud()
		if _run.current().is_ending():
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
		_run.choose(_locale.resolve(_picked.choice.word_key))
		_enter_node()


# --- view helpers ------------------------------------------------------------

func _show_banners() -> void:
	# keep the pre-revealed prose readable in the panel during the choice (it is the
	# beat's content, not a typing target); a normal fork hides the panel
	var node = _run.current()
	var prerevealed: bool = node != null and node.prerevealed
	_type_along.visible = prerevealed
	if prerevealed:
		_type_along.set_plain(_locale.resolve(node.prose_key))
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


func _clear_banners() -> void:
	for e in _banners:
		e.banner.queue_free()
	_banners.clear()


func _highlight_prose() -> void:
	if _prose.is_complete():
		_keyboard.highlight("")
	else:
		_keyboard.highlight(_prose.target.substr(_prose.cursor, 1))


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
	_message.text = text
	_message.visible = text != ""


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
		_position_ow_banners()
		_update_camera(delta, false)
		if _demo:
			_demo_tick(delta)
		return
	if _app_state != AppState.PLAYING:
		if _composer.has_lead():
			_composer.set_lead_animation(false)
		_update_camera(delta, false)
		return
	var p := _typing_progress()
	var act := _activity.update(p, delta)
	# Don't drive idle/walk during WIN/PAUSE -- a one-shot (e.g. PickUp) is playing.
	var drive_anim := _phase == Phase.PROSE or _phase == Phase.CHOICE
	if _composer.is_walking():
		_composer.set_lead_progress(p)
		# Facing and the walk clip are separate: face the travel direction once
		# underway and KEEP facing it on pauses (only the fresh idle pose, no typing
		# yet, faces the camera); but play the idle clip when momentarily paused.
		_composer.set_lead_moving(p > 0.02)
		if drive_anim:
			_composer.set_lead_animation(_phase == Phase.PROSE and act == SceneActivity.Activity.MOVING)
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
	if _composer.is_walking():
		return
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
	if snap:
		_camera.position = rig.pos
	else:
		_camera.position = _camera.position.lerp(rig.pos, clampf(delta * CAM_LERP, 0.0, 1.0))
	_camera.look_at(rig.look, Vector3.UP)


# Framing adapts to the scene: a close follow while walking; a wide, raised
# establishing shot at the fork (so the cave on the left and the bridge on the
# right are both in view as the hero turns to look); medium otherwise.
func _camera_rig() -> Dictionary:
	if _composer.is_overworld():
		return _composer.overworld_cam()   # editable markers in the overworld set
	var lead: Vector3 = _composer.lead_position()
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
			# Just raised a touch to frame the cheering knight + raised sword.
			return {"pos": lead + Vector3(0.5, 2.2, 4.4), "look": lead + Vector3(0.5, 1.35, 0.6)}
		# a near front view of the knight grinding the sword on the wheel in front
		return {"pos": lead + Vector3(0.5, 1.9, 4.0), "look": lead + Vector3(0.55, 0.95, 1.2)}
	return {"pos": lead + Vector3(0, 4.2, 9.5), "look": lead + Vector3(0, 1.0, -1.5)}


func _demo_tick(delta: float) -> void:
	_demo_accum += delta
	if _demo_accum < DEMO_INTERVAL:
		return
	_demo_accum = 0.0
	if _app_state == AppState.OVERWORLD:
		if _ow_walk == null and not _ow_candidates.is_empty():
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
		_narration.visible = playing
	if _type_along != null:
		_type_along.visible = playing
	if _keyboard != null:
		_keyboard.visible = playing
	if _hud != null:
		_hud.visible = playing
	if _message != null:
		_message.visible = playing
	if _choice_layer != null:
		_choice_layer.visible = playing


func _clear_menu() -> void:
	if _menu_screen != null:
		_menu_screen.queue_free()
		_menu_screen = null


func _show_menu(title: String, items: Array) -> void:
	_clear_menu()
	var screen := MenuScreenScene.instantiate()
	_menu_layer.add_child(screen)
	_menu_screen = screen
	(screen.get_node("Title") as Label).text = title
	var vbox := screen.get_node("Items")
	for it in items:
		var banner := MenuBannerScene.instantiate()
		vbox.add_child(banner)
		banner.configure(it.text, it.get("secondary", false))
		banner.pressed.connect(it.on_press)


func _show_main_menu() -> void:
	_app_state = AppState.MAIN
	_set_playing_ui(false)
	_clear_ow_banners()
	_show_menu("TypeQuest", [
		{"text": "Start", "on_press": _show_overworld_from_menu},
		{"text": "Stoppen", "on_press": _quit_app, "secondary": true},
	])


func _show_overworld_from_menu() -> void:
	_show_overworld(_ow_at)


# --- overworld (the walkable scenario picker) ---------------------------------

## Show the island with the knight standing at `at_anchor` (the hub, or the site
## it just finished). The child TYPES a site word to travel there; typing uses
## prefix matching across the unlocked words (bos/boog style shared prefixes stay
## reachable), so no site is ever shadowed by another.
func _show_overworld(at_anchor: String = "hub") -> void:
	_app_state = AppState.OVERWORLD
	_clear_menu()
	_set_playing_ui(false)
	_narration.visible = true
	_keyboard.visible = true
	_choice_layer.visible = true
	_narration.text = _locale.resolve("overworld.narration")
	_composer.compose_overworld(at_anchor)
	_ow_at = at_anchor
	_ow_buffer = ""
	_ow_walk = null
	_ow_candidates = []
	for s in OverworldSites.sites():
		if s.unlocked and s.scenario != "":
			_ow_candidates.append({"word": _locale.resolve(s.word_key), "site": s})
	_build_ow_banners()
	_update_ow_highlight()
	_update_camera(0.0, true)


func _build_ow_banners() -> void:
	_clear_ow_banners()
	var i := 0
	for s in OverworldSites.sites():
		var locked: bool = not s.unlocked or s.scenario == ""
		var banner = ChoiceBannerScript.new()
		_choice_layer.add_child(banner)
		banner.size = Vector2(300, 96)
		banner.configure(_locale.resolve(s.word_key), "none", float(i) * 1.3)
		if locked:
			banner.set_active(false)
		_ow_banners.append({"banner": banner, "site": s,
			"word": _locale.resolve(s.word_key), "locked": locked})
		i += 1
	_position_ow_banners()


func _clear_ow_banners() -> void:
	for e in _ow_banners:
		e.banner.queue_free()
	_ow_banners.clear()


# Banners float above their site, projected from the 3D anchor each frame -- so a
# larger scrolling island later needs no banner changes.
func _position_ow_banners() -> void:
	if _camera == null:
		return
	for e in _ow_banners:
		var world: Vector3 = _composer.anchor_pos(e.site.anchor) + OW_BANNER_LIFT
		var screen: Vector2 = _camera.unproject_position(world)
		e.banner.set_base_position(screen - Vector2(e.banner.size.x * 0.5, 0))


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
	_update_ow_highlight()
	for cand in matches:
		if cand.word == _ow_buffer:
			_begin_ow_travel(cand.site)
			return


func _update_ow_highlight() -> void:
	var matches: Array = []
	for cand in _ow_candidates:
		if cand.word.begins_with(_ow_buffer):
			matches.append(cand)
	for e in _ow_banners:
		if e.locked:
			e.banner.set_typed(0)
			e.banner.set_active(false)
		elif _ow_buffer != "" and e.word.begins_with(_ow_buffer):
			e.banner.set_typed(_ow_buffer.length())
			e.banner.set_active(true)
		else:
			e.banner.set_typed(0)
			e.banner.set_active(_ow_buffer == "")
	# guide the next key only once the typed prefix singles a site out (an open
	# pick shows no bias -- the banners themselves show the words)
	if matches.size() == 1 and _ow_buffer.length() < matches[0].word.length():
		_keyboard.highlight(matches[0].word.substr(_ow_buffer.length(), 1))
	else:
		_keyboard.highlight("")


## Travel legs: routes are authored hub -> site, so from the hub it is one leg;
## from another site it is that site's route reversed back to the hub first.
func _begin_ow_travel(site) -> void:
	var legs: Array = []
	if _ow_at != "hub":
		for s in OverworldSites.sites():
			if s.anchor == _ow_at:
				legs.append({"route": s.route, "reverse": true})
	legs.append({"route": site.route, "reverse": false})
	_ow_walk = {"legs": legs, "leg": 0, "dist": 0.0, "site": site}
	_clear_ow_banners()
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
	_start_scenario(site.scenario)


func _quit_app() -> void:
	get_tree().quit()


func _win_message() -> String:
	var node = _run.current()
	if node != null and node.win_key != "":
		return _locale.resolve(node.win_key)
	return "goed gedaan."


func _start_scenario(id: String) -> void:
	_clear_menu()
	_set_playing_ui(true)
	_app_state = AppState.PLAYING
	_run = RunState.new(Scenarios.build(id), _locale)
	_enter_node()


func _capture_burst() -> void:
	var shots_dir := ProjectSettings.globalize_path("res://.shots")
	DirAccess.make_dir_recursive_absolute(shots_dir)
	for i in range(12):
		await get_tree().create_timer(0.25).timeout
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
