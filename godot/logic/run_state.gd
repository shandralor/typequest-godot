class_name RunState
extends RefCounted

## Traversal + per-run accumulation over a StoryGraph (brief A6/A7/A9). Pure: no
## Node, no Input, no render. A locale is injected to resolve choice words.
##
## Accumulation rules (A6, app-level): XP adds; stars keep the BEST per node; a
## node is "completed" when typed (stars >= 1); score each node AT MOST ONCE per
## run (the cave can bounce back to the fork, so revisiting must not farm XP).
##
## Setback returnTo (A9): a non-win ending resumes the run at its return_to with
## progress intact -- a wrong turn scares-and-bounces, it does not restart.
##
## Pre-revealed beats (A9): produce NO score at all and the scoring path is NEVER
## invoked for them (no keystrokes happened).

const Scoring = preload("res://logic/scoring.gd")

var graph                       # StoryGraph
var locale                      # locale instance with resolve(key) -> String
var current_id: String = ""

var xp: int = 0
var stars_by_node: Dictionary = {}     # id -> best stars
var completed_ids: Dictionary = {}     # id -> true (set)
var _scored_this_run: Dictionary = {}  # id -> true (score-once-per-run set)


func _init(p_graph, p_locale) -> void:
	graph = p_graph
	locale = p_locale
	current_id = p_graph.start_id


func current():
	return graph.get_node_by_id(current_id)


## Resolved prose for the current node (the typing target / hash subject).
func current_prose() -> String:
	var node = current()
	if node == null or node.prose_key == "":
		return ""
	return locale.resolve(node.prose_key)


## Pick a fork by the typed (resolved) choice word. Advances current_id on a
## match. Returns { ok: bool, target: String, hint: String }.
func choose(typed_word: String, get_flag: Callable = Callable()) -> Dictionary:
	var node = current()
	if node != null:
		for ch in node.choices:
			if locale.resolve(ch.word_key) != typed_word:
				continue
			if get_flag.is_valid() and not ch.is_available(get_flag):
				continue   # a gated option, not selectable yet
			var tgt: String = ch.resolved_target(get_flag) if get_flag.is_valid() else ch.target
			current_id = tgt
			return {"ok": true, "target": tgt, "hint": ch.hint}
	return {"ok": false, "target": "", "hint": ""}


## Resolve an ending node. Returns one of:
##   { type: "none" }                      -- not an ending
##   { type: "setback", to: <id> }         -- bounce to return_to, progress intact
##   { type: "win" } / { type: "neutral" } -- terminal ending
func resolve_ending() -> Dictionary:
	var node = current()
	if node == null or not node.is_ending():
		return {"type": "none"}
	if node.return_to != "":
		current_id = node.return_to
		return {"type": "setback", "to": node.return_to}
	return {"type": node.ending}


## Score the current beat and fold it into accumulated progress. Honors:
##   - pre-revealed -> never scored (returns skipped, no scoring call);
##   - score-once-per-run -> a revisit returns already_scored with no effect.
## Returns the scoring result plus a status flag.
func score_current(correct_chars: int, accuracy: float, completed: bool) -> Dictionary:
	var node = current()
	if node == null:
		return {"xp": 0, "stars": 0, "status": "no_node"}
	if node.prerevealed:
		return {"xp": 0, "stars": 0, "status": "prerevealed"}
	if _scored_this_run.has(node.id):
		return {"xp": 0, "stars": 0, "status": "already_scored"}
	_scored_this_run[node.id] = true
	var result = Scoring.score(completed, correct_chars, accuracy)
	xp += result.xp
	var best: int = stars_by_node.get(node.id, 0)
	if result.stars > best:
		stars_by_node[node.id] = result.stars
	if result.stars >= 1:
		completed_ids[node.id] = true
	return {"xp": result.xp, "stars": result.stars, "status": "scored"}


## Coarse progress snapshot (shape mirrors the brief A5 Progress record; the
## profile store persists this later).
func progress_snapshot() -> Dictionary:
	return {
		"xp": xp,
		"starsByNode": stars_by_node.duplicate(),
		"completedNodeIds": completed_ids.keys(),
		"band": "band-1",
	}
