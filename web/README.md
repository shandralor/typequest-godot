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
