/**
 * 3D particle models. Shapes are defined as signed distance functions (SDFs);
 * `sampleSdf` scatters points evenly over their surfaces, so every stage is a
 * real 3D object that can be turned with the mouse.
 */

type Sdf = (x: number, y: number, z: number) => number;
type Vec3 = [number, number, number];

function gauss(): number {
  let u = 0;
  while (u === 0) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * Math.random());
}

// ---------- SDF building blocks ----------

function ellipsoid(px: number, py: number, pz: number, rx: number, ry: number, rz: number) {
  const ax = px / rx, ay = py / ry, az = pz / rz;
  const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
  const bx = ax / rx, by = ay / ry, bz = az / rz;
  const k1 = Math.sqrt(bx * bx + by * by + bz * bz) || 1e-6;
  return (k0 * (k0 - 1)) / k1;
}

function capsule(px: number, py: number, pz: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number) {
  const pax = px - ax, pay = py - ay, paz = pz - az;
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  let h = (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz);
  h = h < 0 ? 0 : h > 1 ? 1 : h;
  const cx = pax - bax * h, cy = pay - bay * h, cz = paz - baz * h;
  return Math.sqrt(cx * cx + cy * cy + cz * cz) - r;
}

function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/** Carve b out of a. */
function ssub(a: number, b: number, k: number) {
  let h = 0.5 - (0.5 * (a + b)) / k;
  h = h < 0 ? 0 : h > 1 ? 1 : h;
  return a + (-b - a) * h + k * h * (1 - h);
}

function roundBox(px: number, py: number, pz: number, bx: number, by: number, bz: number, r: number) {
  const qx = Math.abs(px) - bx + r, qy = Math.abs(py) - by + r, qz = Math.abs(pz) - bz + r;
  const mx = Math.max(qx, 0), my = Math.max(qy, 0), mz = Math.max(qz, 0);
  return Math.sqrt(mx * mx + my * my + mz * mz) + Math.min(Math.max(qx, qy, qz), 0) - r;
}

/** Capped cylinder: radial distance `rad`, offset along its axis `ax`, radius r, half length h. */
function cyl(rad: number, ax: number, r: number, h: number) {
  const dx = rad - r, dy = Math.abs(ax) - h;
  return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
}

// ---------- Robot ----------

/** Detailed robot head: visor, lens eyes, grille mouth, bolts, ear discs, vents, antenna, ribbed neck. */
export function robotHead(px: number, py: number, pz: number) {
  const ax = Math.abs(px);
  let d = roundBox(px, py - 0.25, pz, 0.72, 0.62, 0.6, 0.16);
  d = ssub(d, roundBox(px, py - 0.62, pz, 0.8, 0.012, 0.7, 0.005), 0.01); // seam

  // face panel, eyes, mouth, visor, bolts
  d = ssub(d, roundBox(px, py - 0.18, pz - 0.62, 0.56, 0.44, 0.07, 0.08), 0.02);
  const ex = ax - 0.26, ey = py - 0.32, er = Math.hypot(ex, ey);
  let eye = cyl(er, pz - 0.66, 0.2, 0.13) - 0.015;
  eye = ssub(eye, cyl(er, pz - 0.82, 0.14, 0.12), 0.01);
  d = Math.min(d, eye);
  d = Math.min(d, Math.sqrt(ex * ex + ey * ey + (pz - 0.66) ** 2) - 0.11);
  let mouth = roundBox(px, py + 0.08, pz - 0.62, 0.34, 0.11, 0.09, 0.03);
  const slot = ((((px + 0.06) % 0.12) + 0.12) % 0.12) - 0.06;
  if (ax < 0.29) mouth = ssub(mouth, roundBox(slot, py + 0.08, pz - 0.72, 0.026, 0.075, 0.06, 0.01), 0.005);
  d = Math.min(d, mouth);
  d = smin(d, roundBox(px, py - 0.55, pz - 0.6, 0.52, 0.045, 0.06, 0.02), 0.02);
  const bx = ax - 0.5, bz = pz - 0.62;
  d = Math.min(d, Math.sqrt(bx * bx + (py - 0.56) ** 2 + bz * bz) - 0.032);
  d = Math.min(d, Math.sqrt(bx * bx + (py + 0.2) ** 2 + bz * bz) - 0.032);

  // ear discs + bolts
  const rx = Math.hypot(py - 0.25, pz);
  d = smin(d, cyl(rx, ax - 0.74, 0.22, 0.07) - 0.02, 0.04);
  d = Math.min(d, cyl(rx, ax - 0.82, 0.08, 0.04) - 0.01);

  // side vents
  if (ax > 0.6 && py > -0.25 && py < 0.2 && pz < -0.15) {
    const vy = ((((py + 0.25) % 0.1) + 0.1) % 0.1) - 0.05;
    d = ssub(d, roundBox(ax - 0.73, vy, pz + 0.38, 0.05, 0.016, 0.16, 0.008), 0.006);
  }

  // antenna
  d = smin(d, cyl(Math.hypot(px, pz), py - 0.9, 0.1, 0.04), 0.04);
  d = Math.min(d, capsule(px, py, pz, 0, 0.9, 0, 0, 1.22, 0, 0.03));
  d = Math.min(d, Math.sqrt(px * px + (py - 1.3) ** 2 + pz * pz) - 0.09);

  // ribbed neck, cables into the collar
  d = Math.min(d, capsule(ax, py, pz, 0.3, -0.32, -0.38, 0.4, -0.95, -0.22, 0.045));
  const rr = Math.hypot(px, pz);
  let neck = cyl(rr, py + 0.62, 0.27, 0.3);
  for (const y of [-0.5, -0.64, -0.78]) neck = ssub(neck, Math.hypot(rr - 0.28, py - y) - 0.035, 0.01);
  d = Math.min(d, neck);
  d = Math.min(d, cyl(rr, py + 0.95, 0.36, 0.04) - 0.03);
  return d;
}

