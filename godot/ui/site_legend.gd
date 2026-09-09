class_name SiteLegend
extends PanelContainer

## Right-side colour key for the overworld sites -- replaces the floating map banners.
## One coloured pill per site (its background is the site's map-flag colour) with the typed
## word on it, so the island itself stays clear of text. Highlights the pills the typed
## prefix matches, greys locked sites, and shows a "!" badge when a site has an open
## objective. Pure view: the controller builds it once per overworld entry, then calls
## set_prefix() as keys land.

const PILL_W := 240.0
const TEXT := Color("fdf5e6")
const TEXT_LOCKED := Color(0.82, 0.80, 0.76, 0.6)

var _pills := {}   # site_id -> { root: PanelContainer, sb: StyleBoxFlat, word: String, locked: bool }
var _vbox: VBoxContainer


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	# a subtle dark backing so the pills read against any 3D scene behind them
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.06, 0.05, 0.04, 0.34)
	sb.set_corner_radius_all(16)
	sb.content_margin_left = 14
	sb.content_margin_right = 14
	sb.content_margin_top = 14
	sb.content_margin_bottom = 14
	add_theme_stylebox_override("panel", sb)


## Build the rows. specs: [{ id, word, color: Color, locked: bool, badge: bool }] in order.
func build(specs: Array) -> void:
	if _vbox != null:
		_vbox.queue_free()
	_pills.clear()
	_vbox = VBoxContainer.new()
	_vbox.add_theme_constant_override("separation", 10)
	_vbox.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_vbox)
	for spec in specs:
		_add_pill(spec)


func _add_pill(spec: Dictionary) -> void:
	var color: Color = spec.color
	var locked: bool = spec.get("locked", false)
	var pill := PanelContainer.new()
	pill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	pill.custom_minimum_size = Vector2(PILL_W, 0.0)
	var sb := StyleBoxFlat.new()
	sb.bg_color = _pill_bg(color, locked)
	sb.set_corner_radius_all(12)
	sb.content_margin_left = 18
	sb.content_margin_right = 18
	sb.content_margin_top = 9
	sb.content_margin_bottom = 9
	sb.set_border_width_all(3)
	sb.border_color = Color(1, 1, 1, 0)   # highlight ring, invisible until the prefix matches
	pill.add_theme_stylebox_override("panel", sb)

	var row := HBoxContainer.new()
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	pill.add_child(row)

	var label := Label.new()
	label.text = spec.word
	label.add_theme_font_size_override("font_size", 30)
	label.add_theme_color_override("font_color", TEXT_LOCKED if locked else TEXT)
	label.add_theme_color_override("font_outline_color", Color(0.1, 0.07, 0.04))
	label.add_theme_constant_override("outline_size", 6)
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(label)

	if spec.get("badge", false):
		var badge := Label.new()
		badge.text = "!"
		badge.add_theme_font_size_override("font_size", 30)
		badge.add_theme_color_override("font_color", Color("ffe08a"))
		badge.add_theme_color_override("font_outline_color", Color(0.1, 0.07, 0.04))
		badge.add_theme_constant_override("outline_size", 6)
		badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
		row.add_child(badge)

	_vbox.add_child(pill)
	_pills[spec.id] = {"root": pill, "sb": sb, "word": String(spec.word), "locked": locked}


# Locked pills desaturate toward a dark grey so "not yet open" reads at a glance.
func _pill_bg(color: Color, locked: bool) -> Color:
	if locked:
		var g: float = color.get_luminance()
		return Color(g, g, g).lerp(Color(0.2, 0.2, 0.22), 0.55)
	return color


## Highlight the pills whose word the typed buffer is a prefix of. Empty buffer -> all
## unlocked pills at rest; locked ones always stay greyed.
func set_prefix(buffer: String) -> void:
	for id in _pills:
		var p: Dictionary = _pills[id]
		var sb: StyleBoxFlat = p.sb
		if p.locked:
			p.root.modulate = Color(1, 1, 1, 0.6)
			sb.border_color = Color(1, 1, 1, 0)
		elif buffer == "":
			p.root.modulate = Color.WHITE
			sb.border_color = Color(1, 1, 1, 0)
		elif String(p.word).begins_with(buffer):
			p.root.modulate = Color.WHITE
			sb.border_color = Color(1, 1, 1, 0.95)   # bright ring on the live match
		else:
			p.root.modulate = Color(1, 1, 1, 0.42)   # dim the non-matches
			sb.border_color = Color(1, 1, 1, 0)
