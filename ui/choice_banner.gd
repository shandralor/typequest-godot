class_name ChoiceBanner
extends Control

## A choice presented as a gently-waving banner, so forks read as choices rather
## than another prose box. The banner cloth ripples via a shader and the whole
## banner sways; a Kenney arrow shows the direction, and the word highlights as the
## child types it. (Kenney UI pack art, CC0.)

const PANEL := "res://assets/kenney/ui_rpg/panel_blue.png"
const ARROW_LEFT := "res://assets/kenney/ui_rpg/arrowBeige_left.png"
const ARROW_RIGHT := "res://assets/kenney/ui_rpg/arrowBeige_right.png"

const WAVE_SHADER := """
shader_type canvas_item;
uniform float amplitude = 0.018;
uniform float frequency = 5.0;
uniform float speed = 2.4;
void fragment() {
	vec2 uv = UV;
	uv.y += sin(uv.x * frequency + TIME * speed) * amplitude * (0.35 + uv.x);
	COLOR = texture(TEXTURE, uv);
}
"""

const DONE_COLOR := "fff3c0"
const REST_COLOR := "e7eeff"

var _word := ""
var _phase := 0.0
var _time := 0.0
var _bg: TextureRect
var _label: RichTextLabel
var _arrow: TextureRect


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_bg = TextureRect.new()
	_bg.texture = load(PANEL)
	_bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_bg.stretch_mode = TextureRect.STRETCH_SCALE
	_bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	_bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sh := Shader.new()
	sh.code = WAVE_SHADER
	var mat := ShaderMaterial.new()
	mat.shader = sh
	_bg.material = mat
	add_child(_bg)

	_arrow = TextureRect.new()
	_arrow.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_arrow.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_arrow.custom_minimum_size = Vector2(64, 40)
	_arrow.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_arrow.offset_left = -32
	_arrow.offset_right = 32
	_arrow.offset_top = 8
	_arrow.offset_bottom = 48
	_arrow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_arrow)

	_label = RichTextLabel.new()
	_label.bbcode_enabled = true
	_label.fit_content = true
	_label.scroll_active = false
	_label.set_anchors_preset(Control.PRESET_FULL_RECT)
	_label.offset_top = 44
	_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_label.add_theme_font_size_override("normal_font_size", 44)
	add_child(_label)


func configure(word: String, hint: String, phase: float) -> void:
	_word = word
	_phase = phase
	match hint:
		"left":
			_arrow.texture = load(ARROW_LEFT)
			_arrow.rotation = 0.0
		"right":
			_arrow.texture = load(ARROW_RIGHT)
			_arrow.rotation = 0.0
		"none":
			_arrow.visible = false     # overworld site banners: the word only
			_label.offset_top = 26
		_:
			_arrow.texture = load(ARROW_RIGHT)
			_arrow.pivot_offset = Vector2(32, 20)
			_arrow.rotation = -PI / 2.0   # point up for "forward"
	set_typed(0)


## Highlight the first `n` letters as already typed.
func set_typed(n: int) -> void:
	var done := _word.substr(0, n)
	var rest := _word.substr(n)
	_label.text = "[center][color=#%s]%s[/color][color=#%s]%s[/color][/center]" % [DONE_COLOR, done, REST_COLOR, rest]


## Dim banners that are not the one being typed.
func set_active(active: bool) -> void:
	modulate = Color.WHITE if active else Color(0.7, 0.7, 0.7, 0.65)


var _badge: Panel


## Show a "!" notification badge (objectives: this site has something new to do).
func set_badge(on: bool) -> void:
	if not on:
		if _badge != null:
			_badge.visible = false
		return
	if _badge == null:
		_badge = Panel.new()
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color("e8b23a")
		sb.set_corner_radius_all(17)
		sb.set_border_width_all(3)
		sb.border_color = Color("5a3a12")
		_badge.add_theme_stylebox_override("panel", sb)
		_badge.custom_minimum_size = Vector2(34, 34)
		_badge.size = Vector2(34, 34)
		_badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var lbl := Label.new()
		lbl.text = "!"
		lbl.set_anchors_preset(Control.PRESET_FULL_RECT)
		lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		lbl.add_theme_font_size_override("font_size", 26)
		lbl.add_theme_color_override("font_color", Color("3a2408"))
		lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_badge.add_child(lbl)
		add_child(_badge)
	_badge.visible = true
	_badge.position = Vector2(size.x - 12.0, -16.0)


func _process(delta: float) -> void:
	_time += delta
	pivot_offset = size * 0.5
	rotation = deg_to_rad(2.4) * sin(_time * 1.6 + _phase)
	position.y = _base_y + sin(_time * 1.9 + _phase) * 5.0
	if _badge != null and _badge.visible:
		var p := 1.0 + 0.14 * sin(_time * 5.0)   # gentle attention pulse
		_badge.pivot_offset = _badge.size * 0.5
		_badge.scale = Vector2(p, p)


var _base_y := 0.0


func set_base_position(pos: Vector2) -> void:
	position = pos
	_base_y = pos.y


## Compact the banner (smaller text + tighter vertical padding), for the small
## overworld site labels.
func set_compact(font_size: int) -> void:
	_label.add_theme_font_size_override("normal_font_size", font_size)
	_label.offset_top = 20
	_arrow.visible = false
