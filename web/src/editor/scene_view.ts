// The live Three view of a mutable SceneDef, index-keyed per component kind (tiles[i] <->
// objects[i]) so undo/redo by document index stays in sync. Uses the SAME builders as the game
// (tilePlacement / propPlacement / buildShape / buildLight), so the preview is exactly what the
// game draws; anchors, routes and the camera get editor-only gizmos. Structural edits call
// rebuildAll (cheap: clones of cached templates); live transforms update one object in place.

import * as THREE from "three";
import { axialToWorld, tilePlacement, propPlacement, placedPosition, islandModels, COL_PITCH, type IslandDef } from "../world/hexGrid";
import type { SceneDef } from "../world/sceneDef";
import type { IslandScene } from "../render/islandScene";
import { applyShapeTransform, buildLight, buildShape } from "../render/sceneObjects";
import type { Cell } from "./edit_core";

export type Kind = "tile" | "prop" | "shape" | "anchor" | "light" | "route";
export type Selection = { kind: Kind; index: number; point?: number } | null;

const HEX_R = COL_PITCH / Math.sqrt(3); // circumradius (corner) of a tile: 3.464
const COLORS = { hover: 0xffffff, select: 0xffc400, anchor: 0x27d3ff, route: 0xff7a1a, light: 0xfff2a0, camera: 0xff4ddb };

function hexOutline(color: number, y: number): THREE.LineLoop {
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 180) * (30 + 60 * k); // pointy-top: corners along +-z
    pts.push(new THREE.Vector3(HEX_R * Math.cos(a), y, HEX_R * Math.sin(a)));
  }
  const mat = new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 });
  const loop = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), mat);
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

/** A text label that always faces the camera. */
function label(text: string, color: string): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.font = "bold 30px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "rgba(0,0,0,0.55)";
  const w = Math.min(250, g.measureText(text).width + 24);
  g.fillRect(128 - w / 2, 8, w, 48);
  g.fillStyle = color;
  g.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(4, 1, 1);
  s.renderOrder = 998;
  return s;
}

function pin(color: number, name: string): THREE.Object3D {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.1, 12), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5 }));
  cone.position.y = 0.55;
  cone.rotation.x = Math.PI; // point down at the anchor
  g.add(cone);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.6, 8), new THREE.MeshStandardMaterial({ color }));
  arrow.position.set(0, 0.3, 0.8); // facing +z: the anchor's yaw direction
  arrow.rotation.x = Math.PI / 2;
  g.add(arrow);
  const l = label(name, "#c8f3ff");
  l.position.y = 1.9;
  g.add(l);
  return g;
}

function sphere(color: number, r: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 }));
}

export class SceneView {
  readonly group = new THREE.Group();
  readonly tilesGroup = new THREE.Group();
  readonly propsGroup = new THREE.Group();
  readonly shapesGroup = new THREE.Group();
  readonly anchorsGroup = new THREE.Group();
  readonly lightsGroup = new THREE.Group();
  readonly routesGroup = new THREE.Group();
  readonly cameraGizmo = new THREE.Group();
  /** translucent placement preview that follows the cursor in the paint/place tools */
  readonly ghostGroup = new THREE.Group();
  private ghostKey = "";
  readonly hover = hexOutline(COLORS.hover, 0.12);
  readonly selectHex = hexOutline(COLORS.select, 0.16);
  readonly selectRing = ring(COLORS.select, 2);
  private objs: Record<Kind, THREE.Object3D[]> = { tile: [], prop: [], shape: [], anchor: [], light: [], route: [] };
  private lightNodes: THREE.Object3D[] = [];
  /** editor-only helpers can be hidden for a clean preview */
  gizmosVisible = true;

