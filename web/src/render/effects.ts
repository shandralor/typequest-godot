// The two bits of spectacle the scenarios ask for, ported from the Godot composer:
//
//   Sparks  -- the grindstone shower. It HEATS UP across the song: the colour ramps
//              red-orange -> gold -> white-hot -> blue, and the sparks get bigger, faster and
//              wider, so a child sees the sharpening progress without reading a number.
//   Arrows  -- one arrow per typed SENTENCE at the archery range. A LONGER sentence lands
//              closer to the bullseye, so the arrows march inward as the rhyme is typed.
//
// Both are plain Three objects driven by a `progress` value; no game state lives here.

import * as THREE from "three";

/** A soft round dot, so points read as sparks and not as untextured squares. */
function sparkTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.85)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.beginPath();
  g.arc(32, 32, 32, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const SPARK_COUNT = 60;
const SPARK_LIFETIME = 0.6;
const GRAVITY = -8;

/** Godot's _spark_color: the forge ramp from first strike to nearly-done. */
export function sparkColor(p: number, out = new THREE.Color()): THREE.Color {
  const RED = new THREE.Color(1.0, 0.32, 0.05);
  const GOLD = new THREE.Color(1.0, 0.85, 0.2);
  const WHITE = new THREE.Color(0.9, 0.96, 1.0);
  const BLUE = new THREE.Color(0.35, 0.6, 1.0);
  if (p < 0.5) return out.copy(RED).lerp(GOLD, p / 0.5);
  if (p < 0.67) return out.copy(GOLD).lerp(WHITE, (p - 0.5) / 0.17);
  // the final third cools to a hot blue -- the child sees the end is near
  return out.copy(WHITE).lerp(BLUE, (p - 0.67) / 0.33);
}

interface Spark {
  life: number;
  vel: THREE.Vector3;
}

/** A CPU particle shower of unshaded, emissive sparks. */
export class Sparks {
  readonly group = new THREE.Group();
  private readonly points: THREE.Points;
  private readonly geo: THREE.BufferGeometry;
  private readonly mat: THREE.PointsMaterial;
  private readonly state: Spark[] = [];
  private readonly origin = new THREE.Vector3();
  private readonly colour = new THREE.Color();
  emitting = false;
  progress = 0;

  constructor(pos: THREE.Vector3) {
    this.origin.copy(pos);
    this.geo = new THREE.BufferGeometry();
    const xyz = new Float32Array(SPARK_COUNT * 3);
    this.geo.setAttribute("position", new THREE.BufferAttribute(xyz, 3));
    this.mat = new THREE.PointsMaterial({
      size: 0.09,
      map: sparkTexture(),
      sizeAttenuation: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.group.add(this.points);
    for (let i = 0; i < SPARK_COUNT; i++) this.state.push({ life: 0, vel: new THREE.Vector3() });
    this.group.position.set(0, 0, 0);
    this.hideAll();
  }

  private hideAll(): void {
    const a = this.geo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < SPARK_COUNT; i++) a.setXYZ(i, this.origin.x, -9999, this.origin.z);
    a.needsUpdate = true;
  }

  private respawn(i: number, a: THREE.BufferAttribute): void {
    const s = this.state[i];
    s.life = SPARK_LIFETIME * (0.6 + Math.random() * 0.4);
    // direction (-0.3, 0.8, 0.6): up and toward the camera, widening with progress
    const spread = ((40 + this.progress * 20) * Math.PI) / 180;
    const dir = new THREE.Vector3(-0.3, 0.8, 0.6).normalize();
    const yaw = (Math.random() - 0.5) * spread;
    const pitch = (Math.random() - 0.5) * spread;
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).applyAxisAngle(new THREE.Vector3(1, 0, 0), pitch);
    const speed = 3.0 + Math.random() * (2.0 + this.progress * 3.5);
    s.vel.copy(dir).multiplyScalar(speed);
    a.setXYZ(i, this.origin.x, this.origin.y, this.origin.z);
  }

  update(dt: number): void {
    const a = this.geo.getAttribute("position") as THREE.BufferAttribute;
    this.mat.color.copy(sparkColor(this.progress, this.colour));
    this.mat.size = 0.028 * (0.75 + this.progress * 1.15) + 0.016; // grows as the shower heats up
    for (let i = 0; i < SPARK_COUNT; i++) {
      const s = this.state[i];
      if (s.life <= 0) {
        if (this.emitting && Math.random() < dt * 8) this.respawn(i, a);
        continue;
      }
      s.life -= dt;
      if (s.life <= 0) {
        a.setXYZ(i, this.origin.x, -9999, this.origin.z);
        continue;
      }
      s.vel.y += GRAVITY * dt;
      a.setXYZ(i, a.getX(i) + s.vel.x * dt, a.getY(i) + s.vel.y * dt, a.getZ(i) + s.vel.z * dt);
    }
    a.needsUpdate = true;
    this.mat.opacity = this.emitting ? 1 : 0.35;
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.map?.dispose();
    this.mat.dispose();
  }
}

/** Where each sentence's arrow lands: longer sentence -> nearer the bullseye. */
export function arrowRings(prose: string, maxRadius = 1.0): { span: [number, number]; offset: THREE.Vector2 }[] {
  const spans: [number, number][] = [];
  let start = 0;
  for (let i = 0; i < prose.length; i++) {
    if (prose[i] === ".") {
      spans.push([start, i + 1]);
      start = i + 1;
    }
  }
  if (spans.length === 0) spans.push([0, prose.length]);
  let min = Infinity;
  let max = 0;
  for (const [a, b] of spans) {
    min = Math.min(min, b - a);
    max = Math.max(max, b - a);
  }
  const span = Math.max(1, max - min);
  return spans.map(([a, b], i) => {
    const radius = (maxRadius * (max - (b - a))) / span;
    const angle = i * 2.399963; // golden angle, so the arrows spread around the face
    return { span: [a, b], offset: new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius) };
  });
}

/** One arrow in flight, easing into the target face and sticking there. */
export class Arrow {
  readonly obj: THREE.Object3D;
  private t = 0;
  private readonly dur = 0.22;
  private readonly from = new THREE.Vector3();
  private readonly to = new THREE.Vector3();
  private landed = false;

  constructor(model: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3) {
    this.obj = model;
    this.from.copy(from);
    this.to.copy(to);
    this.obj.position.copy(from);
    this.obj.scale.setScalar(2.4);
    this.obj.lookAt(to);
  }

  /** True once it has landed (then it just sits in the target). */
  update(dt: number): boolean {
    if (this.landed) return true;
    this.t += dt;
    const k = Math.min(1, this.t / this.dur);
    this.obj.position.copy(this.from).lerp(this.to, k * k); // ease-in, like the Godot tween
    if (k >= 1) {
      this.landed = true;
      // a dead-centre shot flies end-on to the camera and would read as an empty bullseye:
      // tilt it up toward the shooter so the hit is legible
      this.obj.lookAt(this.to.clone().add(new THREE.Vector3(0, -0.55, -1.0)));
    }
    return this.landed;
  }
}
