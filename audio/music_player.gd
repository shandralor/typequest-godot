class_name MusicPlayer
extends Node

## Background music: a crossfading, shuffled playlist per CONTEXT. This is the
## presentation/audio layer -- NOT the pure logic layer -- so Godot's RNG/clock are
## fine here (it lives in audio/, which the purity guard does not scan).
##
## Drop CC0/royalty-free .ogg (or .mp3/.wav) tracks into
##   res://assets/audio/music/<context>/
## and they play automatically. play_context("menu") fades to a random track from
## that folder and advances through the (shuffled) folder as each track ends. A
## context with no folder / no tracks just fades to silence -- never an error.

const MUSIC_DIR := "res://assets/audio/music"
const FADE := 1.5          # crossfade seconds
const MUSIC_DB := -9.0     # playing volume (music sits under the game)
const SILENT_DB := -60.0

var _a: AudioStreamPlayer
var _b: AudioStreamPlayer
var _active: AudioStreamPlayer
var _context := ""
var _playlist: Array = []   # Array[AudioStream]
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
	_playlist = _load_playlist(context)
	if _playlist.is_empty():
		_fade_out(_active)   # no tracks for this context -> silence
		return
	_shuffle(_playlist)
	_idx = 0
	_crossfade_to(_playlist[_idx])


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
				out.append(stream)
	return out


func _crossfade_to(stream: AudioStream) -> void:
	var incoming := _b if _active == _a else _a
	var outgoing := _active
	incoming.stream = stream
	incoming.volume_db = SILENT_DB
	incoming.play()
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
	_crossfade_to(_playlist[_idx])


func _shuffle(arr: Array) -> void:
	for i in range(arr.size() - 1, 0, -1):
		var j := _rng.randi_range(0, i)
		var tmp = arr[i]
		arr[i] = arr[j]
		arr[j] = tmp
