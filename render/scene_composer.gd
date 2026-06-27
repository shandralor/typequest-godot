class_name SceneComposer
extends Node3D

## Imperative scene composer (brief B4). Resolves a SceneDescriptor into a staged
## Godot scene: builds the location, places actors/props on the location's named
## anchors, applies mood lighting, and walks the protagonist along the location's
## travel path.
##
## The protagonist-position EXCEPTION (B4): the lead actor (hero) ignores its
## descriptor anchor and is render-authored -- it walks the composer's travel
## path. This is a deliberate, bounded crack in the content<->render decoupling.
## WATCH: if a SECOND actor starts following the path instead of its anchor, the
## override has become a pattern and the contract must be renegotiated.
##
## Composition is deliberately IMPERATIVE for now (B4 / Section 6): one consumer
## per scene type, hand-staged. Do NOT promote to a data-driven anchor-default
## system until a SECOND scene of an already-composed type exists.
##
## Unknown/missing asset id -> loud RED placeholder, never a silent failure.

const Vocabulary = preload("res://axis/vocabulary/fantasy_poc.gd")

const LEAD_ASSETS := ["hero"]            # protagonist ids (render-authored path)
const MISSING_COLOR := Color(1.0, 0.0, 0.0)
const SCATTER_SEED := 20260627           # deterministic staging (brief B8)
const FOREST_DIR := "res://assets/kaykit/forest_nature/"

var _location: Node3D
var _lead: Node3D
var _travel_start := Vector3(0, 0, 6)
var _travel_end := Vector3(0, 0, -7)


func compose(descriptor) -> void:
	_clear()
	_location = _build_location(descriptor.location)
	_location.name = "Location"
	add_child(_location)
	_apply_mood(descriptor.mood)
	for actor in descriptor.actors:
		var node := _instance_asset(actor.asset)
		node.name = "Actor_" + actor.asset
		add_child(node)
		if actor.asset in LEAD_ASSETS:
			_lead = node
			node.position = _travel_start          # B4 exception: walks the path
		else:
			node.position = _anchor_position(actor.anchor)
		_face(node, actor.facing)
	for prop in descriptor.props:
		var node := _instance_asset(prop.asset)
		node.name = "Prop_" + prop.asset
		add_child(node)
		node.position = _anchor_position(prop.anchor)
	set_lead_progress(0.0)


# --- protagonist motion, driven by observed state (B3) -----------------------
# The lead's position is the typing-progress signal expressed as motion (B3): the
# travel only dresses the progress the reveal window already carries; it is NOT a
# second progress channel. The consumer (game controller / demo) drives these.

func has_lead() -> bool:
	return _lead != null


## The lead's current position (composer space == world; composer sits at origin).
func lead_position() -> Vector3:
	return _lead.position if _lead != null else Vector3.ZERO


## Place the lead along the travel path by progress in [0, 1].
func set_lead_progress(p: float) -> void:
	if _lead != null:
		_lead.position = _travel_start.lerp(_travel_end, clampf(p, 0.0, 1.0))


## Orient the lead: facing travel direction while moving, facing the camera at rest.
func set_lead_moving(moving: bool) -> void:
	if _lead == null:
		return
	if moving:
		var dir := _travel_end - _travel_start
		_lead.rotation.y = atan2(dir.x, dir.z)
	else:
		_lead.rotation.y = 0.0   # mannequin forward is +Z -> faces the camera


func _clear() -> void:
	for c in get_children():
		c.queue_free()
	_location = null
	_lead = null


# --- locations (imperative staging) ------------------------------------------

func _build_location(location_id: String) -> Node3D:
	match location_id:
		"forest_path":
			return _build_forest_path()
		"dungeon":
			return _build_dungeon()
		_:
			return _red_placeholder("location:" + location_id)


func _build_forest_path() -> Node3D:
	var root := Node3D.new()
	# ground: a grass plane with a dirt path strip down the middle
	root.add_child(_make_ground(Vector2(18, 28), Color(0.34, 0.46, 0.22)))
	var path := _make_ground(Vector2(2.6, 28), Color(0.5, 0.39, 0.26))
	path.position.y = 0.01
	path.name = "PathStrip"
	root.add_child(path)
	# named anchors the location offers (brief A7)
	var anchors := {
		"center": Vector3(0, 0, 0),
		"path_near": Vector3(0, 0, 6),
		"path_far": Vector3(0, 0, -7),
		"far": Vector3(0, 0, -10),
		"far_left": Vector3(-3, 0, -7),
		"far_right": Vector3(3, 0, -7),
		"treasure": Vector3(0, 0, -5),
		"left": Vector3(-2.5, 0, 0),
		"right": Vector3(2.5, 0, 0),
	}
	for anchor_name in anchors:
		var m := Marker3D.new()
		m.name = anchor_name
		m.position = anchors[anchor_name]
		root.add_child(m)
	_travel_start = anchors["path_near"]
	_travel_end = anchors["path_far"]
	_scatter_forest(root)
	return root


