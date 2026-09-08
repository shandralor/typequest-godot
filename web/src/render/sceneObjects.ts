// Three builders for the non-model scene components (shared by the game and the editor view so
// both draw them identically): primitive shapes and point lights. Models go through the
// hexGrid placements + the IslandScene model cache.

import * as THREE from "three";
import { placedMatrix } from "../world/hexGrid";
import type { LightDef, ShapeDef } from "../world/sceneDef";

export function buildShape(sh: ShapeDef): THREE.Object3D {
  const geo =
    sh.kind === "box"
      ? new THREE.BoxGeometry(sh.size[0] ?? 1, sh.size[1] ?? 1, sh.size[2] ?? 1)
      : new THREE.PlaneGeometry(sh.size[0] ?? 2, sh.size[1] ?? 2);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(sh.color),
    roughness: 0.9,
    metalness: 0,
    transparent: (sh.alpha ?? 1) < 1,
    opacity: sh.alpha ?? 1,
  });
  if (sh.emissive) {
    mat.emissive = new THREE.Color(sh.emissive);
    mat.emissiveIntensity = 0.8;
  }
  const mesh = new THREE.Mesh(geo, mat);
  if (sh.kind === "plane") mesh.rotation.x = -Math.PI / 2; // Godot PlaneMesh lies flat facing +y
  mesh.castShadow = sh.kind === "box";
  mesh.receiveShadow = true;
  const wrap = new THREE.Group();
  wrap.add(mesh);
  wrap.applyMatrix4(placedMatrix(sh, sh.sc ?? 1));
  wrap.visible = !sh.hidden;
  return wrap;
}

export function buildLight(l: LightDef): THREE.Object3D {
  // Godot omni energy/range -> a soft point light; intensity scaled for the physically-based renderer
  const light = new THREE.PointLight(new THREE.Color(l.color), l.energy * 12, l.range, 1.6);
  light.position.set(l.x, l.y, l.z);
  return light;
}

/** Re-apply a shape's placement in place (editor live transform). */
export function applyShapeTransform(obj: THREE.Object3D, sh: ShapeDef): void {
  obj.position.set(0, 0, 0);
  obj.quaternion.identity();
  obj.scale.set(1, 1, 1);
  obj.applyMatrix4(placedMatrix(sh, sh.sc ?? 1));
  obj.visible = !sh.hidden;
}
