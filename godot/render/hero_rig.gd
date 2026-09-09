class_name HeroRig
extends RefCounted

## The protagonist (hero) rig, extracted from SceneComposer (behavior-preserving).
##
## Builds the animated hero (B3): the KayKit Knight -- its own textured mesh on the
## shared Rig_Medium skeleton -- with idle/walk/pickup/work/cheer/ranged clips grafted
## in from the Rig_Medium animation sets (same skeleton, so the tracks resolve). The
## AnimationPlayer is then driven by the SceneActivity state.
##
## The protagonist-position EXCEPTION (B4): the hero is render-authored. On a STRAIGHT
## travel scene it walks the path; on a standing scene it sits and the controller drives
## its yaw (the gaze). The rig exposes `node`/`anim`/`travel_start`/`travel_end` publicly
## so the composer's scenario mechanics (forge, archery, house, props) can reach it.

const SceneKit = preload("res://render/scene_kit.gd")

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
const HERO_LIE := "Lie_Idle"          # looped lying pose (asleep in bed at the intro start)
const HERO_STANDUP := "Lie_StandUp"   # one-shot get-up (fold from lying to standing)
const HERO_AIM := "Ranged_Bow_Aiming_Idle"   # looped bow aim, for archery
const HERO_SHOOT := "Ranged_Bow_Release"     # one-shot loose, per arrow
# per-class ranged variants (C-mini) -- all in the CombatRanged set + General(Throw), same rig
const HERO_AIM_MAGIC := "Ranged_Magic_Spellcasting"   # looped cast pose (wand/staff)
const HERO_SHOOT_MAGIC := "Ranged_Magic_Shoot"        # one-shot cast release
const HERO_AIM_1H := "Ranged_1H_Aiming"               # looped 1H aim (crossbow)
const HERO_SHOOT_1H := "Ranged_1H_Shoot"              # one-shot 1H shot
const HERO_THROW := "Throw"                           # one-shot throw (axe/dagger)
const HERO_RANGED := "res://assets/kaykit/characters/Rig_Medium_CombatRanged.glb"

var node: Node3D
var anim: AnimationPlayer
var walking := false
var travel_start := Vector3(0, 0, 7)
var travel_end := Vector3(0, 0, -8)
var _oneshot := false   # a one-shot (e.g. PickUp) is playing -- do not let walk/idle stomp it


# Builds the animated hero (B3): mesh + idle from the General rig, with the walk
# cycle grafted in from the Movement rig (same Rig_Medium skeleton, so the tracks
# resolve). `anim` is then driven by the SceneActivity state.
func build(model_override: String = "") -> Node3D:
	# the character MESH is the chosen hero (all share Rig_Medium, so the grafted clips
	# below resolve for any of them); the animation glbs stay fixed. `model_override` lets
	# the picker preview a specific hero without changing the saved choice.
	var model: String = model_override if model_override != "" else Characters.model_for(AppProgress.get_choice("hero", Characters.DEFAULT_ID))
	var hero := SceneKit.instance_path(model)
	if hero == null:
		node = SceneKit.red_placeholder("hero")
		return node
	var ap := AnimationPlayer.new()
	hero.add_child(ap)
	ap.root_node = NodePath("..")   # resolve tracks against the Knight root
	var lib := AnimationLibrary.new()
	ap.add_animation_library("", lib)
	_graft_animations(lib, HERO_GENERAL, [HERO_IDLE, HERO_PICKUP, HERO_THROW])
	_graft_animations(lib, HERO_MOVE, [HERO_WALK])
	_graft_animations(lib, HERO_TOOLS, [HERO_WORK])
	_graft_animations(lib, HERO_SIM, [HERO_CHEER, HERO_LIE, HERO_STANDUP])
	_graft_animations(lib, HERO_RANGED, [HERO_AIM, HERO_SHOOT, HERO_AIM_MAGIC, HERO_SHOOT_MAGIC, HERO_AIM_1H, HERO_SHOOT_1H])
	for clip in [HERO_IDLE, HERO_WALK, HERO_WORK, HERO_CHEER, HERO_AIM, HERO_AIM_MAGIC, HERO_AIM_1H, HERO_LIE]:
		if lib.has_animation(clip):
			lib.get_animation(clip).loop_mode = Animation.LOOP_LINEAR
	anim = ap
	node = hero
	return hero


