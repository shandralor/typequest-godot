class_name MusicPlayer
extends Node

## Background music: a crossfading, shuffled playlist per CONTEXT. This is the
## presentation/audio layer -- NOT the pure logic layer -- so Godot's RNG/clock are
## fine here (it lives in audio/, which the purity guard does not scan).
##
## Drop CC0/royalty-free .ogg (or .mp3/.wav) tracks into
##   res://assets/audio/music/<context>/
## and they play automatically. play_context("menu") fades to a track from that
## folder and advances through the (shuffled) folder as each track ends. A context
## with no folder / no tracks just fades to silence -- never an error.

const MUSIC_DIR := "res://assets/audio/music"
const FADE := 1.5          # crossfade seconds
const MUSIC_DB := -9.0     # playing volume (music sits under the game)
const SILENT_DB := -60.0

## ---- EDIT HERE to control what plays and how it starts, per context ----------
## Each context may set:
##   start       -- filename that plays FIRST every time this context starts
##                  (exact name, e.g. "01 - Quiet Menu.ogg"). Omit = random first.
##   shuffle     -- shuffle the rest of the playlist (default true).
##   intro_skip  -- seconds to seek into the FIRST track when the context starts, so
##                  the opening silence is skipped and music is heard immediately.
## Contexts not listed here just play their folder shuffled from the top.
const CONTEXT_CONFIG := {
	"menu": {"start": "01 - Quiet Menu.ogg", "shuffle": true, "intro_skip": 5.0},
	"overworld": {"shuffle": true},
	"adventure": {"shuffle": true},
}
## ------------------------------------------------------------------------------

var _a: AudioStreamPlayer
var _b: AudioStreamPlayer
var _active: AudioStreamPlayer
var _context := ""
var _playlist: Array = []   # Array of { name: String, stream: AudioStream }
var _idx := 0
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	_rng.randomize()
	_a = _make_player()
	_b = _make_player()
	_active = _a


func _make_player() -> AudioStreamPlayer:
	var p := AudioStreamPlayer.new()
	p.volume_db = SILENT_DB
	p.bus = "Master"
	p.finished.connect(_on_track_finished.bind(p))
	add_child(p)
	return p


## Fade to a track for `context`. No-op if already playing that context.
func play_context(context: String) -> void:
	if context == _context:
		return
	_context = context
	var cfg: Dictionary = CONTEXT_CONFIG.get(context, {})
	_playlist = _load_playlist(context)
	if _playlist.is_empty():
		_fade_out(_active)   # no tracks for this context -> silence
		return
	if cfg.get("shuffle", true):
		_shuffle(_playlist)
	# an explicit start track jumps to the front (played first every time)
	var start_name: String = cfg.get("start", "")
	if start_name != "":
		for i in _playlist.size():
			if _playlist[i].name == start_name:
				var e = _playlist.pop_at(i)
				_playlist.push_front(e)
				break
	_idx = 0
	_crossfade_to(_playlist[_idx].stream, cfg.get("intro_skip", 0.0))


func _load_playlist(context: String) -> Array:
	var dir := "%s/%s" % [MUSIC_DIR, context]
	var out: Array = []
	if not DirAccess.dir_exists_absolute(ProjectSettings.globalize_path(dir)):
		return out
	for f in DirAccess.get_files_at(dir):
		if f.ends_with(".import"):
			continue
		if f.get_extension().to_lower() in ["ogg", "mp3", "wav"]:
			var stream = load("%s/%s" % [dir, f])
			if stream is AudioStream:
				if stream is AudioStreamOggVorbis or stream is AudioStreamMP3:
					stream.loop = false   # the playlist handles advancing between tracks
				out.append({"name": f, "stream": stream})
	return out


func _crossfade_to(stream: AudioStream, seek: float = 0.0) -> void:
	var incoming := _b if _active == _a else _a
	var outgoing := _active
	incoming.stream = stream
	incoming.volume_db = SILENT_DB
	incoming.play(max(0.0, seek))
	var t := create_tween().set_parallel()
	t.tween_property(incoming, "volume_db", MUSIC_DB, FADE)
	t.tween_property(outgoing, "volume_db", SILENT_DB, FADE)
	t.chain().tween_callback(outgoing.stop)
	_active = incoming


func _fade_out(p: AudioStreamPlayer) -> void:
	var t := create_tween()
	t.tween_property(p, "volume_db", SILENT_DB, FADE)
	t.tween_callback(p.stop)


func _on_track_finished(p: AudioStreamPlayer) -> void:
	# only the currently-active track advances the playlist; a stopped/outgoing
	# player never reaches here (stop() does not emit finished)
	if p != _active or _playlist.is_empty():
		return
	_idx = (_idx + 1) % _playlist.size()
	_crossfade_to(_playlist[_idx].stream)


func _shuffle(arr: Array) -> void:
	for i in range(arr.size() - 1, 0, -1):
		var j := _rng.randi_range(0, i)
		var tmp = arr[i]
		arr[i] = arr[j]
		arr[j] = tmp
