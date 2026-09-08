// The island editor coordinator: owns the working IslandDef, the undo stack, tool state and
// selection; turns viewport hits into document commands; drives the palette/inspector DOM.
// Every edit is applied to the document, mirrored in the view, and pushed as an undo command.
// Live drags/wheel bursts mutate in place and commit ONE undo entry (base-snapshot pattern).

import { axialToWorld, type IslandDef, type PropDef, type TileDef } from "../world/hexGrid";
import { OVERWORLD } from "../content/island/overworld";
import { stashEditorIsland } from "../world/editorHandoff";
import { UndoStack } from "./undo_core";
import { cloneIsland, sanitizeIslandDef, serializeIslandJson, serializeIslandTs } from "./island_doc";
import { islandCellBounds, propWorld, snapPropToCell, tileIndexAt, unsnapProp } from "./edit_core";
import { CommitCoalescer, NUDGE_STEP, NUDGE_STEP_BIG, PROP_ROT_STEP_BIG_DEG, PROP_ROT_STEP_DEG, nudgeDelta, propRotStep, scaleStep, tileRotStep, type NudgeKey } from "./transform_core";
import { Viewport, type Hit } from "./viewport";
import type { Selection } from "./island_view";
import { PROPS, PROP_CATEGORIES, TILES } from "./catalog.generated";

type Tool = "select" | "tile" | "prop" | "erase";
const DRAFT_PREFIX = "tq_island_draft:";
const AUTHORED: Record<string, IslandDef> = { overworld: OVERWORLD };

// Saving writes the very module this file imports; accept that HMR update in place so Vite does
// not full-reload the editor (the working copy in memory is the truth while editing).
if (import.meta.hot) {
  import.meta.hot.accept("../content/island/overworld", () => {
    /* editor keeps its working copy */
  });
}

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error("missing #" + id);
  return el as T;
}
function defaultScaleFor(path: string): number {
  return path.startsWith("kaykit/hexagon/") ? 3 : 1;
}

export class App {
  def: IslandDef;
  readonly undo = new UndoStack();
  tool: Tool = "select";
  tileCode = "grass";
  propPath = PROPS[0]?.path ?? "";
  sel: Selection = null;
  snapProps = false;
  dirty = false;
  name = "overworld";
  private readonly vp: Viewport;
  private readonly coalescer = new CommitCoalescer();
  private liveBase: { kind: "tile" | "prop"; index: number; prev: TileDef | PropDef } | null = null;
  private draftTimer: number | null = null;

