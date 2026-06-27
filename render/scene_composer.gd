class_name SceneComposer
extends Node3D

## Imperative scene composer (brief B4). Resolves a SceneDescriptor into a staged
## Godot scene: builds the location, places actors/props on the location's named
## anchors, applies mood lighting, and either walks the protagonist along the
## travel path (straight scenes) or lets it stand and gaze (fork / win scenes).
##
## The protagonist-position EXCEPTION (B4): the lead actor (hero) is render-
## authored. On a STRAIGHT travel scene it ignores its anchor and walks the path;
## on a standing scene it sits at its anchor and the controller drives its yaw
## (the gaze). This is a deliberate, bounded crack in content<->render decoupling.
##
## Composition is deliberately IMPERATIVE for now (B4 / Section 6): hand-staged per
## scene. The optional `variant` (the node id) only seeds deterministic foliage and
## scene-specific dressing -- it never reaches the logic layer.
##
## Unknown/missing asset id -> loud RED placeholder, never a silent failure.

const Vocabulary = preload("res://axis/vocabulary/fantasy_poc.gd")
const FOREST_DIR := "res://assets/kaykit/forest_nature/"

const LEAD_ASSETS := ["hero"]
const MISSING_COLOR := Color(1.0, 0.0, 0.0)
const SCATTER_SEED := 20260627

# palette
const C_GRASS := Color(0.34, 0.46, 0.22)
const C_DIRT := Color(0.52, 0.40, 0.26)
const C_WATER := Color(0.20, 0.46, 0.72, 0.78)
const C_WOOD := Color(0.45, 0.30, 0.17)
const C_WOOD_DARK := Color(0.32, 0.21, 0.12)
const C_ROCK_DARK := Color(0.17, 0.17, 0.20)
const C_CAVE := Color(0.02, 0.02, 0.03)
const C_STONE := Color(0.13, 0.13, 0.16)

var _variant := ""
var _location: Node3D
var _lead: Node3D
var _walking := false
var _travel_start := Vector3(0, 0, 7)
var _travel_end := Vector3(0, 0, -8)
var _cave_pos := Vector3.ZERO
var _bridge_pos := Vector3.ZERO
var _has_landmarks := false


func compose(descriptor, variant: String = "") -> void:
	_clear()
	_variant = variant
	_has_landmarks = false
	_location = _build_location(descriptor)
	_location.name = "Location"
	add_child(_location)
	_apply_mood(descriptor.mood)
	for actor in descriptor.actors:
		var node := _instance_asset(actor.asset)
		node.name = "Actor_" + actor.asset
		add_child(node)
		if actor.asset in LEAD_ASSETS:
			_lead = node
			_walking = _is_walking_scene(descriptor, actor)
			node.position = _travel_start if _walking else _anchor_position(actor.anchor)
		else:
			node.position = _anchor_position(actor.anchor)
		_face(node, actor.facing)
	for prop in descriptor.props:
		_place_prop(prop)
	set_lead_progress(0.0)


func _clear() -> void:
	for c in get_children():
		c.queue_free()
	_location = null
	_lead = null


func _is_walking_scene(descriptor, actor) -> bool:
	# the hero only walks the path on a straight scene where it starts at path_near
	return descriptor.path == SceneDescriptor.PATH_STRAIGHT and actor.anchor == "path_near"


# --- protagonist motion / gaze (B3) ------------------------------------------

func has_lead() -> bool:
	return _lead != null


func is_walking() -> bool:
	return _walking


func has_landmarks() -> bool:
	return _has_landmarks


func cave_pos() -> Vector3:
	return _cave_pos


func bridge_pos() -> Vector3:
	return _bridge_pos


func lead_position() -> Vector3:
	return _lead.position if _lead != null else Vector3.ZERO


func anchor_pos(name: String) -> Vector3:
	return _anchor_position(name)


## Place the lead along the travel path by progress in [0, 1] (walking scenes only).
func set_lead_progress(p: float) -> void:
	if _lead != null and _walking:
		_lead.position = _travel_start.lerp(_travel_end, clampf(p, 0.0, 1.0))


## Orient the walking lead: facing travel direction while moving, camera at rest.
func set_lead_moving(moving: bool) -> void:
	if _lead == null or not _walking:
		return
	if moving:
		var dir := _travel_end - _travel_start
		_lead.rotation.y = atan2(dir.x, dir.z)
	else:
		_lead.rotation.y = 0.0


## Directly set the standing lead's yaw (the gaze, driven by the controller).
func set_lead_yaw(yaw: float) -> void:
	if _lead != null and not _walking:
		_lead.rotation.y = yaw


# --- locations ----------------------------------------------------------------

