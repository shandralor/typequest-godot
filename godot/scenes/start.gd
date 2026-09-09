@tool
extends Node3D

## Milestone-1 harness: composes the band-1 `start` scene so it can be OPENED and
## judged directly in the Godot editor, and RUN (F5) to see the knight walk the
## path. @tool means opening this scene composes it live in the editor viewport.
##
## This is the deliberately-first deliverable (brief Section 9): prove the
## COMPOSITION LOOP -- a scene descriptor resolved through the asset vocabulary
## into a staged Godot scene -- before porting the known-good logic layer.

const SceneComposerScript = preload("res://render/scene_composer.gd")
const Band1Descriptors = preload("res://content/band1/scene_descriptors.gd")

var _composer
var _phase := 0.0


func _ready() -> void:
	_compose()


func _compose() -> void:
	for c in get_children():
		c.queue_free()
	_composer = SceneComposerScript.new()
	_composer.name = "Composer"
	add_child(_composer)
	_composer.compose(Band1Descriptors.start())
	_setup_camera()
	if not Engine.is_editor_hint() and "--shot" in OS.get_cmdline_user_args():
		_capture()


func _process(delta: float) -> void:
	# runtime-only demo walk: oscillate progress so the knight paces the path.
	if Engine.is_editor_hint() or _composer == null or not _composer.has_lead():
		return
	_phase += delta * 0.5
	var p := 0.5 - 0.5 * cos(_phase)          # 0..1..0 ping-pong
	_composer.set_lead_progress(p)
	_composer.set_lead_moving(sin(_phase) > 0.0)


func _setup_camera() -> void:
	var cam := Camera3D.new()
	cam.name = "RunCamera"
	add_child(cam)
	cam.position = Vector3(0, 4.0, 12.5)
	cam.look_at(Vector3(0, 1.2, 0.0), Vector3.UP)
	cam.current = not Engine.is_editor_hint()


func _capture() -> void:
	await get_tree().create_timer(1.5).timeout
	var shots_dir := ProjectSettings.globalize_path("res://.shots")
	DirAccess.make_dir_recursive_absolute(shots_dir)
	var img := get_viewport().get_texture().get_image()
	var out := shots_dir.path_join("start.png")
	img.save_png(out)
	print("SHOT_SAVED ", out)
	get_tree().quit()
