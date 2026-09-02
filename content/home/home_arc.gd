class_name HomeArc
extends RefCounted

## A RETURN visit to the house (the overworld "thuis" site), reusing the SAME editable
## set as the intro (scenes/sets/house.tscn). Campaign v2: the knight comes home to
## COLLECT his gear before he can train -- a CHOICE of which item to take first
## (type `zwaard` or `boog`), then he walks to it and picks it up. The controller filters
## the choice to items not yet collected (and handles the "nothing left" case), and does
## the per-item walk + pickup + flag. AUTHORED -- do not regenerate casually.

const GRAPH_ID := "home-arc"
const VOCABULARY_ID := "fantasy-poc"
const START_ID := "thuiskeuze"


static func build() -> StoryGraph:
	var g := StoryGraph.new()
	g.graph_id = GRAPH_ID
	g.vocabulary_id = VOCABULARY_ID
	g.start_id = START_ID

	# the choice: walk in, then pick which item to take (controller filters to uncollected)
	var keuze := StoryGraph.StoryNode.new()
	keuze.id = "thuiskeuze"
	keuze.prose_key = "home.prose"
	keuze.narration_key = "home.narration"
	keuze.choices = [
		StoryGraph.Choice.new("word.zwaard", "neem_zwaard", "right"),
		StoryGraph.Choice.new("word.boog", "neem_boog", "left"),
	]
	keuze.safety = _safety("fnv1a:faa09ff1")
	keuze.scene = _house_scene()
	g.add_node(keuze)

	# take the sword (controller walks him to sword_point + collects on the win)
	var zwaard := StoryGraph.StoryNode.new()
	zwaard.id = "neem_zwaard"
	zwaard.prose_key = "home.sword_prose"
	zwaard.narration_key = "home.narration"
	zwaard.ending = "win"
	zwaard.win_key = "home.win_sword"
	zwaard.safety = _safety("fnv1a:b3d74729")
	zwaard.scene = _house_scene()
	g.add_node(zwaard)

	# take the bow
	var boog := StoryGraph.StoryNode.new()
	boog.id = "neem_boog"
	boog.prose_key = "home.bow_prose"
	boog.narration_key = "home.narration"
	boog.ending = "win"
	boog.win_key = "home.win_bow"
	boog.safety = _safety("fnv1a:d86d6e7a")
	boog.scene = _house_scene()
	g.add_node(boog)
	return g


static func _safety(hash: String) -> Dictionary:
	return {"nl-BE": {"hash": hash, "date": "2026-07-17", "criteria_version": "v0-stub"}}


static func _house_scene() -> SceneDescriptor:
	var d := SceneDescriptor.new()
	d.location = "house"
	d.mood = "day"
	d.path = SceneDescriptor.PATH_STRAIGHT
	# enter from the door (path_far) and walk in, facing into the room
	d.actors = [SceneDescriptor.ActorPlacement.new("hero", "path_far", "idle", "camera")]
	return d
