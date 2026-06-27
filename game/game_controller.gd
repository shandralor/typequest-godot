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

enum Phase { PROSE, CHOICE, PAUSE, WIN, DONE }

const VIEW_HEIGHT := 500   # top: the 3D scene gets its OWN area (a SubViewport)
const BAND_HEIGHT := 380   # bottom: the UI band (500 + 380 = 880 window)

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

# demo / capture
var _demo := false
var _demo_accum := 0.0
const DEMO_INTERVAL := 0.10


func _ready() -> void:
	_locale = LocaleNlBe.new()
	_run = RunState.new(Band1Arc.build(), _locale)
	_build_layout()
	_demo = "--demo" in OS.get_cmdline_user_args()
	if "--shot" in OS.get_cmdline_user_args():
		_capture_after(6.0)
	_enter_node()


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
	_hud = _make_label(24, HORIZONTAL_ALIGNMENT_RIGHT)
	_hud.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_hud.offset_left = -360
	_hud.offset_right = -20
	_hud.offset_top = 14
	ui.add_child(_hud)

	# transient message (over the scene, upper area)
	_message = _make_label(40, HORIZONTAL_ALIGNMENT_CENTER)
	_message.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_message.offset_top = 110
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

	_narration = _make_label(26, HORIZONTAL_ALIGNMENT_CENTER)
	_narration.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_narration.offset_top = 12
	_narration.offset_left = 40
	_narration.offset_right = -40
	band.add_child(_narration)

	_type_along = TypeAlongPanel.new()
	_type_along.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_type_along.offset_top = 44
	_type_along.offset_bottom = 170
	_type_along.offset_left = 90
	_type_along.offset_right = -90
	band.add_child(_type_along)

	_keyboard = KeyboardGuide.new()
	_keyboard.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_keyboard.offset_top = -200
	_keyboard.offset_bottom = -10
	band.add_child(_keyboard)


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
	_composer.compose(node.scene)
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
	_show_choice_prompt()
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
	_show_choice_prompt()
	_highlight_choice()
	if _picked != null and _buffer == _picked.word:
		_run.choose(_locale.resolve(_picked.choice.word_key))
		_enter_node()


# --- view helpers ------------------------------------------------------------

func _show_choice_prompt() -> void:
	var labels: Array = []
	for cand in _candidates:
		labels.append("%s (%s)" % [cand.word, _hint_nl(cand.choice.hint)])
	_narration.text = "typ je keuze: " + " of ".join(labels)
	if _picked == null:
		var words: Array = []
		for cand in _candidates:
			words.append(cand.word)
		_type_along.set_plain(" / ".join(words))
	else:
		_type_along.set_prose(_picked.word, _buffer.length())


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
	var p := 0.0
	if _phase == Phase.PROSE:
		p = _prose.progress()
	elif _phase == Phase.CHOICE or _phase == Phase.PAUSE or _phase == Phase.WIN:
		p = 1.0
	_activity.update(p, delta)
	_composer.set_lead_progress(p)
	# Face the travel direction once underway, and KEEP facing it when the child
	# pauses -- only the fresh idle pose (before any typing) faces the camera. This
	# avoids the hero snapping back to face the player whenever typing stops.
	_composer.set_lead_moving(p > 0.02)
	_update_camera(delta, false)
	if _demo:
		_demo_tick(delta)


# Keep a fixed offset behind/above the hero. Snap on scene entry, smoothly follow
# during play, so the hero is the same apparent size wherever it is on the path.
func _update_camera(delta: float, snap: bool) -> void:
	if _camera == null or not _composer.has_lead():
		return
	var target: Vector3 = _composer.lead_position()
	var desired: Vector3 = target + CAM_OFFSET
	if snap:
		_camera.position = desired
	else:
		_camera.position = _camera.position.lerp(desired, clampf(delta * CAM_LERP, 0.0, 1.0))
	_camera.look_at(target + Vector3(0.0, CAM_LOOK_Y, 0.0), Vector3.UP)


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
