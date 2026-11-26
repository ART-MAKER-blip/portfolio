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

// ---------- 3D annotation cuboids (Experience) ----------

/** Wireframe 3D boxes like LiDAR / 3D annotation cuboids, with corner handles and label tabs. */
export function cuboids(count: number): Float32Array {
  const boxes = [
    { w: 2.4, h: 1.7, d: 1.4, x: -0.2, y: 0.45, z: -0.6, yaw: 0.5 },
    { w: 1.2, h: 1.6, d: 1.0, x: 1.6, y: -0.2, z: 0.3, yaw: -0.4 },
    { w: 1.1, h: 0.75, d: 0.9, x: -1.6, y: -1.15, z: 0.4, yaw: 0.25 },
    { w: 0.9, h: 0.9, d: 0.9, x: 0.6, y: -1.4, z: 0.8, yaw: 0.9 },
    { w: 0.7, h: 1.1, d: 0.6, x: -2.2, y: 0.9, z: -0.2, yaw: -0.3 },
  ];
  const weight = boxes.map((b) => 4 * (b.w + b.h + b.d));
  const total = weight.reduce((a, b) => a + b, 0);
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    let t = Math.random() * total;
    let b = boxes[0];
    for (let k = 0; k < boxes.length; k++) if ((t -= weight[k]) <= 0) { b = boxes[k]; break; }
    const hw = b.w / 2, hh = b.h / 2, hd = b.d / 2;
    const kind = Math.random();
    let x: number, y: number, z: number;
    const sx = Math.random() < 0.5 ? -1 : 1, sy = Math.random() < 0.5 ? -1 : 1, sz = Math.random() < 0.5 ? -1 : 1;
    if (kind < 0.84) {
      // one of the 12 edges
      const axis = Math.random() * (b.w + b.h + b.d);
      if (axis < b.w) { x = (Math.random() - 0.5) * b.w; y = sy * hh; z = sz * hd; }
      else if (axis < b.w + b.h) { x = sx * hw; y = (Math.random() - 0.5) * b.h; z = sz * hd; }
      else { x = sx * hw; y = sy * hh; z = (Math.random() - 0.5) * b.d; }
      x += gauss() * 0.01; y += gauss() * 0.01; z += gauss() * 0.01;
    } else if (kind < 0.95) {
      // corner handles
      x = sx * hw + gauss() * 0.035; y = sy * hh + gauss() * 0.035; z = sz * hd + gauss() * 0.035;
    } else {
      // label tab on the top front-left edge
      x = -hw + Math.random() * Math.min(0.5, b.w * 0.45);
      y = hh + 0.02 + Math.random() * 0.13;
      z = hd;
    }
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
    out[i * 3] = b.x + c * x + s * z;
    out[i * 3 + 1] = b.y + y;
    out[i * 3 + 2] = b.z - s * x + c * z;
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
