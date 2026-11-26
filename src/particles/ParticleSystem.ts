import * as THREE from 'three';
import { config, reducedMotion } from './config';
import { vertexShader, fragmentShader } from './shaders';
import { frame, noiseCloud } from './shapes';

export interface ShapeDef {
  name: string;
  positions: Float32Array;
  /** Y rotation (radians) as a function of elapsed time. */
  rotation?: (time: number) => number;
  /** Wave drift amount (0 = static). */
  drift?: number;
  /** Alpha multiplier while this shape is shown. */
  alpha?: number;
  /** Position of the shape (world units), applied after the hover turn so it turns in place. */
  offset?: [number, number, number];
  /** How much the shape turns to follow the cursor (0 = fixed, e.g. the contact frame). Default 1. */
  tilt?: number;
}

const CAMERA_Z = 10;
const FOV = 35;

/**
 * One THREE.Points with a target-position attribute per shape. Only two
 * shapes are ever bound at once (aFrom / aTo); the CPU swaps them when the
 * integer part of `progress` changes, and the shader blends with uLocal.
 */
export class ParticleSystem {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly points: THREE.Points;
  readonly uniforms;

  /** 0..N-1 — drive this from the scroll timeline. */
  readonly state = { progress: 0, intro: 0, parallaxWeight: 1 };

  private geometry = new THREE.BufferGeometry();
  private shapes: ShapeDef[] = [];
  private attrs: THREE.BufferAttribute[] = [];
  private boundIndex = -1;
  private lastTime = 0;
  private raf = 0;
  private running = false;
  private mouseTarget = new THREE.Vector2(999, 999);
  private mouseNdc = new THREE.Vector2(0, 0);
  private fitScale = 1;
  private frameListeners: Array<(time: number, dt: number) => void> = [];

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(new THREE.Color('#232329'), 1);
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    this.camera.position.set(0, 0, CAMERA_Z);

