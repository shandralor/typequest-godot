// The live Three view of a mutable IslandDef, index-keyed to the document (tiles[i] <-> objects
// [i]) so undo/redo by document index stays in sync. Uses the SAME expansion math as the game
// (tilePlacement / propPlacement), so the editor preview is exactly what the game draws.
// Structural edits call rebuildAll (cheap: clones of cached templates); live transforms update
// one object's matrix in place.

import * as THREE from "three";
import { axialToWorld, tilePlacement, propPlacement, islandModels, COL_PITCH, type IslandDef } from "../world/hexGrid";
import type { IslandScene } from "../render/islandScene";
import type { Cell } from "./edit_core";

export type Selection = { kind: "tile" | "prop"; index: number } | null;

const HEX_R = COL_PITCH / Math.sqrt(3); // circumradius (corner) of a tile: 3.464

function hexOutline(color: number, y: number, width = 1): THREE.LineLoop {
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 180) * (30 + 60 * k); // pointy-top: corners along +-z
    pts.push(new THREE.Vector3(HEX_R * Math.cos(a), y, HEX_R * Math.sin(a)));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color, linewidth: width, depthTest: false, transparent: true, opacity: 0.95 });
  const loop = new THREE.LineLoop(geo, mat);
  loop.renderOrder = 999;
  return loop;
}

function ring(color: number, radius: number): THREE.LineLoop {
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2;
    pts.push(new THREE.Vector3(radius * Math.cos(a), 0.08, radius * Math.sin(a)));
  }
  const mat = new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 });
  const loop = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), mat);
  loop.renderOrder = 999;
  return loop;
}

/** A visible stand-in for a model that failed to load (the loud-placeholder rule). */
function placeholder(): THREE.Object3D {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xff2040 }));
  m.position.y = 0.5;
  return m;
}

export class IslandView {
  readonly group = new THREE.Group();
  readonly tilesGroup = new THREE.Group();
  readonly propsGroup = new THREE.Group();
  readonly hover = hexOutline(0xffffff, 0.12, 2);
  readonly selectHex = hexOutline(0xffc400, 0.16, 3);
  readonly selectRing = ring(0xffc400, 2);
  private tileObjs: THREE.Object3D[] = [];
  private propObjs: THREE.Object3D[] = [];

  constructor(private readonly s: IslandScene) {
    this.group.name = "island";
    this.group.add(this.tilesGroup, this.propsGroup, this.hover, this.selectHex, this.selectRing);
    this.hover.visible = false;
    this.selectHex.visible = false;
    this.selectRing.visible = false;
    s.scene.add(this.group);
  }

  async ensureModels(def: IslandDef): Promise<void> {
    await Promise.all(islandModels(def).map((m) => this.s.loadModel(m).catch(() => null)));
  }

  private instance(model: string, matrix: THREE.Matrix4, userData: Record<string, number>): THREE.Object3D {
    const base = this.s.getModel(model);
    const wrap = new THREE.Group();
    wrap.applyMatrix4(matrix);
    wrap.add(base ? base.clone(true) : placeholder());
    Object.assign(wrap.userData, userData);
    return wrap;
  }

  /** Rebuild every object from the document (call after any structural change). */
  rebuildAll(def: IslandDef): void {
    this.tilesGroup.clear();
    this.propsGroup.clear();
    this.tileObjs = def.tiles.map((t, i) => {
      const p = tilePlacement(t);
      const o = this.instance(p.model, p.matrix, { tileIndex: i });
      this.tilesGroup.add(o);
      return o;
    });
    this.propObjs = def.props.map((pr, i) => {
      const p = propPlacement(pr);
      const o = this.instance(p.model, p.matrix, { propIndex: i });
      this.propsGroup.add(o);
      return o;
    });
  }

  /** Re-apply one tile's transform (rotation) in place. Model changes need rebuildAll. */
  updateTile(def: IslandDef, i: number): void {
    const o = this.tileObjs[i];
    if (!o) return;
    const p = tilePlacement(def.tiles[i]);
    o.matrix.identity();
    o.position.set(0, 0, 0);
    o.quaternion.identity();
    o.scale.set(1, 1, 1);
    o.applyMatrix4(p.matrix);
  }

  /** Re-apply one prop's transform (move/rotate/scale) in place. */
  updateProp(def: IslandDef, i: number): void {
    const o = this.propObjs[i];
    if (!o) return;
    const p = propPlacement(def.props[i]);
    o.position.set(0, 0, 0);
    o.quaternion.identity();
    o.scale.set(1, 1, 1);
    o.applyMatrix4(p.matrix);
    if (this.selectRing.visible && this.selectRing.userData.propIndex === i) this.placeSelectRing(def, i);
  }

  /** The prop index a picked Object3D belongs to, or null. */
  propIndexOf(obj: THREE.Object3D | null): number | null {
    let o: THREE.Object3D | null = obj;
    while (o) {
      if (typeof o.userData.propIndex === "number") return o.userData.propIndex;
      o = o.parent;
    }
    return null;
  }

  setHover(cell: Cell | null): void {
    if (!cell) {
      this.hover.visible = false;
      return;
    }
    const w = axialToWorld(cell.q, cell.r);
    this.hover.position.set(w.x, 0, w.z);
    this.hover.visible = true;
  }

  private placeSelectRing(def: IslandDef, i: number): void {
    const p = def.props[i];
    const o = this.propObjs[i];
    if (!p || !o) return;
    const box = new THREE.Box3().setFromObject(o);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const rad = Math.max(0.8, Math.max(size.x, size.z) * 0.55);
    this.selectRing.scale.set(rad / 2, 1, rad / 2);
    this.selectRing.position.set(c.x, 0, c.z);
    this.selectRing.userData.propIndex = i;
  }

  setSelected(def: IslandDef, sel: Selection): void {
    this.selectHex.visible = false;
    this.selectRing.visible = false;
    if (!sel) return;
    if (sel.kind === "tile") {
      const t = def.tiles[sel.index];
      if (!t) return;
      const w = axialToWorld(t.q, t.r);
      this.selectHex.position.set(w.x, 0, w.z);
      this.selectHex.visible = true;
    } else {
      this.placeSelectRing(def, sel.index);
      this.selectRing.visible = true;
    }
  }
}
