class_name Objectives
extends RefCounted

## The objectives / discoverability layer (roadmap Wave 1). Pure DATA: a list of small
## objectives that tell the child WHERE to go when something unlocks. Each objective:
##   id           -- stable key
##   active_flag   -- becomes ACTIVE once this AppProgress flag is set
##   done_flag     -- COMPLETE (drops off) once this flag is set
##   target_site   -- the overworld site id it points at (gets a badge)
##   hint_key      -- a short read-aloud nudge shown when it newly activates
##
## An objective is "open" when active_flag is set AND done_flag is not. The game layer
## evaluates that against AppProgress; this file stays pure (no engine / no flag store),
## so adding an objective is a DATA row (roadmap G8). The overworld badge + the future
## quest-log scroll (G4) both read this same list.

## active_flag "" means ALWAYS active (until done_flag). done_flag "has_gear" is set once
## both the sword and bow have been collected at home.
static func all() -> Array:
	return [
		{
			# only after the cave-scare (met_skeleton) does he need his weapons -- so the
			# badge/nudge stays dark until then, NOT from the very first house exit.
			"id": "haal_wapens",
			"active_flag": "met_skeleton",
			"done_flag": "has_gear",
			"target_site": "thuis",
			"hint_key": "objective.wapens",
		},
		{
			# after the cave, the newly-open mill holds the miller's bridge tip.
			"id": "vraag_molenaar",
			"active_flag": "met_skeleton",
			"done_flag": "molen_tip",
			"target_site": "molen",
			"hint_key": "objective.molen",
		},
		{
			# fully trained (both weapons) -> go back and beat the skeleton for the crystal.
			"id": "versla_skelet",
			"active_flag": "fully_trained",
			"done_flag": "has_crystal",
			"target_site": "bos",
			"hint_key": "objective.grot",
		},
	]
