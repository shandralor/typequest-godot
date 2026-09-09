class_name KeyboardSettings
extends RefCounted

## Which keyboard-layout axis is active, plus its persistence. The pure layout DATA
## lives in axis/layout/*.gd; this is the app-side selector that says which one the
## child is using and remembers it across runs (user://settings.cfg). Consumers on
## the render/input side (the input adapter B1, the on-screen keyboard B6) ask HERE
## for the active layout instead of hardcoding one, so the switch is a single toggle.
##
## Not part of the pure core (it touches the filesystem); kept out of axis/ on
## purpose so the layout data stays engine-independent.

const AZERTY := preload("res://axis/layout/be_azerty.gd")
const QWERTY := preload("res://axis/layout/qwerty.gd")
const CONFIG_PATH := "user://settings.cfg"

static var _active_id := "azerty"
static var _loaded := false


## The available layouts, in menu order: { id, name, script }.
static func available() -> Array:
	return [
		{"id": AZERTY.LAYOUT_ID, "name": AZERTY.DISPLAY_NAME, "script": AZERTY},
		{"id": QWERTY.LAYOUT_ID, "name": QWERTY.DISPLAY_NAME, "script": QWERTY},
	]


static func _script_for(id: String) -> GDScript:
	for e in available():
		if e.id == id:
			return e.script
	return AZERTY


## The active layout script (call its static methods through this).
static func active() -> GDScript:
	_ensure_loaded()
	return _script_for(_active_id)


static func active_id() -> String:
	_ensure_loaded()
	return _active_id


static func active_name() -> String:
	return active().DISPLAY_NAME


## Persist + switch to `id`. No-op (still saved) if the id is unknown -> AZERTY.
static func set_active(id: String) -> void:
	_active_id = id if _script_for(id) != null and _is_known(id) else "azerty"
	_loaded = true
	var cf := ConfigFile.new()
	cf.set_value("keyboard", "layout", _active_id)
	cf.save(CONFIG_PATH)


## Set the active layout WITHOUT persisting (debug/--layout flag): leaves the saved
## setting untouched so a screenshot run does not clobber the child's choice.
static func set_transient(id: String) -> void:
	_active_id = id if _is_known(id) else "azerty"
	_loaded = true


## Flip to the next layout in the list (the options toggle) and return its name.
static func cycle() -> String:
	_ensure_loaded()
	var ids: Array = []
	for e in available():
		ids.append(e.id)
	var idx := ids.find(_active_id)
	set_active(ids[(idx + 1) % ids.size()])
	return active_name()


static func _is_known(id: String) -> bool:
	for e in available():
		if e.id == id:
			return true
	return false


static func _ensure_loaded() -> void:
	if _loaded:
		return
	_loaded = true
	var cf := ConfigFile.new()
	if cf.load(CONFIG_PATH) == OK:
		var id: String = str(cf.get_value("keyboard", "layout", "azerty"))
		if _is_known(id):
			_active_id = id


# --- delegation to the active layout (so consumers stay layout-agnostic) ------

static func char_at_position(position: String) -> String:
	return active().call("char_at_position", position)


static func guidance_for_char(character: String) -> Dictionary:
	return active().call("guidance_for_char", character)


static func keyboard_rows() -> Array:
	return active().call("keyboard_rows")