func _build_location(descriptor) -> Node3D:
	match descriptor.location:
		"forest_path":
			return _build_forest_path(descriptor)
		"dungeon":
			return _build_dungeon(descriptor)
		_:
			return _red_placeholder("location:" + descriptor.location)


func _build_forest_path(descriptor) -> Node3D:
	var root := Node3D.new()
	var rng := _rng()
	# ground extends well beyond the camera so no edge is ever visible
	var grass := _grass_tint(rng)
	root.add_child(_make_ground(Vector2(56, 140), grass))
	# anchors
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
	_travel_start = anchors["path_near"]
	_travel_end = anchors["path_far"]

	var is_fork: bool = descriptor.path == SceneDescriptor.PATH_FORK
	if is_fork:
		# the path arrives from the front and splits left (cave) / right (bridge)
		root.add_child(_path_segment(Vector3(0, 0, 13), Vector3(0, 0, 0), 3.0))
		root.add_child(_path_segment(Vector3(0, 0, 0), anchors["far_left"], 2.4))
		root.add_child(_path_segment(Vector3(0, 0, 0), anchors["far_right"], 2.4))
		_build_cave_mouth(root, anchors["far_left"])
		_build_bridge(root, anchors["far_right"], 5.0, true)
		_cave_pos = anchors["far_left"]
		_bridge_pos = anchors["far_right"]
		_has_landmarks = true
		_travel_start = anchors["center"]
		_travel_end = anchors["center"]
	else:
		root.add_child(_path_segment(Vector3(0, 0, 16), Vector3(0, 0, -16), 3.0))

	_scatter_forest(root, rng, is_fork)
	return root


func _build_dungeon(descriptor) -> Node3D:
	var root := Node3D.new()
	root.add_child(_make_ground(Vector2(14, 16), Color(0.16, 0.16, 0.19)))
	root.add_child(_make_box(Vector3(14, 5, 0.5), Vector3(0, 2.5, -7), C_STONE))   # back wall
	root.add_child(_make_box(Vector3(0.5, 5, 16), Vector3(-7, 2.5, 0), C_STONE))   # left wall
	root.add_child(_make_box(Vector3(0.5, 5, 16), Vector3(7, 2.5, 0), C_STONE))    # right wall
	root.add_child(_make_box(Vector3(14, 0.5, 16), Vector3(0, 5.0, 0), Color(0.08, 0.08, 0.10)))  # ceiling
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
	_travel_start = anchors["center"]
	_travel_end = anchors["center"]
	var barrel := _instance_path("res://assets/kaykit/dungeon/barrel_large.gltf")
	if barrel != null:
		barrel.position = Vector3(-2.6, 0, -4.6)
		root.add_child(barrel)
	return root


# --- forest dressing ----------------------------------------------------------

func _scatter_forest(root: Node3D, rng: RandomNumberGenerator, is_fork: bool) -> void:
	var trees := ["Tree_1_A_Color1", "Tree_2_A_Color1", "Tree_2_B_Color1",
		"Tree_3_A_Color1", "Tree_4_A_Color1"]
	var bushes := ["Bush_1_A_Color1", "Bush_2_A_Color1", "Bush_3_A_Color1"]
	var grasses := ["Grass_1_A_Color1", "Grass_2_A_Color1"]
	var rocks := ["Rock_1_A_Color1", "Rock_2_A_Color1", "Rock_3_A_Color1"]
	# scattered trees through the mid field
	_scatter(root, rng, trees, 26, 3.0, 18.0, -26.0, 16.0, 0.9, 1.5)
	# a dense far treeline ring so the horizon is always blocked (immersion)
	_treeline(root, rng, trees)
	_scatter(root, rng, bushes, 20, 2.0, 16.0, -22.0, 15.0, 0.8, 1.4)
	_scatter(root, rng, grasses, 30, 1.6, 18.0, -22.0, 15.0, 0.8, 1.3)
	_scatter(root, rng, rocks, 12, 2.2, 16.0, -20.0, 14.0, 0.6, 1.2)


func _scatter(root: Node3D, rng: RandomNumberGenerator, names: Array, count: int,
		min_x: float, max_x: float, min_z: float, max_z: float, min_s: float, max_s: float) -> void:
	for i in range(count):
		var inst := _instance_path(FOREST_DIR + names[rng.randi() % names.size()] + ".gltf")
		if inst == null:
			continue
		var side := -1.0 if rng.randf() < 0.5 else 1.0
		inst.position = Vector3(side * rng.randf_range(min_x, max_x), 0, rng.randf_range(min_z, max_z))
		inst.rotation.y = rng.randf_range(0.0, TAU)
		var s := rng.randf_range(min_s, max_s)
		inst.scale = Vector3(s, s, s)
		root.add_child(inst)


