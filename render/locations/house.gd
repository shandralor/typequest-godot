class_name HouseLocation
extends RefCounted

## Static scenery for the intro interior: a warm, tall room the knight walks across,
## from the bed (front, by the camera) to the doorway (back) it steps out of into the
## overworld. Big and TALL with a ceiling so the camera only ever sees the interior.
## KayKit Dungeon pieces (bed, doorway, torch) on box walls, plus warm lamps. Pure
## scenery -- the hero, his rise/walk, mood lighting and all motion stay in the composer.

const SceneKit = preload("res://render/scene_kit.gd")
const DUNGEON_DIR := "res://assets/kaykit/dungeon/"
const C_HOUSE_WALL := Color(0.62, 0.52, 0.40)   # warm plaster
const C_HOUSE_FLOOR := Color(0.46, 0.32, 0.20)  # wood boards
const HOUSE_H := 10.0   # wall height (tall enough to fill the frame)


static func build() -> Node3D:
	var root := Node3D.new()
	root.add_child(SceneKit.make_box(Vector3(13.0, 0.2, 19.0), Vector3(0, 0.1, 0), C_HOUSE_FLOOR))  # top at y=HOUSE_STAND_Y
	# side walls (full depth) + a back wall split around a doorway gap + a ceiling
	root.add_child(SceneKit.make_box(Vector3(0.4, HOUSE_H, 19.0), Vector3(-6.3, HOUSE_H * 0.5, 0), C_HOUSE_WALL))
	root.add_child(SceneKit.make_box(Vector3(0.4, HOUSE_H, 19.0), Vector3(6.3, HOUSE_H * 0.5, 0), C_HOUSE_WALL))
	root.add_child(SceneKit.make_box(Vector3(4.8, HOUSE_H, 0.4), Vector3(-3.9, HOUSE_H * 0.5, -9.3), C_HOUSE_WALL))
	root.add_child(SceneKit.make_box(Vector3(4.8, HOUSE_H, 0.4), Vector3(3.9, HOUSE_H * 0.5, -9.3), C_HOUSE_WALL))
	root.add_child(SceneKit.make_box(Vector3(3.2, 5.0, 0.4), Vector3(0, 7.5, -9.3), C_HOUSE_WALL))   # lintel over the door
	root.add_child(SceneKit.make_box(Vector3(13.0, 0.4, 19.0), Vector3(0, HOUSE_H, 0), Color(0.30, 0.24, 0.18)))  # ceiling
	var anchors := {
		"center": Vector3(0, 0, 0),
		"path_near": Vector3(0, 0, 4.5),    # rises here (low in the frame)
		"path_far": Vector3(0, 0, -7.6),    # in front of the door (exit)
		"treasure": Vector3(0, 0, -7.6),
	}
	for n in anchors:
		var m := Marker3D.new()
		m.name = n
		m.position = anchors[n]
		root.add_child(m)
	_house_prop(root, "bed_decorated", Vector3(-3.6, 0, 4.8), 90.0, 1.3)
	_house_prop(root, "wall_doorway", Vector3(0, 0, -9.3), 0.0, 1.4)
	_house_prop(root, "table_small", Vector3(4.3, 0, 4.4), -20.0, 1.2)
	_house_prop(root, "barrel_small", Vector3(4.7, 0, -4.5), 0.0, 1.2)
	_house_prop(root, "torch_lit", Vector3(-6.0, 2.4, -3.0), 0.0, 1.2)
	# warm glows so the enclosed room reads cozy, not flat/dark
	for spot in [Vector3(0, 6.0, 3.0), Vector3(0, 6.0, -6.0)]:
		var lamp := OmniLight3D.new()
		lamp.position = spot
		lamp.light_color = Color(1.0, 0.86, 0.62)
		lamp.omni_range = 22.0
		lamp.light_energy = 1.6
		root.add_child(lamp)
	return root


static func _house_prop(root: Node3D, model: String, pos: Vector3, yaw_deg: float, scale: float) -> Node3D:
	var inst := SceneKit.instance_path(DUNGEON_DIR + model + ".gltf")
	if inst == null:
		return null
	inst.position = pos
	inst.rotation.y = deg_to_rad(yaw_deg)
	inst.scale = Vector3(scale, scale, scale)
	root.add_child(inst)
	return inst
