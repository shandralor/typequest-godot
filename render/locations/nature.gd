class_name Nature
extends RefCounted

## Shared foliage helpers used by several outdoor location builders (forest, forge,
## archery): the far treeline ring that hides the horizon, and the per-scene grass
## tint. All static -- seeded randomness is injected via an rng parameter.

const SceneKit = preload("res://render/scene_kit.gd")
const FOREST_DIR := "res://assets/kaykit/forest_nature/"


static func treeline(root: Node3D, rng: RandomNumberGenerator, trees: Array) -> void:
	# a ring of larger trees at the field edge to hide the horizon
	for i in range(40):
		var inst := SceneKit.instance_path(FOREST_DIR + trees[rng.randi() % trees.size()] + ".gltf")
		if inst == null:
			continue
		var ang := TAU * float(i) / 40.0 + rng.randf_range(-0.05, 0.05)
		var r := rng.randf_range(22.0, 27.0)
		inst.position = Vector3(sin(ang) * r, 0, cos(ang) * r)
		inst.rotation.y = rng.randf_range(0.0, TAU)
		var s := rng.randf_range(1.3, 1.9)
		inst.scale = Vector3(s, s, s)
		root.add_child(inst)


static func grass_tint(rng: RandomNumberGenerator) -> Color:
	# small per-scene variation so forest scenes are not identical
	return SceneKit.C_GRASS + Color(rng.randf_range(-0.04, 0.04), rng.randf_range(-0.05, 0.05), rng.randf_range(-0.03, 0.03), 0)
