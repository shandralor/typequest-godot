class_name ArcheryArc
extends RefCounted

## The "Boogschieten" session: the knight shoots at a target while the child types
## an archery rhyme. A crosshair drifts over the target and steadies toward a ring
## as each sentence is typed; a LONGER sentence lands its arrow closer to the
## bullseye, so the arrows march inward across the four sentences. One node, win
## ending. AUTHORED -- do not regenerate casually.

const GRAPH_ID := "archery-arc"
const VOCABULARY_ID := "fantasy-poc"
const START_ID := "boogschieten"


static func build() -> StoryGraph:
	var g := StoryGraph.new()
	g.graph_id = GRAPH_ID
	g.vocabulary_id = VOCABULARY_ID
	g.start_id = START_ID

	var node := StoryGraph.StoryNode.new()
	node.id = "boogschieten"
	node.prose_key = "boog.prose"
	node.narration_key = "boog.narration"
	node.ending = "win"
	node.win_key = "boog.win"
	node.sets_flag = "archery_done"   # bow training done (with sword_sharp -> fully_trained)
	node.safety = {"nl-BE": {"hash": "fnv1a:15ae56be", "date": "2026-07-14", "criteria_version": "v0-stub"}}
	node.scene = scene()
	g.add_node(node)
	return g


static func scene() -> SceneDescriptor:
	var d := SceneDescriptor.new()
	d.location = "archery_range"
	d.mood = "day"
	d.actors = [SceneDescriptor.ActorPlacement.new("hero", "line", "idle", "downrange")]
	d.props = [SceneDescriptor.PropPlacement.new("bow", "hand")]
	return d
