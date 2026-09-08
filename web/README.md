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

## Island editor (`/editor.html`, dev server only)

Islands are data-as-code (`src/content/island/*.ts`, expanded by `src/world/hexGrid.ts`). The
editor is a nicer pen for that file, not a second source of truth: it edits a working copy on
the REAL island renderer and writes the authored `.ts` back through a dev-only Vite endpoint.

```
npm run dev            # then open http://localhost:5173/editor.html
```

- Tools: **1** select/move, **2** paint tiles (click a cell; same tile again rotates it;
  Shift+click stacks), **3** place props (Shift or the checkbox snaps to a cell), **4** erase.
- Selected item: **R** rotate (Shift = reverse, Alt = 60-degree steps for props), Shift+wheel
  rotate, Alt+wheel scale, arrows nudge (Shift = big), **Del** delete, inspector fields edit.
- **Ctrl+Z / Ctrl+Y** undo/redo (drags and wheel bursts are one entry), **F** frame, **P**
  playtest (opens the game on the working island), **Ctrl+S** save to `src/content/island/<name>.ts`.
- Drafts autosave to localStorage per island name; **Reset to file** discards the draft.

Structure (`src/editor/`): pure DOM-free cores (`undo_core`, `span_core`, `transform_core`,
`island_doc` sanitizer/serializer, `edit_core`) + `island_view` (index-keyed Three view),
`viewport` (orbit camera, plane picking, pointer state machine), `app` (commands + DOM).
Palette from `catalog.generated.ts` (`python3 tools/gen_catalog.py`). Shape follows the
world-of-claudecraft map editor; see `docs/editor-blueprint.md`.
