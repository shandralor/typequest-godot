// TypeQuest overworld -- Three.js render spike (Phase 2). Reproduces the Godot island
// from the parsed layout and lights it with the world-of-claudecraft recipe (see
// docs/woc-playbook.md): ACES tonemapping, a warm golden key + cool hemisphere fill (no
// ambient), soft shadows, PMREM/IBL environment, N8AO for depth, and gentle fog.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { N8AOPass } from "n8ao";

interface LayoutNode {
  model: string;
  t: number[];
} // t = Godot Transform3D: [a,b,c, d,e,f, g,h,i, ox,oy,oz]

const canvas = document.getElementById("app") as HTMLCanvasElement;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e12);
scene.fog = new THREE.Fog(0xa6c6e0, 120, 340);

// IBL: prefilter a RoomEnvironment through PMREM for grounded, sky-matched ambient reflectance.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

// --- light rig (playbook): strong warm key + low cool hemisphere fill, no AmbientLight ---
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
scene.add(new THREE.HemisphereLight(0xdcefff, 0x465f39, 0.5));

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.5, 900);

// Godot Transform3D(a,b,c, d,e,f, g,h,i, ox,oy,oz) -> THREE.Matrix4 (both Y-up right-handed).
function godotMatrix(t: number[]): THREE.Matrix4 {
  const [a, b, c, d, e, f, g, h, i, ox, oy, oz] = t;
  return new THREE.Matrix4().set(a, d, g, ox, b, e, h, oy, c, f, i, oz, 0, 0, 0, 1);
}

const loader = new GLTFLoader();
const cache = new Map<string, THREE.Object3D>();

async function loadModel(path: string): Promise<THREE.Object3D> {
  let base = cache.get(path);
  if (!base) {
    const gltf = await loader.loadAsync("/assets/" + path);
    base = gltf.scene;
    base.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    cache.set(path, base);
  }
  return base;
}

async function buildOverworld(): Promise<THREE.Box3> {
  const layout = (await (await fetch("/overworld-layout.json")).json()) as { nodes: LayoutNode[]; models: string[] };
  await Promise.all(layout.models.map((m) => loadModel(m)));
  const island = new THREE.Group();
  for (const node of layout.nodes) {
    const base = cache.get(node.model)!;
    const inst = base.clone(true);
    const wrap = new THREE.Group();
    wrap.applyMatrix4(godotMatrix(node.t));
    wrap.add(inst);
    island.add(wrap);
  }
  scene.add(island);
  return new THREE.Box3().setFromObject(island);
}

// Frame the island with an iso camera roughly matching the Godot overworld view.
function frame(box: THREE.Box3): void {
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.z) * 0.62;
  camera.position.set(center.x + radius * 0.15, center.y + radius * 1.05, center.z + radius * 1.35);
  camera.lookAt(center.x, center.y - size.y * 0.1, center.z);
  sun.target.position.copy(center);
  scene.add(sun.target);
}

// --- post: N8AO (the depth/contact-shadow cue) + output/tonemap pass ---
let composer: EffectComposer;
function setupPost(): void {
  composer = new EffectComposer(renderer);
  // N8AOPass renders the scene AND applies screen-space ambient occlusion (the contact-shadow
  // / crevice depth cue that WebGL2 can't do at runtime otherwise). It replaces the RenderPass.
  const ao = new N8AOPass(scene, camera, window.innerWidth, window.innerHeight);
  ao.configuration.aoRadius = 2.4;
  ao.configuration.distanceFalloff = 3.6;
  ao.configuration.intensity = 2.6;
  ao.configuration.color = new THREE.Color(0, 0, 0);
  ao.setQualityMode?.("High");
  composer.addPass(ao);
  composer.addPass(new OutputPass()); // ACES tonemap + sRGB encode
  composer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer?.setSize(window.innerWidth, window.innerHeight);
});

function renderFrame(): void {
  if (composer) composer.render();
  else renderer.render(scene, camera);
}

async function main(): Promise<void> {
  const box = await buildOverworld();
  frame(box);
  (window as unknown as { __dbg: unknown }).__dbg = {
    boxMin: box.min.toArray(),
    boxMax: box.max.toArray(),
    cam: camera.position.toArray(),
    islandChildren: (scene.getObjectByName("island")?.children.length) ?? scene.children.length,
  };
  if (!location.search.includes("nopost")) setupPost();
  renderFrame();
  renderFrame();
  // signal to the screenshot harness that the island is on screen
  document.body.setAttribute("data-ready", "1");
  (window as unknown as { __ready: boolean }).__ready = true;
  // keep a slow loop so it stays live if viewed interactively
  renderer.setAnimationLoop(renderFrame);
}

main().catch((err) => {
  console.error(err);
  document.body.setAttribute("data-error", String(err));
});
