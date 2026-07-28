extends SceneTree

## Integration check: the shell navigation wiring. Start -> the OVERWORLD island;
## typing a site word starts the travel; travel completion starts the scenario.
## Also checks the prefix rules: a key matching no site word is rejected, and
## shared prefixes (bos/boog) never shadow a site.

func _initialize() -> void:
	# pretend the intro was already seen so Start goes straight to the island (the
	# intro-first path is a separate flow); transient -> no disk write.
	load("res://game/app_progress.gd").set_intro_seen_transient(true)
	# pretend a hero was already picked so Start goes straight to the island (the first-run
	# character picker is a separate flow); transient -> no disk write.
	load("res://game/app_progress.gd").set_choice_transient("hero_chosen", "1")
	var game = load("res://scenes/game.tscn").instantiate()
	get_root().add_child(game)
	await process_frame
	await process_frame
	var fail := 0
	# main menu present
	var start = _banner(game)
	if start == null:
		print("FAIL  no Start banner"); quit(1); return
	start.pressed.emit()
	await process_frame
	fail += _check(game._app_state == game.AppState.OVERWORLD, "Start -> overworld")
	fail += _check(game._legend != null and game._legend._pills.size() == 5, "five site pills in the legend")
	fail += _check(game._ow_candidates.size() == 5, "five sites (bos/smidse/boog/thuis/molen)")
	# a gated training site (boog needs the bow collected first) hints, does not travel
	load("res://game/app_progress.gd").set_flag_transient("has_bow", false)
	for c in ["b", "o", "o", "g"]:
		game._ow_char(c)
	fail += _check(game._ow_walk == null, "gated 'boog' (no bow) does not travel")
	fail += _check(game._ow_buffer == "", "gated site clears the buffer (hint shown)")
	# a key matching no site word is rejected (buffer unchanged)
	game._ow_char("x")
	fail += _check(game._ow_buffer == "", "non-matching key rejected")
	# shared prefix bos/boog: 'bo' is ambiguous (buffered, no site shadowed yet)
	for c in ["b", "o"]:
		game._ow_char(c)
	fail += _check(game._ow_buffer == "bo", "shared prefix 'bo' buffered")
	# completing 'bos' starts the travel to the forest
	game._ow_char("s")
	fail += _check(game._ow_walk != null, "typing 'bos' starts the travel")
	fail += _check(game._ow_walk.site.scenario == "band1", "travel targets band1")
	# fast-forward the walk deterministically
	var guard := 0
	while game._ow_walk != null and guard < 200:
		game._ow_walk_tick(0.25)
		guard += 1
	fail += _check(game._app_state == game.AppState.PLAYING, "arrival -> playing")
	fail += _check(game._run != null and game._run.current_id == "start", "run started at 'start'")
	fail += _check(game._ow_at == "site_bos", "hero remembered at the bos site")
	print("test_menu_flow: %d failures" % fail)
	quit(fail)

func _banner(game):
	if game._menu_screen == null:
		return null
	for c in game._menu_screen.get_node("Items").get_children():
		if c.has_signal("pressed"):
			return c
	return null

func _check(cond, msg) -> int:
	print(("OK   " if cond else "FAIL ") + msg)
	return 0 if cond else 1
