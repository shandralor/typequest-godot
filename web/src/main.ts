// TypeQuest overworld -- the game entry. Builds the authored island (data-as-code) through the
// shared island renderer, drops the hero at the hub, and frames the Godot overworld camera.
// If the island editor stashed a playtest island, that one is drawn instead.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createIslandScene, buildIslandGroup, type IslandScene } from "./render/islandScene";
import { OVERWORLD } from "./content/island/overworld";
import { takeEditorIsland } from "./world/editorHandoff";

// The Godot overworld camera, read verbatim from scenes/sets/overworld.tscn
// (camera_pos / camera_look markers + the controller's fov 30).
const OW_CAM_POS = new THREE.Vector3(0, 30, 34);
const OW_CAM_LOOK = new THREE.Vector3(0, 0, -2);
const OW_CAM_FOV = 30;

function frame(s: IslandScene, box: THREE.Box3): void {
  const center = box.getCenter(new THREE.Vector3());
  s.camera.fov = OW_CAM_FOV;
  s.camera.updateProjectionMatrix();
  if (location.search.includes("top")) {
    const size = box.getSize(new THREE.Vector3());
    s.camera.position.set(center.x, center.y + Math.max(size.x, size.z) * 1.4, center.z + 0.01);
    s.camera.lookAt(center);
  } else {
    s.camera.position.copy(OW_CAM_POS);
    s.camera.lookAt(OW_CAM_LOOK);
  }
  s.sun.target.position.copy(center);
}

// The hero: a KayKit adventurer on the shared Rig_Medium. The character GLB carries the skinned
// mesh but NO clips; clips live in the shared rig GLB and bind by BONE NAME, so the mixer plays
// a Rig_Medium_General clip on the Knight with no retargeting.
async function loadHero(s: IslandScene): Promise<THREE.AnimationMixer> {
  const loader = new GLTFLoader();
  const [heroGltf, rigGltf] = await Promise.all([
    loader.loadAsync("/assets/kaykit/adventurers/Knight.glb"),
    loader.loadAsync("/assets/kaykit/adventurers/Rig_Medium_General.glb"),
  ]);
  const hero = heroGltf.scene;
  hero.name = "hero";
  hero.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false; // skinned parts can report stale bind-pose bounds and vanish
    }
  });
  hero.position.set(0, 0, 0); // hub anchor = origin; pivot at the feet
  hero.rotation.y = Math.PI; // face the camera (KayKit faces +Z; camera sits at +Z)
  s.scene.add(hero);
  hero.position.y -= new THREE.Box3().setFromObject(hero).min.y; // seat the feet on the tile top
  const idle = rigGltf.animations.find((a) => a.name === "Idle_A") ?? rigGltf.animations[0];
  const mixer = new THREE.AnimationMixer(hero);
  mixer.clipAction(idle).play();
  return mixer;
}

async function main(): Promise<void> {
  const canvas = document.getElementById("app") as HTMLCanvasElement;
  const s = createIslandScene(canvas);
  new ResizeObserver(() => s.resize()).observe(canvas);
  const def = takeEditorIsland() ?? OVERWORLD;
  const { land, full } = await buildIslandGroup(s, def);
  const mixer = await loadHero(s);
  frame(s, land);
  (window as unknown as { __dbg: unknown }).__dbg = {
    landMin: land.min.toArray().map((n) => +n.toFixed(2)),
    landMax: land.max.toArray().map((n) => +n.toFixed(2)),
    fullMax: full.max.toArray().map((n) => +n.toFixed(2)),
    cam: s.camera.position.toArray().map((n) => +n.toFixed(1)),
    tiles: def.tiles.length,
    props: def.props.length,
  };
  if (!location.search.includes("nopost")) s.setupPost();
  const clock = new THREE.Clock();
  const tick = (): void => {
    mixer.update(clock.getDelta());
    s.render();
  };
  tick();
  tick();
  document.body.setAttribute("data-ready", "1");
  s.renderer.setAnimationLoop(tick);
  // screenshot harness: pause/resume the loop so a headless capture is not starved by rAF
  (window as unknown as { __pause: () => void; __resume: () => void }).__pause = () => s.renderer.setAnimationLoop(null);
  (window as unknown as { __pause: () => void; __resume: () => void }).__resume = () => s.renderer.setAnimationLoop(tick);
}

main().catch((err) => {
  console.error(err);
  document.body.setAttribute("data-error", String(err));
});
