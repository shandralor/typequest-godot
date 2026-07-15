class_name ForgeLocation
extends RefCounted

## Static scenery for the forge set: a grassy yard with a stone slab, the grindstone
## and anvil props, the named anchors, and a framing treeline. Pure scenery -- the
## hero, sparks, mood lighting and all motion stay in the composer.

const SceneKit = preload("res://render/scene_kit.gd")
const Nature = preload("res://render/locations/nature.gd")


static func build(rng: RandomNumberGenerator) -> Node3D:
	var root := Node3D.new()
	root.add_child(SceneKit.make_ground(Vector2(40, 40), Color(0.30, 0.46, 0.22)))   # grassy yard
	# a thin slab, NOT a coplanar plane (a second plane at y=0 would z-fight/flicker)
	root.add_child(SceneKit.make_box(Vector3(6, 0.08, 6), Vector3(0, 0.04, 0), Color(0.34, 0.32, 0.30)))
	var anchors := {
		"center": Vector3(0.8, 0, 0),          # in line with the grindstone's x
		"grind_point": Vector3(0.8, 0, 1.4),   # in front of the knight, toward the camera
		"path_near": Vector3(0, 0, 3),
		"path_far": Vector3(0, 0, -3),
		"treasure": Vector3(0, 0, -3),
	}
	for n in anchors:
		var m := Marker3D.new()
		m.name = n
		m.position = anchors[n]
		root.add_child(m)
	var grind := SceneKit.instance_path("res://assets/kaykit/rpgtools_bits/grindstone.gltf")
	if grind != null:
		grind.position = anchors["grind_point"]
		grind.rotation.y = deg_to_rad(90)
		root.add_child(grind)
	var anvil := SceneKit.instance_path("res://assets/kaykit/rpgtools_bits/anvil.gltf")
	if anvil != null:
		anvil.position = Vector3(-1.8, 0, 0.6)
		anvil.rotation.y = deg_to_rad(-40)
		root.add_child(anvil)
	Nature.treeline(root, rng, ["Tree_1_A_Color1", "Tree_2_A_Color1", "Tree_3_A_Color1"])
	return root
