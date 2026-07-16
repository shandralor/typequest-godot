class_name HomeArc
extends RefCounted

## A RETURN visit to the house (the overworld "thuis" site). Reuses the SAME editable
## set as the intro (scenes/sets/house.tscn) -- no mirrored/rebaked variant: the knight
## simply enters from the door and walks in, driven by the typed prose. This is the
## foundation for later "fetch an item from home" visits (a shield, a cloak, ...): add
## the item + a `*_point` anchor in the editor and a leg to the walk. One node, win
## ending. AUTHORED -- do not regenerate casually.

const GRAPH_ID := "home-arc"
const VOCABULARY_ID := "fantasy-poc"
const START_ID := "thuisbezoek"


static func build() -> StoryGraph:
	var g := StoryGraph.new()
	g.graph_id = GRAPH_ID
	g.vocabulary_id = VOCABULARY_ID
	g.start_id = START_ID

	var node := StoryGraph.StoryNode.new()
	node.id = "thuisbezoek"
	node.prose_key = "home.prose"
	node.narration_key = "home.narration"
	node.ending = "win"
	node.win_key = "home.win"
	node.safety = {"nl-BE": {"hash": "fnv1a:70f31056", "date": "2026-07-16", "criteria_version": "v0-stub"}}
	node.scene = scene()
	g.add_node(node)
	return g


static func scene() -> SceneDescriptor:
	var d := SceneDescriptor.new()
	d.location = "house"
	d.mood = "day"
	d.path = SceneDescriptor.PATH_STRAIGHT
	# enter from the door (path_far) and walk in, facing into the room
	d.actors = [SceneDescriptor.ActorPlacement.new("hero", "path_far", "idle", "camera")]
	return d