func _scatter_forest(root: Node3D) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = SCATTER_SEED
	var trees := ["Tree_1_A_Color1", "Tree_2_A_Color1", "Tree_2_B_Color1",
		"Tree_3_A_Color1", "Tree_4_A_Color1"]
	var bushes := ["Bush_1_A_Color1", "Bush_2_A_Color1", "Bush_3_A_Color1"]
	var grasses := ["Grass_1_A_Color1", "Grass_2_A_Color1"]
	var rocks := ["Rock_1_A_Color1", "Rock_2_A_Color1", "Rock_3_A_Color1"]
	_scatter(root, rng, trees, 20, 2.6, 8.0, 0.9, 1.4)
	_scatter(root, rng, bushes, 16, 1.7, 7.5, 0.8, 1.3)
	_scatter(root, rng, grasses, 22, 1.5, 8.0, 0.8, 1.2)
	_scatter(root, rng, rocks, 10, 1.6, 8.0, 0.6, 1.1)


func _scatter(root: Node3D, rng: RandomNumberGenerator, names: Array, count: int,
		min_x: float, max_x: float, min_s: float, max_s: float) -> void:
	for i in range(count):
		var inst := _instance_path(FOREST_DIR + names[rng.randi() % names.size()] + ".gltf")
		if inst == null:
			continue
		var side := -1.0 if rng.randf() < 0.5 else 1.0
		inst.position = Vector3(side * rng.randf_range(min_x, max_x), 0, rng.randf_range(-13.0, 12.0))
		inst.rotation.y = rng.randf_range(0.0, TAU)
		var s := rng.randf_range(min_s, max_s)
		inst.scale = Vector3(s, s, s)
		root.add_child(inst)


func _make_ground(size: Vector2, color: Color) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = size
	mi.mesh = plane
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 1.0
	mi.material_override = mat
	mi.name = "Ground"
	return mi


# --- mood lighting -----------------------------------------------------------

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
	we.environment = env
	add_child(we)
	var sun := DirectionalLight3D.new()
	sun.name = "Sun"
	sun.rotation_degrees = Vector3(-55, -40, 0)
	sun.shadow_enabled = true
	match mood:
		"dark":
			sun.light_energy = 0.25
			sun.light_color = Color(0.6, 0.7, 1.0)
			env.ambient_light_energy = 0.15
		_:
			sun.light_energy = 1.1
			sun.light_color = Color(1.0, 0.96, 0.88)
			env.ambient_light_energy = 0.45
	add_child(sun)


# --- asset resolution --------------------------------------------------------

func _instance_asset(asset_id: String) -> Node3D:
	var path: String = Vocabulary.resolve(asset_id)
	if path == "":
		return _red_placeholder(asset_id)
	var inst := _instance_path(path)
	if inst == null:
		return _red_placeholder(asset_id)
	return inst


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


# --- placement helpers -------------------------------------------------------

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
			node.rotation.y = 0.0  # camera


func _build_dungeon() -> Node3D:
	var root := Node3D.new()
	# dark stone floor + a simple enclosing room (staging geometry, not art models)
	root.add_child(_make_ground(Vector2(12, 12), Color(0.16, 0.16, 0.19)))
	var stone := Color(0.12, 0.12, 0.15)
	root.add_child(_make_wall(Vector3(12, 4, 0.4), Vector3(0, 2, -6), stone))     # back
	root.add_child(_make_wall(Vector3(0.4, 4, 12), Vector3(-6, 2, 0), stone))     # left
	root.add_child(_make_wall(Vector3(0.4, 4, 12), Vector3(6, 2, 0), stone))      # right
	var anchors := {
		"center": Vector3(0, 0, 0),
		"path_near": Vector3(0, 0, 3),
		"path_far": Vector3(0, 0, -3),
		"far": Vector3(0, 0, -5),
		"far_right": Vector3(3, 0, -3),
		"far_left": Vector3(-3, 0, -3),
		"left": Vector3(-3, 0, 0),
		"right": Vector3(3, 0, 0),
		"treasure": Vector3(0, 0, -3),
	}
	for anchor_name in anchors:
		var m := Marker3D.new()
		m.name = anchor_name
		m.position = anchors[anchor_name]
		root.add_child(m)
	_travel_start = anchors["path_far"]   # the cave scares the knight back to the light
	_travel_end = anchors["path_near"]
	# a couple of real dungeon props for flavor
	var barrel_a := _instance_path("res://assets/kaykit/dungeon/barrel_large.gltf")
	if barrel_a != null:
		barrel_a.position = Vector3(-2.4, 0, -4)
		root.add_child(barrel_a)
	var barrel_b := _instance_path("res://assets/kaykit/dungeon/barrel_small.gltf")
	if barrel_b != null:
		barrel_b.position = Vector3(2.6, 0, -4.3)
		root.add_child(barrel_b)
	return root


func _make_wall(size: Vector3, pos: Vector3, color: Color) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = size
	mi.mesh = box
	mi.position = pos
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 1.0
	mi.material_override = mat
	mi.name = "Wall"
	return mi
