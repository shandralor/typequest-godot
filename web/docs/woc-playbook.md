# Three.js playbook, distilled from `levy-street/world-of-claudecraft`

Same stack (Three.js + TS) and the same KayKit-style CC0 assets as TypeQuest, so its
techniques transfer directly. Researched at the source (three parallel repo crawls). This
is the Phase-2 blueprint: grounding, rendering (the "not flat" recipe), and rigged-character
animation. Versions: **three 0.185.1**, `n8ao ^2.0.0`, `@gltf-transform/cli ^4.4.0`.

---

## 1. Grounding models (feet on the ground, no clipping)

No raycasting, no physics. Two decoupled pillars:

**A. Normalize at load — seat the pivot at the feet.** For every placed GLB:
1. `const box = new THREE.Box3().setFromObject(root)`
2. scale so the largest dim hits a target height: `scale = targetHeight / max(size.x, size.y, size.z)`
3. **re-measure** the scaled box, then `root.position.y -= box.min.y` (and center x/z). Now the base sits at local `y = 0`.

The whole transform is `T(0, -scaledMinY, 0) · S(scale)`. Target heights live in one rule file
(props ~2.2 units, trees ~7.5, etc.) so the renderer and any collision bake agree.

**For rigged characters**, measure the box from the **posed** skinned-mesh vertices (pose at
mid-idle, call `applyBoneTransform` per vertex, exclude held weapons), not the bind pose:
```
rawHeight = bounds.max.y - bounds.min.y
normScale = def.height / rawHeight
yOffset   = (def.hover ?? 0) - bounds.min.y * normScale   // lift feet to y=0
```
Bake `normScale` / `yOffset` / `def.yaw` (face +Z) into a wrapper. Pivot = feet, faces +Z,
height normalized — regardless of how the source rig was authored. This is the direct fix for
the class of bug we hit in Godot (the intro rise-through-bed): never trust the source origin;
seat the measured lowest point to the ground.

**B. Place on an analytic ground function.** A closed-form `terrainHeight(x, z, seed)` any layer
can sample; static props sit at `y = terrainHeight(...)`, entities at a `groundHeight(...)` that
also returns dungeon floors / decks / walkable lifts. For a flat-ish island this is just the
terrain mesh's height (or 0 on a flat set).

**Anti-clipping extras:** tilt props to the ground normal (finite-difference of `terrainHeight`
→ `setFromUnitVectors(UP, normal)`); when upscaling center-anchored geometry, add
`-(scale-1)*minY` to Y so the base doesn't sink; ease a small settle offset on death poses.

---

## 2. Rendering — the "not flat" recipe (PBR + IBL + post)

The look is **ACES tonemapping + image-based lighting + screen-space AO + a cinematic grade**,
not raw lit WebGL. Replication checklist:

1. **Renderer:** `WebGLRenderer({ antialias:false })` (AA is done in post), `toneMapping =
   ACESFilmicToneMapping`, `toneMappingExposure ≈ 1`, sRGB output, `shadowMap.type =
   PCFShadowMap` (plain PCF honors `shadow.radius`; PCFSoft ignores it).
2. **Lights (contrast comes from a strong key + low fills):**
   - `DirectionalLight` **warm golden** `~0xffd99a`, intensity `~3.5`, tight ortho shadow cam
     (half-extent ~105, near 30 / far 480, `bias -0.0006`, `normalBias 0.035`, `radius 2.25`,
     mapSize 4096).
   - `HemisphereLight(sky 0xdcefff, ground 0x465f39, ~0.27)`.
   - **No `AmbientLight`** — ambient comes from the hemisphere + IBL.
3. **IBL is essential for grounding + reflections:** `scene.environment` from a PMREM-prefiltered
   HDRI (or prefilter the sky dome via `pmremGenerator.fromScene(...)`), `environmentIntensity
   ≈ 0.2`, materials are `MeshStandardMaterial`.
