# Godot tree -- REFERENCE ONLY

This is the Godot 4.7 implementation of TypeQuest. It is **no longer the live build**:
on 2026-09-09 the project moved to the Three.js/TypeScript build in `web/`, which is
faster in the browser and is what ships. Nothing here is built, exported or released by
CI any more.

It is kept because it is the best specification we have. When you port a behaviour to
`web/`, read the `.gd` here and carry its constants **verbatim** rather than re-deriving
them -- that is how the camera rigs, finger colours, nail geometry and scoring stayed
identical. Do not "improve" a value on the way across; a mismatch is a porting bug.

Where things are: `game/game_controller.gd` (the state machine), `render/scene_composer.gd`
(staging), `ui/` (the HUD, keyboard guide and finger legend), `axis/` (locale + keyboard
layouts), `logic/` (the pure core), `content/` (the arcs + hashes), `scenes/sets/` (the
authored `.tscn` sets). `docs/godot-handoff.md` at the repo root is the full guide.

Running it: `godot --path godot` (Godot 4.7), tests `cd godot && bash tests/run.sh`.
`godot/assets` is a symlink to the repo-root `assets/`, the shared art store the web
build also reads -- do not replace it with a copy.

Older history: the pure Godot tree, before the web build landed on `main`, is preserved
on the `godot-reference` branch.
