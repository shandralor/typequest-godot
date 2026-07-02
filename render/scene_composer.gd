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
const HEX_DIR := "res://assets/kaykit/hexagon/"

# Overworld hex grid: KayKit hexagon tiles measure 2.0 across flats (x) with the
# top surface at y=0; everything is placed at HEX_SCALE so the knight reads as a
# figure on a toy island rather than a giant. Axial (q, r) -> world:
#   x = (q + r/2) * 2.0 * HEX_SCALE,  z = r * 1.7320 * HEX_SCALE
const HEX_SCALE := 3.0
const HEX_W := 2.0 * HEX_SCALE          # column step
const HEX_ROW := 1.7320 * HEX_SCALE     # row step

const LEAD_ASSETS := ["hero"]
const MISSING_COLOR := Color(1.0, 0.0, 0.0)
const SCATTER_SEED := 20260627
# the hero is the KayKit Knight (B3): its own textured mesh on the shared Rig_Medium
# skeleton, with idle/walk/pickup grafted in from the Rig_Medium animation sets
# (same skeleton, so the tracks resolve).
const HERO_MODEL := "res://assets/kaykit/adventurers/Knight.glb"
const HERO_GENERAL := "res://assets/kaykit/adventurers/Rig_Medium_General.glb"
const HERO_MOVE := "res://assets/kaykit/adventurers/Rig_Medium_MovementBasic.glb"
const HERO_IDLE := "Idle_A"
const HERO_WALK := "Walking_A"
const HERO_PICKUP := "PickUp"
const HERO_WORK := "Sawing"     # looped horizontal saw -- small vertical, for grinding
const HERO_TOOLS := "res://assets/kaykit/characters/Rig_Medium_Tools.glb"
const HERO_CHEER := "Cheering"  # looped victory -- raises the held sword at the win
const HERO_SIM := "res://assets/kaykit/characters/Rig_Medium_Simulation.glb"

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
var _lead_anim: AnimationPlayer
var _walking := false
var _travel_start := Vector3(0, 0, 7)
var _travel_end := Vector3(0, 0, -8)
var _cave_pos := Vector3.ZERO
var _bridge_pos := Vector3.ZERO
var _has_landmarks := false
var _needs_bloom := false
var _chest_lid: Node3D
var _is_work_scene := false
var _sparks: CPUParticles3D
var _sword: Node3D
var _is_overworld := false


func compose(descriptor, variant: String = "") -> void:
	_clear()
	_variant = variant
	_has_landmarks = descriptor.path == SceneDescriptor.PATH_FORK
	_needs_bloom = false
	for p in descriptor.props:
		if p.asset == "chest":
			_needs_bloom = true   # only the treasure scenes get bloom
	_is_work_scene = descriptor.location == "forge"
	_location = _instance_set(_set_for(descriptor))
	_location.name = "Location"
	add_child(_location)
	_read_anchors(descriptor)
	_apply_mood(descriptor.mood)
	for actor in descriptor.actors:
		var is_lead: bool = actor.asset in LEAD_ASSETS
		var node := _build_hero() if is_lead else _instance_asset(actor.asset)
		node.name = "Actor_" + actor.asset
		add_child(node)
		if is_lead:
			_lead = node
			_walking = _is_walking_scene(descriptor, actor)
			node.position = _travel_start if _walking else _anchor_position(actor.anchor)
		else:
			node.position = _anchor_position(actor.anchor)
		_face(node, actor.facing)
	for prop in descriptor.props:
		_place_prop(prop)
	if _is_work_scene:
		_build_sparks(_anchor_position("grind_point") + Vector3(0.0, 0.7, 0.0))
	set_lead_progress(0.0)
	set_lead_animation(false)


func _clear() -> void:
	for c in get_children():
		c.queue_free()
	_location = null
	_lead = null
	_lead_anim = null
	_chest_lid = null
	_is_work_scene = false
	_sparks = null
	_sword = null
	_is_overworld = false


## Compose the overworld island: the editable set (scenes/sets/overworld.tscn) plus
## the animated knight standing at `start_anchor` (the hub, or the site it just
## returned from). The island is a MENU rendered as a place -- no SceneDescriptor,
## no logic-layer involvement; travel is driven by the controller along the set's
## editable Path3D routes.
func compose_overworld(start_anchor: String = "hub") -> void:
	_clear()
	_variant = "overworld"
	_is_overworld = true
	_location = _instance_set("overworld")
	_location.name = "Location"
	add_child(_location)
	_apply_mood("light", false)   # no distance fog: the island must read crisply
	var hero := _build_hero()
	hero.name = "Actor_hero"
	add_child(hero)
	_lead = hero
	_walking = false
	hero.position = _anchor_position(start_anchor)
	set_lead_animation(false)


