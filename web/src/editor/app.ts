// The scene editor coordinator: owns the working SceneDef, the undo stack, tool state and the
// selection; turns viewport hits into document commands; drives the palette/inspector DOM.
// Every component kind (tile, prop, shape, anchor, light, route, camera) is placeable, selectable,
// movable and editable. Every edit is applied to the document, mirrored in the view, and pushed
// as an undo command; live drags/wheel bursts mutate in place and commit ONE entry.

import * as THREE from "three";
import { axialToWorld, placedMatrix, tilePlacement, type IslandDef } from "../world/hexGrid";
import type { AnchorDef, LightDef, Placed, PropDef, RouteDef, SceneDef, ShapeDef, TileDef } from "../world/sceneDef";
import { stashEditorIsland, clearEditorIsland } from "../world/editorHandoff";
import { UndoStack } from "./undo_core";
import { cloneIsland, sanitizeIslandDef, serializeIslandJson, serializeIslandTs } from "./island_doc";
import { propWorld, snapPropToCell, tileIndexAt, unsnapProp } from "./edit_core";
import { CommitCoalescer, NUDGE_STEP, NUDGE_STEP_BIG, PROP_ROT_STEP_BIG_DEG, PROP_ROT_STEP_DEG, nudgeDelta, propRotStep, scaleStep, tileRotStep, type NudgeKey } from "./transform_core";
import { Viewport, type Hit } from "./viewport";
import type { Kind, Selection } from "./scene_view";
import { PROPS, PROP_CATEGORIES, TILES } from "./catalog.generated";
import { AUTHORED, type AuthoredScene } from "./content_index";
import { starterIsland, starterInterior } from "./starters";

type Tool = "select" | "tile" | "prop" | "shape" | "anchor" | "light" | "route" | "erase";
type Item = TileDef | PropDef | ShapeDef | AnchorDef | LightDef | RouteDef;
const DRAFT_PREFIX = "tq_island_draft:";
const TOOL_KEYS: Record<string, Tool> = { "1": "select", "2": "tile", "3": "prop", "4": "shape", "5": "anchor", "6": "light", "7": "route", "8": "erase" };

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error("missing #" + id);
  return el as T;
}
function defaultScaleFor(path: string): number {
  return path.startsWith("kaykit/hexagon/") ? 3 : 1;
}
function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  let o: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (typeof o[k] !== "object" || o[k] === null) o[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    o = o[k] as Record<string, unknown>;
  }
  const last = keys[keys.length - 1];
  if (value === undefined || value === "" || (typeof value === "number" && Number.isNaN(value))) delete o[last];
  else o[last] = value;
}

export class App {
  def: SceneDef;
  readonly undo = new UndoStack();
  tool: Tool = "select";
  tileCode = "grass";
  propPath = PROPS[0]?.path ?? "";
  shapeKind: "box" | "plane" = "box";
  shapeColor = "#c8b48a";
  /** rotation applied to the NEXT placed item (tiles: steps, others: degrees) */
  placeRotTile = 0;
  placeRotDeg = 0;
  sel: Selection = null;
  snapProps = false;
  dirty = false;
  scene: AuthoredScene;
  /** the authored scenes plus any created this session (unsaved until Ctrl+S) */
  readonly scenes: AuthoredScene[] = [...AUTHORED];
  private readonly vp: Viewport;
  private readonly coalescer = new CommitCoalescer();
  private liveBase: { sel: Exclude<Selection, null>; prev: Item } | null = null;
  private draftTimer: number | null = null;

  constructor() {
    this.scene = this.scenes.find((x) => x.name === "overworld") ?? this.scenes[0];
    this.def = this.loadInitial();
    this.vp = new Viewport($<HTMLCanvasElement>("view"), {
      onHover: (h) => this.onHover(h),
      onTap: (h) => this.onTap(h),
      onDragStart: (h) => this.onDragStart(h),
      onDragMove: (h) => this.onDragMove(h),
      onDragEnd: () => this.commitLive("move"),
      onWheel: (e) => this.onWheel(e),
    });
    this.bindDom();
    this.renderPalettes();
    this.renderSceneSelect();
    void this.vp.view.ensureModels(this.def).then(() => {
      this.vp.view.rebuildAll(this.def);
      this.frame();
      this.vp.scene.setupPost();
      this.vp.start();
      document.body.setAttribute("data-ready", "1");
    });
    window.setInterval(() => {
      if (this.coalescer.due(performance.now())) this.commitLive("transform");
    }, 100);
    this.refreshUi();
  }

  // ---------- document lifecycle ----------
  private draftKey(): string {
    return DRAFT_PREFIX + this.scene.name;
  }

  private loadInitial(): SceneDef {
    try {
      const raw = localStorage.getItem(this.draftKey());
      if (raw) {
        const d = sanitizeIslandDef(JSON.parse(raw));
        if (d) {
          this.dirty = true;
          return d;
        }
      }
    } catch {
      /* broken storage: fall through to the authored file */
    }
    return cloneIsland(this.scene.def);
  }