func _treeline(root: Node3D, rng: RandomNumberGenerator, trees: Array) -> void:
	# a ring of larger trees at the field edge to hide the horizon
	for i in range(40):
		var inst := _instance_path(FOREST_DIR + trees[rng.randi() % trees.size()] + ".gltf")
		if inst == null:
			continue
		var ang := TAU * float(i) / 40.0 + rng.randf_range(-0.05, 0.05)
		var r := rng.randf_range(22.0, 27.0)
		inst.position = Vector3(sin(ang) * r, 0, cos(ang) * r)
		inst.rotation.y = rng.randf_range(0.0, TAU)
		var s := rng.randf_range(1.3, 1.9)
		inst.scale = Vector3(s, s, s)
		root.add_child(inst)


func _build_cave_mouth(root: Node3D, pos: Vector3) -> void:
	# a dark rocky mound with a black opening facing the fork, plus real rocks
	root.add_child(_make_box(Vector3(6.0, 5.5, 4.0), pos + Vector3(0, 2.75, -0.5), C_ROCK_DARK))
	root.add_child(_make_box(Vector3(2.6, 3.2, 1.4), pos + Vector3(0, 1.6, 1.6), C_CAVE))  # opening
	for off in [Vector3(-3.0, 0, 1.4), Vector3(3.0, 0, 1.2)]:
		var rock := _instance_path(FOREST_DIR + "Rock_2_A_Color1.gltf")
		if rock != null:
			rock.position = pos + off
			rock.scale = Vector3(2.6, 2.6, 2.6)
			root.add_child(rock)


func _build_bridge(root: Node3D, center: Vector3, _river_width: float, small: bool) -> void:
	# a river crossing the path with a plank deck over it, rails and posts. The
	# water sits just ABOVE the grass so it is visible (a stylized river, not a
	# carved channel), banked by darker strips.
	var span := 2.2 if small else 3.4
	var depth := 4.0 if small else 5.5
	var width := 11.0 if small else 64.0
	var water := _make_ground(Vector2(width, depth), C_WATER)
	water.position = center + Vector3(0, 0.04, 0)
	_make_transparent(water)
	root.add_child(water)
	for sz in [-1.0, 1.0]:
		root.add_child(_make_box(Vector3(width, 0.12, 0.5), center + Vector3(0, 0.06, sz * depth * 0.5), C_WOOD_DARK))  # bank
	var deck_len := depth + 1.0
	root.add_child(_make_box(Vector3(span, 0.18, deck_len), center + Vector3(0, 0.16, 0), C_WOOD))  # deck
	for sx in [-1.0, 1.0]:
		root.add_child(_make_box(Vector3(0.16, 0.7, deck_len), center + Vector3(sx * span * 0.5, 0.55, 0), C_WOOD_DARK))  # rail
		for sz in [-1.0, 1.0]:
			root.add_child(_make_box(Vector3(0.24, 1.0, 0.24), center + Vector3(sx * span * 0.5, 0.4, sz * depth * 0.5), C_WOOD_DARK))  # post
	for i in range(int(deck_len / 0.6)):
		var z := -deck_len * 0.5 + 0.3 + i * 0.6
		root.add_child(_make_box(Vector3(span - 0.12, 0.04, 0.42), center + Vector3(0, 0.26, z), C_WOOD_DARK))  # slats


# --- props --------------------------------------------------------------------

func _place_prop(prop) -> void:
	match prop.asset:
		"bridge":
			# the real bridge scene: a wide river with the deck along the path
			_build_bridge(_location, _anchor_position("center"), 0.0, false)
		"chest":
			var chest := _instance_asset("chest")
			chest.name = "Prop_chest"
			chest.scale = Vector3(2.5, 2.5, 2.5)
			add_child(chest)
			chest.position = _anchor_position(prop.anchor)
			_stage_treasure(_anchor_position(prop.anchor))
		_:
			var node := _instance_asset(prop.asset)
			node.name = "Prop_" + prop.asset
			add_child(node)
			node.position = _anchor_position(prop.anchor)


func _stage_treasure(pos: Vector3) -> void:
	# a small bright clearing flourish around the won chest
	var glow := OmniLight3D.new()
	glow.position = pos + Vector3(0, 1.2, 0)
	glow.light_color = Color(1.0, 0.92, 0.6)
	glow.omni_range = 7.0
	glow.light_energy = 3.0
	add_child(glow)
	var rng := _rng()
	for i in range(6):
		var bush := _instance_path(FOREST_DIR + "Bush_2_A_Color1.gltf")
		if bush != null:
			var ang := TAU * float(i) / 6.0
			bush.position = pos + Vector3(sin(ang) * 2.2, 0, cos(ang) * 2.2)
			bush.scale = Vector3.ONE * rng.randf_range(0.7, 1.0)
			add_child(bush)


