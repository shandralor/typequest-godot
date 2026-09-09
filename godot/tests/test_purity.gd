extends SceneTree

## Logic-purity guard (brief B2). Scans logic/, axis/, content/ for references to
## the engine/scene-tree/Input/render layer. The pure core must be headless-
## testable and replayable; this stops it from rotting into the render layer.
## Run: godot --headless --script res://tests/test_purity.gd

const DIRS := ["res://logic", "res://axis", "res://content"]

# Real code patterns that would couple the pure core to the engine. Chosen so they
# do not match the prose of the doc-comments (which legitimately discuss "Node",
# "Input", "render" in passing); comment text is stripped before matching anyway.
const FORBIDDEN := [
	"extends Node", "InputEvent", "Input.", "InputMap",
	"get_tree(", "get_viewport(", "get_node(", "add_child(", "queue_free(",
	"RenderingServer", "PhysicsServer", "PackedScene", ".instantiate(",
	"Camera3D", "MeshInstance", "AnimationPlayer", "WorldEnvironment",
	"Engine.is_editor_hint", "OS.get_cmdline",
]

var _violations := 0


func _initialize() -> void:
	for d in DIRS:
		_scan_dir(d)
	print("test_purity: %d violations" % _violations)
	quit(_violations)


func _scan_dir(path: String) -> void:
	var d := DirAccess.open(path)
	if d == null:
		return
	d.list_dir_begin()
	var entry := d.get_next()
	while entry != "":
		var full := path + "/" + entry
		if d.current_is_dir():
			_scan_dir(full)
		elif entry.ends_with(".gd"):
			_scan_file(full)
		entry = d.get_next()
	d.list_dir_end()


func _scan_file(path: String) -> void:
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		return
	var line_no := 0
	while not f.eof_reached():
		line_no += 1
		var raw := f.get_line()
		var code := raw
		var hash_at := code.find("#")
		if hash_at != -1:
			code = code.substr(0, hash_at)  # strip comments before matching
		for token in FORBIDDEN:
			if code.find(token) != -1:
				_violations += 1
				print("VIOLATION %s:%d  '%s'  -> %s" % [path, line_no, token, raw.strip_edges()])
	f.close()
