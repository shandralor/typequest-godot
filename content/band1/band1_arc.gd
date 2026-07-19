class_name Band1Arc
extends RefCounted

## The band-1 story graph `band1-arc` (brief A7/A9), built as pure data.
##
## Arc shape: start -> kruispunt -> { grot (setback, returns to naGrot -> brug ->
## schat) | brug -> schat }. Two ways to the win; the cave is a recoverable detour.
##
## Safety records carry the per-locale FNV-1a hash from A7 (criteria_version is a
## deliberate stub, A4). AUTHORED -- do not regenerate casually.

const Scenes = preload("res://content/band1/scene_descriptors.gd")

const GRAPH_ID := "band1-arc"
const VOCABULARY_ID := "fantasy-poc"
const START_ID := "start"
const SAFETY_DATE := "2026-06-26"
const CRITERIA_VERSION := "v0-stub"


static func _nl_be_safety(hash_value: String) -> Dictionary:
	return {"nl-BE": {"hash": hash_value, "date": SAFETY_DATE, "criteria_version": CRITERIA_VERSION}}


static func build() -> StoryGraph:
	var g := StoryGraph.new()
	g.graph_id = GRAPH_ID
	g.vocabulary_id = VOCABULARY_ID
	g.start_id = START_ID

	# start -- type prose, then `verder` to the fork.
	var start := StoryGraph.StoryNode.new()
	start.id = "start"
	start.prose_key = "start.prose"
	start.narration_key = "start.narration"
	start.choices = [StoryGraph.Choice.new("word.verder", "kruispunt", "forward")]
	start.safety = _nl_be_safety("fnv1a:a69bd641")
	start.scene = Scenes.start()
	g.add_node(start)

	# kruispunt -- the fork: `grot` (left) or `brug` (right).
	var kruispunt := StoryGraph.StoryNode.new()
	kruispunt.id = "kruispunt"
	kruispunt.prose_key = "kruispunt.prose"
	kruispunt.narration_key = "kruispunt.narration"
	# the bridge is fence-locked until the cave is done -- so the FIRST time only `grot`
	# is offered; after the skeleton (met_skeleton) the bridge opens.
	var brug_choice := StoryGraph.Choice.new("word.brug", "brug", "right")
	brug_choice.requires_flag = "met_skeleton"
	kruispunt.choices = [
		StoryGraph.Choice.new("word.grot", "grot", "left"),
		brug_choice,
	]
	kruispunt.safety = _nl_be_safety("fnv1a:fc978a65")
	kruispunt.scene = Scenes.kruispunt()
	g.add_node(kruispunt)

	# grot -- a SETBACK: neutral ending that bounces to naGrot, progress intact.
	var grot := StoryGraph.StoryNode.new()
	grot.id = "grot"
	grot.prose_key = "grot.prose"
	grot.narration_key = "grot.narration"
	# campaign v2: the cave FRIGHTENS him -- he flees, back to the island to train (a
	# terminal, non-celebratory beat). The bridge stays gated for a later, armed visit.
	grot.ending = "win"
	grot.win_key = "grot.win"
	grot.celebrate = false
	# he sees the skeleton AND grabs a glowing crystal before fleeing: met_skeleton unlocks
	# training + the bridge; has_crystal is the key that later lowers the drawbridge.
	grot.sets_flag = "met_skeleton has_crystal"
	grot.safety = _nl_be_safety("fnv1a:07954cfa")
	grot.scene = Scenes.grot()
	g.add_node(grot)

	# naGrot -- pre-revealed connective beat; only the safe bridge is offered.
	var na_grot := StoryGraph.StoryNode.new()
	na_grot.id = "naGrot"
	na_grot.prose_key = "naGrot.prose"
	na_grot.narration_key = "naGrot.narration"
	na_grot.prerevealed = true
	na_grot.choices = [StoryGraph.Choice.new("word.brug", "brug", "right")]
	na_grot.safety = _nl_be_safety("fnv1a:68a2ee24")
	na_grot.scene = Scenes.na_grot()
	g.add_node(na_grot)

	# brug -- the CROSSING (campaign v2): reuses the fork set with its lowered drawbridge
	# and the owner's lengthened far path. Type the prose to walk across; the exit-walk
	# terminator then strolls him off `cross_exit` and soft-fades back to the island.
	var brug := StoryGraph.StoryNode.new()
	brug.id = "brug"
	brug.prose_key = "brug.prose"
	brug.narration_key = "brug.narration"
	brug.ending = "win"
	brug.exit_walk = true
	brug.sets_flag = "crossed_bridge"   # lifts the coastal mist over the region past the bridge
	brug.safety = _nl_be_safety("fnv1a:360036c6")
	brug.scene = Scenes.brug()
	g.add_node(brug)

	# schat -- the WIN.
	var schat := StoryGraph.StoryNode.new()
	schat.id = "schat"
	schat.prose_key = "schat.prose"
	schat.narration_key = "schat.narration"
	schat.ending = "win"
	schat.win_key = "schat.win"
	schat.safety = _nl_be_safety("fnv1a:4c6d879d")
	schat.scene = Scenes.schat()
	g.add_node(schat)

	return g
