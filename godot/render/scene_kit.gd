class_name SceneKit
extends RefCounted

## Generic, stateless scene-building primitives shared by the SceneComposer and the
## per-location builders (render/locations/*): materials, mesh factories (ground /
## box / path), gltf instancing, and the loud RED placeholder for a missing asset.
## Kept separate so builders can live in their own files and reuse these without
## depending on the composer. All static -- no scene state.

const Vocabulary = preload("res://axis/vocabulary/fantasy_poc.gd")

const MISSING_COLOR := Color(1.0, 0.0, 0.0)
const DIRT := Color(0.52, 0.40, 0.26)   # the default path colour

# palette -- shared by the composer and the per-location builders
const C_GRASS := Color(0.34, 0.46, 0.22)
const C_DIRT := Color(0.52, 0.40, 0.26)
const C_WATER := Color(0.20, 0.46, 0.72, 0.78)
const C_WOOD := Color(0.45, 0.30, 0.17)
const C_WOOD_DARK := Color(0.32, 0.21, 0.12)
const C_ROCK_DARK := Color(0.17, 0.17, 0.20)
const C_CAVE := Color(0.02, 0.02, 0.03)
const C_STONE := Color(0.13, 0.13, 0.16)


static func mat(color: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = 1.0
	return m


static func make_ground(size: Vector2, color: Color) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = size
	mi.mesh = plane
	mi.material_override = mat(color)
	mi.name = "Ground"
	return mi


static func make_box(size: Vector3, pos: Vector3, color: Color) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = size
	mi.mesh = box
	mi.position = pos
	mi.material_override = mat(color)
	return mi


static func path_segment(from: Vector3, to: Vector3, width: float, color: Color = DIRT) -> MeshInstance3D:
	var mid := (from + to) * 0.5
	var length := from.distance_to(to)
	var dir := to - from
	var mi := make_box(Vector3(width, 0.05, length), mid + Vector3(0, 0.02, 0), color)
	mi.rotation.y = atan2(dir.x, dir.z)
	mi.name = "Path"
	return mi


static func make_transparent(mi: MeshInstance3D) -> void:
	var m: StandardMaterial3D = mi.material_override
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.roughness = 0.1
	m.metallic = 0.3


## Instance a gltf/scene by resource path, or null if missing/not a Node3D.
static func instance_path(path: String) -> Node3D:
	if not ResourceLoader.exists(path):
		return null
	var packed = load(path)
	if packed is PackedScene:
		var inst = packed.instantiate()
		if inst is Node3D:
			inst.scene_file_path = path  # so the bake tool can save it as an instance
			return inst
	return null


## Instance an asset id via the vocabulary; RED placeholder if unknown/missing.
static func instance_asset(asset_id: String) -> Node3D:
	var path: String = Vocabulary.resolve(asset_id)
	if path == "":
		return red_placeholder(asset_id)
	var inst := instance_path(path)
	return inst if inst != null else red_placeholder(asset_id)


static func red_placeholder(asset_id: String) -> Node3D:
	push_error("Unknown/missing asset id '%s' -- rendering RED placeholder" % asset_id)
	var root := Node3D.new()
	var mi := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3.ONE
	mi.mesh = box
	mi.position.y = 0.5
	var m := StandardMaterial3D.new()
	m.albedo_color = MISSING_COLOR
	m.emission_enabled = true
	m.emission = MISSING_COLOR
	mi.material_override = m
	root.add_child(mi)
	var label := Label3D.new()
	label.text = "MISSING: " + asset_id
	label.position.y = 1.6
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.modulate = MISSING_COLOR
	root.add_child(label)
	return root


static func find_child_containing(root: Node, needle: String) -> Node3D:
	for c in root.get_children():
		if c is Node3D and c.name.to_lower().contains(needle):
			return c
	return null


## Orient a node by a coarse facing keyword (yaw only).
static func face(node: Node3D, facing: String) -> void:
	match facing:
		"left":
			node.rotation.y = deg_to_rad(90)
		"right":
			node.rotation.y = deg_to_rad(-90)
		"away", "downrange":
			# face -Z; at yaw 0 the hero faces the camera
			node.rotation.y = deg_to_rad(180)
		_:
			node.rotation.y = 0.0
