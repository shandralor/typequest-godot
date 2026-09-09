class_name FingerHand
extends Control

## A finger LEGEND beside the on-screen keyboard (B6 aid). Not a drawn hand: five
## Kenney "nail" sprites (monster-builder body pieces) stand in for the fingertips,
## each tinted with its finger colour and captioned with the Dutch finger name, laid
## out staggered so the group reads as a left or right hand. The finger needed right
## now pops (full colour + scale); the rest sit dimmed. Purely presentational.

const NAIL_FINGER := "res://assets/kenney/monster/body_whiteC.png"   # tapered fingertip
const NAIL_THUMB := "res://assets/kenney/monster/body_whiteD.png"    # rounder, for the thumb

const NAIL_BOTTOM := 96.0     # y where the four fingertips bottom-align
const THUMB_DROP := 18.0      # the thumb sits lower than the fingers
const FINGER_W := 44.0
const THUMB_W := 54.0
const LABEL_Y := 116.0
const IDLE_DIM := 0.5
const ACTIVE_SCALE := 1.14

# finger geometry, OUTER -> INNER: [suffix, dutch label, x, height]
const FINGERS := [
	["pinky", "pink", 0.0, 54.0],
	["ring", "ring", 50.0, 74.0],
	["middle", "middel", 100.0, 86.0],
	["index", "wijs", 150.0, 76.0],
]
const THUMB_X := 208.0
const THUMB_H := 50.0

var _prefix := "left_"        # "left_" or "right_"
var _mirror := false
var _colors: Dictionary = {}
var _nails: Dictionary = {}   # finger id -> TextureRect
var _width := 0.0


func configure(prefix: String, colors: Dictionary, mirror: bool) -> void:
	_prefix = prefix
	_colors = colors
	_mirror = mirror
	_width = THUMB_X + THUMB_W
	custom_minimum_size = Vector2(_width, LABEL_Y + 22.0)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	for f in FINGERS:
		_add_nail(_prefix + f[0], f[1], f[2], f[3], FINGER_W, NAIL_BOTTOM, NAIL_FINGER)
	_add_nail("thumb", "duim", THUMB_X, THUMB_H, THUMB_W, NAIL_BOTTOM + THUMB_DROP, NAIL_THUMB)
	_apply(_colors, "")   # start dimmed


func _add_nail(fid: String, label: String, x: float, h: float, w: float, bottom: float, tex: String) -> void:
	var px := (_width - x - w) if _mirror else x
	var nail := TextureRect.new()
	nail.texture = load(tex)
	nail.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	nail.stretch_mode = TextureRect.STRETCH_SCALE
	nail.position = Vector2(px, bottom - h)
	nail.size = Vector2(w, h)
	nail.pivot_offset = Vector2(w * 0.5, h * 0.5)
	nail.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(nail)
	_nails[fid] = nail
	var lbl := Label.new()
	lbl.text = label
	lbl.position = Vector2(px - 6.0, LABEL_Y)
	lbl.size = Vector2(w + 12.0, 18.0)
	lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl.add_theme_font_size_override("font_size", 15)
	lbl.add_theme_color_override("font_color", Color("d8c9b0"))
	lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(lbl)


## Emphasise `active` (a finger id) and dim the rest ("" = all dim).
func highlight(active: String) -> void:
	_apply(_colors, active)


func _apply(colors: Dictionary, active: String) -> void:
	for fid in _nails:
		var nail: TextureRect = _nails[fid]
		var col: Color = colors.get(fid, Color.WHITE)
		if fid == active:
			nail.modulate = col
			nail.scale = Vector2(ACTIVE_SCALE, ACTIVE_SCALE)
		else:
			nail.modulate = col.darkened(IDLE_DIM)
			nail.scale = Vector2.ONE
