class_name OverworldLocation
extends RefCounted

## Static scenery for the overworld island (KayKit hexagon pack): a small one-screen
## island (radius-2 land, water ring) with the hub crossroads in the middle, dirt
## paths to the three sites (bos / smidse / boog), decoration, and the named markers
## + editable Path3D routes the game reads. Baked to scenes/sets/overworld.tscn --
## arrange it in the editor. Pure scenery -- the hero, drifting clouds, camera framing
## and all motion stay in the composer.

const SceneKit = preload("res://render/scene_kit.gd")
const HEX_DIR := "res://assets/kaykit/hexagon/"

# Overworld hex grid: KayKit hexagon tiles measure 2.0 across flats (x) with the
# top surface at y=0; everything is placed at HEX_SCALE so the knight reads as a
# figure on a toy island rather than a giant. Axial (q, r) -> world:
#   x = (q + r/2) * 2.0 * HEX_SCALE,  z = r * 1.7320 * HEX_SCALE
const HEX_SCALE := 3.0
const HEX_W := 2.0 * HEX_SCALE          # column step
const HEX_ROW := 1.7320 * HEX_SCALE     # row step


static func _hex_world(q: int, r: int) -> Vector3:
	return Vector3((float(q) + float(r) * 0.5) * HEX_W, 0.0, float(r) * HEX_ROW)


static func _pull_toward(from: Vector3, to: Vector3, dist: float) -> Vector3:
	return from + (to - from).normalized() * dist


static func _hex_tile(root: Node3D, model: String, q: int, r: int, yaw_deg: float = 0.0) -> Node3D:
	var inst := SceneKit.instance_path(HEX_DIR + model + ".gltf")
	if inst == null:
		inst = SceneKit.red_placeholder(model)
	inst.position = _hex_world(q, r)
	inst.scale = Vector3.ONE * HEX_SCALE
	inst.rotation.y = deg_to_rad(yaw_deg)
	root.add_child(inst)
	return inst


# A decorated model standing ON a tile (building, trees, mountain, flag), turned
# to face the hub so fronts read from the camera.
static func _hex_decor(root: Node3D, model: String, q: int, r: int, face_hub: bool = true) -> Node3D:
	var inst := SceneKit.instance_path(HEX_DIR + model + ".gltf")
	if inst == null:
		inst = SceneKit.red_placeholder(model)
	var pos := _hex_world(q, r)
	inst.position = pos
	inst.scale = Vector3.ONE * HEX_SCALE
	if face_hub and pos.length() > 0.1:
		inst.rotation.y = atan2(-pos.x, -pos.z)
	root.add_child(inst)
	return inst


static func build() -> Node3D:
	var root := Node3D.new()
	# land: every axial coord within radius 2
	for q in range(-2, 3):
		for r in range(-2, 3):
			if abs(q + r) <= 2:
				_hex_tile(root, "hex_grass", q, r)
	# water ring at radius 3
	for q in range(-3, 4):
		for r in range(-3, 4):
			var s := -q - r
			if maxi(abs(q), maxi(abs(r), abs(s))) == 3:
				_hex_tile(root, "hex_water", q, r)
	# sites: the buildings/forest sit on the site tile; the ARRIVAL anchor is pulled
	# toward the hub so the knight stands in front of them, never inside them
	_hex_decor(root, "building_blacksmith_red", 2, -2)
	_hex_decor(root, "building_archeryrange_red", 1, 1)
	# the bos site tile stays open grass; the forest frames it on the neighbours
	_hex_decor(root, "trees_A_large", -2, 1)
	_hex_decor(root, "trees_A_medium", -1, -1)
	_hex_decor(root, "trees_B_medium", -2, 2)
	# decoration (the owner adds/moves more in the editor)
	_hex_decor(root, "mountain_A_grass_trees", 0, -2)
	_hex_decor(root, "building_windmill_red", 1, -2)
	_hex_decor(root, "building_home_A_red", 2, -1)
	_hex_decor(root, "tree_single_A", 2, 0, false)
	_hex_decor(root, "flag_red", -2, 0, false).position += Vector3(0.9, 0, 2.2)
	_hex_decor(root, "flag_red", 2, -2, false).position += Vector3(-2.4, 0, 1.6)
	_hex_decor(root, "flag_red", 1, 1, false).position += Vector3(-2.4, 0, -1.2)
	# a couple of drifting-height clouds for storybook depth
	for c in [[-1.5, -2.0, 10.0], [1.8, 1.2, 13.0]]:
		var cloud := SceneKit.instance_path(HEX_DIR + "cloud_big.gltf")
		if cloud != null:
			cloud.position = _hex_world(0, 0) + Vector3(c[0] * HEX_W, c[2], c[1] * HEX_ROW)
			cloud.scale = Vector3.ONE * HEX_SCALE
			root.add_child(cloud)
	var hub := _hex_world(0, 0)
	# arrival spots: on the site tile but pulled 2.6 units toward the hub
	var arrive := {
		"bos": _pull_toward(_hex_world(-2, 0), hub, 2.6),
		"smidse": _pull_toward(_hex_world(2, -2), hub, 2.6),
		"boog": _pull_toward(_hex_world(1, 1), hub, 2.6),
	}
	# dirt paths from the hub over the via tile to each arrival spot
	var via := {
		"bos": [_hex_world(-1, 0), arrive["bos"]],
		"smidse": [_hex_world(1, -1), arrive["smidse"]],
		"boog": [_hex_world(0, 1), arrive["boog"]],
	}
	for site in via:
		var prev: Vector3 = hub
		for wp in via[site]:
			root.add_child(SceneKit.path_segment(prev, wp, 1.7))
			prev = wp
	# markers the game reads (hero start, site spots, camera framing)
	var anchors := {
		"hub": hub,
		"site_bos": arrive["bos"],
		"site_smidse": arrive["smidse"],
		"site_boog": arrive["boog"],
		"camera_pos": Vector3(0, 30.0, 34.0),
		"camera_look": Vector3(0, 0, -2.0),
	}
	for n in anchors:
		var m := Marker3D.new()
		m.name = n
		m.position = anchors[n]
		root.add_child(m)
	# editable travel routes (hub -> site); the knight walks these curves
	for site in via:
		var path := Path3D.new()
		path.name = "route_" + site
		var curve := Curve3D.new()
		curve.add_point(hub)
		for wp in via[site]:
			curve.add_point(wp)
		path.curve = curve
		root.add_child(path)
	return root