4. **Ambient occlusion = N8AO** (npm `n8ao`), run mid-chain on a **HalfFloat** `EffectComposer`
   target: `aoRadius 1.8`, `distanceFalloff 3.6`, `intensity 1.45`, `gammaCorrection:false`
   (stay linear). This is the single biggest "3D pop / grounded" cue after shadows.
5. **Bloom:** `UnrealBloomPass`, strength 0.4, radius 0.6, **threshold 1.32** (only emissives
   bloom; sky doesn't blow out).
6. **Output/grade pass:** fuse OutputPass (ACES + sRGB) with a subtle grade — lift
   `(0.010,0.008,0.010)`, warm gain `(1.10,1.035,0.90)`, gamma `0.975`, a gentle S-curve
   (`mix(c, c*c*(3-2c), 0.23)`), **+7% saturation**, vignette, faint film grain. This is what
   turns a "raw ACES wash" into the cinematic look.
7. **Fog** for aerial depth: `THREE.Fog(0xa6c6e0, near ~190, far ~700)`.

Pass order: `N8AO → UnrealBloom → OutputGrade → (ScreenFx) → SMAA`. Tiered: full composer /
grade-only (+FXAA) / flat (low-end) — a graceful fallback for weak devices.

---

## 3. Rigged characters (KayKit rigs, shared clips, no foot-slide, no T-pose)

- **Loader:** one shared `GLTFLoader` with `MeshoptDecoder` + a KTX2 loader, promise-cached per
  URL. Geometry is **meshopt, never Draco** (a Draco GLB silently fails to load); textures KTX2.
- **Per instance:** `SkeletonUtils.clone(asset)` (shared geometry, own Skeleton) + its own
  `AnimationMixer`; cache one `clipAction` per clip name.
- **Shared clip vocabulary by BONE NAME.** A rig GLB + mesh-free `animUrls` clip GLBs merge into
  one name→clip map; `AnimationMixer` binds tracks to bones by name, so one KayKit clip set
  (`Idle`, `Walking_A`, `Running_A`, `1H_Melee_Attack_*`, `Spellcasting`, `Death_A`, …) drives
  every KayKit-skeleton character with **no runtime retargeting**. (True retargeting is done
  offline, into the rig's bind space.)
- **No foot-slide:** time-scale locomotion to actual speed — `timeScale = clamp(speed /
  authoredWalkRef, 0.6, 1.8)` each frame; pick run-vs-walk with **hysteresis**. Clips carry no
  root motion; the sim drives the node, the clip only cycles the legs.
- **No T-pose pops** (the bind-pose-when-weight-drops failure): one-shots use `reset()` +
  `clampWhenFinished = true`; snap to full weight when there's no outgoing action (don't fade a
  lone action in from 0); run a low-weight watchdog that re-drives the base pose if the rig is
  starved for ~3 frames.
- **KayKit gotchas:** weapon grip bones are `handslot.r` / `handslot.l` (also `R_Hand`/`L_Hand`);
  a rig's REST pose ≠ its bind pose (verified for KayKit) — skin in bind space. meshopt
  *quantization* corrupts the multi-primitive-skinned KayKit bodies (parts explode to huge
  bounding boxes), so those rigs bypass the quantizing pipeline. Perf: the ~9 body-part
  SkinnedMeshes can be merged to one Skeleton/mesh once you prove their inverse-bind matrices
  differ only by a constant transform.

---

## Takeaways for TypeQuest Phase 2

1. The grounding recipe (measure posed bounds → seat feet to y=0) is what makes models sit
   correctly — port it first; it also retro-explains the Godot clipping we fought.
2. Ship the renderer/light/N8AO/IBL/grade stack from §2 verbatim (with modest numbers for a
   kids' island) — that is the entire answer to "the web looks flat."
3. KayKit clips bind by bone name, so the shared-rig animation TypeQuest already relies on
   carries over as `AnimationMixer` + one clip map.
