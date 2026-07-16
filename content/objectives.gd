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

static func all() -> Array:
	return [
		{
			"id": "haal_je_boog",
			"active_flag": "archery_done",
			"done_flag": "has_bow_a",
			"target_site": "thuis",
			"hint_key": "objective.boog",
		},
	]