/** Head plus chest, shoulder joints and upper arms: a robot bust for the hero. */
export function robotBust(px: number, py: number, pz: number) {
  let d = robotHead(px, py, pz);
  if (py > -0.85) return d;
  const ax = Math.abs(px);

  // chest plate with a horizontal seam and a round core light
  let chest = roundBox(px, py + 1.62, pz + 0.02, 1.0, 0.6, 0.46, 0.24);
  chest = ssub(chest, roundBox(px, py + 1.95, pz, 1.2, 0.012, 0.6, 0.005), 0.01);
  chest = ssub(chest, cyl(Math.hypot(px, py + 1.45), pz - 0.47, 0.2, 0.05), 0.02);
  chest = Math.min(chest, cyl(Math.hypot(px, py + 1.45), pz - 0.42, 0.12, 0.06) - 0.01);
  // collar bolts
  chest = Math.min(chest, Math.sqrt((ax - 0.62) ** 2 + (py + 1.15) ** 2 + (pz - 0.45) ** 2) - 0.035);
  d = smin(d, chest, 0.06);

  // shoulder joints and upper arms (cut off by the bottom of the screen)
  d = Math.min(d, Math.sqrt((ax - 1.15) ** 2 + (py + 1.25) ** 2 + pz * pz) - 0.3);
  d = Math.min(d, cyl(Math.hypot(py + 1.25, pz), ax - 1.15, 0.33, 0.06));
  d = Math.min(d, capsule(ax, py, pz, 1.25, -1.45, 0, 1.38, -2.5, 0.05, 0.24));
  return d;
}

/** Points inside the robot's eyeballs get extra density so the eyes "glow". */
export function robotEyes(count: number, scale = 1, offset: Vec3 = [0, 0, 0]) {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const side = i % 2 ? 1 : -1;
    // fill a disc on the front of each eyeball
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.1;
    out[i * 3] = (side * 0.26 + Math.cos(a) * r) * scale + offset[0];
    out[i * 3 + 1] = (0.32 + Math.sin(a) * r) * scale + offset[1];
    out[i * 3 + 2] = (0.74 + Math.random() * 0.03) * scale + offset[2];
  }
  return out;
}

// ---------- Mannequin bust (hero) ----------

/**
 * An abstract display mannequin: a smooth, featureless egg-shaped head, a long neck
 * with the neck muscles hinted, sloping shoulders, rounded deltoids, collarbones,
 * a sculpted chest and arms hanging down. Faces +z.
 */
