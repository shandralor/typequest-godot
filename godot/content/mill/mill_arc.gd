class_name MillArc
extends RefCounted

## The "Molen" beat: a short STORY visit. The child travels to the mill, meets the
## molenaar (miller), and types his TIP -- to cross the old bridge you need a crystal,
## found in the cave. One node, win ending; sets `molen_tip` (a discoverability hook the
## bridge/objectives can lean on later). AUTHORED -- do not regenerate casually.

const GRAPH_ID := "mill-arc"
const VOCABULARY_ID := "fantasy-poc"
const START_ID := "molenaar"


static func build() -> StoryGraph:
	var g := StoryGraph.new()
	g.graph_id = GRAPH_ID
	g.vocabulary_id = VOCABULARY_ID
	g.start_id = START_ID

	var node := StoryGraph.StoryNode.new()
	node.id = "molenaar"
	node.prose_key = "mill.prose"
	node.narration_key = "mill.narration"
	node.ending = "win"
	node.win_key = "mill.win"
	node.sets_flag = "molen_tip"   # heard the miller's bridge tip (a hook for later)
	node.safety = {"nl-BE": {"hash": "fnv1a:017cea28", "date": "2026-07-20", "criteria_version": "v0-stub"}}
	node.scene = scene()
	g.add_node(node)
	return g


static func scene() -> SceneDescriptor:
	var d := SceneDescriptor.new()
	d.location = "mill"
	d.set_name = "mill"
	d.mood = "day"
	# a standing beat: the hero listens at center, the miller stands to the side facing him
	d.actors = [
		SceneDescriptor.ActorPlacement.new("hero", "center", "idle", "right"),
		SceneDescriptor.ActorPlacement.new("molenaar", "far_right", "idle", "left"),
	]
	return d
