extends SceneTree

## Behaviour tests for the pure logic layer: scoring (A6), typing/progress (B7),
## traversal + setback + score-once-per-run (A7/A9).
## Run: godot --headless --script res://tests/test_logic.gd

const Scoring = preload("res://logic/scoring.gd")
const TypingState = preload("res://logic/typing.gd")
const RunState = preload("res://logic/run_state.gd")
const Band1Arc = preload("res://content/band1/band1_arc.gd")
const LocaleNlBe = preload("res://axis/locale/nl_be.gd")

var _fail := 0


func _check(cond: bool, msg: String) -> void:
	if cond:
		print("OK   ", msg)
	else:
		_fail += 1
		print("FAIL ", msg)


func _initialize() -> void:
	_test_scoring()
	_test_typing()
	_test_traversal()
	print("test_logic: %d failures" % _fail)
	quit(_fail)


func _test_scoring() -> void:
	var perfect = Scoring.score(true, 10, 1.0)
	_check(perfect.xp == 30, "perfect 10 chars -> xp 30 (got %d)" % perfect.xp)
	_check(perfect.stars == 3, "perfect -> 3 stars (got %d)" % perfect.stars)

	_check(Scoring.score(true, 10, 0.84).stars == 1, "acc 0.84 -> 1 star")
	_check(Scoring.score(true, 10, 0.85).stars == 2, "acc 0.85 -> 2 stars")
	_check(Scoring.score(true, 10, 0.95).stars == 3, "acc 0.95 -> 3 stars")

	var not_done = Scoring.score(false, 10, 1.0)
	_check(not_done.stars == 0, "not completed -> 0 stars")
	_check(not_done.xp == 10, "not completed -> no completion bonus (xp 10, got %d)" % not_done.xp)

	var sloppy = Scoring.score(true, 10, 0.0)
	_check(sloppy.xp == 25, "accuracy floor keeps half volume (xp 25, got %d)" % sloppy.xp)
	_check(sloppy.stars == 1, "completed sloppy still 1 star")

	# fast-sloppy-cannot-win (A6): speed is not even a parameter, so two runs equal
	# in accuracy + correct-char count score IDENTICALLY regardless of speed.
	var a = Scoring.score(true, 20, 0.9)
	var b = Scoring.score(true, 20, 0.9)
	_check(a.xp == b.xp and a.stars == b.stars, "fast-sloppy-cannot-win: equal acc+chars -> identical score")


func _test_typing() -> void:
	var ts := TypingState.new("abc")
	ts.type_char("a"); ts.type_char("b"); ts.type_char("c")
	_check(ts.is_complete(), "typed full target -> complete")
	_check(is_equal_approx(ts.progress(), 1.0), "complete -> progress 1")
	_check(ts.correct_chars() == 3, "3 correct chars")
	_check(is_equal_approx(ts.accuracy(), 1.0), "no errors -> accuracy 1")

	var errs := TypingState.new("ab")
	errs.type_char("x"); errs.type_char("a"); errs.type_char("b")
	_check(errs.correct_chars() == 2, "wrong key does not advance (2 correct)")
	_check(is_equal_approx(errs.accuracy(), 2.0 / 3.0), "accuracy = correct/typed = 2/3")

	var empty := TypingState.new("")
	_check(empty.is_complete() and is_equal_approx(empty.progress(), 1.0), "empty target reads complete (progress 1)")

	var mid := TypingState.new("abcd")
	mid.type_char("a"); mid.type_char("b")
	_check(is_equal_approx(mid.progress(), 0.5), "halfway -> progress 0.5")


func _test_traversal() -> void:
	var run := RunState.new(Band1Arc.build(), LocaleNlBe.new())
	_check(run.current_id == "start", "starts at 'start'")

	# score start once, then again -> second is a no-op (score-once-per-run, A6)
	var first = run.score_current(60, 1.0, true)
	_check(first.status == "scored", "start scores first time")
	var xp_after_first := run.xp
	var second = run.score_current(60, 1.0, true)
	_check(second.status == "already_scored", "start does not score twice in a run")
	_check(run.xp == xp_after_first, "revisit does not farm XP")

	# fork to the cave
	_check(run.choose("verder").ok, "type 'verder' -> kruispunt")
	_check(run.current_id == "kruispunt", "now at kruispunt")
	_check(run.choose("grot").ok, "type 'grot' -> grot")
	_check(run.current_id == "grot", "now at grot (the cave-scare beat)")

	# campaign v2: the cave is a terminal WIN that is NOT celebrated (he flees to
	# train). It sets met_skeleton, which later unlocks the smidse/boog + the bridge.
	var grot_node = run.current()
	_check(grot_node.ending == "win", "grot is a win ending")
	_check(not grot_node.celebrate, "grot win is not celebrated (a somber flee)")
	_check(grot_node.sets_flag == "met_skeleton", "grot sets met_skeleton")
	var ending = run.resolve_ending()
	_check(ending.type == "win", "grot resolves as a win (no bounce)")

	# the safe bridge -> treasure path (a later, armed visit; the flag gate lives in
	# the controller, so the pure-logic traversal reaches it directly).
	var run2 := RunState.new(Band1Arc.build(), LocaleNlBe.new())
	_check(run2.choose("verder").ok, "run2: type 'verder' -> kruispunt")
	_check(run2.choose("brug").ok, "type 'brug' -> brug")
	_check(run2.current_id == "brug", "now at brug (the crossing)")
	var brug_node = run2.current()
	_check(brug_node.ending == "win" and brug_node.exit_walk, "brug is an exit-walk win")
	_check(run2.resolve_ending().type == "win", "brug crossing resolves as a win")
