class_name SeededRng
extends RefCounted

## Determinism seam (brief B8 / B2). All randomness in the logic layer flows
## through an injected, seeded RNG. Same seed + same input log -> same result, so
## bugs are reproducible and scoring/replays are deterministic. The logic layer
## must NEVER reach for Godot's global RNG or the clock; it takes one of these.

var _rng := RandomNumberGenerator.new()


func _init(seed_value: int = 0) -> void:
	_rng.seed = seed_value


func seed_value(value: int) -> void:
	_rng.seed = value


## Uniform float in [0, 1).
func next_float() -> float:
	return _rng.randf()


## Integer in [0, n).
func next_int(n: int) -> int:
	if n <= 0:
		return 0
	return _rng.randi() % n


## Float in [from, to).
func range_float(from: float, to: float) -> float:
	return _rng.randf_range(from, to)
