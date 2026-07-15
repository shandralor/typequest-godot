class_name ForestLocation
extends RefCounted

## Static scenery for the forest sets (straight / fork / bridge): ground, path
## segments, the cave mouth and the plank bridge, plus the scattered foliage and the
## far treeline. Anchors are Marker3D nodes the game reads. Pure scenery -- the hero,
## chest, mood lighting and all motion stay in the composer.

const SceneKit = preload("res://render/scene_kit.gd")
const Nature = preload("res://render/locations/nature.gd")
const FOREST_DIR := "res://assets/kaykit/forest_nature/"


static func build(fork: bool, bridge: bool, rng: RandomNumberGenerator) -> Node3D:
	var root := Node3D.new()
	# ground extends well beyond the camera so no edge is ever visible
	root.add_child(SceneKit.make_ground(Vector2(56, 140), Nature.grass_tint(rng)))
	var anchors := {
		"center": Vector3(0, 0, 0),
		"path_near": Vector3(0, 0, 8),
		"path_far": Vector3(0, 0, -9),
		"far": Vector3(0, 0, -12),
		"far_left": Vector3(-5, 0, -6.5),
		"far_right": Vector3(5, 0, -6.5),
		"treasure": Vector3(0, 0, -3.5),
		"left": Vector3(-3, 0, 0),
		"right": Vector3(3, 0, 0),
	}
	for n in anchors:
		var m := Marker3D.new()
		m.name = n
		m.position = anchors[n]
		root.add_child(m)
	if fork:
		# the path arrives from the front and splits left (cave) / right (bridge)
		root.add_child(SceneKit.path_segment(Vector3(0, 0, 13), Vector3(0, 0, 0), 3.0))
		root.add_child(SceneKit.path_segment(Vector3(0, 0, 0), anchors["far_left"], 2.4))
		root.add_child(SceneKit.path_segment(Vector3(0, 0, 0), anchors["far_right"], 2.4))
		_build_cave_mouth(root, anchors["far_left"])
		_build_bridge(root, anchors["far_right"], 5.0, true)
	elif bridge:
		root.add_child(SceneKit.path_segment(Vector3(0, 0, 16), Vector3(0, 0, -16), 3.0))
		_build_bridge(root, anchors["center"], 0.0, false)
	else:
		root.add_child(SceneKit.path_segment(Vector3(0, 0, 16), Vector3(0, 0, -16), 3.0))
	_scatter_forest(root, rng, fork)
	return root


static func _scatter_forest(root: Node3D, rng: RandomNumberGenerator, is_fork: bool) -> void:
	var trees := ["Tree_1_A_Color1", "Tree_2_A_Color1", "Tree_2_B_Color1",
		"Tree_3_A_Color1", "Tree_4_A_Color1"]
	var bushes := ["Bush_1_A_Color1", "Bush_2_A_Color1", "Bush_3_A_Color1"]
	var grasses := ["Grass_1_A_Color1", "Grass_2_A_Color1"]
	var rocks := ["Rock_1_A_Color1", "Rock_2_A_Color1", "Rock_3_A_Color1"]
	# scattered trees through the mid field
	_scatter(root, rng, trees, 26, 3.0, 18.0, -26.0, 16.0, 0.9, 1.5)
	# a dense far treeline ring so the horizon is always blocked (immersion)
	Nature.treeline(root, rng, trees)
	_scatter(root, rng, bushes, 20, 2.0, 16.0, -22.0, 15.0, 0.8, 1.4)
	_scatter(root, rng, grasses, 30, 1.6, 18.0, -22.0, 15.0, 0.8, 1.3)
	_scatter(root, rng, rocks, 12, 2.2, 16.0, -20.0, 14.0, 0.6, 1.2)


static func _scatter(root: Node3D, rng: RandomNumberGenerator, names: Array, count: int,
		min_x: float, max_x: float, min_z: float, max_z: float, min_s: float, max_s: float) -> void:
	for i in range(count):
		var inst := SceneKit.instance_path(FOREST_DIR + names[rng.randi() % names.size()] + ".gltf")
		if inst == null:
			continue
		var side := -1.0 if rng.randf() < 0.5 else 1.0
		inst.position = Vector3(side * rng.randf_range(min_x, max_x), 0, rng.randf_range(min_z, max_z))
		inst.rotation.y = rng.randf_range(0.0, TAU)
		var s := rng.randf_range(min_s, max_s)
		inst.scale = Vector3(s, s, s)
		root.add_child(inst)


static func _build_cave_mouth(root: Node3D, pos: Vector3) -> void:
	# an arch of large real rocks framing a dark opening that faces the fork (+z)
	var placements := [
		["Rock_1_A_Color1", Vector3(-2.4, 0, 0.3), 3.6, 0.3],
		["Rock_2_A_Color1", Vector3(2.5, 0, 0.2), 3.8, -0.5],
		["Rock_3_A_Color1", Vector3(0, 0, -1.6), 4.4, 0.0],     # back mound
		["Rock_2_A_Color1", Vector3(-1.4, 2.6, -0.4), 2.8, 1.1], # lintel left
		["Rock_1_A_Color1", Vector3(1.5, 2.8, -0.4), 3.0, 2.0],  # lintel right
	]
	for p in placements:
		var rock := SceneKit.instance_path(FOREST_DIR + p[0] + ".gltf")
		if rock != null:
			rock.position = pos + p[1]
			rock.scale = Vector3.ONE * p[2]
			rock.rotation.y = p[3]
			root.add_child(rock)
	# a dark recess inside the arch reads as the cave depth
	root.add_child(SceneKit.make_box(Vector3(2.2, 2.8, 1.6), pos + Vector3(0, 1.4, -0.6), SceneKit.C_CAVE))


static func _build_bridge(root: Node3D, center: Vector3, _river_width: float, small: bool) -> void:
	# a river crossing the path with a plank deck over it, rails and posts. The
	# water sits just ABOVE the grass so it is visible (a stylized river, not a
	# carved channel), banked by darker strips.
	var span := 2.2 if small else 3.4
	var depth := 4.0 if small else 5.5
	var width := 11.0 if small else 64.0
	var water := SceneKit.make_ground(Vector2(width, depth), SceneKit.C_WATER)
	water.position = center + Vector3(0, 0.04, 0)
	SceneKit.make_transparent(water)
	root.add_child(water)
	for sz in [-1.0, 1.0]:
		root.add_child(SceneKit.make_box(Vector3(width, 0.12, 0.5), center + Vector3(0, 0.06, sz * depth * 0.5), SceneKit.C_WOOD_DARK))  # bank
	var deck_len := depth + 1.0
	root.add_child(SceneKit.make_box(Vector3(span, 0.18, deck_len), center + Vector3(0, 0.16, 0), SceneKit.C_WOOD))  # deck
	for sx in [-1.0, 1.0]:
		root.add_child(SceneKit.make_box(Vector3(0.16, 0.7, deck_len), center + Vector3(sx * span * 0.5, 0.55, 0), SceneKit.C_WOOD_DARK))  # rail
		for sz in [-1.0, 1.0]:
			root.add_child(SceneKit.make_box(Vector3(0.24, 1.0, 0.24), center + Vector3(sx * span * 0.5, 0.4, sz * depth * 0.5), SceneKit.C_WOOD_DARK))  # post
	for i in range(int(deck_len / 0.6)):
		var z := -deck_len * 0.5 + 0.3 + i * 0.6
		root.add_child(SceneKit.make_box(Vector3(span - 0.12, 0.04, 0.42), center + Vector3(0, 0.26, z), SceneKit.C_WOOD_DARK))  # slats
