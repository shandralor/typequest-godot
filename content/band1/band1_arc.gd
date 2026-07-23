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
	# the bridge needs BOTH the crystal (won by beating the skeleton armed) and the miller's
	# tip (molen_tip) explaining what it's for. Loop: flee the cave -> train -> beat the cave
	# for the crystal -> hear the tip at the mill -> the bridge opens.
	var brug_choice := StoryGraph.Choice.new("word.brug", "brug", "right")
	brug_choice.requires_flag = "has_crystal molen_tip"
	# `grot` is the same fork choice with two beats: the first-visit FLEE, or -- once FULLY
	# trained (fully_trained = sword_sharp at the forge AND archery_done at the range) -- the
	# armed FIGHT that wins the crystal. Both trainings matter; neither alone opens the fight.
	var grot_choice := StoryGraph.Choice.new("word.grot", "grot", "left")
	grot_choice.alt_target = "grot_fight"
	grot_choice.alt_flag = "fully_trained"
	kruispunt.choices = [
		grot_choice,
		brug_choice,
	]
	kruispunt.safety = _nl_be_safety("fnv1a:fc978a65")
	kruispunt.scene = Scenes.kruispunt()
	g.add_node(kruispunt)

	# grot -- FIRST visit: the cave FRIGHTENS him, he flees empty-handed (a terminal, non-
	# celebratory beat). Only `met_skeleton` -- that unlocks training + the mill. The CRYSTAL is
	# NOT grabbed here; it is the reward for coming back armed (see grot_fight).
	var grot := StoryGraph.StoryNode.new()
	grot.id = "grot"
	grot.prose_key = "grot.prose"
	grot.narration_key = "grot.narration"
	grot.ending = "win"
	grot.win_key = "grot.win"
	grot.celebrate = false
	grot.sets_flag = "met_skeleton"
	grot.safety = _nl_be_safety("fnv1a:07954cfa")
	grot.scene = Scenes.grot()
	g.add_node(grot)

	# grot_fight -- the ARMED return (reached via the grot fork once sword_sharp is set): type
	# the fight, BEAT the skeleton, win the glowing crystal. A CELEBRATED terminal win that sets
	# has_crystal (the key that lowers the drawbridge).
	var grot_fight := StoryGraph.StoryNode.new()
	grot_fight.id = "grot_fight"
	grot_fight.prose_key = "grotFight.prose"
	grot_fight.narration_key = "grotFight.narration"
	grot_fight.ending = "win"
	grot_fight.win_key = "grotFight.win"
	grot_fight.sets_flag = "has_crystal"
	grot_fight.safety = _nl_be_safety("fnv1a:b665e070")
	grot_fight.scene = Scenes.grot()
	g.add_node(grot_fight)

	# brug -- the CROSSING (campaign v2): reuses the fork set with its lowered drawbridge
	# and the owner's lengthened far path. Type the prose to walk across; the exit-walk
	# terminator then strolls him off `cross_exit` and soft-fades back to the island.
	var brug := StoryGraph.StoryNode.new()
	brug.id = "brug"
	brug.prose_key = "brug.prose"
	brug.narration_key = "brug.narration"
	brug.ending = "win"
	brug.exit_walk = true
	brug.win_key = "demo.end"           # placeholder: crossing is the end of the demo for now
	brug.sets_flag = "crossed_bridge"   # lifts the coastal mist over the region past the bridge
	brug.safety = _nl_be_safety("fnv1a:360036c6")
	brug.scene = Scenes.brug()
	g.add_node(brug)

	return g
