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
const SceneKit = preload("res://render/scene_kit.gd")
const Nature = preload("res://render/locations/nature.gd")
const ForestLocation = preload("res://render/locations/forest.gd")
const DungeonLocation = preload("res://render/locations/dungeon.gd")
const ForgeLocation = preload("res://render/locations/forge.gd")
const HouseLocation = preload("res://render/locations/house.gd")
const ArcheryLocation = preload("res://render/locations/archery.gd")
const OverworldLocation = preload("res://render/locations/overworld.gd")
const HeroRig = preload("res://render/hero_rig.gd")
const FOREST_DIR := "res://assets/kaykit/forest_nature/"

const LEAD_ASSETS := ["hero"]
const SCATTER_SEED := 20260627

const TARGET_MODEL := "res://assets/kaykit/hexagon/target.gltf"
const ARROW_MODEL := "res://assets/kaykit/adventurers/arrow_bow.gltf"
const TARGET_SCALE := 8.5
const TARGET_RADIUS := 1.0   # crosshair/arrow spread on the target face (world metres)

var _variant := ""
var _location: Node3D
var _hero: HeroRig
var _cave_pos := Vector3.ZERO
var _bridge_pos := Vector3.ZERO
var _has_landmarks := false
var _needs_bloom := false
var _chest_lid: Node3D
var _is_work_scene := false
var _sparks: CPUParticles3D
var _spark_mat: StandardMaterial3D
var _sword: Node3D
var _grindstone: Node3D
var _is_overworld := false
var _clouds: Array = []   # [{ node: Node3D, speed: float }] drifting sky clouds
var _is_archery_scene := false
var _is_house_scene := false   # the intro interior (wake up, walk out the door)
var _house_door: Node3D      # the doorway leaf that swings open at the intro end
var _target: Node3D          # the archery target
var _crosshair: Node3D       # reticle on the target face
var _bow: Node3D             # bow held by the knight (arrow spawn point)
var _target_face := Vector3.ZERO   # world centre of the target face


func compose(descriptor, variant: String = "") -> void:
	_clear()
	_hero = HeroRig.new()
	_variant = variant
	_has_landmarks = descriptor.path == SceneDescriptor.PATH_FORK
	_needs_bloom = false
	for p in descriptor.props:
		if p.asset == "chest":
			_needs_bloom = true   # only the treasure scenes get bloom
	_is_work_scene = descriptor.location == "forge"
	_is_archery_scene = descriptor.location == "archery_range"
	_is_house_scene = descriptor.location == "house"
	_location = _instance_set(_set_for(descriptor))
	_location.name = "Location"
	add_child(_location)
	_read_anchors(descriptor)
	_apply_mood(descriptor.mood)
	for actor in descriptor.actors:
		var is_lead: bool = actor.asset in LEAD_ASSETS
		var node := _hero.build() if is_lead else SceneKit.instance_asset(actor.asset)
		node.name = "Actor_" + actor.asset
		add_child(node)
		if is_lead:
			_hero.set_walking(_is_walking_scene(descriptor, actor))
			node.position = _hero.travel_start if _hero.walking else _anchor_position(actor.anchor)
		else:
			node.position = _anchor_position(actor.anchor)
		SceneKit.face(node, actor.facing)
	for prop in descriptor.props:
		_place_prop(prop)
	if _is_work_scene:
		_build_sparks(_anchor_position("grind_point") + Vector3(0.0, 0.7, 0.0))
		_grindstone = SceneKit.find_child_containing(_location, "grindstone")
	if _is_archery_scene:
		_build_archery_target()
	set_lead_progress(0.0)
	if _is_house_scene and _hero.walking:
		# the INTRO (a walking scene starting at path_near) sinks him for the getting-up
		# rise; a RETURN visit (starts at path_far/door, not walking) just stands there
		set_house_start()
	if _is_archery_scene and _hero.anim != null and _hero.anim.has_animation(HeroRig.HERO_AIM):
		_hero.anim.play(HeroRig.HERO_AIM)   # hold the bow-aim pose (not idle)
	else:
		set_lead_animation(false)