# Copy named clips from an animation glb's player into the hero's library. The
# tracks target Rig_Medium/Skeleton3D bones, which the Knight shares.
func _graft_animations(lib: AnimationLibrary, glb_path: String, names: Array) -> void:
	var src := SceneKit.instance_path(glb_path)
	if src == null:
		return
	var sap := src.find_child("AnimationPlayer", true, false) as AnimationPlayer
	if sap != null:
		for n in names:
			if sap.has_animation(n) and not lib.has_animation(n):
				lib.add_animation(n, sap.get_animation(n).duplicate())
	src.free()


## Cross-fade the hero between its walk and idle clips (B3 in-place aliveness).
func set_animation(moving: bool) -> void:
	if anim == null or _oneshot:
		return   # let an in-flight one-shot (PickUp) finish before walk/idle resumes
	var want := HERO_WALK if moving else HERO_IDLE
	if anim.has_animation(want) and anim.current_animation != want:
		anim.play(want, 0.25)


## Play a looping clip on the hero (e.g. Cheering at the win) -- it holds, unlike a
## one-shot which settles back to idle.
func play_loop(anim_name: String) -> void:
	if anim != null and anim.has_animation(anim_name) and anim.current_animation != anim_name:
		anim.play(anim_name, 0.3)


## Play a one-shot hero clip (e.g. PickUp at the win), then settle back to idle.
## `speed` < 1.0 plays it slower (e.g. a gentle get-up).
func play_oneshot(anim_name: String, speed: float = 1.0) -> void:
	if anim == null or not anim.has_animation(anim_name):
		return
	anim.get_animation(anim_name).loop_mode = Animation.LOOP_NONE
	if not anim.animation_finished.is_connected(_on_oneshot_done):
		anim.animation_finished.connect(_on_oneshot_done)
	_oneshot = true
	anim.play(anim_name, 0.2, speed)


func _on_oneshot_done(_anim: StringName) -> void:
	_oneshot = false
	if anim != null and anim.has_animation(HERO_IDLE):
		anim.play(HERO_IDLE, 0.3)


## Progress [0,1] of the current one-shot (e.g. the get-up), so motion can follow the
## animation's own timeline instead of the typing. Returns 1.0 when no one-shot runs.
func oneshot_progress() -> float:
	if anim == null or not _oneshot:
		return 1.0
	var len := anim.get_current_animation_length()
	if len <= 0.0:
		return 1.0
	return clampf(anim.get_current_animation_position() / len, 0.0, 1.0)


## Place the lead along the travel path by progress in [0, 1] (walking scenes only).
func set_progress(p: float) -> void:
	if node != null and walking:
		node.position = travel_start.lerp(travel_end, clampf(p, 0.0, 1.0))


## Orient the walking lead: facing travel direction while moving, camera at rest.
func set_moving(moving: bool) -> void:
	if node == null or not walking:
		return
	if moving:
		var dir := travel_end - travel_start
		node.rotation.y = atan2(dir.x, dir.z)
	else:
		node.rotation.y = 0.0


## Directly set the standing lead's yaw (the gaze, driven by the controller).
func set_yaw(yaw: float) -> void:
	if node != null and not walking:
		node.rotation.y = yaw


## Force the lead's yaw regardless of walking state -- for scripted walk-offs (the
## fork stroll, the crossing exit-walk) where the controller drives motion by hand and
## the hero must face the direction it is being moved, not the fixed travel path.
func face_yaw(yaw: float) -> void:
	if node != null:
		node.rotation.y = yaw


## Directly place the lead (overworld travel along a route).
func set_position(pos: Vector3) -> void:
	if node != null:
		node.position = pos


func position() -> Vector3:
	return node.position if node != null else Vector3.ZERO


func has() -> bool:
	return node != null


func is_walking() -> bool:
	return walking


func set_walking(w: bool) -> void:
	walking = w


func set_travel(start: Vector3, end: Vector3) -> void:
	travel_start = start
	travel_end = end
