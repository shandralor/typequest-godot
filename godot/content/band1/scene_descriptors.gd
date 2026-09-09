class_name Band1SceneDescriptors
extends RefCounted

## Band-1 scene descriptors (brief A7), as pure data. Graph id `band1-arc`,
## vocabulary `fantasy-poc`. Each node's scene names elements BY ID; no model
## paths. Only `forest_path` is composed by the SceneComposer so far; the dungeon
## scene (grot) renders later. AUTHORED -- do not regenerate casually.

# start -- the opening walk, staged on the DEVELOPED fork set: the hero walks the approach
# up TO the fork (start_approach -> center) so the child arrives where the choice happens.
# anchor stays path_near so it registers as a walking scene; travel_* redirect the route.
static func start() -> SceneDescriptor:
	var d := SceneDescriptor.new()
	d.location = "forest_path"
	d.mood = "day"
	d.path = SceneDescriptor.PATH_STRAIGHT
	d.set_name = "forest_fork"
	d.travel_from = "start_approach"
	d.travel_to = "center"
	d.actors = [SceneDescriptor.ActorPlacement.new("hero", "path_near", "walk", "camera")]
	return d


# kruispunt (the fork) -- SAME forest_fork set as start, so it re-stages in place (no cut):
# the hero is already at center from the opening walk; the choice just appears. `continuous`.
static func kruispunt() -> SceneDescriptor:
	var d := SceneDescriptor.new()
	d.location = "forest_path"
	d.mood = "day"
	d.path = SceneDescriptor.PATH_FORK
	d.set_name = "forest_fork"
	d.continuous = true
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


# brug (the crossing) -- REUSES the fork set (its raised drawbridge + crystal socket +
# the owner's lengthened far path). A walking straight-scene: hero starts at path_near
# and walks path_near -> path_far as the prose is typed, then the exit-walk terminator
# strolls him off the `cross_exit` marker and soft-fades back to the island.
static func brug() -> SceneDescriptor:
	var d := SceneDescriptor.new()
	d.location = "forest_path"
	d.mood = "day"
	d.path = SceneDescriptor.PATH_STRAIGHT
	d.set_name = "forest_fork"
	# same set as the fork -- the choice-walk leaves the hero at path_near, so re-stage in
	# place (no rebuild/teleport); the crystal-lower + crossing then play from there.
	d.continuous = true
	d.actors = [SceneDescriptor.ActorPlacement.new("hero", "path_near", "walk", "camera")]
	return d