func _clear() -> void:
	for c in get_children():
		c.queue_free()
	_location = null
	_hero = null
	_chest_lid = null
	_is_work_scene = false
	_sparks = null
	_spark_mat = null
	_sword = null
	_grindstone = null
	_is_overworld = false
	_clouds = []
	_is_archery_scene = false
	_is_house_scene = false
	_house_door = null
	_target = null
	_crosshair = null
	_bow = null


## Compose the overworld island: the editable set (scenes/sets/overworld.tscn) plus
## the animated knight standing at `start_anchor` (the hub, or the site it just
## returned from). The island is a MENU rendered as a place -- no SceneDescriptor,
## no logic-layer involvement; travel is driven by the controller along the set's
## editable Path3D routes.
func compose_overworld(start_anchor: String = "hub") -> void:
	_clear()
	_hero = HeroRig.new()
	_variant = "overworld"
	_is_overworld = true
	_location = _instance_set("overworld")
	_location.name = "Location"
	add_child(_location)
	_apply_mood("light", false)   # no distance fog: the island must read crisply
	_spawn_clouds()
	var hero := _hero.build()
	hero.name = "Actor_hero"
	add_child(hero)
	_hero.set_walking(false)
	hero.position = _anchor_position(start_anchor)
	set_lead_animation(false)


const CLOUD_MODEL := "res://assets/kaykit/hexagon/cloud_big.gltf"
# wrap well off-screen on both sides so a cloud is never seen popping/teleporting
const CLOUD_WRAP_MIN := -62.0
const CLOUD_WRAP_MAX := 62.0


# Drifting clouds for gentle sky motion. Keeps the cloud already in the set and adds
# a few more at varied height/scale/speed, so the drift reads as parallax. Each
# wraps from one side to the other. Driven by _process below.
func _spawn_clouds() -> void:
	_clouds = []
	var rng := _rng()
	# match clouds by node name OR by the instanced scene path (set clouds can be
	# auto-named like "@Node3D@39", which the name check alone would miss)
	for c in _location.get_children():
		if c is Node3D and (c.name.to_lower().contains("cloud") or c.scene_file_path.to_lower().contains("cloud")):
			_clouds.append({"node": c, "speed": rng.randf_range(0.5, 0.9)})
	var spots := [Vector3(16, 11, -4), Vector3(-24, 13, 6), Vector3(4, 14, -18), Vector3(28, 12, -12)]
	for spot in spots:
		var cl := SceneKit.instance_path(CLOUD_MODEL)
		if cl == null:
			continue
		cl.position = spot
		var s := rng.randf_range(2.2, 3.4)
		cl.scale = Vector3(s, s, s)
		_location.add_child(cl)
		_clouds.append({"node": cl, "speed": rng.randf_range(0.4, 0.9)})


func _process(delta: float) -> void:
	for c in _clouds:
		var n: Node3D = c.node
		n.position.x += c.speed * delta
		if n.position.x > CLOUD_WRAP_MAX:
			n.position.x = CLOUD_WRAP_MIN


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
	_hero.set_position(pos)


## Cross-fade the hero between its walk and idle clips (B3 in-place aliveness).
func set_lead_animation(moving: bool) -> void:
	_hero.set_animation(moving)


func is_work_scene() -> bool:
	return _is_work_scene


## Play a looping clip on the hero (e.g. Cheering at the win) -- it holds, unlike a
## one-shot which settles back to idle.
func play_lead_loop(anim: String) -> void:
	_hero.play_loop(anim)


## Grinding aliveness: the hero plays the work clip and sparks fly while typing,
## settling to idle when paused. The sparks heat up (orange -> hot blue-white) with
## progress, so the child sees the sharpening getting close to done.
func set_lead_work(active: bool, progress: float = 0.0) -> void:
	if _hero.anim != null:
		var want := HeroRig.HERO_WORK if active else HeroRig.HERO_IDLE
		if _hero.anim.has_animation(want) and _hero.anim.current_animation != want:
			_hero.anim.play(want, 0.25)
	if _sparks != null:
		_sparks.emitting = active
		# drive the emission (the sparks are unshaded + emissive, so the glow colour
		# is what reads -- the per-particle albedo tint alone would be overridden)
		var col := _spark_color(progress)
		if _spark_mat != null:
			_spark_mat.albedo_color = col
			_spark_mat.emission = col
		# the shower intensifies toward the end of the song: bigger sparks flung
		# higher and wider (with the colour ramp, the sharpening clearly "heats up")
		var g := 0.75 + progress * 1.15
		_sparks.scale_amount_min = 0.6 * g
		_sparks.scale_amount_max = 1.1 * g
		_sparks.initial_velocity_max = 5.0 + progress * 3.5
		_sparks.spread = 40.0 + progress * 20.0


