extends SceneTree

## Pure tests for the render-facing logic helpers: the reveal window (B5) and the
## SceneActivity hysteresis tracker (B3). Both are pure (time is injected).
## Run: godot --headless --script res://tests/test_render_logic.gd

const RevealWindow = preload("res://logic/reveal_window.gd")
const SceneActivity = preload("res://logic/scene_activity.gd")

var _fail := 0


func _check(cond: bool, msg: String) -> void:
	if cond:
		print("OK   ", msg)
	else:
		_fail += 1
		print("FAIL ", msg)


func _initialize() -> void:
	_test_reveal()
	_test_activity()
	print("test_render_logic: %d failures" % _fail)
	quit(_fail)


func _test_reveal() -> void:
	var prose := "de kleine ridder loopt door het bos."
	var e := RevealWindow.visible_end(prose, 0, 2)
	_check(prose.substr(0, e).begins_with("de kleine ridder"), "reveals cursor word + 2 ahead")
	_check(e < prose.length(), "hides the tail (not the whole passage)")
	_check(RevealWindow.visible_end(prose, 0, 99) == prose.length(), "large window reveals all")
	# already-typed stays visible regardless of window
	_check(RevealWindow.visible_end(prose, 10, 1) >= 10, "window never retreats behind the cursor")


func _test_activity() -> void:
	var t = SceneActivity.Tracker.new()
	_check(t.update(0.0, 0.1) == SceneActivity.Activity.IDLE, "starts idle")
	_check(t.update(0.1, 0.1) == SceneActivity.Activity.MOVING, "progress advance -> moving")
	_check(t.update(0.1, 0.1) == SceneActivity.Activity.MOVING, "no advance, small dt -> still moving (hysteresis)")
	t.update(0.1, 0.5)
	_check(t.activity == SceneActivity.Activity.IDLE, "idle after the hysteresis window")
	_check(t.update(1.0, 0.1) == SceneActivity.Activity.ARRIVED, "progress 1 -> arrived")
