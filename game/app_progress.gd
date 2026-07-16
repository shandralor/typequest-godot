class_name AppProgress
extends RefCounted

## Minimal persistent progress -- the seed of the A5 profile system. For now it only
## remembers whether the child has seen the intro, so the wake-up-and-leave-the-house
## sequence plays ONCE and is skipped on later starts. Stored per-machine in
## user://settings.cfg (the same file the keyboard layout uses, different section).
## When real profiles land (A5), this moves behind the ProfileStore contract.

const CONFIG_PATH := "user://settings.cfg"

static var _intro_seen := false
static var _flags: Dictionary = {}   # name -> bool, persisted under [flags]
static var _loaded := false


static func intro_seen() -> bool:
	_ensure_loaded()
	return _intro_seen


# --- generic unlock flags (the seed of an inventory/progression layer) ---------
# e.g. "archery_done" is set when the archery range is completed, which unlocks a bow
# in the house. Keep names semantic (the EVENT), so several items can key off one flag.

static func get_flag(name: String) -> bool:
	_ensure_loaded()
	return bool(_flags.get(name, false))


static func set_flag(name: String, v: bool = true) -> void:
	_ensure_loaded()
	if bool(_flags.get(name, false)) == v:
		return   # no change -> no write
	_flags[name] = v
	var cf := ConfigFile.new()
	cf.load(CONFIG_PATH)   # keep other sections intact
	cf.set_value("flags", name, v)
	cf.save(CONFIG_PATH)


## Set a flag WITHOUT persisting -- for tests + the --flag debug arg.
static func set_flag_transient(name: String, v: bool = true) -> void:
	_ensure_loaded()
	_flags[name] = v


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
		if cf.has_section("flags"):
			for k in cf.get_section_keys("flags"):
				_flags[k] = bool(cf.get_value("flags", k, false))
