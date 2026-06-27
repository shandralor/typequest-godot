class_name TypeAlongPanel
extends Control

## The type-along text panel with the reveal window (brief B5). Already-typed text
## stays visible; the next expected character is highlighted; a few words of runway
## are revealed ahead; the rest of the passage is hidden. It reads the cursor and
## never gates input on visibility (scoring is against the full prose). Backed by
## the Kenney CC0 panel sprite.

const RevealWindow = preload("res://logic/reveal_window.gd")
const PANEL_TEX := "res://assets/kenney/ui_rpg/panel_brown.png"

const TYPED := "3b2a1a"     # solid dark: already typed
const RUNWAY := "9c8a73"    # faint: revealed runway ahead
const HILITE_BG := "ffd54a" # next expected character background

var _label: RichTextLabel


func _ready() -> void:
	var bg := NinePatchRect.new()
	bg.texture = load(PANEL_TEX)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "top", "right", "bottom"]:
		bg.set("patch_margin_" + side, 20)
	add_child(bg)
	_label = RichTextLabel.new()
	_label.bbcode_enabled = true
	_label.scroll_active = true
	_label.scroll_following = true   # keep the cursor/runway in view as prose wraps
	_label.set_anchors_preset(Control.PRESET_FULL_RECT)
	_label.offset_left = 30
	_label.offset_top = 20
	_label.offset_right = -30
	_label.offset_bottom = -20
	_label.add_theme_font_size_override("normal_font_size", 28)
	add_child(_label)


## Render the reveal window for `prose` at `cursor`.
func set_prose(prose: String, cursor: int, words_ahead: int = RevealWindow.DEFAULT_WORDS_AHEAD) -> void:
	var visible_end := RevealWindow.visible_end(prose, cursor, words_ahead)
	var bb := "[color=#%s]%s[/color]" % [TYPED, prose.substr(0, cursor)]
	if cursor < prose.length():
		var next_char := prose.substr(cursor, 1)
		bb += "[bgcolor=#%s][color=#%s]%s[/color][/bgcolor]" % [HILITE_BG, TYPED, next_char]
		bb += "[color=#%s]%s[/color]" % [RUNWAY, prose.substr(cursor + 1, visible_end - (cursor + 1))]
	_label.text = bb


## Show a full line as-is (pre-revealed beats, prompts, messages).
func set_plain(text: String) -> void:
	_label.text = "[color=#%s]%s[/color]" % [TYPED, text]
