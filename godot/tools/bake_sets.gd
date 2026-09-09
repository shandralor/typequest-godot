extends SceneTree

## Bakes the static location staging into editable scenes/sets/<name>.tscn so the
## scenery (ground, path, trees, cave, bridge, dungeon, island, anchors, routes)
## can be edited in the Godot editor. The game instances these sets
## (scene_composer._instance_set); dynamic things -- hero, chest, the treasure
## glow, mood lighting, all motion -- stay in code and read the named Marker3D
## anchors (and, on the overworld, the Path3D routes) from the set.
##
## Run:  godot --headless --script res://tools/bake_sets.gd -- <set> [<set> ...]
## e.g.  godot --headless --script res://tools/bake_sets.gd -- forge overworld
##
## Re-baking OVERWRITES a set: after you hand-edit a set in the editor, do NOT
## re-bake that set or your edits are lost. To protect hand-edited sets, this tool
## only bakes the sets you NAME -- with no arguments it just lists them.

const Composer = preload("res://render/scene_composer.gd")
const SETS := ["forest_straight", "forest_fork", "forest_bridge", "dungeon", "forge", "overworld", "archery", "house"]
const OUT_DIR := "res://scenes/sets"


func _initialize() -> void:
	var wanted := OS.get_cmdline_user_args()
	if wanted.is_empty():
		print("Usage: godot --headless --script res://tools/bake_sets.gd -- <set> [<set> ...]")
		print("Available sets: ", ", ".join(SETS))
		print("NOTE: baking OVERWRITES the named set -- never re-bake a hand-edited one.")
		quit()
		return
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT_DIR))
	var composer = Composer.new()
	for set_name in wanted:
		if set_name not in SETS:
			push_error("unknown set '%s' (available: %s)" % [set_name, ", ".join(SETS)])
			continue
		composer._variant = set_name
		var root: Node = composer.build_static(set_name)
		_own(root, root)
		var packed := PackedScene.new()
		if packed.pack(root) != OK:
			push_error("pack failed for " + set_name)
			continue
		var out := "%s/%s.tscn" % [OUT_DIR, set_name]
		var err := ResourceSaver.save(packed, out)
		print(("saved " if err == OK else "SAVE FAILED ") + out)
		root.free()
	quit()


# Give every procedurally-built node the scene as its owner so it serializes.
# Stop at instanced sub-scenes (gltf): they are saved as references, not inlined.
func _own(node: Node, root: Node) -> void:
	if node != root:
		node.owner = root
	if node.scene_file_path != "":
		return
	for c in node.get_children():
		_own(c, root)
