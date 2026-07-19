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
static var _stats: Dictionary = {}   # name -> int, cumulative, persisted under [stats]
static var _settings: Dictionary = {}   # name -> float, per-machine prefs under [settings]
static var _profile: Dictionary = {}    # name -> String, profile choices under [profile] (A5 seed)
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


## DEV: wipe all progress (flags + stats + intro) to a fresh state; keeps other sections
## (e.g. the keyboard layout).
static func reset_all() -> void:
	_flags.clear()
	_stats.clear()
	_intro_seen = false
	_loaded = true
	var cf := ConfigFile.new()
	cf.load(CONFIG_PATH)
	if cf.has_section("flags"):
		cf.erase_section("flags")
	if cf.has_section("stats"):
		cf.erase_section("stats")
	cf.set_value("progress", "intro_seen", false)
	cf.save(CONFIG_PATH)


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


# --- cumulative stats (the seed of the A5 progress/profile layer) --------------
# Effort counters that grow across runs -- words typed, adventures done, stars, xp.
# The encouraging progress screen (roadmap G9) + star cosmetics (G3) read these.
# Semantics are CUMULATIVE (effort adds up); privacy A5: non-identifying only.

static func get_stat(name: String) -> int:
	_ensure_loaded()
	return int(_stats.get(name, 0))


static func add_stat(name: String, delta: int) -> void:
	if delta == 0:
		return
	_ensure_loaded()
	_stats[name] = int(_stats.get(name, 0)) + delta
	var cf := ConfigFile.new()
	cf.load(CONFIG_PATH)   # keep other sections intact
	cf.set_value("stats", name, _stats[name])
	cf.save(CONFIG_PATH)


## Bump a stat WITHOUT persisting -- for tests.
static func add_stat_transient(name: String, delta: int) -> void:
	_ensure_loaded()
	_stats[name] = int(_stats.get(name, 0)) + delta


# --- per-machine preferences (floats) -----------------------------------------
# Non-progress knobs the player/owner tunes (e.g. the overworld camera zoom). Kept in
# [settings], NOT wiped by reset_all (like the keyboard layout -- it is a preference).

static func get_setting(name: String, default_value: float) -> float:
	_ensure_loaded()
	return float(_settings.get(name, default_value))


static func set_setting(name: String, v: float) -> void:
	_ensure_loaded()
	if _settings.has(name) and is_equal_approx(_settings[name], v):
		return   # no change -> no write
	_settings[name] = v
	var cf := ConfigFile.new()
	cf.load(CONFIG_PATH)   # keep other sections intact
	cf.set_value("settings", name, v)
	cf.save(CONFIG_PATH)


# --- profile choices (strings; A5 profile seed) -------------------------------
# Non-identifying selections that define the profile (e.g. the chosen hero character).
# Kept in [profile], NOT wiped by reset_all (a preference, like the keyboard layout).

static func get_choice(name: String, default_value: String) -> String:
	_ensure_loaded()
	return String(_profile.get(name, default_value))


static func set_choice(name: String, v: String) -> void:
	_ensure_loaded()
	if String(_profile.get(name, "")) == v:
		return   # no change -> no write
	_profile[name] = v
	var cf := ConfigFile.new()
	cf.load(CONFIG_PATH)   # keep other sections intact
	cf.set_value("profile", name, v)
	cf.save(CONFIG_PATH)


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
		if cf.has_section("stats"):
			for k in cf.get_section_keys("stats"):
				_stats[k] = int(cf.get_value("stats", k, 0))
		if cf.has_section("settings"):
			for k in cf.get_section_keys("settings"):
				_settings[k] = float(cf.get_value("settings", k, 0.0))
		if cf.has_section("profile"):
			for k in cf.get_section_keys("profile"):
				_profile[k] = String(cf.get_value("profile", k, ""))