    const n = config.count;
    const seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) seeds[i] = Math.random();
    const cloud = new THREE.BufferAttribute(noiseCloud(n), 3);
    this.geometry.setAttribute('position', cloud); // drives draw count
    this.geometry.setAttribute('aNoise', cloud);
    this.geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    this.uniforms = {
      uTime: { value: 0 },
      uLocal: { value: 0 },
      uIntro: { value: 0 },
      uStagger: { value: config.stagger },
      uEasePower: { value: config.easePower },
      uNoiseRest: { value: config.noiseRest },
      uNoiseMorph: { value: config.noiseMorph },
      uNoiseScale: { value: config.noiseScale },
      uSize: { value: config.pointSize },
      uPixelRatio: { value: 1 },
      uSizeScale: { value: CAMERA_Z },
      uReduced: { value: reducedMotion ? 1 : 0 },
      uOpacity: { value: config.opacity },
      uMouse: { value: new THREE.Vector3(999, 999, 0) },
      uMouseRadius: { value: config.mouseRadius },
      uMouseStrength: { value: config.mouseStrength },
      uRotFrom: { value: 0 },
      uRotTo: { value: 0 },
      uDriftFrom: { value: 0 },
      uDriftTo: { value: 0 },
      uAlphaFrom: { value: 1 },
      uAlphaTo: { value: 1 },
      uOffsetFrom: { value: new THREE.Vector3() },
      uOffsetTo: { value: new THREE.Vector3() },
      uTiltFrom: { value: 1 },
      uTiltTo: { value: 1 },
      uTilt: { value: new THREE.Vector2() },
      uColor: { value: new THREE.Color(config.color) },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
    });

    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false;
    this.scene.add(this.points);

    window.addEventListener('pointermove', this.onPointer, { passive: true });
    document.addEventListener('pointerleave', () => this.mouseTarget.set(999, 999));
    window.addEventListener('blur', () => this.mouseTarget.set(999, 999));
  }

  setShapes(shapes: ShapeDef[]) {
    this.shapes = shapes;
    this.attrs = shapes.map((s) => new THREE.BufferAttribute(s.positions, 3));
    this.boundIndex = -1;
    this.bind(0);
  }

  /** Replace one shape's positions in place (e.g. the contact frame on resize). */
  updateShape(name: string, positions: Float32Array) {
    const i = this.shapes.findIndex((s) => s.name === name);
    if (i < 0) return;
    this.attrs[i].array.set(positions);
    this.attrs[i].needsUpdate = true;
  }

  /** Rebuild the frame shape so it hugs a DOM element (CSS px rect relative to the viewport). */
  fitFrameToRect(name: string, rect: { x: number; y: number; width: number; height: number }) {
    const i = this.shapes.findIndex((s) => s.name === name);
    if (i < 0) return;
    const ppw = this.pixelsPerWorldUnit() * this.fitScale;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = rect.width / ppw;
    const h = rect.height / ppw;
    const cx = (rect.x + rect.width / 2 - vw / 2) / ppw;
    const cy = -(rect.y + rect.height / 2 - vh / 2) / ppw;
    frame(config.count, w, h, cx, cy, 0.03 / this.fitScale, this.attrs[i].array as Float32Array);
    this.attrs[i].needsUpdate = true;
  }

  /** CSS pixels per world unit on the z = 0 plane. */
  pixelsPerWorldUnit() {
    const visibleH = 2 * CAMERA_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    return window.innerHeight / visibleH;
  }

  /** Uniform scale applied to the whole field so shapes fit narrow screens. */
  get scale() {
    return this.fitScale;
  }

  onFrame(fn: (time: number, dt: number) => void) {
    this.frameListeners.push(fn);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, config.maxDpr);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.uniforms.uPixelRatio.value = dpr;

    const visibleW = w / this.pixelsPerWorldUnit();
    this.fitScale = THREE.MathUtils.clamp(visibleW / 5.4, 0.58, 1);
    this.points.scale.setScalar(this.fitScale);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now(); // swallow the time spent paused
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      this.tick();
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private bind(index: number) {
    if (index === this.boundIndex || !this.attrs.length) return;
    const to = Math.min(index + 1, this.attrs.length - 1);
    this.geometry.setAttribute('aFrom', this.attrs[index]);
    this.geometry.setAttribute('aTo', this.attrs[to]);
    this.boundIndex = index;
  }

  private onPointer = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    this.mouseNdc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    const ppw = this.pixelsPerWorldUnit();
    this.mouseTarget.set((e.clientX - window.innerWidth / 2) / ppw, -(e.clientY - window.innerHeight / 2) / ppw);
  };

  private tick() {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 1 / 20);
    this.lastTime = now;
    const time = (this.uniforms.uTime.value += dt);
    const u = this.uniforms;
    const n = this.shapes.length;

    if (n) {
      const p = THREE.MathUtils.clamp(this.state.progress, 0, n - 1);
      const idx = Math.min(Math.floor(p), Math.max(n - 2, 0));
      this.bind(idx);
      const from = this.shapes[idx];
      const to = this.shapes[Math.min(idx + 1, n - 1)];
      u.uLocal.value = n > 1 ? p - idx : 0;
      u.uRotFrom.value = from.rotation?.(time) ?? 0;
      u.uRotTo.value = to.rotation?.(time) ?? 0;
      u.uDriftFrom.value = from.drift ?? 0;
      u.uDriftTo.value = to.drift ?? 0;
      u.uAlphaFrom.value = from.alpha ?? 1;
      u.uAlphaTo.value = to.alpha ?? 1;
      u.uOffsetFrom.value.fromArray(from.offset ?? [0, 0, 0]);
      u.uOffsetTo.value.fromArray(to.offset ?? [0, 0, 0]);
      u.uTiltFrom.value = from.tilt ?? 1;
      u.uTiltTo.value = to.tilt ?? 1;
    }
    u.uIntro.value = this.state.intro;

    // Smoothed mouse (repulsion) and hero parallax.
    const m = u.uMouse.value;
    const far = this.mouseTarget.x > 900;
    if (far) m.set(999, 999, 0);
    else if (m.x > 900) m.set(this.mouseTarget.x, this.mouseTarget.y, 0);
    else m.lerp(new THREE.Vector3(this.mouseTarget.x, this.mouseTarget.y, 0), 1 - Math.exp(-dt * 10));

    // Hover: every 3D model turns toward the cursor (smoothed). Shapes opt out with tilt: 0.
    const tilt = u.uTilt.value;
    const k = 1 - Math.exp(-dt * 2); // hover turn follows the cursor a little more slowly
    tilt.x += (this.mouseNdc.x * config.hoverYaw - tilt.x) * k;
    tilt.y += (-this.mouseNdc.y * config.hoverPitch - tilt.y) * k;

    for (const fn of this.frameListeners) fn(time, dt);
    this.renderer.render(this.scene, this.camera);
  }
}
