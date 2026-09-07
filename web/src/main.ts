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
// The .tscn serializes the Basis ROW-major (Godot's Basis stores `rows[]` internally): the first
// three floats are the basis matrix's first ROW, not its first column. So the Matrix4 is the
// straight row-major fill -- NOT a column build. (Verified empirically: only this makes the
// rotated road/coast tiles tessellate and the road network connect. A column build is identity
// for the pure-scale grass tiles but rotates every road/coast tile the wrong way.)
function godotMatrix(t: number[]): THREE.Matrix4 {
  const [a, b, c, d, e, f, g, h, i, ox, oy, oz] = t;
  return new THREE.Matrix4().set(a, b, c, ox, d, e, f, oy, g, h, i, oz, 0, 0, 0, 1);
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

// tiles that are "the sea/sky", not the land -- excluded when framing the camera so the
// ISLAND fills the view (like Godot), not the wide flat water around it.
function isSeaOrSky(model: string): boolean {
  return /hex_water|hex_coast|cloud_big/.test(model);
}

async function buildOverworld(): Promise<{ full: THREE.Box3; land: THREE.Box3 }> {
  const layout = (await (await fetch("/overworld-layout.json")).json()) as { nodes: LayoutNode[]; models: string[] };
  await Promise.all(layout.models.map((m) => loadModel(m)));
  const island = new THREE.Group();
  island.name = "island";
  const land = new THREE.Box3();
  for (const node of layout.nodes) {
    const base = cache.get(node.model)!;
    const inst = base.clone(true);
    const wrap = new THREE.Group();
    wrap.applyMatrix4(godotMatrix(node.t));
    wrap.add(inst);
    island.add(wrap);
    if (!isSeaOrSky(node.model)) land.expandByObject(wrap);
  }
  scene.add(island);
  return { full: new THREE.Box3().setFromObject(island), land };
}

// Frame the island with an iso camera roughly matching the Godot overworld view.
// Frame tight on the LAND with a Godot-like low iso view + narrow (tele) lens.
function frame(box: THREE.Box3): void {
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  camera.fov = 30;
  camera.updateProjectionMatrix();
  const radius = Math.max(size.x, size.z) * 0.5;
  const dist = (radius / Math.tan((camera.fov * Math.PI) / 360)) * 1.25;
  if (location.search.includes("top")) {
    camera.position.set(center.x, center.y + dist, center.z + 0.01);
  } else {
    const elev = (33 * Math.PI) / 180; // elevation angle above the island
    const azim = (12 * Math.PI) / 180; // slight offset from dead-front (+Z)
    camera.position.set(
      center.x + dist * Math.cos(elev) * Math.sin(azim),
      center.y + dist * Math.sin(elev),
      center.z + dist * Math.cos(elev) * Math.cos(azim)
    );
  }
  camera.lookAt(center.x, center.y, center.z);
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
  const { full, land } = await buildOverworld();
  frame(land);
  // diagnostic: a single grass tile's world footprint (to check hex size/orientation)
  const island = scene.getObjectByName("island")!;
  const firstGrass = island.children.find((w) =>
    w.children.some((c) => c.name === "hex_grass" || c.getObjectByName?.("hex_grass"))
  );
  const tileBox = firstGrass ? new THREE.Box3().setFromObject(firstGrass) : null;
  (window as unknown as { __dbg: unknown }).__dbg = {
    landMin: land.min.toArray().map((n) => +n.toFixed(2)),
    landMax: land.max.toArray().map((n) => +n.toFixed(2)),
    fullMax: full.max.toArray().map((n) => +n.toFixed(2)),
    cam: camera.position.toArray().map((n) => +n.toFixed(1)),
    tileSize: tileBox ? tileBox.getSize(new THREE.Vector3()).toArray().map((n) => +n.toFixed(2)) : null,
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