  constructor() {
    this.name = $<HTMLInputElement>("island-name").value.trim() || "overworld";
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
  private loadInitial(): IslandDef {
    try {
      const raw = localStorage.getItem(DRAFT_PREFIX + this.name);
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
    return cloneIsland(AUTHORED[this.name] ?? { tiles: [], props: [] });
  }

  private markDirty(): void {
    this.dirty = true;
    if (this.draftTimer !== null) window.clearTimeout(this.draftTimer);
    this.draftTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_PREFIX + this.name, JSON.stringify(this.def));
      } catch {
        /* storage blocked: the in-memory doc is still fine */
      }
    }, 400);
    this.refreshUi();
  }

  private structural(): void {
    this.vp.view.rebuildAll(this.def);
    this.vp.view.setSelected(this.def, this.sel);
    this.markDirty();
  }

  async save(): Promise<void> {
    const exportName = this.name.toUpperCase();
    const source = serializeIslandTs(this.def, exportName);
    try {
      const res = await fetch("/__editor/save", { method: "POST", body: JSON.stringify({ name: this.name, source }) });
      const j = (await res.json()) as { ok?: boolean; file?: string; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error ?? String(res.status));
      this.dirty = false;
      localStorage.removeItem(DRAFT_PREFIX + this.name);
      this.toast(`Saved ${j.file}`);
    } catch (err) {
      this.toast(`Save failed: ${String(err)} (dev server only)`);
    }
    this.refreshUi();
  }

  reset(): void {
    if (!window.confirm("Discard the draft and reload the authored file?")) return;
    localStorage.removeItem(DRAFT_PREFIX + this.name);
    this.def = cloneIsland(AUTHORED[this.name] ?? { tiles: [], props: [] });
    this.undo.clear();
    this.sel = null;
    this.dirty = false;
    void this.vp.view.ensureModels(this.def).then(() => this.structural());
    this.dirty = false;
    this.refreshUi();
  }

  download(): void {
    const blob = new Blob([serializeIslandJson(this.def)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${this.name}.island.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  playtest(): void {
    stashEditorIsland(this.def);
    window.open("/", "_blank");
  }

  frame(): void {
    const b = islandCellBounds(this.def);
    if (!b) return;
    const a = axialToWorld(b.min.q, b.min.r);
    const c = axialToWorld(b.max.q, b.max.r);
    // land only: exclude the wide sea for a tighter frame
    const land = this.def.tiles.filter((t) => t.t !== "water");
    if (land.length) {
      let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
      for (const t of land) {
        const w = axialToWorld(t.q, t.r);
        minX = Math.min(minX, w.x); maxX = Math.max(maxX, w.x);
        minZ = Math.min(minZ, w.z); maxZ = Math.max(maxZ, w.z);
      }
      this.vp.cam.frame(minX, minZ, maxX, maxZ);
      return;
    }
    this.vp.cam.frame(Math.min(a.x, c.x), Math.min(a.z, c.z), Math.max(a.x, c.x), Math.max(a.z, c.z));
  }

  // ---------- selection ----------
  select(sel: Selection): void {
    this.sel = sel;
    this.vp.view.setSelected(this.def, sel);
    this.refreshUi();
  }

  // ---------- viewport hooks ----------
  private onHover(hit: Hit | null): void {
    this.vp.view.setHover(hit && this.tool !== "select" ? hit.cell : null);
    $<HTMLElement>("stats").textContent = this.statsText(hit);
  }

  private onTap(hit: Hit): void {
    switch (this.tool) {
      case "select": {
        if (hit.propIndex !== null) return this.select({ kind: "prop", index: hit.propIndex });
        const i = tileIndexAt(this.def.tiles, hit.cell.q, hit.cell.r);
        return this.select(i >= 0 ? { kind: "tile", index: i } : null);
      }
      case "tile":
        return this.paintTile(hit.cell.q, hit.cell.r, hit.shift);
      case "prop":
        return this.placeProp(hit);
      case "erase":
        return this.eraseAt(hit);
    }
  }

  private onDragStart(hit: Hit): boolean {
    if (this.tool !== "select" || hit.propIndex === null) return false;
    this.select({ kind: "prop", index: hit.propIndex });
    this.beginLive();
    // a cell-anchored prop becomes free so it can follow the pointer
    const p = this.def.props[hit.propIndex];
    if (p.q !== undefined) this.def.props[hit.propIndex] = unsnapProp(p);
    return true;
  }

  private onDragMove(hit: Hit): void {
    if (!this.sel || this.sel.kind !== "prop") return;
    const i = this.sel.index;
    const p = this.def.props[i];
    const snap = this.snapProps !== hit.shift; // Shift toggles the snap setting for this drag
    if (snap) {
      this.def.props[i] = snapPropToCell({ ...p, x: hit.world.x, z: hit.world.z, q: undefined, r: undefined });
    } else {
      this.def.props[i] = unsnapProp({ ...p, x: hit.world.x, z: hit.world.z, q: undefined, r: undefined });
    }
    this.vp.view.updateProp(this.def, i);
    this.renderInspector();
  }

  private onWheel(e: WheelEvent): boolean {
    if (!this.sel || !(e.shiftKey || e.altKey)) return false;
    const dir: 1 | -1 = e.deltaY > 0 ? 1 : -1;
    this.beginLive();
    if (this.sel.kind === "tile") {
      if (!e.shiftKey) return false;
      const t = this.def.tiles[this.sel.index];
      t.rot = tileRotStep(t.rot ?? 0, dir);
      this.vp.view.updateTile(this.def, this.sel.index);
    } else {
      const p = this.def.props[this.sel.index];
      if (e.shiftKey) p.rot = propRotStep(p.rot ?? 0, dir, PROP_ROT_STEP_DEG);
      else p.s = scaleStep(p.s ?? 1, e.deltaY);
      this.vp.view.updateProp(this.def, this.sel.index);
    }
    this.coalescer.tick(performance.now());
    this.renderInspector();
    return true;
  }

  // ---------- live-transform undo pattern ----------
  private beginLive(): void {
    if (this.liveBase || !this.sel) return;
    const prev = this.sel.kind === "tile" ? { ...this.def.tiles[this.sel.index] } : { ...this.def.props[this.sel.index] };
    this.liveBase = { kind: this.sel.kind, index: this.sel.index, prev };
  }

  private commitLive(label: string): void {
    const base = this.liveBase;
    this.liveBase = null;
    this.coalescer.cancel();
    if (!base) return;
    const arr = base.kind === "tile" ? this.def.tiles : this.def.props;
    const next = { ...arr[base.index] } as TileDef | PropDef;
    if (JSON.stringify(next) === JSON.stringify(base.prev)) return;
    const restore = (v: TileDef | PropDef): void => {
      if (base.kind === "tile") {
        this.def.tiles[base.index] = v as TileDef;
        this.vp.view.updateTile(this.def, base.index);
      } else {
        this.def.props[base.index] = v as PropDef;
        this.vp.view.updateProp(this.def, base.index);
      }
      this.vp.view.setSelected(this.def, this.sel);
      this.markDirty();
    };
    this.undo.push({ label, undo: () => restore(base.prev), redo: () => restore(next) });
    this.markDirty();
  }

  // ---------- commands ----------
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
      this.select({ kind: "tile", index: i });
      this.structural();
      return;
    }
    const tile: TileDef = { q, r, t: this.tileCode };
    const at = this.def.tiles.length;
    this.def.tiles.push(tile);
    this.undo.push({
      label: "tile.add",
      undo: () => { this.def.tiles.splice(at, 1); this.sel = null; this.structural(); },
      redo: () => { this.def.tiles.splice(at, 0, tile); this.structural(); },
    });
    void this.vp.view.ensureModels({ tiles: [tile], props: [] }).then(() => this.structural());
    this.select({ kind: "tile", index: at });
    this.structural();
  }

  placeProp(hit: Hit): void {
    if (!this.propPath) return;
    const snap = this.snapProps !== hit.shift;
    const base: PropDef = { m: this.propPath, x: hit.world.x, z: hit.world.z };
    const s = defaultScaleFor(this.propPath);
    if (s !== 1) base.s = s;
    const prop = snap ? snapPropToCell(base) : base;
    const at = this.def.props.length;
    this.def.props.push(prop);
    this.undo.push({
      label: "prop.add",
      undo: () => { this.def.props.splice(at, 1); this.sel = null; this.structural(); },
      redo: () => { this.def.props.splice(at, 0, prop); this.structural(); },
    });
    void this.vp.view.ensureModels({ tiles: [], props: [prop] }).then(() => this.structural());
    this.select({ kind: "prop", index: at });
    this.structural();
  }

  eraseAt(hit: Hit): void {
    if (hit.propIndex !== null) return this.removeProp(hit.propIndex);
    const i = tileIndexAt(this.def.tiles, hit.cell.q, hit.cell.r);
    if (i >= 0) this.removeTile(i);
  }

  removeTile(i: number): void {
    const [tile] = this.def.tiles.splice(i, 1);
    this.undo.push({
      label: "tile.remove",
      undo: () => { this.def.tiles.splice(i, 0, tile); this.structural(); },
      redo: () => { this.def.tiles.splice(i, 1); this.sel = null; this.structural(); },
    });
    this.sel = null;
    this.structural();
  }

  removeProp(i: number): void {
    const [prop] = this.def.props.splice(i, 1);
    this.undo.push({
      label: "prop.remove",
      undo: () => { this.def.props.splice(i, 0, prop); this.structural(); },
      redo: () => { this.def.props.splice(i, 1); this.sel = null; this.structural(); },
    });
    this.sel = null;
    this.structural();
  }

  deleteSelected(): void {
    if (!this.sel) return;
    if (this.sel.kind === "tile") this.removeTile(this.sel.index);
    else this.removeProp(this.sel.index);
  }

  rotateSelected(dir: 1 | -1, big: boolean): void {
    if (!this.sel) return;
    this.beginLive();
    if (this.sel.kind === "tile") {
      const t = this.def.tiles[this.sel.index];
      t.rot = tileRotStep(t.rot ?? 0, dir);
      if (!t.rot) delete t.rot;
      this.vp.view.updateTile(this.def, this.sel.index);
    } else {
      const p = this.def.props[this.sel.index];
      p.rot = propRotStep(p.rot ?? 0, dir, big ? PROP_ROT_STEP_BIG_DEG : PROP_ROT_STEP_DEG);
      if (!p.rot) delete p.rot;
      this.vp.view.updateProp(this.def, this.sel.index);
    }
    this.commitLive("rotate");
    this.renderInspector();
  }

  nudgeSelected(key: NudgeKey, big: boolean): void {
    if (!this.sel || this.sel.kind !== "prop") return;
    this.beginLive();
    const i = this.sel.index;
    const w = propWorld(this.def.props[i]);
    const d = nudgeDelta(key, this.vp.cam.yaw, big ? NUDGE_STEP_BIG : NUDGE_STEP);
    this.def.props[i] = unsnapProp({ ...this.def.props[i], x: w.x + d.dx, z: w.z + d.dz, q: undefined, r: undefined });
    this.vp.view.updateProp(this.def, i);
    this.coalescer.tick(performance.now());
    this.renderInspector();
  }

  /** Inspector field edit on the selected item: one undo entry per change. */
  patchSelected(patch: Partial<TileDef> | Partial<PropDef>): void {
    if (!this.sel) return;
    this.beginLive();
    if (this.sel.kind === "tile") {
      Object.assign(this.def.tiles[this.sel.index], patch);
      this.commitLive("tile.edit");
      this.structural(); // model may have changed
    } else {
      const p = { ...this.def.props[this.sel.index], ...(patch as Partial<PropDef>) };
      for (const k of ["rot", "s", "y", "x", "z", "q", "r"] as const) if (p[k] === undefined) delete p[k];
      this.def.props[this.sel.index] = p;
      this.vp.view.updateProp(this.def, this.sel.index);
      this.commitLive("prop.edit");
    }
    this.renderInspector();
  }

  toggleSnapSelected(): void {
    if (!this.sel || this.sel.kind !== "prop") return;
    const p = this.def.props[this.sel.index];
    this.beginLive();
    this.def.props[this.sel.index] = p.q !== undefined ? unsnapProp(p) : snapPropToCell(p);
    this.vp.view.updateProp(this.def, this.sel.index);
    this.commitLive("prop.snap");
    this.renderInspector();
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
    $<HTMLButtonElement>("btn-reset").onclick = () => this.reset();
    $<HTMLButtonElement>("btn-download").onclick = () => this.download();
    $<HTMLButtonElement>("btn-playtest").onclick = () => this.playtest();
    $<HTMLButtonElement>("btn-save").onclick = () => void this.save();
    $<HTMLInputElement>("snap-props").onchange = (e) => (this.snapProps = (e.target as HTMLInputElement).checked);
    $<HTMLInputElement>("island-name").onchange = (e) => {
      const v = (e.target as HTMLInputElement).value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
      (e.target as HTMLInputElement).value = v || "overworld";
      this.name = v || "overworld";
      this.refreshUi();
    };
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
    if (t !== "select") this.vp.view.setHover(null);
  }

  private onKey(e: KeyboardEvent): void {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? this.doRedo() : this.doUndo(); return; }
    if (ctrl && e.key.toLowerCase() === "y") { e.preventDefault(); this.doRedo(); return; }
    if (ctrl && e.key.toLowerCase() === "s") { e.preventDefault(); void this.save(); return; }
    switch (e.key) {
      case "1": return this.setTool("select");
      case "2": return this.setTool("tile");
      case "3": return this.setTool("prop");
      case "4": return this.setTool("erase");
      case "r": case "R": return this.rotateSelected(e.shiftKey ? -1 : 1, e.altKey);
      case "f": case "F": return this.frame();
      case "p": case "P": return this.playtest();
      case "Escape": return this.select(null);
      case "Delete": case "Backspace": e.preventDefault(); return this.deleteSelected();
      case "ArrowUp": case "ArrowDown": case "ArrowLeft": case "ArrowRight":
        e.preventDefault();
        return this.nudgeSelected(e.key, e.shiftKey);
    }
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

  private renderInspector(): void {
    const body = $<HTMLElement>("insp-body");
    if (!this.sel) {
      body.className = "muted";
      body.textContent = "Nothing selected";
      return;
    }
    body.className = "";
    const num = (label: string, key: string, val: number | undefined, step = 0.1): string =>
      `<div class="field"><label>${label}</label><input type="number" step="${step}" data-k="${key}" value="${val ?? ""}"></div>`;
    if (this.sel.kind === "tile") {
      const t = this.def.tiles[this.sel.index];
      body.innerHTML = `
        <div class="field"><label>cell</label><span>q ${t.q}, r ${t.r}</span></div>
        <div class="field"><label>tile</label><select data-k="t">${TILES.map((x) => `<option value="${x.code}" ${x.code === t.t ? "selected" : ""}>${x.label}</option>`).join("")}</select></div>
        ${num("rot", "rot", t.rot ?? 0, 1)}
        <div class="row"><button data-act="rot">Rotate (R)</button><button data-act="del" class="danger">Delete</button></div>`;
    } else {
      const p = this.def.props[this.sel.index];
      const onCell = p.q !== undefined;
      body.innerHTML = `
        <div class="field"><label>model</label><span title="${p.m}">${p.m.split("/").pop()}</span></div>
        ${onCell ? `<div class="field"><label>cell</label><span>q ${p.q}, r ${p.r}</span></div>` : num("x", "x", p.x) + num("z", "z", p.z)}
        ${num("rot", "rot", p.rot ?? 0, 5)}${num("scale", "s", p.s ?? 1, 0.1)}${num("y", "y", p.y ?? 0, 0.1)}
        <div class="row"><button data-act="snap">${onCell ? "Unsnap" : "Snap to cell"}</button><button data-act="rot">Rotate (R)</button></div>
        <div class="row"><button data-act="del" class="danger">Delete</button></div>`;
    }
    body.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-k]").forEach((el) => {
      el.onchange = () => {
        const k = el.dataset.k!;
        const v = el.tagName === "SELECT" ? el.value : Number(el.value);
        this.patchSelected({ [k]: v } as Partial<PropDef>);
      };
    });
    body.querySelectorAll<HTMLButtonElement>("[data-act]").forEach((b) => {
      b.onclick = () => {
        if (b.dataset.act === "rot") this.rotateSelected(1, false);
        else if (b.dataset.act === "del") this.deleteSelected();
        else if (b.dataset.act === "snap") this.toggleSnapSelected();
      };
    });
  }

  private statsText(hit: Hit | null): string {
    const cell = hit ? ` | cell q ${hit.cell.q}, r ${hit.cell.r}` : "";
    return `${this.def.tiles.length} tiles, ${this.def.props.length} props${cell}`;
  }

  private refreshUi(): void {
    $<HTMLElement>("dirty").hidden = !this.dirty;
    $<HTMLButtonElement>("btn-undo").disabled = !this.undo.canUndo;
    $<HTMLButtonElement>("btn-redo").disabled = !this.undo.canRedo;
    $<HTMLButtonElement>("btn-save").textContent = `Save to ${this.name}.ts`;
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
