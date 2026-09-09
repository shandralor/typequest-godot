class_name QwertyLayout
extends RefCounted

## Keyboard-layout axis (brief A3/A8): US QWERTY, the second supported layout. Same
## engine-independent DATA contract as BeAzertyLayout -- it maps a physical key
## POSITION (named by its US-QWERTY label) to the character it produces and the
## finger that presses it. Because we deliberately do NOT teach one row at a time
## (the teaching mechanism is VOLUME of motivated typing, not drills), a second
## layout drops in safely: the same prose is taught on another board with no logic
## change. The child picks the layout that matches their physical keyboard.
##
## On QWERTY the position label IS the letter (Q -> q, W -> w, ...), so the map is
## the identity for letters; `m` sits on the bottom row (not the home row as on
## AZERTY). Fingers follow standard touch typing; f/j stay the home-row anchor.
##
## PoC scope (A8): 3 letter rows + space + period, lowercase, no AltGr, no Shift.

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

const LAYOUT_ID := "qwerty"
const DISPLAY_NAME := "QWERTY"
const HOME_ANCHORS := ["F", "J"]   # the kept f/j orientation scaffold (A1/A8)

# [US-position label, produced char, finger]
const ROWS := [
	# top row
	["Q", "q", L_PINKY], ["W", "w", L_RING], ["E", "e", L_MIDDLE], ["R", "r", L_INDEX],
	["T", "t", L_INDEX], ["Y", "y", R_INDEX], ["U", "u", R_INDEX], ["I", "i", R_MIDDLE],
	["O", "o", R_RING], ["P", "p", R_PINKY],
	# home row (f/j are the anchor)
	["A", "a", L_PINKY], ["S", "s", L_RING], ["D", "d", L_MIDDLE], ["F", "f", L_INDEX],
	["G", "g", L_INDEX], ["H", "h", R_INDEX], ["J", "j", R_INDEX], ["K", "k", R_MIDDLE],
	["L", "l", R_RING],
	# bottom row (m lives here on QWERTY)
	["Z", "z", L_PINKY], ["X", "x", L_RING], ["C", "c", L_MIDDLE], ["V", "v", L_INDEX],
	["B", "b", L_INDEX], ["N", "n", R_INDEX], ["M", "m", R_INDEX],
	# space + period
	["SPACE", " ", THUMB], ["PERIOD", ".", R_RING],
]

# The on-screen keyboard's letter rows, in display order (space + period are added
# by the guide itself, being layout-neutral).
const KEYBOARD_ROWS := [
	["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
	["a", "s", "d", "f", "g", "h", "j", "k", "l"],
	["z", "x", "c", "v", "b", "n", "m"],
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


## The on-screen keyboard's letter rows for this layout (B6 render helper).
static func keyboard_rows() -> Array:
	return KEYBOARD_ROWS
