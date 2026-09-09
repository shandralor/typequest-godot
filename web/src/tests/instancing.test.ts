// The island draws repeated models as InstancedMesh, which replaces "clone the template under a
// wrapper with the placement matrix" with "placement * the sub-mesh's local matrix". Those two
// must produce the SAME world transform -- if they drift, every tile and tree silently moves.
// This pins the composition on a template shaped like a real KayKit model: a root with its own
// transform and nested sub-meshes.

import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { templateParts, fitInstanceBounds } from "../render/islandScene";

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

// Culling bounds. three's own computeBoundingSphere() came out too small and off-centre for
// these instanced sets, so scenery was frustum-culled while still on screen -- the cave mouth
// lost half its rock face. The bounds must CONTAIN every instance; being too big is harmless.
describe("instanced culling bounds", () => {
  const geo = new THREE.BoxGeometry(1, 2, 1);
  const local = new THREE.Matrix4().makeTranslation(0.3, 0, -0.2);

  /** the placements a wide scatter produces -- the case three got wrong */
  const scatter = (n: number): THREE.Matrix4[] =>
    Array.from({ length: n }, (_, i) =>
      new THREE.Matrix4().compose(
        new THREE.Vector3(Math.cos(i) * 40, (i % 3) * 2, Math.sin(i * 1.7) * 60),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, i, 0)),
        new THREE.Vector3(1 + (i % 4) * 0.5, 1, 1)
      )
    );

  it("contains every instance, however widely they are scattered", () => {
    const placements = scatter(50);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), placements.length);
    const m = new THREE.Matrix4();
    placements.forEach((p, i) => mesh.setMatrixAt(i, m.multiplyMatrices(p, local)));
    fitInstanceBounds(mesh, placements, local);

    const sphere = mesh.boundingSphere!;
    expect(sphere).toBeTruthy();
    const unit = geo.boundingBox ?? (geo.computeBoundingBox(), geo.boundingBox!);
    for (const [i, p] of placements.entries()) {
      const box = unit.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(p, local));
      for (const corner of cornersOf(box)) {
        expect(sphere.containsPoint(corner), `instance ${i} corner outside the culling sphere`).toBe(true);
        expect(mesh.boundingBox!.containsPoint(corner), `instance ${i} corner outside the culling box`).toBe(true);
      }
    }
  });

  it("handles a single instance", () => {
    const placements = [new THREE.Matrix4().makeTranslation(5, 0, -3)];
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), 1);
    mesh.setMatrixAt(0, placements[0]);
    fitInstanceBounds(mesh, placements, new THREE.Matrix4());
    expect(mesh.boundingSphere!.containsPoint(new THREE.Vector3(5, 1, -3))).toBe(true);
  });
});

function cornersOf(b: THREE.Box3): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
    out.push(new THREE.Vector3(x, y, z));
  }
  return out;
}
