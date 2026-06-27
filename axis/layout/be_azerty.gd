class_name BeAzertyLayout
extends RefCounted

## Keyboard-layout axis (brief A3/A8) + the principle behind B1/B6. Belgian AZERTY
## (`be-latin1`), the PoC layout. Engine-independent DATA: it maps a physical key
## POSITION to the character it produces and the finger that should press it.
##
## POSITION is named by the US-QWERTY label of that physical key (a stable,
## engine-neutral name for "the key in that spot"). The input adapter (render
## side, B1) maps Godot's physical keycode -> this position label, so the child is
## scored on true AZERTY POSITIONS no matter what layout the OS is set to. Swap
## this table for QWERTY and the same prose is taught on another layout, with no
## logic change.
##
## Belgian AZERTY facts carried (A8): the home row carries NO vowels
## (q s d f g h j k l m); all Dutch vowels live on the TOP row (a z e r t y u i o p).
## The home-row anchor is f/j -- the one kept scaffold, highlighted from the start.
##
## PoC scope (A8): 3 letter rows + space + period, lowercase, no AltGr, no Shift.
## (On a physical be-latin1 board "." is Shift+";"; for the no-Shift PoC we bind the
## period POSITION directly so the child can type it. Revisit when Shift enters scope.)

# finger ids
const L_PINKY := "left_pinky"
const L_RING := "left_ring"
const L_MIDDLE := "left_middle"
const L_INDEX := "left_index"
const R_INDEX := "right_index"
const R_MIDDLE := "right_middle"
const R_RING := "right_ring"
const R_PINKY := "right_pinky"
const THUMB := "thumb"

const HOME_ANCHORS := ["F", "J"]   # the kept f/j orientation scaffold (A1/A8)

# [US-position label, produced char, finger]
const ROWS := [
	# top row (all vowels live here on AZERTY)
	["Q", "a", L_PINKY], ["W", "z", L_RING], ["E", "e", L_MIDDLE], ["R", "r", L_INDEX],
	["T", "t", L_INDEX], ["Y", "y", R_INDEX], ["U", "u", R_INDEX], ["I", "i", R_MIDDLE],
	["O", "o", R_RING], ["P", "p", R_PINKY],
	# home row (no vowels; f/j are the anchor)
	["A", "q", L_PINKY], ["S", "s", L_RING], ["D", "d", L_MIDDLE], ["F", "f", L_INDEX],
	["G", "g", L_INDEX], ["H", "h", R_INDEX], ["J", "j", R_INDEX], ["K", "k", R_MIDDLE],
	["L", "l", R_RING], ["SEMICOLON", "m", R_PINKY],
	# bottom row
	["Z", "w", L_PINKY], ["X", "x", L_RING], ["C", "c", L_MIDDLE], ["V", "v", L_INDEX],
	["B", "b", L_INDEX], ["N", "n", R_INDEX],
	# space + period
	["SPACE", " ", THUMB], ["PERIOD", ".", R_RING],
]

# Lazily-built lookups (char -> {position, finger}, position -> char).
static var _char_map: Dictionary = {}
static var _position_map: Dictionary = {}


static func _ensure_maps() -> void:
	if not _char_map.is_empty():
		return
	for row in ROWS:
		var position: String = row[0]
		var character: String = row[1]
		var finger: String = row[2]
		_char_map[character] = {"position": position, "finger": finger}
		_position_map[position] = character


## The character produced by pressing the key at this US-position label.
static func char_at_position(position: String) -> String:
	_ensure_maps()
	return _position_map.get(position, "")


## Guidance for the next expected character (B6): which key position + finger.
## Returns { position, finger, is_home_anchor } or {} if the char is unsupported.
static func guidance_for_char(character: String) -> Dictionary:
	_ensure_maps()
	if not _char_map.has(character):
		return {}
	var entry: Dictionary = _char_map[character]
	return {
		"position": entry.position,
		"finger": entry.finger,
		"is_home_anchor": entry.position in HOME_ANCHORS,
	}


## True if every character of `text` is typeable on this layout (validator use).
static func supports_text(text: String) -> bool:
	_ensure_maps()
	for i in text.length():
		if not _char_map.has(text.substr(i, 1)):
			return false
	return true