func _spark_color(p: float) -> Color:
	if p < 0.5:
		return Color(1.0, 0.32, 0.05).lerp(Color(1.0, 0.85, 0.2), p / 0.5)          # red-orange -> gold
	if p < 0.67:
		return Color(1.0, 0.85, 0.2).lerp(Color(0.9, 0.96, 1.0), (p - 0.5) / 0.17)  # gold -> white-hot
	# the final third cools to a hot blue -- the child sees the end is near
	return Color(0.9, 0.96, 1.0).lerp(Color(0.35, 0.6, 1.0), (p - 0.67) / 0.33)     # white-hot -> blue


func stop_sparks() -> void:
	if _sparks != null:
		_sparks.emitting = false


func has_grindstone() -> bool:
	return _grindstone != null


## The grind win: the sharpened wheel vanishes in a puff of smoke, revealing the
## cheering knight. Keeps the same camera angle as the grinding shot (no swing that
## would expose the smithy walls from outside).
func vanish_grindstone() -> void:
	if _grindstone == null:
		return
	var at := _grindstone.position + Vector3(0.0, 0.6, 0.0)
	_puff_smoke(at)
	var stone := _grindstone
	_grindstone = null
	# fade the wheel out under the smoke, then remove it
	var t := create_tween()
	t.tween_interval(0.12)
	t.tween_callback(stone.hide)
	t.tween_callback(stone.queue_free)


func _puff_smoke(pos: Vector3) -> void:
	var p := CPUParticles3D.new()
	p.position = pos
	p.one_shot = true
	p.amount = 34
	p.lifetime = 0.9
	p.explosiveness = 0.85
	p.direction = Vector3(0, 1, 0)
	p.spread = 80.0
	p.initial_velocity_min = 1.2
	p.initial_velocity_max = 3.2
	p.gravity = Vector3(0, 0.6, 0)
	p.scale_amount_min = 1.6
	p.scale_amount_max = 3.2
	var puff := SphereMesh.new()
	puff.radius = 0.16
	puff.height = 0.32
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.85, 0.85, 0.88, 0.9)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	puff.material = mat
	p.mesh = puff
	add_child(p)
	p.emitting = true
	# auto-remove after it finishes
	var t := create_tween()
	t.tween_interval(1.3)
	t.tween_callback(p.queue_free)


func _build_sparks(pos: Vector3) -> void:
	var p := CPUParticles3D.new()
	p.position = pos
	p.amount = 60
	p.lifetime = 0.6
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
	_spark_mat = mat


## Play a one-shot hero clip (e.g. PickUp at the win), then settle back to idle.
func play_lead_oneshot(anim: String) -> void:
	_hero.play_oneshot(anim)


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
	return _hero.has()


func is_walking() -> bool:
	return _hero.is_walking()


func has_landmarks() -> bool:
	return _has_landmarks


func is_treasure() -> bool:
	return _needs_bloom


func cave_pos() -> Vector3:
	return _cave_pos


func bridge_pos() -> Vector3:
	return _bridge_pos


func lead_position() -> Vector3:
	return _hero.position()


func anchor_pos(name: String) -> Vector3:
	return _anchor_position(name)


## Place the lead along the travel path by progress in [0, 1] (walking scenes only).
func set_lead_progress(p: float) -> void:
	_hero.set_progress(p)


## Orient the walking lead: facing travel direction while moving, camera at rest.
func set_lead_moving(moving: bool) -> void:
	_hero.set_moving(moving)


## Directly set the standing lead's yaw (the gaze, driven by the controller).
func set_lead_yaw(yaw: float) -> void:
	_hero.set_yaw(yaw)