func is_overworld() -> bool:
	return _is_overworld


## The editable Path3D route named in the overworld set (null if missing).
func overworld_route(route_name: String) -> Path3D:
	if _location == null:
		return null
	return _location.get_node_or_null(NodePath(route_name)) as Path3D


## Camera framing for the overworld, read from the set's editable camera_pos /
## camera_look markers so the owner can reframe the island in the editor. The
## narrow fov is deliberate: the game viewport is very wide (1920x680), where the
## default 75-degree fov turns fisheye; a tele lens keeps the island a readable
## storybook diorama.
func overworld_cam() -> Dictionary:
	var pos := Vector3(0, 30, 34)
	var look := Vector3(0, 0, -2)
	if _location != null:
		var p := _location.get_node_or_null(^"camera_pos") as Node3D
		var l := _location.get_node_or_null(^"camera_look") as Node3D
		if p != null:
			pos = p.position
		if l != null:
			look = l.position
	return {"pos": pos, "look": look, "fov": 30.0}


## Directly place the lead (overworld travel along a route).
func set_lead_position(pos: Vector3) -> void:
	if _lead != null:
		_lead.position = pos


# Builds the animated hero (B3): mesh + idle from the General rig, with the walk
# cycle grafted in from the Movement rig (same Rig_Medium skeleton, so the tracks
# resolve). _lead_anim is then driven by the SceneActivity state.
func _build_hero() -> Node3D:
	var hero := _instance_path(HERO_MODEL)
	if hero == null:
		return _red_placeholder("hero")
	var ap := AnimationPlayer.new()
	hero.add_child(ap)
	ap.root_node = NodePath("..")   # resolve tracks against the Knight root
	var lib := AnimationLibrary.new()
	ap.add_animation_library("", lib)
	_graft_animations(lib, HERO_GENERAL, [HERO_IDLE, HERO_PICKUP])
	_graft_animations(lib, HERO_MOVE, [HERO_WALK])
	_graft_animations(lib, HERO_TOOLS, [HERO_WORK])
	_graft_animations(lib, HERO_SIM, [HERO_CHEER])
	for clip in [HERO_IDLE, HERO_WALK, HERO_WORK, HERO_CHEER]:
		if lib.has_animation(clip):
			lib.get_animation(clip).loop_mode = Animation.LOOP_LINEAR
	_lead_anim = ap
	return hero


# Copy named clips from an animation glb's player into the hero's library. The
# tracks target Rig_Medium/Skeleton3D bones, which the Knight shares.
func _graft_animations(lib: AnimationLibrary, glb_path: String, names: Array) -> void:
	var src := _instance_path(glb_path)
	if src == null:
		return
	var sap := src.find_child("AnimationPlayer", true, false) as AnimationPlayer
	if sap != null:
		for n in names:
			if sap.has_animation(n) and not lib.has_animation(n):
				lib.add_animation(n, sap.get_animation(n).duplicate())
	src.free()


## Cross-fade the hero between its walk and idle clips (B3 in-place aliveness).
func set_lead_animation(moving: bool) -> void:
	if _lead_anim == null:
		return
	var want := HERO_WALK if moving else HERO_IDLE
	if _lead_anim.has_animation(want) and _lead_anim.current_animation != want:
		_lead_anim.play(want, 0.25)


func is_work_scene() -> bool:
	return _is_work_scene


## Play a looping clip on the hero (e.g. Cheering at the win) -- it holds, unlike a
## one-shot which settles back to idle.
func play_lead_loop(anim: String) -> void:
	if _lead_anim != null and _lead_anim.has_animation(anim) and _lead_anim.current_animation != anim:
		_lead_anim.play(anim, 0.3)


## Grinding aliveness: the hero plays the work clip and sparks fly while typing,
## settling to idle when paused. The sparks heat up (orange -> hot blue-white) with
## progress, so the child sees the sharpening getting close to done.
func set_lead_work(active: bool, progress: float = 0.0) -> void:
	if _lead_anim != null:
		var want := HERO_WORK if active else HERO_IDLE
		if _lead_anim.has_animation(want) and _lead_anim.current_animation != want:
			_lead_anim.play(want, 0.25)
	if _sparks != null:
		_sparks.emitting = active
		_sparks.color = _spark_color(progress)


