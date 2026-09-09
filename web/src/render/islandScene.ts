// The shared island renderer: ONE scene/light/post recipe used by both the game (main.ts) and
// the editor viewport, so what you see while editing is exactly what the game draws (the
// world-of-claudecraft "editor reuses the real renderer" seam). Recipe per docs/woc-playbook.md:
// warm golden key + cool hemisphere fill (no AmbientLight), PMREM/IBL environment, soft
// shadows, N8AO for contact depth, Neutral tonemap + a colour-grade pass for the cartoon pop.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { N8AOPass } from "n8ao";
import { expandIsland, islandModels, placedPosition, type IslandDef } from "../world/hexGrid";
import { buildLight, buildShape } from "./sceneObjects";
import { assetUrl } from "../assetPath";

// Colour grade on the tonemapped/sRGB image: saturation pop, gentle S-curve, warmth, vignette.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    // Tuned back once the material colours were fixed: this boost was compensating for grounds
    // that arrived washed out (double sRGB encoding). With correct colours it over-cooked them --
    // an authored olive pad rendered vivid chartreuse.
    saturation: { value: 1.07 },
    contrast: { value: 0.10 },
    warm: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
    vignette: { value: 0.16 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float saturation; uniform float contrast; uniform vec3 warm; uniform float vignette;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, saturation);
      col = mix(col, col * col * (3.0 - 2.0 * col), contrast);
      col *= warm;
      vec2 d = vUv - 0.5;
      float v = smoothstep(0.9, 0.32, dot(d, d) * 2.0);
      col *= mix(1.0, v, vignette);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }`,
};

/** Tiles that are "the sea/sky", not the land (excluded when framing on the island). */
export function isSeaOrSky(model: string): boolean {
  return /hex_water|hex_coast|cloud_big/.test(model);
}

export interface IslandScene {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  /** Load (and cache) a model template by its path under /assets. */
  loadModel(path: string): Promise<THREE.Object3D>;
  /** A cached template, if loaded. Clone it to place it. */
  getModel(path: string): THREE.Object3D | undefined;
  /** Enable the post stack (N8AO -> tonemap -> grade). Call after the scene is populated. */
  setupPost(): void;
  /** Fit the drawing buffer to the canvas's CSS size. */
  resize(): void;
  render(): void;
}

export function createIslandScene(canvas: HTMLCanvasElement): IslandScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // ACES desaturates cartoon colours; NeutralToneMapping keeps hue/saturation for a bright island.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0e12);
  scene.fog = new THREE.Fog(0xa6c6e0, 120, 340);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.42;

  const sun = new THREE.DirectionalLight(0xffd99a, 3.2);
  sun.position.set(38, 60, 28);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 260;
  const S = 55;
  sun.shadow.camera.left = -S;
  sun.shadow.camera.right = S;
  sun.shadow.camera.top = S;
  sun.shadow.camera.bottom = -S;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 2.2;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xdcefff, 0x465f39, 0.5);
  scene.add(hemi);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 900);

  const loader = new GLTFLoader();
  const cache = new Map<string, THREE.Object3D>();
  const pending = new Map<string, Promise<THREE.Object3D>>();
  function loadModel(path: string): Promise<THREE.Object3D> {
    const hit = cache.get(path);
    if (hit) return Promise.resolve(hit);
    let p = pending.get(path);
    if (!p) {
      p = loader.loadAsync(assetUrl("/assets/" + path)).then((gltf) => {
        const base = gltf.scene;
        base.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.castShadow = true;
            m.receiveShadow = true;
          }
        });
        cache.set(path, base);
        pending.delete(path);
        return base;
      });
      pending.set(path, p);
    }
    return p;
  }

  let composer: EffectComposer | null = null;
  function size(): { w: number; h: number } {
    return { w: Math.max(1, canvas.clientWidth), h: Math.max(1, canvas.clientHeight) };
  }
  function setupPost(): void {
    const { w, h } = size();
    composer = new EffectComposer(renderer);
    const ao = new N8AOPass(scene, camera, w, h);
    ao.configuration.aoRadius = 2.2;
    ao.configuration.distanceFalloff = 3.6;
    ao.configuration.intensity = 1.7;
    ao.configuration.color = new THREE.Color(0, 0, 0);
    ao.setQualityMode?.("High");
    composer.addPass(ao);
    composer.addPass(new OutputPass());
    composer.addPass(new ShaderPass(GradeShader));
    composer.setSize(w, h);
  }
  function resize(): void {
    const { w, h } = size();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer?.setSize(w, h);
  }
  function render(): void {
    if (composer) composer.render();
    else renderer.render(scene, camera);
  }
  resize();
  return { renderer, scene, camera, sun, hemi, loadModel, getModel: (p) => cache.get(p), setupPost, resize, render };
}

/** shapes with this name form the swinging drawbridge leaf, pivoted at `bridge_near` */
export const BRIDGE_LEAF = "bridge_leaf";

/** The hinge the leaf swings about: its near edge, which the set marks with `bridge_near`. */
function bridgeHinge(def: IslandDef): THREE.Vector3 {
  const a = def.anchors?.find((x) => x.name === "bridge_near");
  return a ? placedPosition(a) : new THREE.Vector3();
}

/**
 * A model that appears more than once is drawn as ONE InstancedMesh per sub-mesh instead of a
 * clone per placement. The island is mostly repeats -- the authored overworld places the same
 * 24-triangle water tile 147 times -- so cloning cost 147 draw calls (plus 147 more in the
 * shadow pass) to move 3.5k triangles. Two placements already win: a model with N sub-meshes
 * costs N instanced draws instead of 2N cloned ones.
 */
const INSTANCE_MIN = 2;

/** Every drawable sub-mesh of a loaded template, with its transform RELATIVE to the template. */
interface TemplatePart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  local: THREE.Matrix4;
}

/**
 * Flatten a template into instanceable parts. Returns null when the model cannot be instanced
 * (a skinned mesh needs its own skeleton, so it stays a clone) -- callers fall back to cloning.
 * Exported for the test that pins `placement * local` to what cloning would have produced.
 */
export function templateParts(base: THREE.Object3D): TemplatePart[] | null {
  base.updateWorldMatrix(true, true);
  // Relative to the template's PARENT, not to the template itself: cloning puts the whole
  // template (root transform included) under the placement wrapper, so the root's own
  // position/rotation has to survive here too. Cached templates are unparented, which makes
  // this the identity -- but a gltf root that carries a transform would otherwise be flattened
  // away and every instance of it would sit in the wrong place.
  const toLocal = new THREE.Matrix4();
  if (base.parent) toLocal.copy(base.parent.matrixWorld).invert();
  const parts: TemplatePart[] = [];
  let skinned = false;
  base.traverse((o) => {
    const m = o as THREE.Mesh;
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned = true;
    if (!m.isMesh || !m.geometry) return;
    parts.push({ geometry: m.geometry, material: m.material, local: new THREE.Matrix4().multiplyMatrices(toLocal, m.matrixWorld) });
  });
  return skinned || parts.length === 0 ? null : parts;
}

/**
 * A prop can carry `tags` to mark it as one VARIANT of a slot -- the house wall racks one
 * weapon per hero class, tagged weapon_knight / weapon_barbarian / ... A tagged prop is drawn
 * only when one of its tags is active, so the wall shows the chosen hero's weapon and nothing
 * else (Godot scene_composer.show_hero_weapon). An untagged prop is always drawn.
 */
function isVariant(tags: string[] | undefined): boolean {
  return !!tags && tags.length > 0;
}

/**
 * Give an InstancedMesh culling bounds that actually contain every instance.
 *
 * three's own computeBoundingSphere() came out TOO SMALL and off-centre here -- measured on the
 * forest fork, every instanced set was short by 5-10 units with its centre out by up to 16 --
 * so three frustum-culled them early and lumps of scenery popped out at the edge of the screen.
 * The cave mouth losing half its rock face is what that looks like in play.
 *
 * Union the geometry's box under each instance matrix, and derive the sphere from that. It is
 * conservative, which is the safe direction: worst case something off-screen is still drawn.
 */
export function fitInstanceBounds(mesh: THREE.InstancedMesh, placements: THREE.Matrix4[], local: THREE.Matrix4): void {
  const geo = mesh.geometry;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const unit = geo.boundingBox;
  if (!unit) return;
  const box = new THREE.Box3();
  const scratch = new THREE.Box3();
  const m = new THREE.Matrix4();
  for (const p of placements) box.union(scratch.copy(unit).applyMatrix4(m.multiplyMatrices(p, local)));
  mesh.boundingBox = box;
  mesh.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
}

/** Build a static scene group from a SceneDef (the game path): tiles + props + shapes + lights. */
export async function buildIslandGroup(
  s: IslandScene,
  def: IslandDef,
  activeTags: ReadonlySet<string> = new Set()
): Promise<{ group: THREE.Group; land: THREE.Box3; full: THREE.Box3 }> {
  await Promise.all(islandModels(def).map((m) => s.loadModel(m).catch(() => null)));
  const group = new THREE.Group();
  group.name = "island";
  const land = new THREE.Box3();
  // For a TAGGED prop the tags decide and the authored `hidden` flag does not apply: the set
  // authors every variant of the slot hidden (so the editor is not a pile of stacked weapons)
  // and the game turns exactly one back on. Untagged props obey `hidden` as before.
  const hidden = new Set(
    def.props
      .filter((p) => (isVariant(p.tags) ? !p.tags!.some((t) => activeTags.has(t)) : p.hidden))
      .map((p) => p)
  );
  const placements = expandIsland(def);
  const nTiles = def.tiles.length;

  // Hidden props stay in the group as individual hidden clones rather than being dropped or
  // folded into an instance. They are authored content a later feature turns ON (the house
  // wall carries a weapon per hero class, tagged and hidden), and an invisible object costs
  // nothing to draw -- so keep them findable instead of optimising them away.
  const byModel = new Map<string, THREE.Matrix4[]>();
  placements.forEach((p, i) => {
    const prop = i >= nTiles ? def.props[i - nTiles] : null;
    if (prop && hidden.has(prop)) {
      const wrap = new THREE.Group();
      wrap.applyMatrix4(p.matrix);
      const base = s.getModel(p.model);
      if (base) wrap.add(base.clone(true));
      wrap.visible = false;
      group.add(wrap);
      // Box3.expandByObject walks hidden children too, so this matches the pre-instancing
      // framing exactly -- the land bounds must not shift under an optimisation.
      if (!isSeaOrSky(p.model)) land.expandByObject(wrap);
      return;
    }
    const list = byModel.get(p.model);
    if (list) list.push(p.matrix);
    else byModel.set(p.model, [p.matrix]);
  });

  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  for (const [model, matrices] of byModel) {
    const base = s.getModel(model);
    if (!base) continue;
    const sea = isSeaOrSky(model);
    const parts = matrices.length >= INSTANCE_MIN ? templateParts(base) : null;
    if (parts) {
      for (const part of parts) {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, matrices.length);
        mesh.name = model;
        mesh.castShadow = !/hex_water/.test(model); // flat sea at the bottom shadows nothing
        mesh.receiveShadow = true;
        const m = new THREE.Matrix4();
        matrices.forEach((placement, i) => mesh.setMatrixAt(i, m.multiplyMatrices(placement, part.local)));
        mesh.instanceMatrix.needsUpdate = true;
        fitInstanceBounds(mesh, matrices, part.local);
        group.add(mesh);
      }
      if (!sea) {
        // bounds without materialising the clones: the template's box under each placement
        box.setFromObject(base);
        for (const placement of matrices) land.union(tmp.copy(box).applyMatrix4(placement));
      }
    } else {
      for (const placement of matrices) {
        const wrap = new THREE.Group();
        // named by MODEL PATH, like the instanced meshes are: a cloned gltf root is called
        // "Scene", so without this a scene lookup by model silently found nothing and any
        // code measuring against a prop quietly did nothing at all
        wrap.name = model;
        wrap.applyMatrix4(placement);
        wrap.add(base.clone(true));
        group.add(wrap);
        if (!sea) land.expandByObject(wrap);
      }
    }
  }

  // The drawbridge deck is authored as a fan of primitives already tilted into the RAISED pose.
  // They are collected under one pivot at the near hinge so the whole leaf swings as a unit --
  // rotating eleven boxes individually about a hinge they do not share would be a nightmare.
  const leaf = new THREE.Group();
  leaf.name = BRIDGE_LEAF;
  leaf.position.copy(bridgeHinge(def));
  for (const sh of def.shapes ?? []) {
    const o = buildShape(sh);
    if (sh.name === BRIDGE_LEAF) {
      o.position.sub(leaf.position); // re-parent: keep the world pose, express it about the hinge
      leaf.add(o);
    } else {
      group.add(o);
    }
    land.expandByObject(o);
  }
  if (leaf.children.length > 0) group.add(leaf);
  for (const l of def.lights ?? []) group.add(buildLight(l));
  s.scene.add(group);
  return { group, land, full: new THREE.Box3().setFromObject(group) };
}
