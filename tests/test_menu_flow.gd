extends SceneTree

## Integration check: the shell navigation wiring. Start -> the OVERWORLD island;
## typing a site word starts the travel; travel completion starts the scenario.
## Also checks the prefix rules: a locked site's word is rejected where it diverges
## from unlocked words, and shared prefixes (bos/boog) never shadow a site.

func _initialize() -> void:
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
	fail += _check(game._ow_banners.size() == 3, "three site banners on the island")
	fail += _check(game._ow_candidates.size() == 2, "two unlocked sites (boog is a teaser)")
	# locked teaser: 'boo' (only boog's prefix) is rejected at the divergence
	for c in ["b", "o"]:
		game._ow_char(c)
	game._ow_char("o")   # 'boo' matches only the LOCKED boog -> rejected
	fail += _check(game._ow_buffer == "bo", "locked site word rejected at divergence")
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