  private markDirty(): void {
    this.dirty = true;
    if (this.draftTimer !== null) window.clearTimeout(this.draftTimer);
    this.draftTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(this.draftKey(), JSON.stringify(this.def));
      } catch {
        /* storage blocked */
      }
    }, 400);
    this.refreshUi();
  }

  private structural(): void {
    this.vp.view.rebuildAll(this.def);
    this.vp.view.setSelected(this.def, this.sel);
    this.markDirty();
  }

  openScene(name: string): void {
    const s = this.scenes.find((x) => x.name === name);
    if (!s || s.name === this.scene.name) return;
    if (this.dirty && !window.confirm("Discard unsaved changes to the current scene? (a draft is kept)")) {
      this.renderSceneSelect();
      return;
    }
    this.scene = s;
    this.dirty = false;
    this.def = this.loadInitial();
    this.undo.clear();
    this.sel = null;
    void this.vp.view.ensureModels(this.def).then(() => {
      this.vp.view.rebuildAll(this.def);
      this.frame();
      this.refreshUi();
    });
    this.refreshUi();
  }

  /** Create a scene from a template (or a copy of the current one) and open it unsaved. */
  newScene(name: string, dir: "island" | "scenes", template: "clone" | "island" | "interior" | "empty"): boolean {
    name = name.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]{0,40}$/.test(name)) { this.toast("Name: lowercase letters, digits, underscores"); return false; }
    if (this.scenes.some((x) => x.name === name)) { this.toast(`A scene named ${name} already exists`); return false; }
    if (this.dirty && !window.confirm("Discard unsaved changes to the current scene? (a draft is kept)")) return false;
    const def: SceneDef = template === "clone" ? cloneIsland(this.def) : template === "island" ? starterIsland() : template === "interior" ? starterInterior() : { tiles: [], props: [] };
    const entry: AuthoredScene = { name, dir, def: cloneIsland(def) };
    this.scenes.push(entry);
    this.scene = entry;
    this.def = def;
    this.undo.clear();
    this.sel = null;
    this.dirty = true;
    localStorage.removeItem(this.draftKey());
    this.renderSceneSelect();
    void this.vp.view.ensureModels(this.def).then(() => {
      this.vp.view.rebuildAll(this.def);
      this.frame();
      this.markDirty();
    });
    this.toast(`New scene ${dir}/${name} -- unsaved until Ctrl+S`);
    this.refreshUi();
    return true;
  }

  async save(): Promise<void> {
    const exportName = this.scene.name.toUpperCase();
    const source = serializeIslandTs(this.def, exportName);
    try {
      const res = await fetch("/__editor/save", { method: "POST", body: JSON.stringify({ name: this.scene.name, dir: this.scene.dir, source }) });
      const j = (await res.json()) as { ok?: boolean; file?: string; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error ?? String(res.status));
      this.dirty = false;
      localStorage.removeItem(this.draftKey());
      this.scene.def = cloneIsland(this.def); // "Reset to file" now returns to what was written
      this.toast(`Saved ${j.file}`);
    } catch (err) {
      this.toast(`Save failed: ${String(err)} (dev server only)`);
    }
    this.refreshUi();
  }

  reset(): void {
    if (!window.confirm("Discard the draft and reload the authored file?")) return;
    localStorage.removeItem(this.draftKey());
    this.def = cloneIsland(this.scene.def);
    this.undo.clear();
    this.sel = null;
    void this.vp.view.ensureModels(this.def).then(() => {
      this.vp.view.rebuildAll(this.def);
      this.dirty = false;
      this.refreshUi();
    });
  }

  download(): void {
    const blob = new Blob([serializeIslandJson(this.def)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${this.scene.name}.scene.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  playtest(): void {
    stashEditorIsland(this.def);
    window.open("/", "_blank");
    clearEditorIsland(); // window.open copied it into the new tab; drop OUR copy
  }

  frame(): void {
    const box = this.vp.view.landBox(this.def);
    if (!box) return;
    this.vp.cam.frame(box.min.x, box.min.z, box.max.x, box.max.z);
  }

  // ---------- selection + generic item access ----------
  select(sel: Selection): void {
    this.sel = sel;
    this.vp.view.setSelected(this.def, sel);
    this.refreshUi();
  }

  private list(kind: Kind): Item[] {
    switch (kind) {
      case "tile": return this.def.tiles;
      case "prop": return this.def.props;
      case "shape": return (this.def.shapes ??= []);
      case "anchor": return (this.def.anchors ??= []);
      case "light": return (this.def.lights ??= []);
      case "route": return (this.def.routes ??= []);
    }
  }

  private item(sel: Exclude<Selection, null>): Item | undefined {
    return this.list(sel.kind)[sel.index];
  }

  /** Placement key for the ghost preview of the current tool. */
  private ghostKey(): string | null {
    switch (this.tool) {
      case "tile": return `kaykit/hexagon/hex_${this.tileCode}.gltf`;
      case "prop": return this.propPath || null;
      case "shape": return `shape:${this.shapeKind}`;
      case "anchor": return "anchor";
      case "light": return "light";
      case "route": return "light";
      default: return null;
    }
  }

  private ghostMatrix(hit: Hit): THREE.Matrix4 {
    switch (this.tool) {
      case "tile":
        return tilePlacement({ q: hit.cell.q, r: hit.cell.r, t: this.tileCode, rot: this.placeRotTile }).matrix;
      case "prop": {
        const snap = this.snapProps !== hit.shift;
        const p: Placed = snap ? { q: hit.cell.q, r: hit.cell.r, rot: this.placeRotDeg } : { x: hit.world.x, z: hit.world.z, rot: this.placeRotDeg };
        return placedMatrix(p, defaultScaleFor(this.propPath));
      }
      case "shape":
        return placedMatrix({ x: hit.world.x, z: hit.world.z, y: this.shapeKind === "box" ? 0.5 : 0.02, rot: this.placeRotDeg }, 1);
      case "light":
        return placedMatrix({ x: hit.world.x, z: hit.world.z, y: 3 }, 1);
      default:
        return placedMatrix({ x: hit.world.x, z: hit.world.z, rot: this.placeRotDeg }, 1);
    }
  }

  // ---------- viewport hooks ----------
  private onHover(hit: Hit | null): void {
    const placing = this.tool !== "select" && this.tool !== "erase";
    this.vp.view.setHover(hit && (this.tool === "tile" || this.tool === "erase" || (this.tool === "prop" && this.snapProps !== hit.shift)) ? hit.cell : null);
    const key = hit && placing ? this.ghostKey() : null;
    if (key && hit) {
      if (this.tool === "prop" || this.tool === "tile") void this.vp.scene.loadModel(key).then(() => this.vp.view.showGhost(key, this.ghostMatrix(hit)));
      else this.vp.view.showGhost(key, this.ghostMatrix(hit));
    } else this.vp.view.showGhost(null);
    $<HTMLElement>("stats").textContent = this.statsText(hit);
  }

  private onTap(hit: Hit): void {
    switch (this.tool) {
      case "select": {
        if (hit.pick) return this.select(hit.pick);
        const i = tileIndexAt(this.def.tiles, hit.cell.q, hit.cell.r);
        return this.select(i >= 0 ? { kind: "tile", index: i } : null);
      }
      case "tile": return this.paintTile(hit.cell.q, hit.cell.r, hit.shift);
      case "prop": return this.placeProp(hit);
      case "shape": return this.placeShape(hit);
      case "anchor": return this.placeAnchor(hit);
      case "light": return this.placeLight(hit);
      case "route": return this.routeClick(hit);
      case "erase": return this.eraseAt(hit);
    }
  }

  private movable(sel: Selection): boolean {
    return !!sel && (sel.kind !== "tile") && !(sel.kind === "route" && sel.point === undefined);
  }

  private onDragStart(hit: Hit): boolean {
    if (this.tool !== "select" || !hit.pick || !this.movable(hit.pick)) return false;
    this.select(hit.pick);
    this.beginLive();
    return true;
  }

  private onDragMove(hit: Hit): void {
    if (!this.sel || !this.movable(this.sel)) return;
    this.moveSelectedTo(hit.world.x, hit.world.z, this.snapProps !== hit.shift);
  }

  private onWheel(e: WheelEvent): boolean {
    const dir: 1 | -1 = e.deltaY > 0 ? 1 : -1;
    if (!(e.shiftKey || e.altKey)) return false;
    if (!this.sel) {
      // no selection: the wheel rotates the placement ghost
      if (this.tool === "tile") this.placeRotTile = tileRotStep(this.placeRotTile, dir);
      else this.placeRotDeg = propRotStep(this.placeRotDeg, dir, PROP_ROT_STEP_DEG);
      return true;
    }
    this.beginLive();
    if (e.shiftKey) this.applyRotate(dir, false);
    else this.applyScale(e.deltaY);
    this.coalescer.tick(performance.now());
    this.renderInspector();
    return true;
  }

  // ---------- live-transform undo pattern ----------
  private beginLive(): void {
    if (this.liveBase || !this.sel) return;
    const it = this.item(this.sel);
    if (!it) return;
    this.liveBase = { sel: { ...this.sel }, prev: deepClone(it) };
  }

  private commitLive(label: string): void {
    const base = this.liveBase;
    this.liveBase = null;
    this.coalescer.cancel();
    if (!base) return;
    const arr = this.list(base.sel.kind);
    const next = deepClone(arr[base.sel.index]);
    if (JSON.stringify(next) === JSON.stringify(base.prev)) return;
    const restore = (v: Item): void => {
      this.list(base.sel.kind)[base.sel.index] = deepClone(v);
      this.vp.view.updateItem(this.def, base.sel);
      this.vp.view.setSelected(this.def, this.sel);
      this.markDirty();
      this.renderInspector();
    };
    this.undo.push({ label, undo: () => restore(base.prev), redo: () => restore(next) });
    this.markDirty();
  }

  private moveSelectedTo(x: number, z: number, snap: boolean): void {
    const sel = this.sel!;
    const it = this.item(sel);
    if (!it) return;
    switch (sel.kind) {
      case "prop": case "shape": case "anchor": {
        const p = it as Placed;
        const moved = { ...p, x, z } as Placed;
        delete moved.q; delete moved.r;
        this.list(sel.kind)[sel.index] = (sel.kind !== "shape" && snap ? snapPropToCell(moved) : unsnapProp(moved)) as Item;
        break;
      }
      case "light": (it as LightDef).x = x; (it as LightDef).z = z; break;
      case "route": {
        const r = it as RouteDef;
        if (sel.point !== undefined && r.points[sel.point]) r.points[sel.point] = [x, r.points[sel.point][1], z];
        break;
      }
    }
    this.vp.view.updateItem(this.def, sel);
    this.renderInspector();
  }

  private applyRotate(dir: 1 | -1, big: boolean): void {
    const sel = this.sel!;
    const it = this.item(sel);
    if (!it) return;
    if (sel.kind === "tile") {
      const t = it as TileDef;
      t.rot = tileRotStep(t.rot ?? 0, dir);
      if (!t.rot) delete t.rot;
    } else if (sel.kind === "prop" || sel.kind === "shape" || sel.kind === "anchor") {
      const p = it as Placed;
      p.rot = propRotStep(p.rot ?? 0, dir, big ? PROP_ROT_STEP_BIG_DEG : PROP_ROT_STEP_DEG);
      if (!p.rot) delete p.rot;
    } else return;
    this.vp.view.updateItem(this.def, sel);
  }

  private applyScale(deltaY: number): void {
    const sel = this.sel!;
    const it = this.item(sel);
    if (!it) return;
    if (sel.kind === "prop") {
      const p = it as PropDef;
      if (p.sc) {
        const f = scaleStep(1, deltaY);
        p.sc = [p.sc[0] * f, p.sc[1] * f, p.sc[2] * f].map((v) => Math.round(v * 1000) / 1000) as [number, number, number];
      } else {
        p.s = scaleStep(p.s ?? 1, deltaY);
        if (p.s === 1) delete p.s;
      }
    } else if (sel.kind === "shape") {
      const sh = it as ShapeDef;
      const f = scaleStep(1, deltaY);
      const sc = sh.sc ?? [1, 1, 1];
      sh.sc = [sc[0] * f, sc[1] * f, sc[2] * f].map((v) => Math.round(v * 1000) / 1000) as [number, number, number];
    } else return;
    this.vp.view.updateItem(this.def, sel);
  }

  // ---------- commands ----------
  private addItem(kind: Kind, item: Item, label: string): void {
    const arr = this.list(kind);
    const at = arr.length;
    arr.push(item);
    this.undo.push({
      label,
      undo: () => { this.list(kind).splice(at, 1); this.sel = null; this.structural(); },
      redo: () => { this.list(kind).splice(at, 0, item); this.structural(); },
    });
    this.sel = { kind, index: at };
    this.structural();
    this.refreshUi();
  }

  removeItem(kind: Kind, i: number): void {
    const arr = this.list(kind);
    const [item] = arr.splice(i, 1);
    if (!item) return;
    this.undo.push({
      label: `${kind}.remove`,
      undo: () => { this.list(kind).splice(i, 0, item); this.structural(); },
      redo: () => { this.list(kind).splice(i, 1); this.sel = null; this.structural(); },
    });
    this.sel = null;
    this.structural();
  }

  paintTile(q: number, r: number, stack: boolean): void {
    const i = tileIndexAt(this.def.tiles, q, r);
    if (i >= 0 && !stack) {
      const prev = { ...this.def.tiles[i] };
      // painting the same code again rotates it a step; a new code replaces it (keeps rotation)
      const next: TileDef = prev.t === this.tileCode ? { ...prev, rot: tileRotStep(prev.rot ?? 0, 1) } : { ...prev, t: this.tileCode };
      if (!next.rot) delete next.rot;
      this.def.tiles[i] = next;
      this.undo.push({
        label: "tile.replace",
        undo: () => { this.def.tiles[i] = prev; this.structural(); },
        redo: () => { this.def.tiles[i] = next; this.structural(); },
      });
      this.sel = { kind: "tile", index: i };
      void this.vp.view.ensureModels({ tiles: [next], props: [] }).then(() => this.structural());
      this.structural();
      return;
    }
    const tile: TileDef = { q, r, t: this.tileCode };
    if (this.placeRotTile) tile.rot = this.placeRotTile;
    void this.vp.view.ensureModels({ tiles: [tile], props: [] }).then(() => this.structural());
    this.addItem("tile", tile, "tile.add");
  }

  placeProp(hit: Hit): void {
    if (!this.propPath) return;
    const snap = this.snapProps !== hit.shift;
    const base: PropDef = { m: this.propPath, x: hit.world.x, z: hit.world.z };
    const s = defaultScaleFor(this.propPath);
    if (s !== 1) base.s = s;
    if (this.placeRotDeg) base.rot = this.placeRotDeg;
    const prop = snap ? snapPropToCell(base) : base;
    void this.vp.view.ensureModels({ tiles: [], props: [prop] }).then(() => this.structural());
    this.addItem("prop", prop, "prop.add");
  }

  placeShape(hit: Hit): void {
    const sh: ShapeDef = this.shapeKind === "box"
      ? { kind: "box", size: [2, 1, 2], color: this.shapeColor, x: hit.world.x, z: hit.world.z, y: 0.5 }
      : { kind: "plane", size: [4, 4], color: this.shapeColor, x: hit.world.x, z: hit.world.z, y: 0.02 };
    if (this.placeRotDeg) sh.rot = this.placeRotDeg;
    this.addItem("shape", sh, "shape.add");
  }

  placeAnchor(hit: Hit): void {
    const n = (this.def.anchors?.length ?? 0) + 1;
    const a: AnchorDef = { name: `anchor_${n}`, x: hit.world.x, z: hit.world.z };
    if (this.placeRotDeg) a.rot = this.placeRotDeg;
    this.addItem("anchor", a, "anchor.add");
  }

  placeLight(hit: Hit): void {
    this.addItem("light", { kind: "omni", x: hit.world.x, y: 3, z: hit.world.z, color: "#ffd9a0", energy: 1, range: 8 }, "light.add");
  }

  /** Route tool: append a point to the selected route, or start a new route. */
  routeClick(hit: Hit): void {
    const pt: [number, number, number] = [hit.world.x, 0, hit.world.z];
    if (this.sel?.kind === "route") {
      const i = this.sel.index;
      const r = this.def.routes![i];
      const at = r.points.length;
      r.points.push(pt);
      this.undo.push({
        label: "route.point.add",
        undo: () => { this.def.routes![i].points.splice(at, 1); this.sel = { kind: "route", index: i }; this.structural(); },
        redo: () => { this.def.routes![i].points.splice(at, 0, pt); this.structural(); },
      });
      this.sel = { kind: "route", index: i, point: at };
      this.structural();
      return;
    }
    const n = (this.def.routes?.length ?? 0) + 1;
    this.addItem("route", { name: `route_${n}`, points: [pt] }, "route.add");
    this.sel = { kind: "route", index: this.def.routes!.length - 1, point: 0 };
    this.vp.view.setSelected(this.def, this.sel);
  }

  removeRoutePoint(i: number, k: number): void {
    const r = this.def.routes?.[i];
    if (!r) return;
    if (r.points.length <= 1) return this.removeItem("route", i);
    const [pt] = r.points.splice(k, 1);
    this.undo.push({
      label: "route.point.remove",
      undo: () => { this.def.routes![i].points.splice(k, 0, pt); this.structural(); },
      redo: () => { this.def.routes![i].points.splice(k, 1); this.sel = { kind: "route", index: i }; this.structural(); },
    });
    this.sel = { kind: "route", index: i };
    this.structural();
  }

  eraseAt(hit: Hit): void {
    if (hit.pick) {
      if (hit.pick.kind === "route" && hit.pick.point !== undefined) return this.removeRoutePoint(hit.pick.index, hit.pick.point);
      return this.removeItem(hit.pick.kind, hit.pick.index);
    }
    const i = tileIndexAt(this.def.tiles, hit.cell.q, hit.cell.r);
    if (i >= 0) this.removeItem("tile", i);
  }

  deleteSelected(): void {
    if (!this.sel) return;
    if (this.sel.kind === "route" && this.sel.point !== undefined) return this.removeRoutePoint(this.sel.index, this.sel.point);
    this.removeItem(this.sel.kind, this.sel.index);
  }

  rotateSelected(dir: 1 | -1, big: boolean): void {
    if (!this.sel) {
      if (this.tool === "tile") this.placeRotTile = tileRotStep(this.placeRotTile, dir);
      else this.placeRotDeg = propRotStep(this.placeRotDeg, dir, big ? PROP_ROT_STEP_BIG_DEG : PROP_ROT_STEP_DEG);
      return;
    }
    this.beginLive();
    this.applyRotate(dir, big);
    this.commitLive("rotate");
    this.renderInspector();
  }

  nudgeSelected(key: NudgeKey, big: boolean): void {
    if (!this.sel || !this.movable(this.sel)) return;
    this.beginLive();
    const d = nudgeDelta(key, this.vp.cam.yaw, big ? NUDGE_STEP_BIG : NUDGE_STEP);
    const it = this.item(this.sel)!;
    let w: { x: number; z: number };
    if (this.sel.kind === "light") w = { x: (it as LightDef).x, z: (it as LightDef).z };
    else if (this.sel.kind === "route") { const p = (it as RouteDef).points[this.sel.point!]; w = { x: p[0], z: p[2] }; }
    else w = propWorld(it as Placed);
    this.moveSelectedTo(w.x + d.dx, w.z + d.dz, false);
    this.coalescer.tick(performance.now());
  }

  /** Inspector field edit on the selected item (dotted paths allowed): one undo entry per change. */
  patchSelected(path: string, value: unknown): void {
    if (!this.sel) return;
    this.beginLive();
    const arr = this.list(this.sel.kind);
    const next = deepClone(arr[this.sel.index]) as unknown as Record<string, unknown>;
    setPath(next, path, value);
    // keep tilt/sc canonical: drop when all zeros / ones
    if (Array.isArray(next.tilt) && (next.tilt as number[]).every((v) => !v)) delete next.tilt;
    if (Array.isArray(next.sc) && (next.sc as number[]).every((v) => v === 1)) delete next.sc;
    if (next.s === 1) delete next.s;
    if (next.hidden === false) delete next.hidden;
    arr[this.sel.index] = next as unknown as Item;
    const structuralKeys = ["t", "m", "kind", "size", "color", "alpha", "emissive", "hidden", "name", "sc"];
    const needsRebuild = structuralKeys.some((k) => path === k || path.startsWith(k + "."));
    if (needsRebuild) {
      void this.vp.view.ensureModels(this.def).then(() => this.structural());
      this.commitLive(`${this.sel!.kind}.edit`);
      this.structural();
    } else {
      this.vp.view.updateItem(this.def, this.sel);
      this.commitLive(`${this.sel.kind}.edit`);
    }
    this.renderInspector();
  }

  toggleSnapSelected(): void {
    if (!this.sel || (this.sel.kind !== "prop" && this.sel.kind !== "anchor")) return;
    const arr = this.list(this.sel.kind);
    const p = arr[this.sel.index] as Placed;
    this.beginLive();
    arr[this.sel.index] = (p.q !== undefined ? unsnapProp(p) : snapPropToCell(p)) as Item;
    this.vp.view.updateItem(this.def, this.sel);
    this.commitLive("snap");
    this.renderInspector();
  }

  // ---------- camera ----------
  setCameraFromView(): void {
    const p = this.vp.pose();
    const prev = this.def.camera ? deepClone(this.def.camera) : undefined;
    const next = { pos: [p.pos.x, p.pos.y, p.pos.z].map((v) => Math.round(v * 1000) / 1000) as [number, number, number], look: [p.target.x, p.target.y, p.target.z].map((v) => Math.round(v * 1000) / 1000) as [number, number, number], ...(this.def.camera?.fov ? { fov: this.def.camera.fov } : {}) };
    const apply = (c: typeof prev): void => { if (c) this.def.camera = c; else delete this.def.camera; this.structural(); };
    this.def.camera = next;
    this.undo.push({ label: "camera.set", undo: () => apply(prev), redo: () => apply(next) });
    this.structural();
  }

  lookThroughCamera(): void {
    if (!this.def.camera) return;
    this.vp.lookFrom(this.def.camera.pos, this.def.camera.look);
  }

  patchCamera(path: string, value: unknown): void {
    const prev = this.def.camera ? deepClone(this.def.camera) : undefined;
    const next = deepClone(this.def.camera ?? { pos: [0, 30, 34], look: [0, 0, 0] }) as unknown as Record<string, unknown>;
    setPath(next, path, value);
    const apply = (c: unknown): void => { if (c) this.def.camera = c as SceneDef["camera"]; else delete this.def.camera; this.structural(); this.renderInspector(); };
    apply(next);
    this.undo.push({ label: "camera.edit", undo: () => apply(prev), redo: () => apply(next) });
  }

  removeCamera(): void {
    const prev = this.def.camera ? deepClone(this.def.camera) : undefined;
    if (!prev) return;
    const apply = (c: unknown): void => { if (c) this.def.camera = c as SceneDef["camera"]; else delete this.def.camera; this.structural(); this.renderInspector(); };
    apply(undefined);
    this.undo.push({ label: "camera.remove", undo: () => apply(prev), redo: () => apply(undefined) });
  }

  doUndo(): void { this.undo.undo(); this.sel = null; this.structural(); }
  doRedo(): void { this.undo.redo(); this.sel = null; this.structural(); }

  // ---------- DOM ----------
  private bindDom(): void {
    $<HTMLElement>("tools").addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button[data-tool]") as HTMLButtonElement | null;
      if (b) this.setTool(b.dataset.tool as Tool);
    });
    $<HTMLButtonElement>("btn-undo").onclick = () => this.doUndo();
    $<HTMLButtonElement>("btn-redo").onclick = () => this.doRedo();
    $<HTMLButtonElement>("btn-frame").onclick = () => this.frame();
    $<HTMLButtonElement>("btn-gizmos").onclick = () => { this.vp.view.setGizmos(!this.vp.view.gizmosVisible, this.def); this.vp.view.setSelected(this.def, this.sel); };
    $<HTMLButtonElement>("btn-reset").onclick = () => this.reset();
    $<HTMLButtonElement>("btn-download").onclick = () => this.download();
    $<HTMLButtonElement>("btn-playtest").onclick = () => this.playtest();
    $<HTMLButtonElement>("btn-save").onclick = () => void this.save();
    $<HTMLInputElement>("snap-props").onchange = (e) => (this.snapProps = (e.target as HTMLInputElement).checked);
    $<HTMLSelectElement>("scene-select").onchange = (e) => this.openScene((e.target as HTMLSelectElement).value);
    const dlg = $<HTMLDialogElement>("new-dialog");
    $<HTMLButtonElement>("btn-new").onclick = () => { $<HTMLInputElement>("new-name").value = ""; dlg.showModal(); };
    $<HTMLButtonElement>("new-cancel").onclick = () => dlg.close();
    $<HTMLFormElement>("new-form").onsubmit = (e) => {
      e.preventDefault();
      const ok = this.newScene($<HTMLInputElement>("new-name").value, $<HTMLSelectElement>("new-dir").value as "island" | "scenes", $<HTMLSelectElement>("new-template").value as "clone" | "island" | "interior" | "empty");
      if (ok) dlg.close();
    };
    $<HTMLSelectElement>("shape-kind").onchange = (e) => (this.shapeKind = (e.target as HTMLSelectElement).value as "box" | "plane");
    $<HTMLInputElement>("shape-color").oninput = (e) => (this.shapeColor = (e.target as HTMLInputElement).value);
    $<HTMLInputElement>("tile-search").oninput = () => this.renderPalettes();
    $<HTMLInputElement>("prop-search").oninput = () => this.renderPalettes();
    const cat = $<HTMLSelectElement>("prop-cat");
    cat.innerHTML = `<option value="">all categories</option>` + PROP_CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("");
    cat.onchange = () => this.renderPalettes();
    window.addEventListener("keydown", (e) => this.onKey(e));
    window.addEventListener("beforeunload", (e) => {
      if (this.dirty) e.preventDefault();
    });
  }

  setTool(t: Tool): void {
    this.tool = t;
    for (const b of Array.from($<HTMLElement>("tools").querySelectorAll("button"))) b.classList.toggle("active", b.dataset.tool === t);
    this.vp.view.setHover(null);
    this.vp.view.showGhost(null);
    $<HTMLElement>("shape-opts").hidden = t !== "shape";
    if (t === "route" && this.sel?.kind !== "route") this.select(null); // a new click starts a new route
  }

  private onKey(e: KeyboardEvent): void {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? this.doRedo() : this.doUndo(); return; }
    if (ctrl && e.key.toLowerCase() === "y") { e.preventDefault(); this.doRedo(); return; }
    if (ctrl && e.key.toLowerCase() === "s") { e.preventDefault(); void this.save(); return; }
    if (TOOL_KEYS[e.key]) return this.setTool(TOOL_KEYS[e.key]);
    switch (e.key) {
      case "r": case "R": return this.rotateSelected(e.shiftKey ? -1 : 1, e.altKey);
      case "f": case "F": return this.frame();
      case "g": case "G": this.vp.view.setGizmos(!this.vp.view.gizmosVisible, this.def); this.vp.view.setSelected(this.def, this.sel); return;
      case "p": case "P": return this.playtest();
      case "c": case "C": return this.setCameraFromView();
      case "v": case "V": return this.lookThroughCamera();
      case "Escape": return this.select(null);
      case "Delete": case "Backspace": e.preventDefault(); return this.deleteSelected();
      case "ArrowUp": case "ArrowDown": case "ArrowLeft": case "ArrowRight":
        e.preventDefault();
        return this.nudgeSelected(e.key, e.shiftKey);
    }
  }

  private renderSceneSelect(): void {
    const sel = $<HTMLSelectElement>("scene-select");
    sel.innerHTML = this.scenes.map((s) => `<option value="${s.name}" ${s.name === this.scene.name ? "selected" : ""}>${s.dir}/${s.name}${AUTHORED.includes(s) ? "" : " (new)"}</option>`).join("");
  }

  private renderPalettes(): void {
    const tq = $<HTMLInputElement>("tile-search").value.toLowerCase();
    const tl = $<HTMLElement>("tile-list");
    tl.innerHTML = "";
    for (const t of TILES) {
      if (tq && !t.code.toLowerCase().includes(tq)) continue;
      const b = document.createElement("button");
      b.textContent = t.label;
      b.classList.toggle("active", t.code === this.tileCode);
      b.onclick = () => { this.tileCode = t.code; this.setTool("tile"); this.renderPalettes(); };
      tl.appendChild(b);
    }
    const pq = $<HTMLInputElement>("prop-search").value.toLowerCase();
    const cat = $<HTMLSelectElement>("prop-cat").value;
    const pl = $<HTMLElement>("prop-list");
    pl.innerHTML = "";
    for (const p of PROPS) {
      if (cat && p.category !== cat) continue;
      if (pq && !p.label.toLowerCase().includes(pq)) continue;
      const b = document.createElement("button");
      b.textContent = p.label;
      b.title = p.path;
      b.classList.toggle("active", p.path === this.propPath);
      b.onclick = () => { this.propPath = p.path; this.setTool("prop"); this.renderPalettes(); };
      pl.appendChild(b);
    }
  }

  // ---------- inspector ----------
  private num(label: string, key: string, val: number | undefined, step = 0.1): string {
    return `<div class="field"><label>${label}</label><input type="number" step="${step}" data-k="${key}" value="${val ?? ""}"></div>`;
  }
  private text(label: string, key: string, val: string | undefined): string {
    return `<div class="field"><label>${label}</label><input type="text" data-k="${key}" value="${val ?? ""}"></div>`;
  }
  private color(label: string, key: string, val: string | undefined): string {
    return `<div class="field"><label>${label}</label><input type="color" data-k="${key}" value="${val ?? "#ffffff"}"></div>`;
  }
  private check(label: string, key: string, val: boolean | undefined): string {
    return `<div class="field"><label>${label}</label><input type="checkbox" data-k="${key}" ${val ? "checked" : ""}></div>`;
  }
  private placedFields(p: Placed, snapButton: boolean): string {
    const onCell = p.q !== undefined;
    return (onCell ? `<div class="field"><label>cell</label><span>q ${p.q}, r ${p.r}</span></div>` : this.num("x", "x", p.x) + this.num("z", "z", p.z)) +
      this.num("y", "y", p.y ?? 0) + this.num("rot", "rot", p.rot ?? 0, 5) +
      this.num("tilt x", "tilt.0", p.tilt?.[0] ?? 0, 1) + this.num("tilt z", "tilt.1", p.tilt?.[1] ?? 0, 1) +
      (snapButton ? `<div class="row"><button data-act="snap">${onCell ? "Unsnap" : "Snap to cell"}</button><button data-act="rot">Rotate (R)</button></div>` : `<div class="row"><button data-act="rot">Rotate (R)</button></div>`);
  }

  private renderInspector(): void {
    const body = $<HTMLElement>("insp-body");
    const camBody = $<HTMLElement>("cam-body");
    // camera section (always)
    if (this.def.camera) {
      const c = this.def.camera;
      camBody.innerHTML = this.num("pos x", "pos.0", c.pos[0]) + this.num("pos y", "pos.1", c.pos[1]) + this.num("pos z", "pos.2", c.pos[2]) +
        this.num("look x", "look.0", c.look[0]) + this.num("look y", "look.1", c.look[1]) + this.num("look z", "look.2", c.look[2]) + this.num("fov", "fov", c.fov ?? 0, 1) +
        `<div class="row"><button data-cam="set">Set from view (C)</button><button data-cam="look">Look through (V)</button></div><div class="row"><button data-cam="remove" class="danger">Remove camera</button></div>`;
    } else {
      camBody.innerHTML = `<div class="muted">No camera in this scene.</div><div class="row"><button data-cam="set">Create from view (C)</button></div>`;
    }
    camBody.querySelectorAll<HTMLInputElement>("[data-k]").forEach((el) => { el.onchange = () => this.patchCamera(el.dataset.k!, Number(el.value)); });
    camBody.querySelectorAll<HTMLButtonElement>("[data-cam]").forEach((b) => {
      b.onclick = () => { if (b.dataset.cam === "set") this.setCameraFromView(); else if (b.dataset.cam === "look") this.lookThroughCamera(); else this.removeCamera(); };
    });
    if (!this.sel) {
      body.className = "muted";
      body.textContent = "Nothing selected";
      return;
    }
    const it = this.item(this.sel);
    if (!it) { this.sel = null; body.className = "muted"; body.textContent = "Nothing selected"; return; }
    body.className = "";
    let html = `<div class="field"><label>kind</label><span>${this.sel.kind}${this.sel.point !== undefined ? ` point ${this.sel.point}` : ""}</span></div>`;
    switch (this.sel.kind) {
      case "tile": {
        const t = it as TileDef;
        html += `<div class="field"><label>cell</label><span>q ${t.q}, r ${t.r}</span></div>
          <div class="field"><label>tile</label><select data-k="t">${TILES.map((x) => `<option value="${x.code}" ${x.code === t.t ? "selected" : ""}>${x.label}</option>`).join("")}</select></div>
          ${this.num("rot", "rot", t.rot ?? 0, 1)}<div class="row"><button data-act="rot">Rotate (R)</button></div>`;
        break;
      }
      case "prop": {
        const p = it as PropDef;
        html += `<div class="field"><label>model</label><span title="${p.m}">${p.m.split("/").pop()}</span></div>` + this.placedFields(p, true) +
          (p.sc ? this.num("scale x", "sc.0", p.sc[0]) + this.num("scale y", "sc.1", p.sc[1]) + this.num("scale z", "sc.2", p.sc[2]) : this.num("scale", "s", p.s ?? 1, 0.1)) +
          this.text("tags", "tags", p.tags?.join(" ")) + this.check("hidden", "hidden", p.hidden);
        break;
      }
      case "shape": {
        const s = it as ShapeDef;
        html += `<div class="field"><label>shape</label><select data-k="kind"><option value="box" ${s.kind === "box" ? "selected" : ""}>box</option><option value="plane" ${s.kind === "plane" ? "selected" : ""}>plane</option></select></div>` +
          this.text("name", "name", s.name) +
          (s.kind === "box" ? this.num("w", "size.0", s.size[0]) + this.num("h", "size.1", s.size[1]) + this.num("d", "size.2", s.size[2]) : this.num("w", "size.0", s.size[0]) + this.num("d", "size.1", s.size[1])) +
          this.color("color", "color", s.color) + this.num("alpha", "alpha", s.alpha ?? 1, 0.05) + this.color("emissive", "emissive", s.emissive ?? "#000000") +
          this.placedFields(s, false) +
          this.num("scale x", "sc.0", s.sc?.[0] ?? 1) + this.num("scale y", "sc.1", s.sc?.[1] ?? 1) + this.num("scale z", "sc.2", s.sc?.[2] ?? 1) + this.check("hidden", "hidden", s.hidden);
        break;
      }
      case "anchor": {
        const a = it as AnchorDef;
        html += this.text("name", "name", a.name) + this.placedFields(a, true);
        break;
      }
      case "light": {
        const l = it as LightDef;
        html += this.num("x", "x", l.x) + this.num("y", "y", l.y) + this.num("z", "z", l.z) + this.color("color", "color", l.color) + this.num("energy", "energy", l.energy, 0.1) + this.num("range", "range", l.range, 0.5);
        break;
      }
      case "route": {
        const r = it as RouteDef;
        html += this.text("name", "name", r.name) + `<div class="muted">${r.points.length} points -- Route tool click appends; select a point to drag it.</div>`;
        r.points.forEach((p, k) => {
          html += `<div class="pt ${this.sel!.point === k ? "active" : ""}"><span>#${k}</span>` + this.num("x", `points.${k}.0`, p[0]) + this.num("y", `points.${k}.1`, p[1]) + this.num("z", `points.${k}.2`, p[2]) + `<button data-pt="${k}" class="danger">x</button></div>`;
        });
        break;
      }
    }
    html += `<div class="row"><button data-act="del" class="danger">Delete${this.sel.kind === "route" && this.sel.point !== undefined ? " point" : ""}</button></div>`;
    body.innerHTML = html;
    body.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-k]").forEach((el) => {
      el.onchange = () => {
        const k = el.dataset.k!;
        let v: unknown;
        if (el instanceof HTMLInputElement && el.type === "checkbox") v = el.checked;
        else if (el instanceof HTMLInputElement && (el.type === "number")) v = el.value === "" ? undefined : Number(el.value);
        else if (k === "tags") v = el.value.trim() ? el.value.trim().split(/\s+/) : undefined;
        else if (k === "emissive" && el.value === "#000000") v = undefined;
        else v = el.value;
        this.patchSelected(k, v);
      };
    });
    body.querySelectorAll<HTMLButtonElement>("[data-act]").forEach((b) => {
      b.onclick = () => {
        if (b.dataset.act === "rot") this.rotateSelected(1, false);
        else if (b.dataset.act === "del") this.deleteSelected();
        else if (b.dataset.act === "snap") this.toggleSnapSelected();
      };
    });
    body.querySelectorAll<HTMLButtonElement>("[data-pt]").forEach((b) => {
      b.onclick = () => { if (this.sel?.kind === "route") this.removeRoutePoint(this.sel.index, Number(b.dataset.pt)); };
    });
  }

  private statsText(hit: Hit | null): string {
    const d = this.def;
    const cell = hit ? ` | cell q ${hit.cell.q}, r ${hit.cell.r}` : "";
    return `${d.tiles.length} tiles, ${d.props.length} props, ${d.shapes?.length ?? 0} shapes, ${d.anchors?.length ?? 0} anchors, ${d.routes?.length ?? 0} routes, ${d.lights?.length ?? 0} lights${cell}`;
  }

  private refreshUi(): void {
    $<HTMLElement>("dirty").hidden = !this.dirty;
    $<HTMLButtonElement>("btn-undo").disabled = !this.undo.canUndo;
    $<HTMLButtonElement>("btn-redo").disabled = !this.undo.canRedo;
    $<HTMLButtonElement>("btn-save").textContent = `Save to ${this.scene.dir}/${this.scene.name}.ts`;
    const ss = $<HTMLSelectElement>("scene-select");
    if (ss.value !== this.scene.name) ss.value = this.scene.name; // never show a scene other than the document
    this.renderInspector();
    $<HTMLElement>("stats").textContent = this.statsText(null);
  }

  private toast(msg: string): void {
    const t = $<HTMLElement>("toast");
    t.textContent = msg;
    t.hidden = false;
    window.setTimeout(() => (t.hidden = true), 2600);
  }
}
