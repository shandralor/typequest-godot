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

enum Phase { PROSE, CHOICE, PAUSE, WIN, DONE }

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

# demo / capture
var _demo := false
var _demo_accum := 0.0
const DEMO_INTERVAL := 0.10


func _ready() -> void:
	_locale = LocaleNlBe.new()
	_run = RunState.new(Band1Arc.build(), _locale)
	_build_layout()
	var args := OS.get_cmdline_user_args()
	_demo = "--demo" in args
	# debug: jump straight to a node (--scene=ID) and pre-type N chars (--type=N)
	var jump := _arg_value(args, "--scene")
	if jump != "":
		_run.current_id = jump
	_enter_node()
	for i in range(int(_arg_value(args, "--type"))):
		if _phase == Phase.PROSE and not _prose.is_complete():
			_on_char(_prose.target.substr(_prose.cursor, 1))
	if "--shot" in args:
		_capture_after(2.0 if jump != "" else 6.0)


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

	# --- 3D scene area (top) ---
	var container := SubViewportContainer.new()
	container.stretch = true
	container.set_anchors_preset(Control.PRESET_TOP_WIDE)
	container.offset_top = 0
	container.offset_bottom = VIEW_HEIGHT
	container.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(container)
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

	# transient message (over the scene, upper area)
	_message = _make_label(48, HORIZONTAL_ALIGNMENT_CENTER)
	_message.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_message.offset_top = 170
	_message.offset_left = 40
	_message.offset_right = -40
	ui.add_child(_message)

	# --- UI band (bottom): opaque, holds narration + type-along + keyboard ---
	var band := Control.new()
	band.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	band.offset_top = -BAND_HEIGHT
	ui.add_child(band)
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

	_narration = _make_label(30, HORIZONTAL_ALIGNMENT_CENTER)
	_narration.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_narration.offset_top = 12
	_narration.offset_left = 40
	_narration.offset_right = -40
	band.add_child(_narration)

	_type_along = TypeAlongPanel.new()
	_type_along.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_type_along.offset_top = 50
	_type_along.offset_bottom = 168
	_type_along.offset_left = 220
	_type_along.offset_right = -220
	band.add_child(_type_along)

	_keyboard = KeyboardGuide.new()
	_keyboard.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_keyboard.offset_top = -232
	_keyboard.offset_bottom = -12
	band.add_child(_keyboard)

	# choice banners float over the lower part of the scene, above the band
	_choice_layer = Control.new()
	_choice_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	_choice_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(_choice_layer)


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
	_message.text = ""
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
			_message.text = "de grot is eng. terug naar het pad."
			_phase = Phase.PAUSE
			_after(1.8, _enter_node)
		"win":
			_message.text = "goed gedaan. je hebt de schat."
			_type_along.set_plain("")
			_keyboard.highlight("")
			_phase = Phase.WIN
		_:
			_message.text = "einde."
			_phase = Phase.DONE


# --- input -------------------------------------------------------------------

func _input(event: InputEvent) -> void:
	if not (event is InputEventKey) or not event.pressed or event.echo:
		return
	if event.keycode == KEY_ESCAPE:
		get_tree().quit()
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
	_type_along.visible = false
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
	if _picked == null and not _candidates.is_empty():
		next_char = _candidates[0].word.substr(0, 1)
	elif _picked != null and _buffer.length() < _picked.word.length():
		next_char = _picked.word.substr(_buffer.length(), 1)
	_keyboard.highlight(next_char)


func _hint_nl(hint: String) -> String:
	match hint:
		"left": return "links"
		"right": return "rechts"
		"forward": return "vooruit"
		_: return hint


func _update_hud() -> void:
	var snap = _run.progress_snapshot()
	var stars := 0
	for v in snap.starsByNode.values():
		stars += v
	_hud.text = "XP %d    sterren %d" % [snap.xp, stars]


# --- per-frame: drive protagonist motion from observed state -----------------

func _process(delta: float) -> void:
	var p := _typing_progress()
	_activity.update(p, delta)
	if _composer.is_walking():
		_composer.set_lead_progress(p)
		# Face travel direction once underway and KEEP facing it on pauses; only the
		# fresh idle pose (no typing yet) faces the camera.
		_composer.set_lead_moving(p > 0.02)
	else:
		_update_gaze(delta)
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
	if snap:
		_camera.position = rig.pos
	else:
		_camera.position = _camera.position.lerp(rig.pos, clampf(delta * CAM_LERP, 0.0, 1.0))
	_camera.look_at(rig.look, Vector3.UP)


# Framing adapts to the scene: a close follow while walking; a wide, raised
# establishing shot at the fork (so the cave on the left and the bridge on the
# right are both in view as the hero turns to look); medium otherwise.
func _camera_rig() -> Dictionary:
	var lead: Vector3 = _composer.lead_position()
	if _composer.is_walking():
		return {"pos": lead + CAM_OFFSET, "look": lead + Vector3(0, CAM_LOOK_Y, 0)}
	if _composer.has_landmarks():
		return {"pos": lead + Vector3(0, 5.5, 11.5), "look": lead + Vector3(0, 0.5, -4.5)}
	return {"pos": lead + Vector3(0, 4.2, 9.5), "look": lead + Vector3(0, 1.0, -1.5)}


func _demo_tick(delta: float) -> void:
	_demo_accum += delta
	if _demo_accum < DEMO_INTERVAL:
		return
	_demo_accum = 0.0
	if _phase == Phase.PROSE and not _prose.is_complete():
		_on_char(_prose.target.substr(_prose.cursor, 1))
	elif _phase == Phase.CHOICE:
		var nc := ""
		if _picked == null and not _candidates.is_empty():
			nc = _candidates[0].word.substr(0, 1)
		elif _picked != null and _buffer.length() < _picked.word.length():
			nc = _picked.word.substr(_buffer.length(), 1)
		if nc != "":
			_on_char(nc)


# --- utilities ---------------------------------------------------------------

func _after(seconds: float, cb: Callable) -> void:
	get_tree().create_timer(seconds).timeout.connect(cb, CONNECT_ONE_SHOT)


func _capture_after(seconds: float) -> void:
	await get_tree().create_timer(seconds).timeout
	var shots_dir := ProjectSettings.globalize_path("res://.shots")
	DirAccess.make_dir_recursive_absolute(shots_dir)
	var img := get_viewport().get_texture().get_image()
	var out := shots_dir.path_join("game.png")
	img.save_png(out)
	print("SHOT_SAVED ", out)
	get_tree().quit()
