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
import { expandIsland, islandModels, type IslandDef } from "../world/hexGrid";
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

/** Build a static scene group from a SceneDef (the game path): tiles + props + shapes + lights. */
export async function buildIslandGroup(
  s: IslandScene,
  def: IslandDef
): Promise<{ group: THREE.Group; land: THREE.Box3; full: THREE.Box3 }> {
  await Promise.all(islandModels(def).map((m) => s.loadModel(m).catch(() => null)));
  const group = new THREE.Group();
  group.name = "island";
  const land = new THREE.Box3();
  const hidden = new Set(def.props.filter((p) => p.hidden).map((p) => p));
  def.props.forEach(() => void 0);
  const placements = expandIsland(def);
  const nTiles = def.tiles.length;
  placements.forEach((p, i) => {
    const base = s.getModel(p.model);
    if (!base) return;
    const wrap = new THREE.Group();
    wrap.applyMatrix4(p.matrix);
    wrap.add(base.clone(true));
    const prop = i >= nTiles ? def.props[i - nTiles] : null;
    if (prop && hidden.has(prop)) wrap.visible = false;
    group.add(wrap);
    if (!isSeaOrSky(p.model)) land.expandByObject(wrap);
  });
  for (const sh of def.shapes ?? []) {
    const o = buildShape(sh);
    group.add(o);
    land.expandByObject(o);
  }
  for (const l of def.lights ?? []) group.add(buildLight(l));
  s.scene.add(group);
  return { group, land, full: new THREE.Box3().setFromObject(group) };
}