func _spark_color(p: float) -> Color:
	if p < 0.5:
		return Color(1.0, 0.5, 0.1).lerp(Color(1.0, 0.92, 0.35), p / 0.5)        # orange -> yellow
	return Color(1.0, 0.92, 0.35).lerp(Color(0.6, 0.85, 1.0), (p - 0.5) / 0.5)   # yellow -> hot blue-white


func stop_sparks() -> void:
	if _sparks != null:
		_sparks.emitting = false


func _build_sparks(pos: Vector3) -> void:
	var p := CPUParticles3D.new()
	p.position = pos
	p.amount = 44
	p.lifetime = 0.55
	p.emitting = false
	p.direction = Vector3(-0.3, 0.8, 0.6)   # up and toward the camera
	p.spread = 42.0
	p.initial_velocity_min = 3.0
	p.initial_velocity_max = 6.5
	p.gravity = Vector3(0, -8, 0)
	p.scale_amount_min = 0.8
	p.scale_amount_max = 1.8
	var spark := SphereMesh.new()
	spark.radius = 0.05
	spark.height = 0.1
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.8, 0.3)
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.6, 0.15)
	mat.emission_energy_multiplier = 9.0
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	spark.material = mat
	p.mesh = spark
	add_child(p)
	_sparks = p


## Play a one-shot hero clip (e.g. PickUp at the win), then settle back to idle.
func play_lead_oneshot(anim: String) -> void:
	if _lead_anim == null or not _lead_anim.has_animation(anim):
		return
	_lead_anim.get_animation(anim).loop_mode = Animation.LOOP_NONE
	if not _lead_anim.animation_finished.is_connected(_on_lead_oneshot_done):
		_lead_anim.animation_finished.connect(_on_lead_oneshot_done)
	_lead_anim.play(anim, 0.2)


func _on_lead_oneshot_done(_anim: StringName) -> void:
	if _lead_anim != null and _lead_anim.has_animation(HERO_IDLE):
		_lead_anim.play(HERO_IDLE, 0.3)


## Hinge the treasure chest lid open (A9 win flourish). The lid is a child node of
## the chest model, so "open" is a lid rotation.
func open_chest() -> void:
	if _chest_lid == null:
		return
	var t := create_tween()
	t.tween_interval(0.3)   # let the hero reach first
	t.tween_property(_chest_lid, "rotation_degrees:x", -82.0, 0.6) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


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


func is_treasure() -> bool:
	return _needs_bloom


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
# Static staging is authored in scenes/sets/<name>.tscn (editable in the editor)
# and instanced here; if a set is missing it falls back to the procedural builder.
# Only the STATIC scenery + anchors live in the set. Dynamic things (hero, chest,
# the treasure glow, mood lighting) and all motion stay in code.

func _set_for(descriptor) -> String:
	if descriptor.location == "forge":
		return "forge"
	if descriptor.location == "dungeon":
		return "dungeon"
	if descriptor.path == SceneDescriptor.PATH_FORK:
		return "forest_fork"
	for p in descriptor.props:
		if p.asset == "bridge":
			return "forest_bridge"
	return "forest_straight"


func _instance_set(set_name: String) -> Node3D:
	var path := "res://scenes/sets/%s.tscn" % set_name
	if ResourceLoader.exists(path):
		var inst := _instance_path(path)
		if inst != null:
			return inst
	return build_static(set_name)


func _read_anchors(descriptor) -> void:
	_travel_start = _anchor_position("path_near")
	_travel_end = _anchor_position("path_far")
	if descriptor.path == SceneDescriptor.PATH_FORK:
		_cave_pos = _anchor_position("far_left")
		_bridge_pos = _anchor_position("far_right")


# Builds the STATIC staging for a set. Public so the bake tool can generate the
# editable scenes/sets/<name>.tscn from it.
func build_static(set_name: String) -> Node3D:
	match set_name:
		"forest_fork":
			return _static_forest(true, false)
		"forest_bridge":
			return _static_forest(false, true)
		"dungeon":
			return _static_dungeon()
		"forge":
			return _static_forge()
		"overworld":
			return _static_overworld()
		_:
			return _static_forest(false, false)