# --- mood / lighting ----------------------------------------------------------

func _apply_mood(mood: String) -> void:
	var we := WorldEnvironment.new()
	we.name = "Mood"
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	sky.sky_material = ProceduralSkyMaterial.new()
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	var sun := DirectionalLight3D.new()
	sun.name = "Sun"
	sun.rotation_degrees = Vector3(-55, -40, 0)
	sun.shadow_enabled = true
	match mood:
		"dark":
			sun.light_energy = 0.25
			sun.light_color = Color(0.6, 0.7, 1.0)
			env.ambient_light_energy = 0.18
		_:
			sun.light_energy = 1.15
			sun.light_color = Color(1.0, 0.96, 0.88)
			env.ambient_light_energy = 0.5
			# gentle distance fog so the field edge fades, never a hard horizon
			env.fog_enabled = true
			env.fog_light_color = Color(0.74, 0.82, 0.92)
			env.fog_density = 0.013
			env.fog_aerial_perspective = 0.5
	we.environment = env
	add_child(we)
	add_child(sun)


# --- asset resolution ---------------------------------------------------------

func _instance_asset(asset_id: String) -> Node3D:
	var path: String = Vocabulary.resolve(asset_id)
	if path == "":
		return _red_placeholder(asset_id)
	var inst := _instance_path(path)
	return inst if inst != null else _red_placeholder(asset_id)


func _instance_path(path: String) -> Node3D:
	if not ResourceLoader.exists(path):
		return null
	var packed = load(path)
	if packed is PackedScene:
		var inst = packed.instantiate()
		if inst is Node3D:
			return inst
	return null


func _red_placeholder(asset_id: String) -> Node3D:
	push_error("Unknown/missing asset id '%s' -- rendering RED placeholder" % asset_id)
	var root := Node3D.new()
	var mi := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3.ONE
	mi.mesh = box
	mi.position.y = 0.5
	var mat := StandardMaterial3D.new()
	mat.albedo_color = MISSING_COLOR
	mat.emission_enabled = true
	mat.emission = MISSING_COLOR
	mi.material_override = mat
	root.add_child(mi)
	var label := Label3D.new()
	label.text = "MISSING: " + asset_id
	label.position.y = 1.6
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.modulate = MISSING_COLOR
	root.add_child(label)
	return root


# --- geometry helpers ---------------------------------------------------------

func _make_ground(size: Vector2, color: Color) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = size
	mi.mesh = plane
	mi.material_override = _mat(color)
	mi.name = "Ground"
	return mi


func _make_box(size: Vector3, pos: Vector3, color: Color) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = size
	mi.mesh = box
	mi.position = pos
	mi.material_override = _mat(color)
	return mi


func _path_segment(from: Vector3, to: Vector3, width: float) -> MeshInstance3D:
	var mid := (from + to) * 0.5
	var length := from.distance_to(to)
	var dir := to - from
	var mi := _make_box(Vector3(width, 0.05, length), mid + Vector3(0, 0.02, 0), C_DIRT)
	mi.rotation.y = atan2(dir.x, dir.z)
	mi.name = "Path"
	return mi


func _mat(color: Color) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 1.0
	return mat


func _make_transparent(mi: MeshInstance3D) -> void:
	var mat: StandardMaterial3D = mi.material_override
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.roughness = 0.1
	mat.metallic = 0.3


# --- placement helpers --------------------------------------------------------

func _anchor_position(anchor: String) -> Vector3:
	if _location != null:
		var m := _location.get_node_or_null(NodePath(anchor))
		if m is Node3D:
			return (m as Node3D).position
	push_warning("Unknown anchor '%s' -- placing at origin" % anchor)
	return Vector3.ZERO


func _face(node: Node3D, facing: String) -> void:
	match facing:
		"left":
			node.rotation.y = deg_to_rad(90)
		"right":
			node.rotation.y = deg_to_rad(-90)
		"away":
			node.rotation.y = deg_to_rad(180)
		_:
			node.rotation.y = 0.0


func _grass_tint(rng: RandomNumberGenerator) -> Color:
	# small per-scene variation so forest scenes are not identical
	return C_GRASS + Color(rng.randf_range(-0.04, 0.04), rng.randf_range(-0.05, 0.05), rng.randf_range(-0.03, 0.03), 0)


func _rng() -> RandomNumberGenerator:
	var rng := RandomNumberGenerator.new()
	rng.seed = SCATTER_SEED + abs(_variant.hash())
	return rng
