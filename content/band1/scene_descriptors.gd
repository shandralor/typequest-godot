class_name Band1SceneDescriptors
extends RefCounted

## Band-1 scene descriptors (brief A7), as pure data. Graph id `band1-arc`,
## vocabulary `fantasy-poc`. Each node's scene names elements BY ID; no model
## paths. Only `forest_path` is composed by the SceneComposer so far; the dungeon
## scene (grot) renders later. AUTHORED -- do not regenerate casually.

# start -- forest_path, day; hero at path_near, idle, facing camera.
static func start() -> SceneDescriptor:
	var d := SceneDescriptor.new()
	d.location = "forest_path"
	d.mood = "day"
	d.path = SceneDescriptor.PATH_STRAIGHT
	d.actors = [SceneDescriptor.ActorPlacement.new("hero", "path_near", "idle", "camera")]
	return d


# kruispunt (the fork) -- forest_path, day, path fork; hero at center, idle.
static func kruispunt() -> SceneDescriptor:
	var d := SceneDescriptor.new()
	d.location = "forest_path"
	d.mood = "day"
	d.path = SceneDescriptor.PATH_FORK
	d.actors = [SceneDescriptor.ActorPlacement.new("hero", "center", "idle", "camera")]
	return d


# grot (the cave, a setback) -- dungeon, dark; hero at center idle, skeleton at
# far_right idle facing camera.
static func grot() -> SceneDescriptor:
	var d := SceneDescriptor.new()
	d.location = "dungeon"
	d.mood = "dark"
	d.actors = [
		SceneDescriptor.ActorPlacement.new("hero", "center", "idle", "camera"),
		SceneDescriptor.ActorPlacement.new("skeleton", "far_right", "idle", "camera"),
	]
	return d


# naGrot (post-cave fork) -- forest_path, day, path fork; hero at center, idle.
static func na_grot() -> SceneDescriptor:
	var d := SceneDescriptor.new()
	d.location = "forest_path"
	d.mood = "day"
	d.path = SceneDescriptor.PATH_FORK
	d.actors = [SceneDescriptor.ActorPlacement.new("hero", "center", "idle", "camera")]
	return d


# brug (the bridge) -- forest_path, day; hero at path_near, walk; bridge at center.
static func brug() -> SceneDescriptor:
	var d := SceneDescriptor.new()
	d.location = "forest_path"
	d.mood = "day"
	d.path = SceneDescriptor.PATH_STRAIGHT
	d.actors = [SceneDescriptor.ActorPlacement.new("hero", "path_near", "walk", "camera")]
	d.props = [SceneDescriptor.PropPlacement.new("bridge", "center")]
	return d


# schat (the treasure, the win) -- forest_path, day; hero at center idle; chest at
# treasure.
static func schat() -> SceneDescriptor:
	var d := SceneDescriptor.new()
	d.location = "forest_path"
	d.mood = "day"
	d.path = SceneDescriptor.PATH_STRAIGHT
	d.actors = [SceneDescriptor.ActorPlacement.new("hero", "center", "idle", "camera")]
	d.props = [SceneDescriptor.PropPlacement.new("chest", "treasure")]
	return d