# --- locations ----------------------------------------------------------------
# Static staging is authored in scenes/sets/<name>.tscn (editable in the editor)
# and instanced here; if a set is missing it falls back to the procedural builder.
# Only the STATIC scenery + anchors live in the set. Dynamic things (hero, chest,
# the treasure glow, mood lighting) and all motion stay in code.

func _set_for(descriptor) -> String:
	if descriptor.location == "forge":
		return "forge"
	if descriptor.location == "archery_range":
		return "archery"
	if descriptor.location == "house":
		return "house"
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
		var inst := SceneKit.instance_path(path)
		if inst != null:
			return inst
	return build_static(set_name)


func _read_anchors(descriptor) -> void:
	_hero.set_travel(_anchor_position("path_near"), _anchor_position("path_far"))
	if descriptor.path == SceneDescriptor.PATH_FORK:
		_cave_pos = _anchor_position("far_left")
		_bridge_pos = _anchor_position("far_right")


# Builds the STATIC staging for a set. Public so the bake tool can generate the
# editable scenes/sets/<name>.tscn from it.
func build_static(set_name: String) -> Node3D:
	match set_name:
		"forest_fork":
			return ForestLocation.build(true, false, _rng())
		"forest_bridge":
			return ForestLocation.build(false, true, _rng())
		"dungeon":
			return DungeonLocation.build()
		"forge":
			return ForgeLocation.build(_rng())
		"archery":
			return ArcheryLocation.build(_rng())
		"house":
			return HouseLocation.build()
		"overworld":
			return OverworldLocation.build()
		_:
			return ForestLocation.build(false, false, _rng())


func is_house_scene() -> bool:
	return _is_house_scene


const LOCKED_GHOST := 0.55   # transparency for a locked (not-yet-unlocked) house item


# Ghost a house item (by node-name substring) when it is locked, so it reads as
# "visible but not takeable yet"; solid once unlocked. The controller drives `locked`
# from the progression flags (render stays decoupled from game/progress).
func set_house_item_locked(name_contains: String, locked: bool) -> void:
	if _location == null:
		return
	var n := SceneKit.find_child_containing(_location, name_contains)
	if n == null:
		return
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		(mi as GeometryInstance3D).transparency = LOCKED_GHOST if locked else 0.0


const HOUSE_RISE_FRAC := 0.16   # first slice of typing: the knight rises out of the floor
const HOUSE_STAND_Y := 0.2      # the floor's TOP surface -- where the knight's feet rest
const HOUSE_SINK_DROP := 1.0    # how far below standing he starts (getting-up illusion)
const HOUSE_MOVE_SPEED := 5.0   # how fast he glides toward the typing target (fluidity)


# The floor top the knight stands on / how far below he starts (controller reads these
# to compute the rise as he gets up).
func house_stand_y() -> float:
	return HOUSE_STAND_Y


func house_sink_drop() -> float:
	return HOUSE_SINK_DROP


# Move the intro knight toward `target`, SMOOTHED each frame (delta > 0) so he glides
# instead of snapping; a non-positive delta snaps (initial placement). `yaw` sets his
# facing (radians). The controller computes the waypoint + rise Y and passes it in.
func house_move_to(target: Vector3, delta: float = 0.0, yaw: float = PI) -> void:
	if _hero.node == null:
		return
	if delta <= 0.0:
		_hero.node.position = target
	else:
		_hero.node.position = _hero.node.position.lerp(target, clampf(delta * HOUSE_MOVE_SPEED, 0.0, 1.0))
	_hero.node.rotation.y = yaw


# Initial sunk placement for the house intro (called once from compose(), delta = 0):
# he starts below the floor at path_near, facing the door.
func set_house_start() -> void:
	if _hero.node == null:
		return
	var s := _hero.travel_start
	house_move_to(Vector3(s.x, HOUSE_STAND_Y - HOUSE_SINK_DROP, s.z), 0.0, deg_to_rad(180))


# The knight takes his sword off the shelf: hide the displayed shelf sword, put the
# vocabulary sword in his right hand, and play the pickup one-shot.
func house_pickup_sword() -> void:
	var shelf := SceneKit.find_child_containing(_location, "shelf_sword")
	if shelf != null:
		shelf.visible = false
	var sword := SceneKit.instance_asset("sword")
	sword.name = "Prop_sword"
	if not _attach_to_hand(sword, "handslot.r", Vector3(0.0, 0.0, 0.0)):
		add_child(sword)
		sword.position = lead_position()
	_sword = sword
	play_lead_oneshot(HeroRig.HERO_PICKUP)


