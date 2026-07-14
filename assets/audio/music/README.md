# Music

Background music, grouped by CONTEXT (one folder per context). The in-game player
(`audio/music_player.gd`) shuffles a folder and crossfades between its tracks as each
one ends. Add or remove `.ogg` (preferred), `.mp3`, or `.wav` files here -- no code
change needed. An empty/missing context folder just plays silence.

Contexts:
- `menu/` -- the main menu.
- `overworld/` -- the hex island (scenario picker).
- `adventure/` -- while playing a scenario.

To add a context, make a folder here and call `play_context("<name>")` from
`game/game_controller.gd`.

To pick WHICH track starts, or to skip the opening silence, edit `CONTEXT_CONFIG` at
the top of `audio/music_player.gd`: per context you can set `start` (exact filename to
play first every time), `shuffle` (default true), and `intro_skip` (seconds to seek
into the first track -- the menu uses 5s because most tracks open on silence).

## Source & license

**AlkaKrab -- *50 Fantasy Open World RPG Tracks*** (https://alkakrab.itch.io).
Royalty-free / 100% copyright-free -- free to use in commercial games, no attribution
required. We credit anyway (see `/CREDITS.md` and `/README.md`) to give the artist
exposure. A curated calm/exploration selection is bundled; the full pack (65 tracks,
11 mood categories) lives in the shared `game-dev/_music-assets/` library.
