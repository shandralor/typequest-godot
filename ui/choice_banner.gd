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


func _process(delta: float) -> void:
	_time += delta
	pivot_offset = size * 0.5
	rotation = deg_to_rad(2.4) * sin(_time * 1.6 + _phase)
	position.y = _base_y + sin(_time * 1.9 + _phase) * 5.0


var _base_y := 0.0


func set_base_position(pos: Vector2) -> void:
	position = pos
	_base_y = pos.y
