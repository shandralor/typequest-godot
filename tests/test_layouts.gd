extends SceneTree

## Keyboard-layout axis guard. Each supported layout (AZERTY, QWERTY) must:
##  - round-trip every character: guidance_for_char(c).position -> char_at_position
##    gives back c (the position/char maps are consistent, no dupes/typos);
##  - produce the SAME character set (a-z + space + period) so the SAME prose is
##    typeable on either -- swapping layouts never makes content untypeable (A3);
##  - expose on-screen keyboard rows that cover exactly the 26 letters, once each;
##  - keep f/j as the home-row anchor (A1/A8).
## Also checks that all real content prose is typeable on every layout.
## Run: godot --headless --script res://tests/test_layouts.gd

const AZERTY = preload("res://axis/layout/be_azerty.gd")
const QWERTY = preload("res://axis/layout/qwerty.gd")
const Band1Arc = preload("res://content/band1/band1_arc.gd")
const GrindArc = preload("res://content/grind/grind_arc.gd")
const ArcheryArc = preload("res://content/archery/archery_arc.gd")
const LocaleNlBe = preload("res://axis/locale/nl_be.gd")

const ALPHABET := "abcdefghijklmnopqrstuvwxyz"

var _fail := 0


func _initialize() -> void:
	var layouts := {"azerty": AZERTY, "qwerty": QWERTY}
	for name in layouts:
		_check_layout(name, layouts[name])
	_check_same_charset()
	_check_content_typeable(layouts)
	print("test_layouts: %d failures" % _fail)
	quit(_fail)


func _check_layout(name: String, L) -> void:
	# round-trip every letter + space + period
	for ch in (ALPHABET + " .").split("", false):
		var g: Dictionary = L.guidance_for_char(ch)
		if g.is_empty():
			_bad("%s: char '%s' has no guidance" % [name, ch])
			continue
		var back: String = L.char_at_position(g.position)
		if back != ch:
			_bad("%s: '%s' -> pos %s -> '%s' (round-trip broken)" % [name, ch, g.position, back])
	# f/j anchor
	if L.guidance_for_char("f").is_home_anchor != true or L.guidance_for_char("j").is_home_anchor != true:
		_bad("%s: f/j are not both home anchors" % name)
	# keyboard rows cover each letter exactly once
	var seen := {}
	for row in L.keyboard_rows():
		for ch in row:
			if seen.has(ch):
				_bad("%s: keyboard row letter '%s' appears twice" % [name, ch])
			seen[ch] = true
	for ch in ALPHABET.split("", false):
		if not seen.has(ch):
			_bad("%s: keyboard rows miss letter '%s'" % [name, ch])


func _check_same_charset() -> void:
	# every alphabet letter is typeable on BOTH layouts (swap never breaks content)
	for ch in (ALPHABET + " .").split("", false):
		if not AZERTY.supports_text(ch) or not QWERTY.supports_text(ch):
			_bad("charset mismatch: '%s' not typeable on both layouts" % ch)


func _check_content_typeable(layouts: Dictionary) -> void:
	var locale = LocaleNlBe.new()
	for graph in [Band1Arc.build(), GrindArc.build(), ArcheryArc.build()]:
		for id in graph.nodes:
			var prose: String = locale.resolve(graph.nodes[id].prose_key)
			for name in layouts:
				if not layouts[name].supports_text(prose):
					_bad("%s: node '%s' prose not typeable" % [name, id])


func _bad(msg: String) -> void:
	_fail += 1
	print("FAIL ", msg)
