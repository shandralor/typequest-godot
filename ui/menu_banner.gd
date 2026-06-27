class_name MenuBanner
extends Control

## A clickable menu item shown as a waving banner -- the same cloth-wave look as the
## choice banners. Container-friendly: it sways via rotation + the shader (it does
## not move its own position), so it sits happily inside a VBoxContainer you can
## reorder in the editor. Emits `pressed` on click.

const ChoiceBanner = preload("res://ui/choice_banner.gd")
const PANEL_PRIMARY := "res://assets/kenney/ui_rpg/panel_blue.png"
const PANEL_SECONDARY := "res://assets/kenney/ui_rpg/panel_brown.png"

signal pressed

var _bg: TextureRect
var _label: RichTextLabel
var _time := 0.0
var _hover := false


func _ready() -> void:
	custom_minimum_size = Vector2(460, 116)
	mouse_filter = Control.MOUSE_FILTER_STOP
	_bg = TextureRect.new()
	_bg.texture = load(PANEL_PRIMARY)
	_bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_bg.stretch_mode = TextureRect.STRETCH_SCALE
	_bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	_bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sh := Shader.new()
	sh.code = ChoiceBanner.WAVE_SHADER
	var mat := ShaderMaterial.new()
	mat.shader = sh
	_bg.material = mat
	add_child(_bg)

	_label = RichTextLabel.new()
	_label.bbcode_enabled = true
	_label.fit_content = true
	_label.scroll_active = false
	_label.set_anchors_preset(Control.PRESET_FULL_RECT)
	_label.offset_top = 16
	_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_label.add_theme_font_size_override("normal_font_size", 38)
	add_child(_label)

	mouse_entered.connect(func(): _hover = true)
	mouse_exited.connect(func(): _hover = false)


func configure(text: String, secondary: bool = false) -> void:
	if _label == null:
		await ready
	_label.text = "[center][color=#ffffff]%s[/color][/center]" % text
	# secondary items (Stoppen, Terug) are smaller with a different panel colour
	if secondary:
		custom_minimum_size = Vector2(300, 78)
		_bg.texture = load(PANEL_SECONDARY)
		_label.offset_top = 12
		_label.add_theme_font_size_override("normal_font_size", 28)
	else:
		custom_minimum_size = Vector2(460, 116)
		_bg.texture = load(PANEL_PRIMARY)
		_label.offset_top = 16
		_label.add_theme_font_size_override("normal_font_size", 38)


func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		pressed.emit()


func _process(delta: float) -> void:
	_time += delta
	pivot_offset = size * 0.5
	rotation = deg_to_rad(2.0) * sin(_time * 1.5 + get_index() * 0.7)
	var s := 1.06 if _hover else 1.0
	scale = scale.lerp(Vector2(s, s), clampf(delta * 10.0, 0.0, 1.0))
	modulate = Color(1.18, 1.18, 1.18) if _hover else Color.WHITE
