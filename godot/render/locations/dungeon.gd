class_name DungeonLocation
extends RefCounted

## Static scenery for the dungeon set: a box room (walls + ceiling), the named
## anchors, and a decorative barrel. Pure scenery -- the hero, chest, mood lighting
## and all motion stay in the composer.

const SceneKit = preload("res://render/scene_kit.gd")


static func build() -> Node3D:
	var root := Node3D.new()
	root.add_child(SceneKit.make_ground(Vector2(14, 16), Color(0.16, 0.16, 0.19)))
	root.add_child(SceneKit.make_box(Vector3(14, 5, 0.5), Vector3(0, 2.5, -7), SceneKit.C_STONE))   # back wall
	root.add_child(SceneKit.make_box(Vector3(0.5, 5, 16), Vector3(-7, 2.5, 0), SceneKit.C_STONE))   # left wall
	root.add_child(SceneKit.make_box(Vector3(0.5, 5, 16), Vector3(7, 2.5, 0), SceneKit.C_STONE))    # right wall
	root.add_child(SceneKit.make_box(Vector3(14, 0.5, 16), Vector3(0, 5.0, 0), Color(0.08, 0.08, 0.10)))  # ceiling
	var anchors := {
		"center": Vector3(0, 0, 0),
		"path_near": Vector3(0, 0, 4),
		"path_far": Vector3(0, 0, -4),
		"far": Vector3(0, 0, -5),
		"far_right": Vector3(2.6, 0, -2.5),
		"far_left": Vector3(-2.6, 0, -2.5),
		"left": Vector3(-3, 0, 0),
		"right": Vector3(3, 0, 0),
		"treasure": Vector3(0, 0, -3),
	}
	for n in anchors:
		var m := Marker3D.new()
		m.name = n
		m.position = anchors[n]
		root.add_child(m)
	var barrel := SceneKit.instance_path("res://assets/kaykit/dungeon/barrel_large.gltf")
	if barrel != null:
		barrel.position = Vector3(-2.6, 0, -4.6)
		root.add_child(barrel)
	return root
