// The island draws repeated models as InstancedMesh, which replaces "clone the template under a
// wrapper with the placement matrix" with "placement * the sub-mesh's local matrix". Those two
// must produce the SAME world transform -- if they drift, every tile and tree silently moves.
// This pins the composition on a template shaped like a real KayKit model: a root with its own
// transform and nested sub-meshes.

import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { templateParts } from "../render/islandScene";

function makeTemplate(): THREE.Object3D {
  const root = new THREE.Group();
  root.position.set(0.5, 0, -0.25); // gltf roots are rarely at the origin
  root.rotation.y = Math.PI / 7;
  const branch = new THREE.Group();
  branch.position.set(0, 1.5, 0);
  branch.scale.setScalar(0.8);
  root.add(branch);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  leaf.position.set(0.2, 0.3, 0.4);
  leaf.rotation.z = 0.6;
  branch.add(leaf);
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial());
  root.add(trunk);
  return root;
}

/** The world matrix the OLD path produced: a wrapper carrying the placement, template inside. */
function clonedWorldMatrix(template: THREE.Object3D, placement: THREE.Matrix4, meshIndex: number): THREE.Matrix4 {
  const wrap = new THREE.Group();
  wrap.applyMatrix4(placement);
  wrap.add(template.clone(true));
  wrap.updateWorldMatrix(true, true);
  const meshes: THREE.Object3D[] = [];
  wrap.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o);
  });
  return meshes[meshIndex].matrixWorld.clone();
}

describe("instanced placement", () => {
  const template = makeTemplate();
  const placement = new THREE.Matrix4().compose(
    new THREE.Vector3(12, 0.5, -30),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 3, 0, "YXZ")),
    new THREE.Vector3(3, 3, 3)
  );

  it("finds every sub-mesh, however deeply nested", () => {
    expect(templateParts(template)?.length).toBe(2);
  });

  it("places an instance exactly where cloning would have put it", () => {
    const parts = templateParts(template)!;
    parts.forEach((part, i) => {
      const instanced = new THREE.Matrix4().multiplyMatrices(placement, part.local);
      const cloned = clonedWorldMatrix(template, placement, i);
      instanced.elements.forEach((v, k) => expect(v).toBeCloseTo(cloned.elements[k], 10));
    });
  });

  it("refuses a skinned model, so it keeps its own skeleton via cloning", () => {
    const root = new THREE.Group();
    const skinned = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    root.add(skinned);
    expect(templateParts(root)).toBeNull();
  });

  it("refuses an empty model rather than building a zero-part instance", () => {
    expect(templateParts(new THREE.Group())).toBeNull();
  });
});
