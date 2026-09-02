class_name OverworldSites
extends RefCounted

## The overworld's adventure sites: pure DATA (no engine refs). Each site is a
## spot on the island the child travels to by TYPING its word. `anchor` and
## `route` name the Marker3D / Path3D authored in scenes/sets/overworld.tscn;
## `scenario` is the Scenarios id started on arrival.
##
## `unlocked` is a plain flag for now (picker-first); once profiles (A5) exist it
## becomes derived from stars/XP without changing this shape. A site with an empty
## scenario is a TEASER: shown greyed on the map, not selectable.
##
## Optional gating keys (all AppProgress flags): `unlock_flag` hard-locks the site until
## set (earned progression); `requires_flag` + `hint_key` soft-gate it (unlocked but hints
## to fetch gear first); `done_flag` marks the site's objective complete -- the site stays
## replayable for practice but a revisit shows a gentle "al gedaan" beat first.
##
## Site words are owner-approved one by one (2026-07-02: bos, smidse, boog;
## 2026-07-16: thuis -- the revisitable house, reuses scenes/sets/house.tscn).

static func sites() -> Array:
	return [
		{"id": "bos", "word_key": "site.bos", "scenario": "band1",
			"anchor": "site_bos", "route": "route_bos", "unlocked": true},
		{"id": "smidse", "word_key": "site.smidse", "scenario": "grind",
			"anchor": "site_smidse", "route": "route_smidse", "unlocked": true,
			"unlock_flag": "met_skeleton", "requires_flag": "has_sword", "hint_key": "hint.smidse",
			"done_flag": "sword_sharp"},
		{"id": "boog", "word_key": "site.boog", "scenario": "archery",
			"anchor": "site_boog", "route": "route_boog", "unlocked": true,
			"unlock_flag": "met_skeleton", "requires_flag": "has_ranged", "hint_key": "hint.boog",
			"done_flag": "archery_done"},
		{"id": "thuis", "word_key": "site.thuis", "scenario": "home",
			"anchor": "site_home", "route": "route_home", "unlocked": true,
			"unlock_flag": "met_skeleton"},
		{"id": "molen", "word_key": "site.molen", "scenario": "mill",
			"anchor": "site_molen", "route": "route_molen", "unlocked": true,
			"unlock_flag": "met_skeleton", "done_flag": "molen_tip"},
	]