export function mannequinBust(px: number, py: number, pz: number) {
  const ax = Math.abs(px);
  // egg head: rounded crown tapering to a narrow chin, no facial features
  let d = ellipsoid(px, py - 0.3, pz, 0.6, 0.82, 0.7);
  d = smin(d, ellipsoid(px, py + 0.18, pz - 0.1, 0.42, 0.55, 0.52), 0.35);

  // neck with the two neck muscles running down to the collarbones
  d = smin(d, capsule(px, py, pz, 0, -0.4, -0.05, 0, -1.35, -0.05, 0.25), 0.18);
  d = smin(d, capsule(ax, py, pz, 0.24, -0.45, -0.02, 0.08, -1.42, 0.2, 0.065), 0.08);

  // trapezius slopes and rounded shoulders
  d = smin(d, capsule(ax, py, pz, 0.18, -1.2, -0.12, 0.98, -1.55, -0.1, 0.2), 0.22);
  d = smin(d, Math.hypot(ax - 1.12, py + 1.78, pz + 0.04) - 0.38, 0.22);

  // torso, chest muscles, collarbones and the notch between them
  d = smin(d, ellipsoid(px, py + 3.0, pz, 1.02, 1.6, 0.52), 0.3); // continues off the bottom of the screen
  d = smin(d, ellipsoid(ax - 0.45, py + 2.05, pz - 0.34, 0.45, 0.28, 0.2), 0.16);
  d = smin(d, capsule(ax, py, pz, 0.12, -1.5, 0.28, 0.95, -1.56, 0.1, 0.05), 0.05);
  d = ssub(d, Math.hypot(px, py + 1.48, pz - 0.36) - 0.07, 0.05);

  // upper arms hanging down
  d = smin(d, capsule(ax, py, pz, 1.2, -1.9, -0.05, 1.32, -3.3, -0.05, 0.27), 0.15);
  return d;
}

// ---------- Graduation cap ----------

export function capModel(px: number, py: number, pz: number) {
  const q = Math.hypot(px, pz) - 0.52;
  const h = Math.abs(py - 0.05) - 0.3;
  let d = Math.min(Math.max(q, h), 0) + Math.hypot(Math.max(q, 0), Math.max(h, 0)) - 0.04;
  const rx = Math.abs((px + pz) * Math.SQRT1_2) - 0.78;
  const rz = Math.abs((pz - px) * Math.SQRT1_2) - 0.78;
  const ry = Math.abs(py - 0.4) - 0.035;
  const mx = Math.max(rx, 0), my = Math.max(ry, 0), mz = Math.max(rz, 0);
  d = smin(d, Math.sqrt(mx * mx + my * my + mz * mz) + Math.min(Math.max(rx, ry, rz), 0) - 0.02, 0.05);
  d = Math.min(d, Math.sqrt(px * px + (py - 0.47) ** 2 + pz * pz) - 0.07);
  d = Math.min(d, capsule(px, py, pz, 0, 0.47, 0, 0.88, 0.45, 0, 0.025));
  d = Math.min(d, capsule(px, py, pz, 0.88, 0.45, 0, 0.88, -0.05, 0, 0.03));
  d = Math.min(d, capsule(px, py, pz, 0.88, -0.1, 0, 0.88, -0.45, 0, 0.08));
  return d;
}

// ---------- Surface sampler ----------

export interface SdfSampleOptions {
  /** Bounding box of the shape in model units. */
  min: Vec3;
  max: Vec3;
  scale?: number;
  offset?: Vec3;
  /** Tilt toward the camera (radians about x) before offsetting, e.g. to show the top of the cap. */
  tiltX?: number;
  /** Unique surface samples; the rest of `count` are jittered copies (keeps start-up fast). */
  unique?: number;
}

/**
 * Scatter `count` points evenly over the surface of an SDF: random points near the
 * surface are pulled onto it along the gradient (Newton steps).
 */