# The knight takes the key from the cabinet: hide the displayed keyring + play pickup.
func house_pickup_key() -> void:
	var kr := SceneKit.find_child_containing(_location, "cabinet_key")
	if kr != null:
		kr.visible = false
	play_lead_oneshot(HeroRig.HERO_PICKUP)


# Swing the doorway leaf open (the intro flourish as the knight leaves). The door mesh
# hinges near its own origin, so a yaw on the leaf reads as a door opening.
func house_open_door() -> void:
	if _house_door == null and _location != null:
		_house_door = _location.find_child("wall_doorway_door", true, false) as Node3D
	if _house_door == null:
		return
	var t := create_tween()
	t.tween_property(_house_door, "rotation:y", deg_to_rad(100), 0.7) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


# --- archery (crosshair + arrows) ---------------------------------------------

func is_archery_scene() -> bool:
	return _is_archery_scene


# Build the downrange target (scaled up, facing the knight) and the reticle.
func _build_archery_target() -> void:
	var pos := _anchor_position("target")
	# the target model's origin is at its base, disc offset (0, 0.15, 0.04) in local
	var disc := pos + Vector3(0.0, 0.15 * TARGET_SCALE, 0.04 * TARGET_SCALE)
	_target = SceneKit.instance_path(TARGET_MODEL)
	if _target != null:
		_target.position = pos
		_target.scale = Vector3(TARGET_SCALE, TARGET_SCALE, TARGET_SCALE)
		add_child(_target)
	# a wooden post from the ground up to the disc, set back a touch behind it
	var post_h := disc.y
	add_child(SceneKit.make_box(Vector3(0.22, post_h, 0.22), Vector3(pos.x, post_h * 0.5, pos.z - 0.35), Color(0.45, 0.3, 0.17)))
	_target_face = disc + Vector3(0, 0, 0.25)   # just in front of the disc (+Z, toward the knight)
	_crosshair = _make_crosshair()
	_crosshair.position = _target_face
	add_child(_crosshair)
	# keep the knight in the bow-aim pose
	if _hero.anim != null and _hero.anim.has_animation(HeroRig.HERO_AIM):
		_hero.anim.play(HeroRig.HERO_AIM, 0.3)


func _make_crosshair() -> Node3D:
	var root := Node3D.new()
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.25, 0.15)
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.25, 0.15)
	mat.emission_energy_multiplier = 3.0
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.26
	torus.outer_radius = 0.34
	ring.mesh = torus
	ring.material_override = mat
	ring.rotation.x = deg_to_rad(90)   # face +Z (toward the camera/knight)
	root.add_child(ring)
	for horiz in [true, false]:
		var bar := MeshInstance3D.new()
		var box := BoxMesh.new()
		box.size = Vector3(0.5, 0.05, 0.02) if horiz else Vector3(0.05, 0.5, 0.02)
		bar.mesh = box
		bar.material_override = mat
		root.add_child(bar)
	return root


## Place the reticle on the target face. `offset` is metres from the bullseye
## (x = right, y = up); clamped to the target radius.
func set_crosshair(offset: Vector2) -> void:
	if _crosshair == null:
		return
	var o := offset.limit_length(TARGET_RADIUS)
	_crosshair.position = _target_face + Vector3(o.x, o.y, 0.0)


## Hide the reticle -- used once the last arrow lands, so the win pause shows just
## the arrow in the bullseye (no crosshair over it).
func hide_crosshair() -> void:
	if _crosshair != null:
		_crosshair.visible = false


