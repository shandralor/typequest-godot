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
const MusicPlayerScript = preload("res://audio/music_player.gd")

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

# archery: per-sentence landing points; the crosshair homes to each as it is typed,
# a longer sentence lands closer to the bullseye, and an arrow fires per sentence.
var _arch_ring: Array = []   # Vector2 landing offset (metres on the target) per sentence
var _arch_span: Array = []   # [start, end) char range per sentence
var _arch_fired := 0
var _arch_t := 0.0

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
var _music
var _top_bar: NinePatchRect   # small brown bar at the top (the overworld prompt)
var _top_prompt: Label
var _back_button: TextureButton   # leave a scenario, back to the island

# overworld (the walkable scenario picker)
var _ow_candidates: Array = []   # unlocked sites: [{ word, site }]
var _ow_buffer := ""
var _ow_banners: Array = []      # [{ banner, site, word, locked }]
var _ow_walk = null              # { legs: [{route, reverse}], leg, dist, site }
var _ow_at := "hub"              # anchor the hero stands at on the island
const OW_WALK_SPEED := 4.5
const OW_BANNER_LIFT := Vector3(0, 7.2, 0)   # banner floats this far above a site (into the sky, off the hexes)

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

func _enter_node() -> void:
	var node = _run.current()
	_clear_banners()
	_type_along.visible = true
	_composer.compose(node.scene, node.id)
	_update_camera(0.0, true)   # snap to the new scene's framing
	_activity.reset()
	_set_top_prompt(_locale.resolve(node.narration_key))   # instruction in the top bar
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
		if _composer.is_archery_scene():
			_setup_archery(_prose.target)
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
	_set_top_prompt("Typ je keuze.")
	_show_banners()
	_highlight_choice()


func _resolve_ending() -> void:
	var ending = _run.resolve_ending()
	match ending.type:
		"setback":
			_set_message("De grot is eng. Terug naar het pad!")
			_phase = Phase.PAUSE
			_after(1.8, _enter_node)
		"win":
			_set_message(_win_message() + "\n(druk op enter)")
			_set_top_prompt("")          # the win message takes over
			_type_along.visible = false   # no empty panel at the win
			_keyboard.highlight("")
			_phase = Phase.WIN
			if _composer.is_work_scene():
				_composer.stop_sparks()
				_composer.vanish_grindstone()            # poof the wheel, reveal the knight
				_composer.play_lead_loop("Cheering")    # raise the held sword in triumph
			elif _composer.is_archery_scene():
				_composer.play_lead_loop("Cheering")    # bullseye! celebrate
			else:
				_composer.open_chest()                  # treasure win: open the chest
				_composer.play_lead_oneshot("PickUp")
			_flash()
		_:
			_set_message("Einde.")
			_phase = Phase.DONE


# --- input -------------------------------------------------------------------

func _input(event: InputEvent) -> void:
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
	if _composer.is_archery_scene():
		_archery_check_fire()
	if _prose.is_complete():
		_run.score_current(_prose.correct_chars(), _prose.accuracy(), true)
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
func _camera_rig() -> Dictionary:
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
		# overworld picker: a modest zoom-out from the set framing, so the site
		# labels have sky room above the hexes
		return {"pos": look2 + (ow2.pos - look2) * 1.12, "look": look2, "fov": ow2.get("fov", 30.0)}
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
		_narration.visible = false   # instructions now live in the top bar, not the band
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
	if _back_button != null:
		_back_button.visible = playing


func _on_back_pressed() -> void:
	if _app_state == AppState.PLAYING:
		_show_overworld(_ow_at)


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
		banner.pressed.connect(it.on_press)


func _show_main_menu() -> void:
	_app_state = AppState.MAIN
	_music.play_context("menu")
	_set_top_prompt("")
	_set_playing_ui(false)
	_set_menu_fullscreen(true)
	_clear_ow_banners()
	_update_camera(0.0, true)
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
		banner.size = Vector2(190, 64)
		banner.configure(_locale.resolve(s.word_key), "none", float(i) * 1.3)
		banner.set_compact(30)   # small site label, floats above its site
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


func _set_top_prompt(text: String) -> void:
	if _top_bar == null:
		return
	_top_bar.visible = text != ""
	_top_prompt.text = text


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
	_type_along.set_plain(_ow_buffer)   # show the typed word in the band
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
	_music.play_context("adventure")
	_set_top_prompt("")
	_set_menu_fullscreen(false)
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