func _static_forest(fork: bool, bridge: bool) -> Node3D:
	var root := Node3D.new()
	var rng := _rng()
	# ground extends well beyond the camera so no edge is ever visible
	root.add_child(_make_ground(Vector2(56, 140), _grass_tint(rng)))
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
		root.add_child(_path_segment(Vector3(0, 0, 13), Vector3(0, 0, 0), 3.0))
		root.add_child(_path_segment(Vector3(0, 0, 0), anchors["far_left"], 2.4))
		root.add_child(_path_segment(Vector3(0, 0, 0), anchors["far_right"], 2.4))
		_build_cave_mouth(root, anchors["far_left"])
		_build_bridge(root, anchors["far_right"], 5.0, true)
	elif bridge:
		root.add_child(_path_segment(Vector3(0, 0, 16), Vector3(0, 0, -16), 3.0))
		_build_bridge(root, anchors["center"], 0.0, false)
	else:
		root.add_child(_path_segment(Vector3(0, 0, 16), Vector3(0, 0, -16), 3.0))
	_scatter_forest(root, rng, fork)
	return root


func _static_dungeon() -> Node3D:
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
	var barrel := _instance_path("res://assets/kaykit/dungeon/barrel_large.gltf")
	if barrel != null:
		barrel.position = Vector3(-2.6, 0, -4.6)
		root.add_child(barrel)
	return root


func _static_forge() -> Node3D:
	var root := Node3D.new()
	var rng := _rng()
	root.add_child(_make_ground(Vector2(40, 40), Color(0.30, 0.46, 0.22)))   # grassy yard
	# a thin slab, NOT a coplanar plane (a second plane at y=0 would z-fight/flicker)
	root.add_child(_make_box(Vector3(6, 0.08, 6), Vector3(0, 0.04, 0), Color(0.34, 0.32, 0.30)))
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
	var grind := _instance_path("res://assets/kaykit/rpgtools_bits/grindstone.gltf")
	if grind != null:
		grind.position = anchors["grind_point"]
		grind.rotation.y = deg_to_rad(90)
		root.add_child(grind)
	var anvil := _instance_path("res://assets/kaykit/rpgtools_bits/anvil.gltf")
	if anvil != null:
		anvil.position = Vector3(-1.8, 0, 0.6)
		anvil.rotation.y = deg_to_rad(-40)
		root.add_child(anvil)
	_treeline(root, rng, ["Tree_1_A_Color1", "Tree_2_A_Color1", "Tree_3_A_Color1"])
	return root


# --- overworld island (KayKit hexagon pack) ------------------------------------

func _hex_world(q: int, r: int) -> Vector3:
	return Vector3((float(q) + float(r) * 0.5) * HEX_W, 0.0, float(r) * HEX_ROW)


func _pull_toward(from: Vector3, to: Vector3, dist: float) -> Vector3:
	return from + (to - from).normalized() * dist


func _hex_tile(root: Node3D, model: String, q: int, r: int, yaw_deg: float = 0.0) -> Node3D:
	var inst := _instance_path(HEX_DIR + model + ".gltf")
	if inst == null:
		inst = _red_placeholder(model)
	inst.position = _hex_world(q, r)
	inst.scale = Vector3.ONE * HEX_SCALE
	inst.rotation.y = deg_to_rad(yaw_deg)
	root.add_child(inst)
	return inst


# A decorated model standing ON a tile (building, trees, mountain, flag), turned
# to face the hub so fronts read from the camera.
func _hex_decor(root: Node3D, model: String, q: int, r: int, face_hub: bool = true) -> Node3D:
	var inst := _instance_path(HEX_DIR + model + ".gltf")
	if inst == null:
		inst = _red_placeholder(model)
	var pos := _hex_world(q, r)
	inst.position = pos
	inst.scale = Vector3.ONE * HEX_SCALE
	if face_hub and pos.length() > 0.1:
		inst.rotation.y = atan2(-pos.x, -pos.z)
	root.add_child(inst)
	return inst