## Loose an arrow to `offset` on the target: a quick bow release, an arrow flies
## from the bow to that point and sticks.
func fire_arrow(offset: Vector2) -> void:
	if _hero.anim != null and _hero.anim.has_animation(HeroRig.HERO_SHOOT):
		_hero.anim.play(HeroRig.HERO_SHOOT, 0.1)
		_hero.anim.animation_finished.connect(_back_to_aim, CONNECT_ONE_SHOT)
	var o := offset.limit_length(TARGET_RADIUS)
	var land := _target_face + Vector3(o.x, o.y, -0.5)   # into the target face
	var arrow := SceneKit.instance_path(ARROW_MODEL)
	if arrow == null:
		return
	arrow.scale = Vector3(2.4, 2.4, 2.4)
	var start := _bow.global_position if _bow != null else _hero_position_high()
	arrow.position = start
	arrow.look_at_from_position(start, land, Vector3.UP)
	add_child(arrow)
	var t := create_tween()
	t.tween_property(arrow, "position", land, 0.22).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	# ONLY the dead-centre bullseye shot needs re-angling: a straight-down-the-lane
	# arrow sits end-on to the camera (invisible), so the roos would read empty. The
	# off-centre arrows flew laterally and already read fine at their flight angle.
	if o.length() < 0.05:
		t.tween_callback(_stick_arrow.bind(arrow, land))


## Give a landed arrow the classic "stuck in the target" silhouette: shaft into the
## face but tilted up toward the shooter, so even a centre hit reads clearly.
func _stick_arrow(arrow: Node3D, land: Vector3) -> void:
	if is_instance_valid(arrow):
		arrow.look_at_from_position(land, land + Vector3(0.0, -0.55, -1.0), Vector3.UP)


func _back_to_aim(_a: StringName) -> void:
	if _hero.anim != null and _is_archery_scene and _hero.anim.has_animation(HeroRig.HERO_AIM):
		_hero.anim.play(HeroRig.HERO_AIM, 0.15)


func _hero_position_high() -> Vector3:
	return lead_position() + Vector3(0, 1.4, 0)


# --- props --------------------------------------------------------------------

# Attach `node` to the hero skeleton's named bone slot (e.g. handslot.r/.l) at a local
# offset, so it is actually held and follows the hand animation. Returns false if the
# hero has no Skeleton3D (caller should place it in the world instead).
func _attach_to_hand(node: Node3D, bone_name: String, offset: Vector3) -> bool:
	var sk: Skeleton3D = _hero.node.find_child("Skeleton3D", true, false) if _hero.node != null else null
	if sk == null:
		return false
	var ba := BoneAttachment3D.new()
	ba.bone_name = bone_name
	sk.add_child(ba)
	ba.add_child(node)
	node.position = offset
	return true


func _place_prop(prop) -> void:
	match prop.asset:
		"bridge":
			pass  # the river + bridge are baked into the forest_bridge location set
		"sword":
			var sword := SceneKit.instance_asset("sword")
			sword.name = "Prop_sword"
			# attach to the knight's right-hand weapon slot so it is actually held;
			# the grinding + raise motion then comes from the hand animation
			if not _attach_to_hand(sword, "handslot.r", Vector3(0.4, 0.11, 0.0)):
				add_child(sword)
				sword.position = _anchor_position(prop.anchor)
			_sword = sword
		"bow":
			var bow := SceneKit.instance_asset("bow")
			bow.name = "Prop_bow"
			if _attach_to_hand(bow, "handslot.l", Vector3.ZERO):   # held in the off-hand
				# the model's default grip points the string downrange; spin it so the
				# string faces the archer and the belly (arrow rest) faces the target
				bow.rotate_object_local(Vector3.UP, PI)
			else:
				add_child(bow)
				bow.position = _anchor_position("line")
			_bow = bow
		"chest":
			var chest := SceneKit.instance_asset("chest")
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
			var node := SceneKit.instance_asset(prop.asset)
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
		var bush := SceneKit.instance_path(FOREST_DIR + "Bush_2_A_Color1.gltf")
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

# --- placement helpers --------------------------------------------------------

func _anchor_position(anchor: String) -> Vector3:
	if _location != null:
		var m := _location.get_node_or_null(NodePath(anchor))
		if m is Node3D:
			return (m as Node3D).position
	push_warning("Unknown anchor '%s' -- placing at origin" % anchor)
	return Vector3.ZERO


func _rng() -> RandomNumberGenerator:
	var rng := RandomNumberGenerator.new()
	rng.seed = SCATTER_SEED + abs(_variant.hash())
	return rng
