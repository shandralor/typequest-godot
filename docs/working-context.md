# Working context (LIVE)

Update this at the end of every session: current state + next step. This plus
CLAUDE.md is how another device picks up the work (git pull -> read these).

## Current state (2026-06-27)

**Milestone 1 -- COMPOSITION LOOP -- DONE and awaiting human judgment.**

The deliberately-first deliverable (brief Section 9) is built: one band-1 scene
(`start`, forest_path) composed in the Godot editor from a scene descriptor
resolved through the asset vocabulary, with real CC0 KayKit models. Open
`scenes/start.tscn` in the editor to judge it; press F5 to see the knight walk the
path. A reference render is at `.shots/start.png` (gitignored).

What exists:
- `logic/scene_descriptor.gd` -- pure SceneDescriptor + ActorPlacement/PropPlacement.
- `content/band1/scene_descriptors.gd` -- the `start` scene descriptor only.
- `axis/vocabulary/fantasy_poc.gd` -- id -> KayKit resource (hero, skeleton, chest,
  chest_gold, bridge). Locations are composed, not single models.
- `render/scene_composer.gd` -- imperative composer: builds forest_path (ground +
  dirt path + named anchors + deterministic foliage scatter), mood lighting, places
  actors/props on anchors, walks the protagonist (B4 exception), RED placeholder for
  unknown ids.
- `scenes/start.{tscn,gd}` -- @tool harness; composes live in the editor and on run.
  Set as `run/main_scene`.
- `assets/kaykit/**` -- 7 CC0 packs, gltf/glb + atlas only (507 models). See CREDITS.md.

Deliberately NOT done this milestone (per brief Section 9 + this session's decision
to go scene-first): the logic port (story-graph traversal, typing compare/stats,
scoring, FNV-1a safety hash + A7 hash verification, seeded RNG, progress primitive),
the nl-BE locale catalog, the Belgian AZERTY layout table, the type-along UI / reveal
window / finger guidance, profiles, and the remaining scenes.

## Next step

Wait for the human to open `scenes/start.tscn` and judge whether the editor
composition loop is the productivity win this migration is betting on. THAT judgment
gates everything. Do not build more scenes or the UI before it.

If judged good, the next milestone is the logic port (brief Bucket B2/B6/B7/B8 +
content A7): pure GDScript, no engine refs, and verify the six band-1 safety hashes
against the imported prose -- if any FAILS, fix the prose to be byte-identical, never
recompute the hash (brief A4).

## Open decisions / watch-items

- Hero is `Mannequin_Medium` as a knight stand-in (no knight in the free packs).
  Revisit if a proper knight model is wanted.
- Hero facing: `facing: camera` currently maps to rotation.y = 0; confirm the
  KayKit forward axis when judging (may need a 180 flip to truly face the camera).
- ~34MB of binary art committed to git; Git LFS is a later option if history bloats.
- All brief Section 6-7 open questions still stand; they live in
  `docs/MIGRATION-TO-GODOT.md` (do not re-litigate).