## The small one-screen island (radius-2 land, water ring): the hub crossroads in
## the middle, dirt paths to the three sites (bos / smidse / boog), decoration, and
## the named markers + editable Path3D routes the game reads. Baked to
## scenes/sets/overworld.tscn -- arrange it in the editor; a LARGER island later
## only means editing that set (nothing here assumes one screen).
func _static_overworld() -> Node3D:
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
		var cloud := _instance_path(HEX_DIR + "cloud_big.gltf")
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
			root.add_child(_path_segment(prev, wp, 1.7))
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
	# an arch of large real rocks framing a dark opening that faces the fork (+z)
	var placements := [
		["Rock_1_A_Color1", Vector3(-2.4, 0, 0.3), 3.6, 0.3],
		["Rock_2_A_Color1", Vector3(2.5, 0, 0.2), 3.8, -0.5],
		["Rock_3_A_Color1", Vector3(0, 0, -1.6), 4.4, 0.0],     # back mound
		["Rock_2_A_Color1", Vector3(-1.4, 2.6, -0.4), 2.8, 1.1], # lintel left
		["Rock_1_A_Color1", Vector3(1.5, 2.8, -0.4), 3.0, 2.0],  # lintel right
	]
	for p in placements:
		var rock := _instance_path(FOREST_DIR + p[0] + ".gltf")
		if rock != null:
			rock.position = pos + p[1]
			rock.scale = Vector3.ONE * p[2]
			rock.rotation.y = p[3]
			root.add_child(rock)
	# a dark recess inside the arch reads as the cave depth
	root.add_child(_make_box(Vector3(2.2, 2.8, 1.6), pos + Vector3(0, 1.4, -0.6), C_CAVE))


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
			pass  # the river + bridge are baked into the forest_bridge location set
		"sword":
			var sword := _instance_asset("sword")
			sword.name = "Prop_sword"
			# attach to the knight's right-hand weapon slot so it is actually held;
			# the grinding + raise motion then comes from the hand animation
			var sk: Skeleton3D = _lead.find_child("Skeleton3D", true, false) if _lead != null else null
			if sk != null:
				var ba := BoneAttachment3D.new()
				ba.bone_name = "handslot.r"
				sk.add_child(ba)
				ba.add_child(sword)
				sword.position = Vector3(0.4, 0.11, 0.0)   # nudge onto the wheel
			else:
				add_child(sword)
				sword.position = _anchor_position(prop.anchor)
			_sword = sword
		"chest":
			var chest := _instance_asset("chest")
			chest.name = "Prop_chest"
			chest.scale = Vector3(2.5, 2.5, 2.5)
			add_child(chest)
			# at the win, sit the chest a bit closer to the hero so the open reads
			var cpos := _anchor_position(prop.anchor)
			if prop.anchor == "treasure":
				cpos += Vector3(0, 0, 1.4)
			chest.position = cpos
			_chest_lid = chest.find_child("chest_gold_lid", true, false)
			_stage_treasure(cpos)
		_:
			var node := _instance_asset(prop.asset)
			node.name = "Prop_" + prop.asset
			add_child(node)
			node.position = _anchor_position(prop.anchor)


func _stage_treasure(pos: Vector3) -> void:
	# a bright clearing flourish around the chest: a warm light, an emissive halo
	# (blooms via the environment glow), and a ring of bushes
	var glow := OmniLight3D.new()
	glow.position = pos + Vector3(0, 1.8, 0)
	glow.light_color = Color(1.0, 0.88, 0.5)
	glow.omni_range = 14.0
	glow.light_energy = 13.0
	add_child(glow)
	# a tall light shaft + emissive halo so the treasure is an obvious beacon
	var shaft := SpotLight3D.new()
	shaft.position = pos + Vector3(0, 9.0, 0)
	shaft.rotation_degrees = Vector3(-90, 0, 0)
	shaft.light_color = Color(1.0, 0.9, 0.55)
	shaft.light_energy = 11.0
	shaft.spot_range = 14.0
	shaft.spot_angle = 30.0
	add_child(shaft)
	var halo := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 1.1
	sphere.height = 2.2
	halo.mesh = sphere
	halo.position = pos + Vector3(0, 1.6, 0)
	var hmat := StandardMaterial3D.new()
	hmat.emission_enabled = true
	hmat.emission = Color(1.0, 0.85, 0.4)
	hmat.emission_energy_multiplier = 9.0
	hmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	hmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	hmat.albedo_color = Color(1.0, 0.85, 0.4, 0.55)
	halo.material_override = hmat
	add_child(halo)
	var rng := _rng()
	for i in range(7):
		var bush := _instance_path(FOREST_DIR + "Bush_2_A_Color1.gltf")
		if bush != null:
			var ang := TAU * float(i) / 7.0
			bush.position = pos + Vector3(sin(ang) * 2.4, 0, cos(ang) * 2.4)
			bush.scale = Vector3.ONE * rng.randf_range(0.7, 1.0)
			add_child(bush)


# --- mood / lighting ----------------------------------------------------------

func _apply_mood(mood: String, with_fog: bool = true) -> void:
	var we := WorldEnvironment.new()
	we.name = "Mood"
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	sky.sky_material = ProceduralSkyMaterial.new()
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	if _needs_bloom:
		# bloom only in the treasure scenes, reduced 25% from the first pass
		env.glow_enabled = true
		env.glow_intensity = 0.75
		env.glow_strength = 0.9
		env.glow_bloom = 0.26
		env.glow_hdr_threshold = 0.9
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
			if with_fog:
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
			inst.scene_file_path = path  # so the bake tool can save it as an instance
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
