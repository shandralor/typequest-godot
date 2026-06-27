class_name Band1SceneDescriptors
extends RefCounted

## Band-1 scene descriptors (brief A7), as pure data. Graph id `band1-arc`,
## start node `start`, vocabulary `fantasy-poc`, all nodes tagged band `band-1`.
##
## Scene-first milestone: only `start` is provided here. The remaining nodes
## (kruispunt, grot, naGrot, brug, schat) and the full story-graph/typing/scoring
## logic follow once the composition loop is judged (brief Section 9 build order).
##
## AUTHORED -- do not regenerate casually (brief A7).

## start -- scene: forest_path, mood day; actor hero at anchor path_near, pose
## idle, facing camera. (The choice/prose/safety-hash belong to the story node,
## carried with the logic port; this is only the SCENE descriptor.)
static func start() -> SceneDescriptor:
	var d := SceneDescriptor.new()
	d.location = "forest_path"
	d.mood = "day"
	d.path = SceneDescriptor.PATH_STRAIGHT
	d.actors = [
		SceneDescriptor.ActorPlacement.new("hero", "path_near", "idle", "camera"),
	]
	d.props = []
	return d
