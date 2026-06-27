class_name KeyboardGuide
extends Control

## On-screen keyboard with finger guidance (brief B6). Shows WHICH key and WHICH
## finger to press for the next expected character, colour-coded by finger, driven
## by the keyboard-layout axis (so swapping layouts swaps guidance with no logic
## change). The home-row anchor f/j is marked from the start (A1/A8). Keys use the
## Kenney CC0 square-button sprite.

const Layout = preload("res://axis/layout/be_azerty.gd")
const KEY_TEX := "res://assets/kenney/ui_rpg/buttonSquare_beige.png"

const ROWS := [
	["a", "z", "e", "r", "t", "y", "u", "i", "o", "p"],
	["q", "s", "d", "f", "g", "h", "j", "k", "l", "m"],
	["w", "x", "c", "v", "b", "n"],
]
const FINGER_COLORS := {
	"left_pinky": Color("e57373"), "left_ring": Color("ffb74d"),
	"left_middle": Color("fff176"), "left_index": Color("81c784"),
	"right_index": Color("4dd0e1"), "right_middle": Color("64b5f6"),
	"right_ring": Color("9575cd"), "right_pinky": Color("f06292"),
	"thumb": Color("bdbdbd"),
}
const KEY_SIZE := Vector2(48, 50)
const GAP := 5
const IDLE_MODULATE := Color(0.82, 0.82, 0.82)

var _keys: Dictionary = {}   # char -> NinePatchRect


func _ready() -> void:
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", GAP)
	vbox.alignment = BoxContainer.ALIGNMENT_CENTER          # center rows vertically
	vbox.set_anchors_preset(Control.PRESET_FULL_RECT)        # fill the keyboard area
	vbox.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(vbox)
	for row in ROWS:
		vbox.add_child(_make_row(row))
	var extra := HBoxContainer.new()
	extra.alignment = BoxContainer.ALIGNMENT_CENTER
	extra.add_theme_constant_override("separation", GAP)
	extra.add_child(_make_key(" ", "spatie", Vector2(250, 50)))
	extra.add_child(_make_key(".", ".", KEY_SIZE))
	vbox.add_child(extra)


func _make_row(chars: Array) -> HBoxContainer:
	var hbox := HBoxContainer.new()
	hbox.alignment = BoxContainer.ALIGNMENT_CENTER
	hbox.add_theme_constant_override("separation", GAP)
	for ch in chars:
		hbox.add_child(_make_key(ch, ch, KEY_SIZE))
	return hbox


func _make_key(ch: String, label_text: String, size: Vector2) -> NinePatchRect:
	var key := NinePatchRect.new()
	key.texture = load(KEY_TEX)
	for side in ["left", "top", "right", "bottom"]:
		key.set("patch_margin_" + side, 6)
	key.custom_minimum_size = size
	key.modulate = IDLE_MODULATE
	var lbl := Label.new()
	lbl.text = label_text
	lbl.set_anchors_preset(Control.PRESET_FULL_RECT)
	lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	var guide := Layout.guidance_for_char(ch)
	var is_anchor: bool = guide.get("is_home_anchor", false)
	lbl.add_theme_color_override("font_color", Color("7a1f0a") if is_anchor else Color("3b2a1a"))
	lbl.add_theme_font_size_override("font_size", 26)
	key.add_child(lbl)
	_keys[ch] = key
	return key


## Highlight the key for the next expected character (or "" to clear all).
func highlight(next_char: String) -> void:
	for ch in _keys:
		_keys[ch].modulate = IDLE_MODULATE
	if next_char != "" and _keys.has(next_char):
		var guide := Layout.guidance_for_char(next_char)
		_keys[next_char].modulate = FINGER_COLORS.get(guide.get("finger", ""), Color.WHITE)