export function sampleSdf(sdf: Sdf, count: number, opts: SdfSampleOptions): Float32Array {
  const { min, max, scale = 1, offset = [0, 0, 0], tiltX = 0, unique = Math.min(count, 24000) } = opts;
  const uniq = new Float32Array(unique * 3);
  const e = 0.002;
  let n = 0;
  let guard = 0;
  while (n < unique && guard++ < unique * 400) {
    let x = min[0] + Math.random() * (max[0] - min[0]);
    let y = min[1] + Math.random() * (max[1] - min[1]);
    let z = min[2] + Math.random() * (max[2] - min[2]);
    let d = sdf(x, y, z);
    if (Math.abs(d) > 0.1) continue;
    for (let k = 0; k < 4 && Math.abs(d) > 0.0015; k++) {
      const gx = sdf(x + e, y, z) - d, gy = sdf(x, y + e, z) - d, gz = sdf(x, y, z + e) - d;
      const gl = Math.hypot(gx, gy, gz) || 1;
      x -= (gx / gl) * d;
      y -= (gy / gl) * d;
      z -= (gz / gl) * d;
      d = sdf(x, y, z);
    }
    if (Math.abs(d) > 0.004) continue;
    uniq[n * 3] = x;
    uniq[n * 3 + 1] = y;
    uniq[n * 3 + 2] = z;
    n++;
  }

  const ct = Math.cos(tiltX), st = Math.sin(tiltX);
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const j = (i % Math.max(n, 1)) * 3;
    const jit = i < n ? 0 : 0.006;
    const x = uniq[j] + gauss() * jit;
    const y = uniq[j + 1] + gauss() * jit;
    const z = uniq[j + 2] + gauss() * jit;
    out[i * 3] = x * scale + offset[0];
    out[i * 3 + 1] = (y * ct - z * st) * scale + offset[1];
    out[i * 3 + 2] = (y * st + z * ct) * scale + offset[2];
  }
  return out;
}

// ---------- 3D network (Skills) ----------

function randomDir(): Vec3 {
  const z = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - z * z);
  return [r * Math.cos(a), r * Math.sin(a), z];
}

/** Four hubs (one per skill group) in 3D, each with satellites and links. */
export function network3d(count: number): Float32Array {
  const hubs: Vec3[] = [
    [-1.5, 0.95, 0.5],
    [1.45, 1.05, -0.6],
    [-1.15, -1.1, -0.55],
    [1.6, -0.9, 0.55],
  ];
  const sats: Vec3[] = [];
  const edges: Array<[Vec3, Vec3]> = [];
  for (const h of hubs) {
    for (let k = 0; k < 8; k++) {
      const dir = randomDir(), d = 0.55 + Math.random() * 0.5;
      const s: Vec3 = [h[0] + dir[0] * d, h[1] + dir[1] * d * 0.85, h[2] + dir[2] * d];
      sats.push(s);
      edges.push([h, s]);
    }
  }
  for (let i = 0; i < hubs.length; i++) for (let j = i + 1; j < hubs.length; j++) edges.push([hubs[i], hubs[j]]);

  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const kind = Math.random();
    let p: Vec3;
    if (kind < 0.32) {
      // hub: a soft sphere shell
      const h = hubs[(Math.random() * hubs.length) | 0], dir = randomDir(), r = 0.2 + gauss() * 0.03;
      p = [h[0] + dir[0] * r, h[1] + dir[1] * r, h[2] + dir[2] * r];
    } else if (kind < 0.54) {
      const s = sats[(Math.random() * sats.length) | 0];
      p = [s[0] + gauss() * 0.04, s[1] + gauss() * 0.04, s[2] + gauss() * 0.04];
    } else if (kind < 0.93) {
      const [a, b] = edges[(Math.random() * edges.length) | 0];
      const t = Math.random();
      p = [a[0] + (b[0] - a[0]) * t + gauss() * 0.01, a[1] + (b[1] - a[1]) * t + gauss() * 0.01, a[2] + (b[2] - a[2]) * t + gauss() * 0.01];
    } else {
      p = [gauss() * 2.4, gauss() * 1.5, gauss() * 1.2];
    }
    out[i * 3] = p[0];
    out[i * 3 + 1] = p[1];
    out[i * 3 + 2] = p[2];
  }
  return out;
}

// ---------- Floating laptop with code (hero) ----------

/**
 * An open laptop with code on the screen, a keyboard and trackpad, a floating </> tag
 * and { } brackets, and a faint glow underneath. Procedural points (crisp lines), tipped
 * toward the camera so the keyboard shows. Faces +z.
 */
