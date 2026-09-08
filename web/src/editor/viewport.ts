// The 3D editing viewport: composes the REAL island renderer (render/islandScene.ts) over the
// working document, owns the orbit camera and the pointer state machine, and turns pointer
// events into ground/cell/prop hits for the app. Skeleton adapted from world-of-claudecraft
// 3d/viewport.ts with terrain picking replaced by a y=0 plane intersection (flat island).

import * as THREE from "three";
import { createIslandScene, type IslandScene } from "../render/islandScene";
import { worldToAxial } from "../world/hexGrid";
import { EditorCamera } from "./editor_camera";
import { IslandView } from "./island_view";
import type { Cell } from "./edit_core";

export interface Hit {
  world: { x: number; z: number };
  cell: Cell;
  /** Prop under the pointer (raycast), or null. */
  propIndex: number | null;
  shift: boolean;
  alt: boolean;
}

export interface ViewportHooks {
  onHover(hit: Hit | null): void;
  /** A click without drag. */
  onTap(hit: Hit): void;
  /** Return true to claim the left-drag as an edit drag (e.g. moving a prop). */
  onDragStart(hit: Hit): boolean;
  onDragMove(hit: Hit): void;
  onDragEnd(): void;
  /** Return true if the wheel was consumed (rotate/scale); otherwise it zooms. */
  onWheel(e: WheelEvent): boolean;
}

type DragMode = "none" | "orbit" | "pan" | "edit";
const TAP_PX = 5;

export class Viewport {
  readonly scene: IslandScene;
  readonly view: IslandView;
  readonly cam = new EditorCamera();
  private readonly ray = new THREE.Raycaster();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly ndc = new THREE.Vector2();
  private readonly tmp = new THREE.Vector3();
  private dragMode: DragMode = "none";
  private downX = 0;
  private downY = 0;
  private lastX = 0;
  private lastY = 0;
  private moved = false;
  private running = false;

  constructor(readonly canvas: HTMLCanvasElement, private readonly hooks: ViewportHooks) {
    this.scene = createIslandScene(canvas);
    this.view = new IslandView(this.scene);
    this.attach();
    new ResizeObserver(() => this.scene.resize()).observe(canvas);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const loop = (): void => {
      if (!this.running) return;
      const p = this.cam.pose();
      this.scene.camera.position.copy(p.pos);
      this.scene.camera.lookAt(p.target);
      this.scene.sun.target.position.copy(p.target);
      this.scene.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /** Ground-plane hit + cell + prop pick for a pointer event. */
  private hitAt(e: { clientX: number; clientY: number; shiftKey: boolean; altKey: boolean }): Hit | null {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.scene.camera);
    const hit = this.ray.ray.intersectPlane(this.plane, this.tmp);
    if (!hit) return null;
    const inter = this.ray.intersectObjects(this.view.propsGroup.children, true);
    const propIndex = inter.length ? this.view.propIndexOf(inter[0].object) : null;
    return {
      world: { x: hit.x, z: hit.z },
      cell: worldToAxial(hit.x, hit.z),
      propIndex,
      shift: e.shiftKey,
      alt: e.altKey,
    };
  }

  private attach(): void {
    const c = this.canvas;
    c.addEventListener("contextmenu", (e) => e.preventDefault());
    c.addEventListener("pointerdown", (e) => {
      c.setPointerCapture(e.pointerId);
      this.downX = this.lastX = e.clientX;
      this.downY = this.lastY = e.clientY;
      this.moved = false;
      if (e.button === 1 || (e.button === 0 && e.shiftKey && e.ctrlKey)) {
        this.dragMode = "pan";
      } else if (e.button === 2) {
        this.dragMode = "orbit";
      } else if (e.button === 0) {
        const hit = this.hitAt(e);
        this.dragMode = hit && this.hooks.onDragStart(hit) ? "edit" : "orbit";
      }
    });
    c.addEventListener("pointermove", (e) => {
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      if (this.dragMode !== "none" && Math.hypot(e.clientX - this.downX, e.clientY - this.downY) > TAP_PX) this.moved = true;
      switch (this.dragMode) {
        case "orbit":
          if (this.moved) this.cam.orbit(dx, dy);
          break;
        case "pan":
          this.cam.pan(dx, dy);
          break;
        case "edit": {
          const hit = this.hitAt(e);
          if (hit) this.hooks.onDragMove(hit);
          break;
        }
        default: {
          this.hooks.onHover(this.hitAt(e));
        }
      }
    });
    const end = (e: PointerEvent): void => {
      const mode = this.dragMode;
      this.dragMode = "none";
      if (mode === "edit") this.hooks.onDragEnd();
      else if (mode === "orbit" && !this.moved && e.button === 0) {
        const hit = this.hitAt(e);
        if (hit) this.hooks.onTap(hit);
      }
    };
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
    c.addEventListener("pointerleave", () => {
      if (this.dragMode === "none") this.hooks.onHover(null);
    });
    c.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        if (this.hooks.onWheel(e)) return;
        this.cam.zoom(e.deltaY);
      },
      { passive: false }
    );
  }
}
