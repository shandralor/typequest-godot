class_name SceneActivity
extends RefCounted

## The observed-state struct the renderer reads (brief B3). Visuals are driven by
## "what is true" -- not by raw keypresses -- so the character animation is freed
## to be aliveness while the reveal window carries narrative progress.
##
##  - progress: 0..1, the canonical typing-progress signal (B7), expressed as motion.
##  - activity: the coarse locomotion state the renderer switches on (with hysteresis).
##  - intensity: RESERVED and neutral (= 1) now; earmarked for a future per-profile
##    typing-level signal. Adding it later sets ONE field, no new path into the renderer.

enum Activity { IDLE, MOVING, ARRIVED }

var progress: float = 0.0
var activity: int = Activity.IDLE
var intensity: float = 1.0


static func activity_name(a: int) -> String:
	match a:
		Activity.MOVING: return "moving"
		Activity.ARRIVED: return "arrived"
		_: return "idle"


## Derives `activity` from how `progress` changes over time, WITH HYSTERESIS so it
## does not jitter on every keystroke (B3). Time is injected (dt), keeping it pure
## and deterministic -- a recorded keystroke log reproduces the same locomotion.
class Tracker extends RefCounted:
	const MOVE_HYSTERESIS_SEC := 0.35   # keep "moving" this long after the last advance
	const ARRIVED_AT := 0.999
	const EPS := 0.0001

	var activity: int = Activity.IDLE
	var _last_progress: float = 0.0
	var _idle_time: float = 0.0

	## Returns the current activity enum.
	func update(progress: float, dt: float) -> int:
		if progress >= ARRIVED_AT:
			activity = Activity.ARRIVED
		elif progress > _last_progress + EPS:
			activity = Activity.MOVING
			_idle_time = 0.0
		else:
			_idle_time += dt
			if activity != Activity.ARRIVED and _idle_time >= MOVE_HYSTERESIS_SEC:
				activity = Activity.IDLE
		_last_progress = progress
		return activity

	func reset() -> void:
		activity = Activity.IDLE
		_last_progress = 0.0
		_idle_time = 0.0
