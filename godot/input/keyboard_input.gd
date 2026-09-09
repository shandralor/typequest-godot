class_name KeyboardInput
extends RefCounted

## Input adapter (brief B1). Resolves a key press to the character the child
## INTENDED by physical position -- not the character the OS produced. It reads
## Godot's physical_keycode (which is position-based: the key at the US-QWERTY 'Q'
## spot reports KEY_Q no matter the OS layout), maps it to a neutral position label,
## then to the ACTIVE layout's character via KeyboardSettings.
##
## This is the render/input side of the keyboard axis: the Godot-specific part (the
## KEY_* enum, InputEvent) lives HERE, so the layout tables stay pure, engine-
## independent axis data. The active layout (AZERTY / QWERTY) is chosen in settings;
## input handling itself never changes.

const Settings = preload("res://game/keyboard_settings.gd")

# Godot physical keycode -> neutral US-position label. Position-based and layout-
# independent: it covers every physical key ANY supported layout binds (e.g. both
# SEMICOLON, where AZERTY puts `m`, and M, where QWERTY puts `m`). A layout that
# does not bind a given position just yields "" for it.
const KEY_TO_POSITION := {
	KEY_Q: "Q", KEY_W: "W", KEY_E: "E", KEY_R: "R", KEY_T: "T",
	KEY_Y: "Y", KEY_U: "U", KEY_I: "I", KEY_O: "O", KEY_P: "P",
	KEY_A: "A", KEY_S: "S", KEY_D: "D", KEY_F: "F", KEY_G: "G",
	KEY_H: "H", KEY_J: "J", KEY_K: "K", KEY_L: "L", KEY_SEMICOLON: "SEMICOLON",
	KEY_Z: "Z", KEY_X: "X", KEY_C: "C", KEY_V: "V", KEY_B: "B", KEY_N: "N",
	KEY_M: "M",
	KEY_SPACE: "SPACE", KEY_PERIOD: "PERIOD",
}


## The active layout's character for a physical keycode, or "" if out of PoC scope.
static func char_for_physical(physical_keycode: int) -> String:
	var position: String = KEY_TO_POSITION.get(physical_keycode, "")
	if position == "":
		return ""
	return Settings.char_at_position(position)
