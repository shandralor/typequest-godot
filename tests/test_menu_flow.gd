extends SceneTree

## Integration check: the menu navigation wiring (Start -> scenarios -> playing).
## Emits the banners' pressed signal (what a click does) and asserts state.

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
	fail += _check(game._app_state == game.AppState.SCENARIOS, "Start -> scenario menu")
	# pick the scenario
	var sc = _banner(game)
	if sc != null:
		sc.pressed.emit()
	await process_frame
	fail += _check(game._app_state == game.AppState.PLAYING, "scenario -> playing")
	fail += _check(game._run != null and game._run.current_id == "start", "run started at 'start'")
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
