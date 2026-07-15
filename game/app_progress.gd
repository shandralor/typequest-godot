class_name AppProgress
extends RefCounted

## Minimal persistent progress -- the seed of the A5 profile system. For now it only
## remembers whether the child has seen the intro, so the wake-up-and-leave-the-house
## sequence plays ONCE and is skipped on later starts. Stored per-machine in
## user://settings.cfg (the same file the keyboard layout uses, different section).
## When real profiles land (A5), this moves behind the ProfileStore contract.

const CONFIG_PATH := "user://settings.cfg"

static var _intro_seen := false
static var _loaded := false


static func intro_seen() -> bool:
	_ensure_loaded()
	return _intro_seen


static func set_intro_seen(v: bool) -> void:
	_intro_seen = v
	_loaded = true
	var cf := ConfigFile.new()
	cf.load(CONFIG_PATH)   # keep other sections (e.g. keyboard) intact
	cf.set_value("progress", "intro_seen", v)
	cf.save(CONFIG_PATH)


## Set the flag WITHOUT persisting -- for tests, so they do not depend on (or mutate)
## the machine's saved state.
static func set_intro_seen_transient(v: bool) -> void:
	_intro_seen = v
	_loaded = true


static func _ensure_loaded() -> void:
	if _loaded:
		return
	_loaded = true
	var cf := ConfigFile.new()
	if cf.load(CONFIG_PATH) == OK:
		_intro_seen = bool(cf.get_value("progress", "intro_seen", false))
