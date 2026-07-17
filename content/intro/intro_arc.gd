class_name IntroArc
extends RefCounted

## The intro: the knight wakes up in the house and walks out the door into the world.
## A gentle "how to play" -- SHORT words / three-word sentences -- teaching the one
## core move: type the words and the knight advances. It plays ONCE (AppProgress
## remembers it) and then hands off to the overworld, where the child learns to CHOOSE
## a destination by typing its name. One walking node, ends by leaving the house.
## AUTHORED -- do not regenerate casually.

const GRAPH_ID := "intro-arc"
const VOCABULARY_ID := "fantasy-poc"
const START_ID := "ontwaken"


static func build() -> StoryGraph:
	var g := StoryGraph.new()
	g.graph_id = GRAPH_ID
	g.vocabulary_id = VOCABULARY_ID
	g.start_id = START_ID

	var node := StoryGraph.StoryNode.new()
	node.id = "ontwaken"
	node.prose_key = "intro.prose"
	node.narration_key = "intro.narration"
	node.ending = "win"
	node.win_key = "intro.win"
	node.safety = {"nl-BE": {"hash": "fnv1a:6d8a5857", "date": "2026-07-17", "criteria_version": "v0-stub"}}
	node.scene = scene()
	g.add_node(node)
	return g


static func scene() -> SceneDescriptor:
	var d := SceneDescriptor.new()
	d.location = "house"
	d.mood = "day"
	d.path = SceneDescriptor.PATH_STRAIGHT           # a walking node: bed -> door
	d.actors = [SceneDescriptor.ActorPlacement.new("hero", "path_near", "idle", "away")]
	return d
