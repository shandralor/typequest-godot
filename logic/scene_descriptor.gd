class_name SceneDescriptor
extends RefCounted

## Pure data model for the scene a story node carries (migration brief A7/B4).
##
## This is logic-layer data: it has ZERO knowledge of rendering, the scene tree,
## Input, or networking. It names scene elements by id drawn from an asset
## vocabulary; it never references a model path. Swap the art pack behind the
## vocabulary and the same descriptor renders from different models.
##
## Schema (brief A7):
##   { location, mood?, actors?: [{ asset, anchor, pose?, facing? }],
##     props?: [{ asset, anchor }], camera?, path?: 'straight' | 'fork' }

const PATH_STRAIGHT := "straight"
const PATH_FORK := "fork"

var location: String
var mood: String = ""
var actors: Array = []  # Array[ActorPlacement]
var props: Array = []   # Array[PropPlacement]
var camera: String = ""
var path: String = PATH_STRAIGHT  # presentation hint only, never affects logic
var set_name: String = ""  # explicit editable-set override (else the composer picks by heuristic)
# walking-scene travel endpoints (anchor names). Default is the full path_near -> path_far
# run; a scene can point them elsewhere (e.g. the opening walk goes an approach -> the fork).
var travel_from: String = "path_near"
var travel_to: String = "path_far"
# presentation hint: this beat CONTINUES the previous one on the same set -- the composer may
# re-stage in place (keep the set + hero, no rebuild) instead of cutting. Never affects logic.
var continuous: bool = false


## A placed actor. `facing` is one of camera|left|right|away.
class ActorPlacement extends RefCounted:
	var asset: String
	var anchor: String
	var pose: String = "idle"
	var facing: String = "camera"

	func _init(p_asset: String, p_anchor: String, p_pose: String = "idle", p_facing: String = "camera") -> void:
		asset = p_asset
		anchor = p_anchor
		pose = p_pose
		facing = p_facing


## A placed prop. Props sit on a named anchor; no pose/facing.
class PropPlacement extends RefCounted:
	var asset: String
	var anchor: String

	func _init(p_asset: String, p_anchor: String) -> void:
		asset = p_asset
		anchor = p_anchor