export interface LaptopModel {
  positions: Float32Array;
  /** Typing order of each code point (0…1, line by line); -1 for points that aren't code. */
  reveal: Float32Array;
  /** Keyboard key index (row × 13 + column, rows from the back) of each key point; -1 otherwise. */
  key: Float32Array;
}

export function laptopCode(count: number): LaptopModel {
  const pts: number[] = [];
  const rv: number[] = [];
  const ky: number[] = [];
  const add = (x: number, y: number, z: number, reveal = -1, key = -1) => { pts.push(x, y, z); rv.push(reveal); ky.push(key); };
  const J = (s = 0.008) => gauss() * s;

  // screen frame: tilted back 16° from vertical, hinged at the back edge of the base
  const W = 3.4, Hs = 2.15, tilt = 0.28, hingeY = -1.18, hingeZ = -0.95;
  const onScreen = (u: number, v: number, lift = 0): Vec3 => [
    u,
    hingeY + v * Math.cos(tilt) + lift * Math.sin(tilt),
    hingeZ - v * Math.sin(tilt) + lift * Math.cos(tilt),
  ];
  const baseY = -1.25, baseD = 2.3, baseZ0 = hingeZ, baseZ1 = hingeZ + baseD;

  // how many points each part gets (fractions of count)
  const parts: Array<[number, () => void]> = [
    [0.1, () => { // base outline
      const t = Math.random() * 2 * (W + baseD), y = baseY + (Math.random() < 0.5 ? 0 : -0.09);
      let x: number, z: number;
      if (t < W) { x = -W / 2 + t; z = baseZ1; }
      else if (t < W + baseD) { x = W / 2; z = baseZ1 - (t - W); }
      else if (t < 2 * W + baseD) { x = W / 2 - (t - W - baseD); z = baseZ0; }
      else { x = -W / 2; z = baseZ0 + (t - 2 * W - baseD); }
      add(x + J(), y + J(), z + J());
    }],
    [0.06, () => add(-W / 2 + Math.random() * W, baseY, baseZ0 + Math.random() * baseD)], // deck surface
    [0.14, () => { // keyboard: 5 rows × 13 key outlines
      const r = (Math.random() * 5) | 0, c = (Math.random() * 13) | 0, kw = 0.2, gap = 0.035;
      const x0 = -1.35 + c * (kw + gap), z0 = baseZ0 + 0.25 + r * (kw + gap);
      const e = Math.random() * 4 * kw;
      const [x, z] = e < kw ? [x0 + e, z0] : e < 2 * kw ? [x0 + kw, z0 + e - kw] : e < 3 * kw ? [x0 + 3 * kw - e, z0 + kw] : [x0, z0 + 4 * kw - e];
      add(x + J(0.004), baseY + 0.01, z + J(0.004), -1, r * 13 + c);
    }],
    [0.04, () => { // trackpad
      const w = 1.1, d = 0.55, x0 = -w / 2, z0 = baseZ1 - 0.68, e = Math.random() * 2 * (w + d);
      const [x, z] = e < w ? [x0 + e, z0] : e < w + d ? [x0 + w, z0 + e - w] : e < 2 * w + d ? [x0 + 2 * w + d - e, z0 + d] : [x0, z0 + 2 * (w + d) - e];
      add(x + J(0.005), baseY + 0.01, z + J(0.005));
    }],
    [0.12, () => { // screen bezel + inner display edge
      const inner = Math.random() < 0.5, m = inner ? 0.12 : 0, w = W - 2 * m, h = Hs - 2 * m;
      const e = Math.random() * 2 * (w + h);
      const [u, v] = e < w ? [-w / 2 + e, m] : e < w + h ? [w / 2, m + e - w] : e < 2 * w + h ? [w / 2 - (e - w - h), m + h] : [-w / 2, m + h - (e - 2 * w - h)];
      const p = onScreen(u, v);
      add(p[0] + J(), p[1] + J(), p[2] + J());
    }],
    [0.05, () => { const p = onScreen((Math.random() - 0.5) * (W - 0.24), 0.12 + Math.random() * (Hs - 0.24)); add(p[0], p[1], p[2]); }], // display
    [0.3, () => { // code: indented token lines
      const row = (Math.random() * CODE.length) | 0, [indent, ...tokens] = CODE[row];
      let u0 = -1.35 + indent * 0.22;
      const total = tokens.reduce((a, b) => a + b, 0) + (tokens.length - 1) * 0.08;
      let pick = Math.random() * total;
      const start = u0;
      for (const len of tokens) {
        if (pick <= len) {
          const u = u0 + pick, p = onScreen(u, Hs - 0.32 - row * 0.135, 0.01);
          // typed left to right, line by line
          const reveal = (row + (u - start) / (total + 1e-6)) / CODE.length;
          add(p[0] + J(0.004), p[1] + J(0.004), p[2], reveal);
          return;
        }
        pick -= len + 0.08; u0 += len + 0.08;
      }
    }],
    [0.025, () => { // line numbers
      const row = (Math.random() * CODE.length) | 0, p = onScreen(-1.52 + Math.random() * 0.06, Hs - 0.32 - row * 0.135, 0.01);
      add(p[0] + J(0.003), p[1] + J(0.003), p[2]);
    }],
    [0.09, () => { // floating </> above the screen
      const s = 0.55, cx = 0, cy = 1.62, cz = 0.2;
      const stroke = (Math.random() * 5) | 0, t = Math.random();
      const seg: Array<[number, number, number, number]> = [
        [-0.9, 0, -0.55, 0.38], [-0.9, 0, -0.55, -0.38], [-0.18, -0.45, 0.18, 0.45], [0.9, 0, 0.55, 0.38], [0.9, 0, 0.55, -0.38],
      ];
      const [x0, y0, x1, y1] = seg[stroke];
      add(cx + (x0 + (x1 - x0) * t) * s + J(0.01), cy + (y0 + (y1 - y0) * t) * s + J(0.01), cz + J(0.03));
    }],
    [0.04, () => { // { } braces floating beside the screen
      const side = Math.random() < 0.5 ? -1 : 1; // -1 = '{' on the left, 1 = '}' on the right
      const t = Math.random() * (BRACE.length - 1), i = Math.floor(t), f = t - i;
      const [x0, y0] = BRACE[i], [x1, y1] = BRACE[i + 1];
      const x = (x0 + (x1 - x0) * f) * -side, y = y0 + (y1 - y0) * f;
      add(side * 2.15 + x * 0.42 + J(0.008), 0.35 + y * 0.42 + J(0.008), 0.3 + J(0.02));
    }],
    [0.023, () => { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()); add(Math.cos(a) * r * 2.0, -1.75 + J(0.04), 0.2 + Math.sin(a) * r * 1.0); }], // glow below
  ];

  const total = parts.reduce((a, [f]) => a + f, 0);
  for (const [f, fn] of parts) {
    const n = Math.round((count * f) / total);
    for (let i = 0; i < n; i++) fn();
  }
  while (pts.length < count * 3) parts[6][1]();

  // tip the whole laptop toward the camera so the keyboard shows
  const out = new Float32Array(count * 3);
  const c = Math.cos(0.32), s = Math.sin(0.32);
  for (let i = 0; i < count; i++) {
    const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2];
    out[i * 3] = x;
    out[i * 3 + 1] = y * c - z * s + 0.15;
    out[i * 3 + 2] = y * s + z * c;
  }
  return { positions: out, reveal: Float32Array.from(rv.slice(0, count)), key: Float32Array.from(ky.slice(0, count)) };
}

/** A '{' outline as a polyline (x right, y up); '}' is the mirror image. */
const BRACE: Array<[number, number]> = [
  [0.28, 1], [0.08, 0.92], [0.04, 0.6], [0.04, 0.2], [-0.2, 0], [0.04, -0.2], [0.04, -0.6], [0.08, -0.92], [0.28, -1],
];

/** Code shown on the laptop screen: [indent, token lengths…] per line. */
const CODE: number[][] = [
  [0, 0.45, 0.6, 0.25],
  [1, 0.35, 0.9],
  [1, 0.5, 0.3, 0.55],
  [2, 0.7, 0.4],
  [2, 0.3, 0.85, 0.2],
  [1, 0.25],
  [0, 0.3],
  [0, 0.6, 0.45],
  [1, 0.4, 0.7, 0.3],
  [1, 0.55],
  [2, 0.35, 0.5, 0.6],
  [1, 0.2],
  [0, 0.3],
];
