class_name GrindArc
extends RefCounted

## The "Slijp je zwaard" session: a short, single-beat adventure where the knight
## grinds his sword on a grindstone while the child types the words of a song (the
## slijplied). One node, win ending. AUTHORED -- do not regenerate casually.

const GRAPH_ID := "grind-arc"
const VOCABULARY_ID := "fantasy-poc"
const START_ID := "slijpen"


static func build() -> StoryGraph:
	var g := StoryGraph.new()
	g.graph_id = GRAPH_ID
	g.vocabulary_id = VOCABULARY_ID
	g.start_id = START_ID

	var node := StoryGraph.StoryNode.new()
	node.id = "slijpen"
	node.prose_key = "slijpen.prose"
	node.narration_key = "slijpen.narration"
	node.ending = "win"
	node.win_key = "slijpen.win"
	node.sets_flag = "sword_sharp"   # a sharp sword -- the training the armed cave fight needs
	node.safety = {"nl-BE": {"hash": "fnv1a:e7256a7d", "date": "2026-07-13", "criteria_version": "v0-stub"}}
	node.scene = scene()
	g.add_node(node)
	return g


static func scene() -> SceneDescriptor:
	var d := SceneDescriptor.new()
	d.location = "forge"
	d.mood = "day"
	d.actors = [SceneDescriptor.ActorPlacement.new("hero", "center", "idle", "camera")]
	d.props = [SceneDescriptor.PropPlacement.new("sword", "grind_point")]
	return d
