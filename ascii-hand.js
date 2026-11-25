// ASCII 3D figures — raymarched signed-distance shapes rendered as text.
// Each page section (data-shape="...") has its own figure: robot head, hands, graduation cap,
// pencil. Scrolling spins, zooms and morphs between them; the pointer adds a slight tilt.
(() => {
  const pre = document.querySelector('.ascii-hand');
  if (!pre) return;

  const RAMP = " .\'`,:;-~=!+*x%#&$@";
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Realistic human arm (local space: y = up the fingers, +z = palm side) ----------
  const FINGERS = [
    // index, middle, ring, pinky
    { x: 0.27, y: 0.44, splay: 0.1, len: [0.43, 0.26, 0.2], r: 0.085 },
    { x: 0.09, y: 0.5, splay: 0.02, len: [0.48, 0.3, 0.22], r: 0.089 },
    { x: -0.1, y: 0.47, splay: -0.06, len: [0.44, 0.28, 0.21], r: 0.085 },
    { x: -0.28, y: 0.4, splay: -0.15, len: [0.34, 0.22, 0.18], r: 0.074 },
  ];
  const BENDS = [1.3, 1.5, 0.9]; // per-joint bend (radians) at full curl

  const THUMB_BASE = [0.3, -0.36, 0.04];
  const THUMB_LEN = [0.4, 0.3, 0.24];
  const THUMB_R = [0.14, 0.115, 0.1, 0.082]; // radius at each joint, base → tip
  const THUMB_OPEN = [[0.62, 0.7, 0.35], [0.55, 0.78, 0.3], [0.45, 0.86, 0.25]];
  const THUMB_CURL = [[0.25, 0.6, 0.75], [-0.5, 0.4, 0.75], [-0.9, 0.0, 0.4]];

  // Tapered segments (iq's round cone), stored flat:
  // ax ay az, bax bay baz, l2, rr, a2, il2, r1, r2
  const SEG = 12;
  const seg = new Float64Array(16 * SEG);
  let segCount = 0;

  // One group per digit: bounding sphere, its segments, and its fingernail frame
  const digits = Array.from({ length: 5 }, () => ({
    cx: 0, cy: 0, cz: 0, R: 0, start: 0, end: 0,
    nail: new Float64Array(15), // centre(3) side(3) along(3) back(3) radii(3)
  }));

  function addCone(ax, ay, az, bx, by, bz, r1, r2) {
    const o = segCount * SEG;
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const l2 = dx * dx + dy * dy + dz * dz, rr = r1 - r2;
    seg[o] = ax; seg[o + 1] = ay; seg[o + 2] = az;
    seg[o + 3] = dx; seg[o + 4] = dy; seg[o + 5] = dz;
    seg[o + 6] = l2; seg[o + 7] = rr; seg[o + 8] = l2 - rr * rr; seg[o + 9] = 1 / l2;
    seg[o + 10] = r1; seg[o + 11] = r2;
    segCount++;
  }

  function coneDist(o, px, py, pz) {
    const pax = px - seg[o], pay = py - seg[o + 1], paz = pz - seg[o + 2];
    const bax = seg[o + 3], bay = seg[o + 4], baz = seg[o + 5];
    const l2 = seg[o + 6], rr = seg[o + 7], a2 = seg[o + 8], il2 = seg[o + 9];
    const y = pax * bax + pay * bay + paz * baz;
    const z = y - l2;
    const xx = pax * l2 - bax * y, xy = pay * l2 - bay * y, xz = paz * l2 - baz * y;
    const x2 = xx * xx + xy * xy + xz * xz;
    const y2 = y * y * l2, z2 = z * z * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - seg[o + 11];
    if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - seg[o + 10];
    return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - seg[o + 10];
  }

  // close a digit: bounding sphere over its joints + a nail on the last segment
  function finishDigit(g, joints, tipR, along, back) {
    let cx = 0, cy = 0, cz = 0;
    for (const p of joints) { cx += p[0]; cy += p[1]; cz += p[2]; }
    cx /= joints.length; cy /= joints.length; cz /= joints.length;
    let R = 0;
    for (const p of joints) R = Math.max(R, Math.hypot(p[0] - cx, p[1] - cy, p[2] - cz));
    Object.assign(g, { cx, cy, cz, R: R + 0.16, end: segCount });

    // side = along × back
    const sx = along[1] * back[2] - along[2] * back[1];
    const sy = along[2] * back[0] - along[0] * back[2];
    const sz = along[0] * back[1] - along[1] * back[0];
    const tip = joints[joints.length - 1];
    const n = g.nail;
    n[0] = tip[0] - along[0] * 0.075 + back[0] * tipR * 0.78;
    n[1] = tip[1] - along[1] * 0.075 + back[1] * tipR * 0.78;
    n[2] = tip[2] - along[2] * 0.075 + back[2] * tipR * 0.78;
    n.set([sx, sy, sz], 3); n.set(along, 6); n.set(back, 9);
    n.set([tipR * 0.82, 0.085, 0.028], 12);
  }

  // curls: [thumb, index, middle, ring, pinky], 0 = straight, 1 = fully curled
  function buildHand(curls) {
    segCount = 0;

    FINGERS.forEach((f, i) => {
      const g = digits[i + 1];
      g.start = segCount;
      const k = curls[i + 1];
      const s = f.splay * (1 - 0.5 * k);
      let x = f.x, y = f.y, z = 0, a = 0;
      const joints = [[x, y, z]];
      for (let j = 0; j < 3; j++) {
        a += BENDS[j] * k;
        const ca = Math.cos(a);
        const nx = x + Math.sin(s) * ca * f.len[j];
        const ny = y + Math.cos(s) * ca * f.len[j];
        const nz = z + Math.sin(a) * f.len[j];
        // taper toward the tip, slight swelling at each knuckle
        addCone(x, y, z, nx, ny, nz, f.r * (1.04 - j * 0.09), f.r * (0.97 - (j + 1) * 0.09));
        x = nx; y = ny; z = nz;
        joints.push([x, y, z]);
      }
      const along = [Math.sin(s) * Math.cos(a), Math.cos(s) * Math.cos(a), Math.sin(a)];
      const back = [Math.sin(s) * Math.sin(a), Math.cos(s) * Math.sin(a), -Math.cos(a)];
      finishDigit(g, joints, f.r * 0.7, along, back);
    });

    const g = digits[0];
    g.start = segCount;
    const k = curls[0];
    let [x, y, z] = THUMB_BASE;
    const joints = [[x, y, z]];
    let along = [0, 1, 0];
    for (let j = 0; j < 3; j++) {
      const o = THUMB_OPEN[j], c = THUMB_CURL[j];
      let dx = o[0] + (c[0] - o[0]) * k;
      let dy = o[1] + (c[1] - o[1]) * k;
      let dz = o[2] + (c[2] - o[2]) * k;
      const len = Math.hypot(dx, dy, dz);
      along = [dx / len, dy / len, dz / len];
      const s = THUMB_LEN[j] / len;
      dx *= s; dy *= s; dz *= s;
      addCone(x, y, z, x + dx, y + dy, z + dz, THUMB_R[j], THUMB_R[j + 1]);
      x += dx; y += dy; z += dz;
      joints.push([x, y, z]);
    }
    // thumbnail faces away from the palm, roughly
    const hint = [0.45, 0, -0.9];
    const dot = hint[0] * along[0] + hint[1] * along[1] + hint[2] * along[2];
    let back = hint.map((v, i) => v - dot * along[i]);
    const bl = Math.hypot(...back) || 1;
    back = back.map((v) => v / bl);
    finishDigit(g, joints, THUMB_R[3], along, back);
  }

  let forearmReady = false;
  function handSdf(px, py, pz) {
    // palm: soft block with thumb (thenar) and pinky-side pads, cupped in the middle
    let palm = roundBox(px, py, pz, 0.41, 0.47, 0.12, 0.11);
    // the pads/knuckles stay within ~0.1 of the base block, so far away a bound is enough
    if (palm > 0.22) palm -= 0.12;
    else {
    palm = smin(palm, ellipsoid(px - 0.22, py + 0.27, pz - 0.05, 0.2, 0.26, 0.13), 0.1);
    palm = smin(palm, ellipsoid(px + 0.26, py + 0.12, pz - 0.03, 0.15, 0.32, 0.11), 0.08);
    palm = ssub(palm, ellipsoid(px + 0.02, py - 0.02, pz - 0.2, 0.26, 0.3, 0.1), 0.06);

    // back of the hand: knuckle bumps and tendons
    if (pz < 0.05 && py > -0.6 && py < 0.65) {
      for (const f of FINGERS) {
        palm = smin(palm, Math.sqrt((px - f.x) ** 2 + (py - f.y + 0.03) ** 2 + (pz + 0.06) ** 2) - f.r * 1.12, 0.06);
        palm = smin(palm, capsule(px, py, pz, f.x * 0.45, -0.42, -0.1, f.x, f.y - 0.06, -0.115, 0.017), 0.03);
      }
    }
    }

    // forearm: flattened, widening toward the elbow, with the wrist bone showing
    if (!forearmReady) {
      const keep = segCount;
      segCount = 15;
      addCone(0, -0.42, 0, 0, -2.75, 0, 0.25, 0.37);
      segCount = keep;
      forearmReady = true;
    }
    let arm = coneDist(15 * SEG, px, py, pz * 1.3) / 1.3;
    if (py < -1.2) arm = smin(arm, ellipsoid(px - 0.04, py + 1.95, pz - 0.04, 0.38, 0.6, 0.3), 0.25);
    arm = smin(arm, Math.sqrt((px + 0.24) ** 2 + (py + 0.5) ** 2 + (pz + 0.06) ** 2) - 0.065, 0.05);
    let d = smin(palm, arm, 0.14);

    // fingers + thumb; skip any digit whose bounding sphere is too far away
    for (let i = 0; i < 5; i++) {
      const g = digits[i];
      if (Math.sqrt((px - g.cx) ** 2 + (py - g.cy) ** 2 + (pz - g.cz) ** 2) - g.R > d + 0.06) continue;
      let dg = 1e9;
      for (let s = g.start; s < g.end; s++) dg = Math.min(dg, coneDist(s * SEG, px, py, pz));
      // fingernail: thin ellipsoid in the digit's own frame
      const n = g.nail;
      const qx = px - n[0], qy = py - n[1], qz = pz - n[2];
      const lx = qx * n[3] + qy * n[4] + qz * n[5];
      const ly = qx * n[6] + qy * n[7] + qz * n[8];
      const lz = qx * n[9] + qy * n[10] + qz * n[11];
      if (lx * lx + ly * ly + lz * lz < 0.04) dg = smin(dg, ellipsoid(lx, ly, lz, n[12], n[13], n[14]), 0.012);
      d = smin(d, dg, i === 0 ? 0.09 : 0.05);
    }
    return d;
  }

  // ---------- Shape helpers ----------
  function ellipsoid(px, py, pz, rx, ry, rz) {
    const ax = px / rx, ay = py / ry, az = pz / rz;
    const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
    const bx = ax / rx, by = ay / ry, bz = az / rz;
    const k1 = Math.sqrt(bx * bx + by * by + bz * bz) || 1e-6;
    return (k0 * (k0 - 1)) / k1;
  }

  function capsule(px, py, pz, ax, ay, az, bx, by, bz, r) {
    const pax = px - ax, pay = py - ay, paz = pz - az;
    const bax = bx - ax, bay = by - ay, baz = bz - az;
    let h = (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz);
    h = h < 0 ? 0 : h > 1 ? 1 : h;
    const cx = pax - bax * h, cy = pay - bay * h, cz = paz - baz * h;
    return Math.sqrt(cx * cx + cy * cy + cz * cz) - r;
  }

  function smin(a, b, k) {
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - h * h * k * 0.25;
  }

  // carve shape b out of a
  function ssub(a, b, k) {
    let h = 0.5 - (0.5 * (a + b)) / k;
    h = h < 0 ? 0 : h > 1 ? 1 : h;
    return a + (-b - a) * h + k * h * (1 - h);
  }

  // ---------- Robot head (looking toward +z) ----------
  function roundBox(px, py, pz, bx, by, bz, r) {
    const qx = Math.abs(px) - bx + r, qy = Math.abs(py) - by + r, qz = Math.abs(pz) - bz + r;
    const mx = Math.max(qx, 0), my = Math.max(qy, 0), mz = Math.max(qz, 0);
    return Math.sqrt(mx * mx + my * my + mz * mz) + Math.min(Math.max(qx, qy, qz), 0) - r;
  }

  // capped cylinder: radial distance `rad`, offset along the axis `ax`, half length h
  function cyl(rad, ax, r, h) {
    const dx = rad - r, dy = Math.abs(ax) - h;
    return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  }

  // distance from a point to an axis-aligned box (0 inside): cheap bound for detail groups
  function boxDist(px, py, pz, cx, cy, cz, hx, hy, hz) {
    const qx = Math.max(Math.abs(px - cx) - hx, 0);
    const qy = Math.max(Math.abs(py - cy) - hy, 0);
    const qz = Math.max(Math.abs(pz - cz) - hz, 0);
    return Math.sqrt(qx * qx + qy * qy + qz * qz);
  }

  function robotSdf(px, py, pz) {
    const ax = Math.abs(px); // left/right symmetry

    // head; each detail group below is only evaluated when it could be the closest surface
    let d = roundBox(px, py - 0.25, pz, 0.72, 0.62, 0.6, 0.16);
    // seam around the top of the head
    if (Math.abs(py - 0.62) < 0.05) d = ssub(d, roundBox(px, py - 0.62, pz, 0.8, 0.012, 0.7, 0.005), 0.01);

    // face: recessed panel, eyes, mouth grille, brow visor, bolts
    if (boxDist(px, py, pz, 0, 0.2, 0.68, 0.6, 0.45, 0.18) < d + 0.02) {
      d = ssub(d, roundBox(px, py - 0.18, pz - 0.62, 0.56, 0.44, 0.07, 0.08), 0.02);

      // eyes: ring lenses with an eyeball inside
      const ex = ax - 0.26, ey = py - 0.32, er = Math.hypot(ex, ey);
      let eye = cyl(er, pz - 0.66, 0.2, 0.13) - 0.015; // lens barrel sticking out of the panel
      eye = ssub(eye, cyl(er, pz - 0.82, 0.14, 0.12), 0.01); // hollow it out
      d = Math.min(d, eye);
      d = Math.min(d, Math.sqrt(ex * ex + ey * ey + (pz - 0.66) ** 2) - 0.11); // eyeball

      // mouth grille with vertical slots
      let mouth = roundBox(px, py + 0.08, pz - 0.62, 0.34, 0.11, 0.09, 0.03);
      const slot = ((((px + 0.06) % 0.12) + 0.12) % 0.12) - 0.06;
      if (ax < 0.29) mouth = ssub(mouth, roundBox(slot, py + 0.08, pz - 0.72, 0.026, 0.075, 0.06, 0.01), 0.005);
      d = Math.min(d, mouth);

      d = smin(d, roundBox(px, py - 0.55, pz - 0.6, 0.52, 0.045, 0.06, 0.02), 0.02); // visor
      const bx = ax - 0.5, bz = pz - 0.62;
      d = Math.min(d, Math.sqrt(bx * bx + (py - 0.56) ** 2 + bz * bz) - 0.032);
      d = Math.min(d, Math.sqrt(bx * bx + (py + 0.2) ** 2 + bz * bz) - 0.032);
    }

    // ear discs + bolts
    if (boxDist(ax, py, pz, 0.79, 0.25, 0, 0.1, 0.25, 0.25) < d + 0.04) {
      const rx = Math.hypot(py - 0.25, pz);
      d = smin(d, cyl(rx, ax - 0.74, 0.22, 0.07) - 0.02, 0.04);
      d = Math.min(d, cyl(rx, ax - 0.82, 0.08, 0.04) - 0.01);
    }

    // side vents: three horizontal slots behind each ear
    if (ax > 0.6 && py > -0.25 && py < 0.2 && pz < -0.15) {
      const vy = ((((py + 0.25) % 0.1) + 0.1) % 0.1) - 0.05;
      d = ssub(d, roundBox(ax - 0.73, vy, pz + 0.38, 0.05, 0.016, 0.16, 0.008), 0.006);
    }

    // antenna
    if (boxDist(px, py, pz, 0, 1.08, 0, 0.12, 0.33, 0.12) < d + 0.04) {
      d = smin(d, cyl(Math.hypot(px, pz), py - 0.9, 0.1, 0.04), 0.04);
      d = Math.min(d, capsule(px, py, pz, 0, 0.9, 0, 0, 1.22, 0, 0.03));
      d = Math.min(d, Math.sqrt(px * px + (py - 1.3) ** 2 + pz * pz) - 0.09);
    }

    // ribbed neck on a collar, cables from the back of the head into the collar
    if (boxDist(px, py, pz, 0, -0.72, -0.05, 0.45, 0.36, 0.45) < d + 0.02) {
      d = Math.min(d, capsule(ax, py, pz, 0.3, -0.32, -0.38, 0.4, -0.95, -0.22, 0.045));
      const rr = Math.hypot(px, pz);
      let neck = cyl(rr, py + 0.62, 0.27, 0.3);
      for (const y of [-0.5, -0.64, -0.78]) {
        neck = ssub(neck, Math.hypot(rr - 0.28, py - y) - 0.035, 0.01);
      }
      d = Math.min(d, neck);
      d = Math.min(d, cyl(rr, py + 0.95, 0.36, 0.04) - 0.03);
    }
    return d;
  }


  // ---------- Graduation cap ----------
  function capSdf(px, py, pz) {
    // skull cap: capped cylinder
    const q = Math.hypot(px, pz) - 0.52;
    const h = Math.abs(py - 0.05) - 0.3;
    let d = Math.min(Math.max(q, h), 0) + Math.hypot(Math.max(q, 0), Math.max(h, 0)) - 0.04;

    // mortarboard: thin square board turned 45°
    const rx = Math.abs((px + pz) * Math.SQRT1_2) - 0.78;
    const rz = Math.abs((pz - px) * Math.SQRT1_2) - 0.78;
    const ry = Math.abs(py - 0.4) - 0.035;
    const mx = Math.max(rx, 0), my = Math.max(ry, 0), mz = Math.max(rz, 0);
    d = smin(d, Math.sqrt(mx * mx + my * my + mz * mz) + Math.min(Math.max(rx, ry, rz), 0) - 0.02, 0.05);

    // button + tassel
    d = Math.min(d, Math.sqrt(px * px + (py - 0.47) ** 2 + pz * pz) - 0.07);
    d = Math.min(d, capsule(px, py, pz, 0, 0.47, 0, 0.88, 0.45, 0, 0.025));
    d = Math.min(d, capsule(px, py, pz, 0.88, 0.45, 0, 0.88, -0.05, 0, 0.03));
    d = Math.min(d, capsule(px, py, pz, 0.88, -0.1, 0, 0.88, -0.45, 0, 0.08));
    return d;
  }

  // ---------- Pencil (digital artist) ----------
  function cappedCone(px, py, pz, h, r1, r2) {
    // iq's capped cone, centred at origin, r1 at y = -h, r2 at y = +h
    const qx = Math.hypot(px, pz), qy = py;
    const k1x = r2, k1y = h, k2x = r2 - r1, k2y = 2 * h;
    const cax = qx - Math.min(qx, qy < 0 ? r1 : r2), cay = Math.abs(qy) - h;
    let t = ((k1x - qx) * k2x + (k1y - qy) * k2y) / (k2x * k2x + k2y * k2y);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cbx = qx - k1x + k2x * t, cby = qy - k1y + k2y * t;
    const s = cbx < 0 && cay < 0 ? -1 : 1;
    return s * Math.sqrt(Math.min(cax * cax + cay * cay, cbx * cbx + cby * cby));
  }

  function hexPrism(px, py, pz, r, halfLen) {
    // hexagonal prism along y
    let x = Math.abs(px), z = Math.abs(pz);
    const kx = -0.8660254, kz = 0.5, kk = 0.57735;
    const dot = Math.min(kx * x + kz * z, 0) * 2;
    x -= dot * kx; z -= dot * kz;
    const cx = Math.max(-kk * r, Math.min(kk * r, x));
    const dx = Math.hypot(x - cx, z - r) * Math.sign(z - r);
    const dy = Math.abs(py) - halfLen;
    return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  }

  function pencilSdf(px, py, pz) {
    let d = hexPrism(px, py - 0.2, pz, 0.22, 0.75) - 0.015; // body
    d = Math.min(d, cappedCone(px, py + 0.83, pz, 0.28, 0.03, 0.21)); // sharpened wood
    d = Math.min(d, Math.sqrt(px * px + (py + 1.11) ** 2 + pz * pz) - 0.035); // graphite tip
    // metal band with two grooves
    const band = Math.max(Math.hypot(px, pz) - 0.245, Math.abs(py - 1.05) - 0.1);
    d = Math.min(d, band);
    d = ssub(d, Math.max(Math.hypot(px, pz) - 0.26, Math.abs(Math.abs(py - 1.05) - 0.05) - 0.012) + 0.0, 0.01);
    // eraser
    const er = Math.max(Math.hypot(px, pz) - 0.2, Math.abs(py - 1.27) - 0.12) ;
    d = Math.min(d, er - 0.03);
    return d;
  }

  // ---------- Scene: one shape per page section ----------
  // Each section in the HTML carries data-shape="<name>".
  const SHAPES = {
    robot: { kind: 'robot', yaw: -0.4, pitch: 0.08, roll: 0, dist: 5.4 },
    open: { kind: 'hand', curls: [0, 0, 0, 0, 0], yaw: 0.35, pitch: 0.1, roll: 0.05, dist: 5.8 },
    point: { kind: 'hand', curls: [0.85, 0, 1, 1, 1], yaw: 0.15, pitch: 0.1, roll: 0.75, dist: 5.0 }, // points at the text
    cap: { kind: 'cap', yaw: 0.25, pitch: 0.22, roll: 0.1, dist: 5.4 },
    pencil: { kind: 'pencil', yaw: 0.3, pitch: 0.2, roll: -0.65, dist: 5.4 },
    wave: { kind: 'hand', curls: [0, 0, 0, 0, 0], yaw: 0.1, pitch: 0.05, roll: 0, dist: 5.6, wave: true },
  };
  const FIELDS = { robot: robotSdf, hand: handSdf, cap: capSdf, pencil: pencilSdf };
  const BOUNDS = { robot: [0.15, 1.75], hand: [-0.6, 2.3], cap: [0, 1.8], pencil: [0.1, 1.8] };
  const MATERIALS = { robot: [0.8, 48], hand: [0.14, 8], cap: [0.25, 16], pencil: [0.35, 24] };
  const TAU = Math.PI * 2;

  const stages = [...document.querySelectorAll('[data-shape]')]
    .map((el) => ({ el, ...(SHAPES[el.dataset.shape] || SHAPES.open) }));
  if (!stages.length) stages.push({ el: document.body, ...SHAPES.robot });

  const smooth = (t) => t * t * (3 - 2 * t);
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lerp = (a, b, t) => a + (b - a) * t;

  // current blend, read by sdf()
  let fieldA = robotSdf, fieldB = robotSdf, blend = 0;

  function sdf(px, py, pz) {
    if (blend <= 0.001) return fieldA(px, py, pz);
    if (blend >= 0.999) return fieldB(px, py, pz);
    const a = fieldA(px, py, pz);
    return a + (fieldB(px, py, pz) - a) * blend;
  }

  // Robot eyes render as solid bright characters
  function glows(px, py, pz) {
    const robot = (fieldA === robotSdf && blend < 0.5) || (fieldB === robotSdf && blend >= 0.5);
    if (!robot) return false;
    const ex = Math.abs(px) - 0.26, ey = py - 0.32, ez = pz - 0.66;
    return ex * ex + ey * ey + ez * ez < 0.125 * 0.125;
  }

  // Float stage index: 0 while the first section is centred, 1 at the second, ...
  function scrollStage() {
    const mid = window.scrollY + window.innerHeight / 2;
    const maxMid = document.documentElement.scrollHeight - window.innerHeight / 2;
    const n = stages.length;
    const centers = stages.map((s, i) => {
      const r = s.el.getBoundingClientRect();
      const c = r.top + window.scrollY + Math.min(r.height, window.innerHeight) / 2;
      // make sure the last sections can still be reached at the bottom of the page
      return Math.min(c, maxMid - (n - 1 - i) * 60);
    });
    if (mid <= centers[0]) return 0;
    for (let i = 0; i < n - 1; i++) {
      if (mid <= centers[i + 1]) return i + (mid - centers[i]) / Math.max(1, centers[i + 1] - centers[i]);
    }
    return n - 1;
  }

  // Resolve a (smoothed) stage index into camera + shape settings
  // one sphere that covers both shapes while they blend
  function mixBounds(a, b, t) {
    if (t <= 0.001) return a;
    if (t >= 0.999) return b;
    return [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + Math.abs(a[0] - b[0]) / 2];
  }

  function scene(s, now) {
    const n = stages.length;
    const i = Math.max(0, Math.min(n - 1, Math.floor(s)));
    const j = Math.min(i + 1, n - 1);
    // hold each shape briefly, then ride through the transform between sections
    const t = j === i ? 0 : smooth(clamp01((s - i - 0.2) / 0.6));
    const A = stages[i], B = stages[j];

    let curls = null;
    if (A.kind === 'hand' && B.kind === 'hand') {
      curls = A.curls.map((v, k) => lerp(v, B.curls[k], t));
      fieldA = fieldB = handSdf;
      blend = 0;
    } else {
      fieldA = FIELDS[A.kind];
      fieldB = FIELDS[B.kind];
      blend = t;
      curls = A.kind === 'hand' ? A.curls : B.kind === 'hand' ? B.curls : null;
    }
    if (curls) buildHand(curls);

    const wave = lerp(A.wave ? 1 : 0, B.wave ? 1 : 0, t);

    // Roller-coaster ride between sections: 0 → 1 → 0 across each transition
    const ride = reduceMotion ? 0 : 1;
    const arc = Math.sin(t * Math.PI);
    const dir = i % 2 ? -1 : 1; // alternate the direction of every drop
    const loop = i % 2 === 1; // every other transition loops head over heels

    return {
      // a full 360° spin between sections; each shape settles at its own angle
      yaw: lerp(A.yaw + i * TAU, B.yaw + j * TAU, t),
      pitch: lerp(A.pitch, B.pitch, t) + ride * (loop ? TAU * t : 0.55 * arc),
      roll: lerp(A.roll, B.roll, t) + ride * dir * 0.7 * arc
        + (reduceMotion ? 0 : wave * 0.3 * Math.sin(now / 260)),
      // swoop in close at the middle of the morph, then settle back
      dist: lerp(A.dist, B.dist, t) - ride * 2.0 * arc,
      // swing out toward the right edge and back (away from the text column)
      swing: ride * 0.1 * arc,
      bound: mixBounds(BOUNDS[A.kind], BOUNDS[B.kind], blend === 0 && A.kind === B.kind ? 0 : blend),
      spec: lerp(MATERIALS[A.kind][0], MATERIALS[B.kind][0], t),
      gloss: lerp(MATERIALS[A.kind][1], MATERIALS[B.kind][1], t),
    };
  }

  const pointer = { x: 0, y: 0 };

  // Scroll speed in -1..1, used for extra spin and lean (the "g-force")
  let lastScrollY = window.scrollY, lastScrollT = performance.now();
  function scrollSpeed() {
    const now = performance.now();
    const v = (window.scrollY - lastScrollY) / Math.max(16, now - lastScrollT); // px per ms
    lastScrollY = window.scrollY;
    lastScrollT = now;
    return Math.max(-1, Math.min(1, v / 3));
  }

  function targets() {
    const wide = window.innerWidth > 820;
    return {
      stage: scrollStage(),
      speed: reduceMotion ? 0 : scrollSpeed(),
      px: pointer.x,
      py: pointer.y,
      offset: wide ? 0.22 : 0,
      opacity: wide ? 0.95 : 0.3,
    };
  }

  // ---------- Renderer ----------
  let cols = 0, rows = 0, cw = 6, ch = 10, W = 0, H = 0;

  function measure() {
    const probe = document.createElement('span');
    probe.textContent = 'M'.repeat(100);
    probe.style.visibility = 'hidden';
    pre.textContent = '';
    pre.appendChild(probe);
    const rect = probe.getBoundingClientRect();
    cw = rect.width / 100 || 6;
    ch = parseFloat(getComputedStyle(pre).lineHeight) || rect.height || 10;
    pre.removeChild(probe);
    W = window.innerWidth;
    H = window.innerHeight;
    cols = Math.ceil(W / cw);
    rows = Math.ceil(H / ch);
  }

  const FOCAL = 1.5;
  const LIGHT = (() => {
    const l = [-0.75, 0.45, 0.55];
    const n = Math.hypot(...l);
    return l.map((v) => v / n);
  })();

  const FILL = (() => {
    const l = [0.6, -0.35, 0.5];
    const n = Math.hypot(...l);
    return l.map((v) => v / n);
  })();

  // cheap soft shadow: two probes toward the light; nearby geometry darkens the point
  function softShadow(px, py, pz, lx, ly, lz) {
    const a = sdf(px + lx * 0.12, py + ly * 0.12, pz + lz * 0.12) / 0.12;
    const b = sdf(px + lx * 0.35, py + ly * 0.35, pz + lz * 0.35) / 0.35;
    return 0.2 + 0.8 * clamp01(Math.min(a, b) * 1.6);
  }

  function render(st, now) {
    const cam = scene(st.stage, now);
    const yaw = cam.yaw + st.px * 0.3 + st.speed * 0.9 + (reduceMotion ? 0 : 0.06 * Math.sin(now / 1600));
    const pitch = cam.pitch + st.py * 0.2 + st.speed * 0.35;

    // rotation matrix R = Ry * Rx * Rz (row-major); R^T brings rays into object space
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cx = Math.cos(pitch), sx = Math.sin(pitch);
    const cz = Math.cos(cam.roll), sz = Math.sin(cam.roll);
    const m0 = cy * cz + sy * sx * sz, m1 = -cy * sz + sy * sx * cz, m2 = sy * cx;
    const m3 = cx * sz, m4 = cx * cz, m5 = -sx;
    const m6 = -sy * cz + cy * sx * sz, m7 = sy * sz + cy * sx * cz, m8 = cy * cx;
    const toLocal = (x, y, z) => [
      m0 * x + m3 * y + m6 * z,
      m1 * x + m4 * y + m7 * z,
      m2 * x + m5 * y + m8 * z,
    ];

    const [ox, oy, oz] = toLocal(0, 0.2, cam.dist);
    const [lx, ly, lz] = toLocal(LIGHT[0], LIGHT[1], LIGHT[2]);
    const [fx, fy, fz] = toLocal(FILL[0], FILL[1], FILL[2]);
    // bounding sphere (in object space) for the current shape(s)
    const [boundY, boundR] = cam.bound;
    const ocy = oy - boundY;
    const ocDot = ox * ox + ocy * ocy + oz * oz - boundR * boundR;
    const specK = cam.spec, gloss = cam.gloss;

    const centerX = (W * (0.5 + st.offset + (st.offset ? cam.swing : 0))) / cw;
    const centerY = rows / 2;
    const ramp = RAMP.length - 1;
    const lines = new Array(rows);
    const e = 0.003;

    for (let r = 0; r < rows; r++) {
      let line = '';
      const v = ((centerY - r - 0.5) * ch) / H;
      for (let c = 0; c < cols; c++) {
        const u = ((c + 0.5 - centerX) * cw) / H;
        const inv = 1 / Math.sqrt(u * u + v * v + FOCAL * FOCAL);
        const wx = u * inv, wy = v * inv, wz = -FOCAL * inv;
        const dx = m0 * wx + m3 * wy + m6 * wz;
        const dy = m1 * wx + m4 * wy + m7 * wz;
        const dz = m2 * wx + m5 * wy + m8 * wz;

        // bounding sphere test
        const b = ox * dx + ocy * dy + oz * dz;
        const disc = b * b - ocDot;
        if (disc < 0) { line += ' '; continue; }
        const sq = Math.sqrt(disc);
        let t = Math.max(-b - sq, 0);
        const tEnd = -b + sq;

        let hit = false, px = 0, py = 0, pz = 0, d0 = 0;
        for (let i = 0; i < 56; i++) {
          px = ox + dx * t; py = oy + dy * t; pz = oz + dz * t;
          d0 = sdf(px, py, pz);
          if (d0 < 0.0009 * t) { hit = true; break; } // looser hit test farther away
          t += d0;
          if (t > tEnd) break;
        }
        if (!hit) { line += ' '; continue; }

        // forward-difference normal (reuses the hit distance: 3 extra lookups)
        let nx = sdf(px + e, py, pz) - d0, ny = sdf(px, py + e, pz) - d0, nz = sdf(px, py, pz + e) - d0;
        const nl = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
        nx *= nl; ny *= nl; nz *= nl;

        if (glows(px, py, pz)) { line += '@'; continue; }

        // ambient occlusion: darken creases and hollows
        const occ = (0.05 - sdf(px + nx * 0.05, py + ny * 0.05, pz + nz * 0.05))
          + (0.12 - sdf(px + nx * 0.12, py + ny * 0.12, pz + nz * 0.12)) * 0.5;
        const ao = clamp01(1 - 3.5 * occ);

        const diff = Math.max(0, nx * lx + ny * ly + nz * lz);
        const shadow = diff > 0 ? softShadow(px + nx * 0.01, py + ny * 0.01, pz + nz * 0.01, lx, ly, lz) : 0;
        const fill = Math.max(0, nx * fx + ny * fy + nz * fz);
        const facing = Math.max(0, -(nx * dx + ny * dy + nz * dz));
        const rim = (1 - facing) ** 3;
        // half-vector specular: glossy metal on the robot, soft sheen on skin
        const hx = lx - dx, hy = ly - dy, hz = lz - dz;
        const hl = 1 / (Math.sqrt(hx * hx + hy * hy + hz * hz) || 1);
        const spec = Math.max(0, (nx * hx + ny * hy + nz * hz) * hl) ** gloss;
        const light = 0.05 + 0.8 * diff * shadow + 0.14 * fill + 0.28 * rim + specK * spec * shadow;
        const val = Math.pow(clamp01(light * (0.3 + 0.7 * ao)), 0.85);
        line += RAMP[1 + Math.round(val * (ramp - 1))];
      }
      lines[r] = line;
    }
    pre.textContent = lines.join('\n');
    pre.style.opacity = st.opacity.toFixed(3);
  }

  // ---------- Adaptive detail ----------
  const LEVELS = [6, 7, 8, 9, 10, 12]; // character size in px
  let level = window.innerWidth > 820 ? 1 : 3;
  let renderMs = 16, checks = 0, holdFiner = 0;

  function applyLevel() {
    pre.style.fontSize = pre.style.lineHeight = `${LEVELS[level]}px`;
    measure();
  }

  function adapt(ms) {
    renderMs = renderMs * 0.9 + ms * 0.1;
    if (++checks % 20) return;
    if (renderMs > 30 && level < LEVELS.length - 1) {
      level++; holdFiner = 10; applyLevel(); renderMs = 20;
    } else if (renderMs < 11 && level > 0 && --holdFiner < 0) {
      level--; applyLevel(); renderMs = 20;
    }
  }

  // ---------- Loop ----------
  let state = targets();
  let last = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    if (now - last < 33) return; // ~30fps cap
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    const target = targets();
    const k = reduceMotion ? 1 : 1 - Math.exp(-dt * 6);
    for (const key of Object.keys(target)) state[key] = lerp(state[key], target[key], k);
    const t0 = performance.now();
    render(state, now);
    adapt(performance.now() - t0);
  }

  window.addEventListener('pointermove', (ev) => {
    pointer.x = (ev.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (ev.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  window.addEventListener('resize', measure);

  applyLevel();
  render(state, performance.now());
  requestAnimationFrame(frame);
})();
