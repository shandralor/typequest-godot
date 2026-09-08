# Island editor blueprint (deferred) -- distilled from the ClaudeCraft map editor

Read of `levy-street/world-of-claudecraft` `src/editor/` at v0.41.4 (2026-09-05, code-only
snapshot at `/mnt/professional/projects/code/world-of-claudecraft-latest-src/`). Purpose: know
what a visual editor for TypeQuest's `IslandDef` would cost, so the decision to build one is
made on a number, not a fear. **Decision so far: do not build it** -- content is authored as
data-as-code (`src/content/island/*.ts`); build the editor only when a non-Claude human must
compose islands. See the memory note `island-grid-map-authoring`.

## What WoC's editor is (and is not)

- A **player custom-map tool** (`/editor`), not the developers' authoring pipeline. Shipped
  content stays data-as-code (~80 modules). The editor edits a separate `MapDoc` and "never
  mutates the imported builtin content".
- **Freeform coordinates, no grid, no snapping.** `MapPlacement = {assetId, x, z, rotY(radians,
  free), scale, collide}`; terrain is procedural + sculpt stamps. There is NO tile equivalent
  of our `tiles: {q, r, t, rot}` -- the hex-grid half is ours (and already exists in
  `src/world/hexGrid.ts`). Shift+wheel rotates in 15-degree steps; 60-degree tile stepping
  is a one-line constant change plus `worldToAxial` snapping.
- Architecture: pure DOM-free `*_core.ts` decision modules + thin DOM consumers, composed by
  `app.ts` (2,566 lines, holds the command bodies). Undo = capped do/undo closure stack;
  batch appends undo as one span; drags coalesce into ONE undo entry 400 ms after the last
  tick; live edits mutate the document, undo restores full snapshots by document index.
- The 3D viewport (~890 lines) constructs the REAL game Sim + Renderer over the working
  document (one `WorldContent` shared by reference via `setActiveWorldContent`), with an
  `editorCam` override slot and a hand-rolled 72-line orbit camera (not OrbitControls, so it
  never fights the renderer). Picking: analytic ground ray-march + `Raycaster` on the placed
  group, nearest anchor within `max(slack, scale*2)`.
- Also: a 2D top-down mode sharing the same tool switch; an asset browser with a 1,257-entry
  generated catalog and an idle-time offscreen thumbnail renderer (~420 lines); three-layer
  persistence (local store / file download / server with optimistic versions); a playtest
  handoff via `sessionStorage` that the game reads once and removes.
- Size: ~9,700 hand-written lines (+7,580 generated catalog).

## Minimal hex `IslandDef` editor -- what to write, what to copy

Scope: place a tile on a cell, rotate in 60-degree steps, place/move/rotate/scale a prop,
undo, save to the IslandDef, live 3D preview reusing the game renderer. A second Vite entry
(`editor.html`) composing the existing scene over a mutable `IslandDef`.

| Module (under `src/editor/`) | LOC | Source |
|---|---|---|
| `island_doc.ts` -- never-throws sanitizer + caps + TS/JSON serializer | ~120 | pattern from `sim/map_doc.ts` |
| `undo_core.ts`, `span_core.ts`, `edit_caps_core.ts`, `camera_axes.ts` | ~130 | copy verbatim |
| `placement_transform_core.ts` (rotate step = PI/3 for tiles, CommitCoalescer) | ~100 | copy, adapt |
| `island_edit_core.ts` -- tileIndexAt (topmost; tiles stack), setTile, rotateTile, pickProp, snapProp via `worldToAxial`, flat ground y=0 | ~150 | ours |
| `island_view.ts` -- index-keyed Object3D view (add/update/removeAt/rebuildAll/setSelected), hex hover cursor, selection ring | ~250 | adapt `render/placed_assets.ts` |
| `3d/viewport.ts` + `3d/editor_camera.ts` -- skeleton, dragMode state machine, plane picking | ~420 | copy skeleton, delete terrain/water/blockers |
| catalog generator (walk `public/assets/kaykit/**.gltf`) + `asset_browser/thumbs` | ~640 | copy, strip uploads/i18n |
| `app.ts` -- tools select/tile/prop/erase, commands, keyboard | ~500 | rewrite small |
| `inspector.ts` + toolbar/topbar/dom/toasts | ~450 | copy trimmed |
| `persist.ts` + `file_io.ts` + dev-only Vite write-back plugin | ~190 | copy shape |
| `playtest.ts` + `takeEditorIsland()` in `main.ts` | ~40 | copy shape |
| `styles.css`, `editor.html`, `editor/main.ts` | ~430 | trimmed copy |

Total: ~2,600-3,000 LOC + ~400 CSS (vs WoC's 9,700).

## Effort

4-6 developer-days for a dev + AI pair with WoC open as reference:
day 1 sanitizer/serializer/catalog/cores; day 2 view + viewport + camera + picking; day 3 tile
and prop tools with coalesced undo; day 4 browser/inspector/persistence/playtest; day 5 polish
(stacked coast-over-water, hero/camera fields, Playwright smoke). +1-2 days for a 2D hex
minimap; +3-5 for product features (server sync, uploads, tutorial) -- skip those.

## The real risks (not editor code)

1. **Save format vs AUTHORED markers.** `IslandDef` has no meta/id/version. Decide whether the
   editor regenerates the authored `.ts` (then the "do not regenerate" convention must allow
   an editor write-back) or emits JSON the `.ts` imports.
2. **Engine direction.** Godot is still the source of truth per `CLAUDE.md`; an editor on the
   Three.js spike only pays off if the web build is the direction of travel. Settle that first.