  constructor(private readonly s: IslandScene) {
    this.group.name = "island";
    this.group.add(this.tilesGroup, this.propsGroup, this.shapesGroup, this.anchorsGroup, this.lightsGroup, this.routesGroup, this.cameraGizmo, this.ghostGroup, this.hover, this.selectHex, this.selectRing);
    this.hover.visible = false;
    this.selectHex.visible = false;
    this.selectRing.visible = false;
    s.scene.add(this.group);
  }

  async ensureModels(def: IslandDef): Promise<void> {
    await Promise.all(islandModels(def).map((m) => this.s.loadModel(m).catch(() => null)));
  }

  private instance(model: string, matrix: THREE.Matrix4, ud: Record<string, unknown>): THREE.Object3D {
    const base = this.s.getModel(model);
    const wrap = new THREE.Group();
    wrap.applyMatrix4(matrix);
    wrap.add(base ? base.clone(true) : placeholder());
    Object.assign(wrap.userData, ud);
    return wrap;
  }

  /** Rebuild every object from the document (call after any structural change). */
  rebuildAll(def: SceneDef): void {
    for (const g of [this.tilesGroup, this.propsGroup, this.shapesGroup, this.anchorsGroup, this.lightsGroup, this.routesGroup, this.cameraGizmo]) g.clear();
    this.objs.tile = def.tiles.map((t, i) => {
      const p = tilePlacement(t);
      const o = this.instance(p.model, p.matrix, { kind: "tile", index: i });
      this.tilesGroup.add(o);
      return o;
    });
    this.objs.prop = def.props.map((pr, i) => {
      const p = propPlacement(pr);
      const o = this.instance(p.model, p.matrix, { kind: "prop", index: i });
      o.visible = !pr.hidden || this.gizmosVisible; // hidden props stay visible while editing
      if (pr.hidden) o.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh && m.material) { m.material = (m.material as THREE.Material).clone(); (m.material as THREE.MeshStandardMaterial).transparent = true; (m.material as THREE.MeshStandardMaterial).opacity = 0.45; } });
      this.propsGroup.add(o);
      return o;
    });
    this.objs.shape = (def.shapes ?? []).map((sh, i) => {
      const o = buildShape(sh);
      if (sh.hidden) o.visible = this.gizmosVisible;
      Object.assign(o.userData, { kind: "shape", index: i });
      this.shapesGroup.add(o);
      return o;
    });
    this.objs.anchor = (def.anchors ?? []).map((a, i) => {
      const o = pin(COLORS.anchor, a.name);
      o.position.copy(placedPosition(a));
      o.rotation.y = ((a.rot ?? 0) * Math.PI) / 180;
      Object.assign(o.userData, { kind: "anchor", index: i });
      this.anchorsGroup.add(o);
      return o;
    });
    this.lightNodes = [];
    this.objs.light = (def.lights ?? []).map((l, i) => {
      const light = buildLight(l);
      this.lightsGroup.add(light);
      this.lightNodes.push(light);
      const o = sphere(COLORS.light, 0.35);
      o.position.set(l.x, l.y, l.z);
      Object.assign(o.userData, { kind: "light", index: i });
      this.lightsGroup.add(o);
      return o;
    });
    this.objs.route = (def.routes ?? []).map((r, i) => this.buildRoute(r.name, r.points, i));
    this.buildCamera(def);
    this.anchorsGroup.visible = this.routesGroup.visible = this.cameraGizmo.visible = this.gizmosVisible;
  }

  private buildRoute(name: string, points: [number, number, number][], index: number): THREE.Object3D {
    const g = new THREE.Group();
    Object.assign(g.userData, { kind: "route", index });
    const pts = points.map((p) => new THREE.Vector3(p[0], p[1] + 0.15, p[2]));
    if (pts.length >= 2) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: COLORS.route, depthTest: false }));
      line.renderOrder = 997;
      g.add(line);
    }
    pts.forEach((p, k) => {
      const dot = sphere(COLORS.route, k === 0 ? 0.42 : 0.3);
      dot.position.copy(p);
      Object.assign(dot.userData, { kind: "route", index, point: k });
      g.add(dot);
    });
    if (pts.length) {
      const l = label(name, "#ffd2b0");
      l.position.copy(pts[0]).add(new THREE.Vector3(0, 1.4, 0));
      g.add(l);
    }
    this.routesGroup.add(g);
    return g;
  }

  private buildCamera(def: SceneDef): void {
    this.cameraGizmo.clear();
    if (!def.camera) return;
    const pos = new THREE.Vector3(...def.camera.pos);
    const look = new THREE.Vector3(...def.camera.look);
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 4), new THREE.MeshStandardMaterial({ color: COLORS.camera, emissive: COLORS.camera, emissiveIntensity: 0.5 }));
    body.position.copy(pos);
    body.lookAt(look);
    body.rotateX(Math.PI / 2);
    this.cameraGizmo.add(body);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([pos, look]), new THREE.LineDashedMaterial({ color: COLORS.camera, dashSize: 1, gapSize: 0.6, depthTest: false }));
    line.computeLineDistances();
    this.cameraGizmo.add(line);
    const target = sphere(COLORS.camera, 0.3);
    target.position.copy(look);
    this.cameraGizmo.add(target);
    const l = label("camera", "#ffc6f3");
    l.position.copy(pos).add(new THREE.Vector3(0, 1.6, 0));
    this.cameraGizmo.add(l);
  }

  /** Re-apply one item's transform in place (live drags). Model/kind changes need rebuildAll. */
  updateItem(def: SceneDef, sel: Selection): void {
    if (!sel) return;
    const o = this.objs[sel.kind][sel.index];
    if (!o) return;
    switch (sel.kind) {
      case "tile": {
        const p = tilePlacement(def.tiles[sel.index]);
        o.position.set(0, 0, 0); o.quaternion.identity(); o.scale.set(1, 1, 1); o.applyMatrix4(p.matrix);
        break;
      }
      case "prop": {
        const p = propPlacement(def.props[sel.index]);
        o.position.set(0, 0, 0); o.quaternion.identity(); o.scale.set(1, 1, 1); o.applyMatrix4(p.matrix);
        break;
      }
      case "shape":
        applyShapeTransform(o, def.shapes![sel.index]);
        if (def.shapes![sel.index].hidden) o.visible = this.gizmosVisible;
        break;
      case "anchor": {
        const a = def.anchors![sel.index];
        o.position.copy(placedPosition(a));
        o.rotation.y = ((a.rot ?? 0) * Math.PI) / 180;
        break;
      }
      case "light": {
        const l = def.lights![sel.index];
        o.position.set(l.x, l.y, l.z);
        this.lightNodes[sel.index]?.position.set(l.x, l.y, l.z);
        break;
      }
      case "route": {
        const r = def.routes![sel.index];
        this.routesGroup.remove(o);
        this.objs.route[sel.index] = this.buildRoute(r.name, r.points, sel.index);
        break;
      }
    }
    if (this.selectRing.visible) this.placeSelectRing(def, sel);
  }

  /** Objects the viewport raycasts against for picking. */
  pickables(): THREE.Object3D[] {
    return [...this.propsGroup.children, ...this.shapesGroup.children, ...this.anchorsGroup.children, ...this.lightsGroup.children.filter((c) => c.userData.kind), ...this.routesGroup.children];
  }

  /** The selection a picked Object3D belongs to, or null. */
  pickOf(obj: THREE.Object3D | null): Selection {
    let o: THREE.Object3D | null = obj;
    while (o) {
      if (typeof o.userData.kind === "string") {
        const sel: Selection = { kind: o.userData.kind as Kind, index: o.userData.index as number };
        if (typeof o.userData.point === "number") sel.point = o.userData.point;
        return sel;
      }
      o = o.parent;
    }
    return null;
  }

  /**
   * Show a translucent preview of what a click would place: `key` identifies the content (a
   * model path, "shape:box", "anchor", "light"); `matrix` is where it would land. Pass null to
   * hide. The ghost object is rebuilt only when the key changes.
   */
  showGhost(key: string | null, matrix?: THREE.Matrix4): void {
    if (!key) {
      this.ghostGroup.visible = false;
      return;
    }
    if (key !== this.ghostKey) {
      this.ghostGroup.clear();
      this.ghostKey = key;
      let obj: THREE.Object3D;
      if (key.startsWith("shape:")) {
        obj = buildShape({ kind: key.endsWith("plane") ? "plane" : "box", size: key.endsWith("plane") ? [2, 2] : [2, 1, 2], color: "#ffffff", x: 0, z: 0 });
      } else if (key === "anchor") obj = pin(COLORS.anchor, "anchor");
      else if (key === "light") obj = sphere(COLORS.light, 0.35);
      else {
        const base = this.s.getModel(key);
        obj = base ? base.clone(true) : placeholder();
      }
      obj.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh && m.material) {
          const mat = (m.material as THREE.Material).clone() as THREE.MeshStandardMaterial;
          mat.transparent = true;
          mat.opacity = 0.5;
          mat.depthWrite = false;
          m.material = mat;
          m.castShadow = false;
          m.receiveShadow = false;
        }
      });
      // strip any placement the builder applied; the group carries the matrix
      obj.position.set(0, 0, 0); obj.quaternion.identity(); obj.scale.set(1, 1, 1);
      this.ghostGroup.add(obj);
    }
    if (matrix) {
      this.ghostGroup.position.set(0, 0, 0); this.ghostGroup.quaternion.identity(); this.ghostGroup.scale.set(1, 1, 1);
      this.ghostGroup.applyMatrix4(matrix);
    }
    this.ghostGroup.visible = true;
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

  private placeSelectRing(def: SceneDef, sel: Exclude<Selection, null>): void {
    const o = this.objs[sel.kind][sel.index];
    if (!o) return;
    let c: THREE.Vector3;
    let rad = 1;
    if (sel.kind === "route" && sel.point !== undefined) {
      const p = def.routes![sel.index].points[sel.point];
      c = new THREE.Vector3(p[0], p[1], p[2]);
      rad = 0.7;
    } else if (sel.kind === "route") {
      const box = new THREE.Box3().setFromObject(o);
      c = box.getCenter(new THREE.Vector3());
      rad = Math.max(1, box.getSize(new THREE.Vector3()).length() * 0.5);
    } else {
      const box = new THREE.Box3().setFromObject(o);
      const size = box.getSize(new THREE.Vector3());
      c = box.getCenter(new THREE.Vector3());
      rad = Math.max(0.8, Math.max(size.x, size.z) * 0.55);
    }
    this.selectRing.scale.set(rad / 2, 1, rad / 2);
    this.selectRing.position.set(c.x, sel.kind === "light" ? c.y : 0, c.z);
  }

  setSelected(def: SceneDef, sel: Selection): void {
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
      this.placeSelectRing(def, sel);
      this.selectRing.visible = true;
    }
  }

  setGizmos(on: boolean, def: SceneDef): void {
    this.gizmosVisible = on;
    this.rebuildAll(def);
  }

  /** Ground-plane bounds of the "land" content (non-water tiles, props, shapes) for framing. */
  landBox(def: SceneDef): THREE.Box3 | null {
    const box = new THREE.Box3();
    def.tiles.forEach((t, i) => {
      if (t.t !== "water" && !t.t.startsWith("coast")) box.expandByObject(this.objs.tile[i]);
    });
    this.objs.prop.forEach((o, i) => {
      if (!/cloud/.test(def.props[i].m)) box.expandByObject(o);
    });
    this.objs.shape.forEach((o) => box.expandByObject(o));
    this.objs.anchor.forEach((o) => box.expandByPoint(o.position));
    return box.isEmpty() ? null : box;
  }
}
