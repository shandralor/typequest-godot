class_name StoryGraph
extends RefCounted

## The story graph data model (brief A3/A7/A9). Pure data: nodes, forks, scene
## descriptors. THE load-bearing rule: the graph carries KEYS, never words, and
## IDS, never models. Narrative + choice words are text keys resolved against a
## locale catalog; scenes are bags of ids drawn from an asset vocabulary. Swap the
## catalog or the art pack and the same graph plays in another language / renders
## from other models.
##
## A node carries no key/finger terms -- those live on the keyboard-layout axis.

var graph_id: String = ""
var start_id: String = ""
var vocabulary_id: String = ""
var nodes: Dictionary = {}   # id -> StoryNode


func add_node(node) -> void:
	nodes[node.id] = node


func get_node_by_id(id: String):
	return nodes.get(id, null)


func has_node(id: String) -> bool:
	return nodes.has(id)


## A fork option: type the resolved `word_key` to go to `target` (with a finger/
## direction `hint`). The word is a KEY, the target is an ID.
class Choice extends RefCounted:
	var word_key: String
	var target: String
	var hint: String   # forward|left|right (presentation/guidance hint)
	var requires_flag: String = ""   # hidden until this progress flag is set (e.g. a gate)

	func _init(p_word_key: String, p_target: String, p_hint: String) -> void:
		word_key = p_word_key
		target = p_target
		hint = p_hint


## One story beat.
##  - prose_key / narration_key: text keys resolved per locale.
##  - choices: fork options (empty for endings).
##  - ending: "" | "neutral" | "win".
##  - return_to (A9): a non-win ending may bounce the run here with progress intact.
##  - prerevealed (A9): prose shown already complete; no typing, NO score.
##  - safety: locale -> { hash, date, criteria_version } (A4).
##  - scene: the SceneDescriptor (ids, never models).
class StoryNode extends RefCounted:
	var id: String
	var band: String = "band-1"
	var prose_key: String = ""
	var narration_key: String = ""
	var choices: Array = []         # Array[Choice]
	var ending: String = ""         # "" | "neutral" | "win"
	var win_key: String = ""        # locale key for the win message (optional)
	var return_to: String = ""      # A9 setback target
	var prerevealed: bool = false   # A9
	var sets_flag: String = ""      # progress flag set when this node completes (e.g. met_skeleton)
	var celebrate: bool = true      # a win with no cheer/chest/flash reads as a somber beat
	var exit_walk: bool = false     # a win that strolls the hero off `cross_exit` + fades to the island
	var safety: Dictionary = {}     # locale -> { hash, date, criteria_version }
	var scene = null                # SceneDescriptor

	func is_ending() -> bool:
		return ending != ""
