class_name AzertyInput
extends RefCounted

## Input adapter (brief B1). Resolves a key press to the character the child
## INTENDED by physical position -- not the character the OS produced. It reads
## Godot's physical_keycode (which is position-based: the key at the US-QWERTY 'Q'
## spot reports KEY_Q no matter the OS layout), maps it to this layout's neutral
## position label, then to the Belgian AZERTY character + finger.
##
## This is the render/input side of the keyboard axis: the Godot-specific part
## (the KEY_* enum, InputEvent) lives HERE, so the BeAzertyLayout stays pure,
## engine-independent axis data. Swap the layout table to teach QWERTY with no
## change to input handling.

const Layout = preload("res://axis/layout/be_azerty.gd")

# Godot physical keycode -> this layout's US-position label.
const KEY_TO_POSITION := {
	KEY_Q: "Q", KEY_W: "W", KEY_E: "E", KEY_R: "R", KEY_T: "T",
	KEY_Y: "Y", KEY_U: "U", KEY_I: "I", KEY_O: "O", KEY_P: "P",
	KEY_A: "A", KEY_S: "S", KEY_D: "D", KEY_F: "F", KEY_G: "G",
	KEY_H: "H", KEY_J: "J", KEY_K: "K", KEY_L: "L", KEY_SEMICOLON: "SEMICOLON",
	KEY_Z: "Z", KEY_X: "X", KEY_C: "C", KEY_V: "V", KEY_B: "B", KEY_N: "N",
	KEY_SPACE: "SPACE", KEY_PERIOD: "PERIOD",
}


## The Belgian AZERTY character for a physical keycode, or "" if not in PoC scope.
static func char_for_physical(physical_keycode: int) -> String:
	var position: String = KEY_TO_POSITION.get(physical_keycode, "")
	if position == "":
		return ""
	return Layout.char_at_position(position)
