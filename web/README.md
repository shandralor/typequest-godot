# TypeQuest — Three.js rebuild spike

A de-risking spike for the Godot → Three.js rebuild (see the scoping doc). Lives on the
`threejs-spike` branch alongside the intact Godot project — nothing Godot is touched.

## Phase 1 (done): the brain ports faithfully

The pure logic + content + data ported to TypeScript, verified by the same tests the Godot
build passes — including the byte-identical FNV-1a safety hashes.

```
cd web
npm install
npm test        # 15 tests: FNV hashes, content validator, layouts, traversal/scoring/typing
npm run typecheck
```

- `src/logic/` — fnv1a, typing, scoring, storyGraph, runState, sceneDescriptor, contentValidator
- `src/axis/` — nl-BE locale, AZERTY/QWERTY layouts, asset vocabulary
- `src/content/` — the band-1 arc, scene descriptors, band spec, characters
- `src/tests/` — the gate

The `fnv1a` test reproducing the A7 reference hashes and the content validator reporting zero
problems together prove the port is byte-faithful to the Godot version.

## Phase 2 (next): one scene with real graphics

Stand up Vite + Three.js, render the overworld, and apply the rendering + grounding recipe in
`docs/woc-playbook.md` (distilled from world-of-claudecraft — same stack, same asset style) to
prove the web finally has depth. That is the go/no-go gate for the whole rebuild.

## Scene editor (`/editor.html`, dev server only)

Every story set is data-as-code -- a `SceneDef` in `src/content/scenes/*.ts` (the overworld in
`src/content/island/overworld.ts`): hex tiles, props, primitive shapes, named anchors, camera,
routes, lights. The editor is a pen for those files, not a second source of truth: it edits a
working copy on the REAL renderer and writes the authored `.ts` back through a dev-only Vite
endpoint. Migrated from the Godot sets by `tools/tscn_to_scene.py` (zero drops; the mill's two
CSG polygons are the only unsupported nodes).

```
./editor.sh              # from the repo root -- starts the dev server, opens the editor
cd web && npm run editor # same
```

- **Scene** dropdown in the topbar switches between all authored sets (drafts are kept per scene).
- Tools (keys 1-8): **Select/move**, **Tile** (click a cell; same tile again rotates; Shift stacks),
  **Prop** (Shift or the checkbox snaps to a cell), **Shape** (box/plane with a colour), **Anchor**
  (a named story point), **Light** (omni), **Route** (click to append points to the selected route,
  or start a new one), **Erase**. A translucent **ghost** previews what a click will place.
- Selected item: **R** rotate (Shift reverse, Alt 60-degree steps), Shift+wheel rotate, Alt+wheel
  scale, arrows nudge (Shift big), **Del** delete; the inspector edits every field (position,
  yaw, tilt, scale, model/tile, colour, name, tags, hidden, route points, light energy/range).
- Camera: **C** sets the scene camera from the current view, **V** looks through it; fields in the
  inspector. **G** hides the anchor/route/camera gizmos for a clean preview, **F** frames.
- **Ctrl+Z / Ctrl+Y** undo/redo (drags and wheel bursts are one entry), **P** playtest (the game
  opens on the working scene), **Ctrl+S** save to `src/content/<dir>/<name>.ts`.

Structure (`src/editor/`): pure DOM-free cores (`undo_core`, `span_core`, `transform_core`,
`island_doc` sanitizer/serializer, `edit_core`) + `scene_view` (index-keyed Three view of every
component kind, gizmos, ghost), `viewport` (orbit camera, plane picking, pointer state machine),
`app` (commands + DOM), `content_index` (all authored scenes, an HMR boundary). Palette from
`catalog.generated.ts` (`python3 tools/gen_catalog.py`). Tests: every set round-trips losslessly
and serialises byte-identically to its file (`src/tests/scenes.test.ts`). Shape follows the
world-of-claudecraft map editor; see `docs/editor-blueprint.md`.
