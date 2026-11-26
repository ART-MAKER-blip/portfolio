// Generates the "Areas of work" card illustrations in the same particle style as the
// 3D robot: each object is a 3D point cloud, turned to a 3/4 view and projected with
// perspective, then drawn as soft light dots on the site's #232329 background.
//
//   node scripts/work-art.mjs <outDir>      → writes work-1.svg … work-5.svg
//   then rasterise each to public/works/work-N.webp:
//   rsvg-convert -w 800 -h 600 work-N.svg -o work-N.png && magick work-N.png -quality 82 work-N.webp
import { writeFileSync, mkdirSync } from 'node:fs';

const outDir = process.argv[2] || 'work-art';
mkdirSync(outDir, { recursive: true });

const W = 800, H = 600, BG = '#232329', INK = '#d9d9de';
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const gauss = () => { let u = 0; while (!u) u = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand()); };
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const lerp = (a, b, t) => add(a, mul(add(b, mul(a, -1)), t));
const J = (s = 0.006) => [gauss() * s, gauss() * s, gauss() * s];

// ---------- point primitives (all push into `pts`) ----------
let pts = [];
const P = (p, w = 1) => pts.push([...p, w]);
const line = (a, b, n, j = 0.006, w = 1) => { for (let i = 0; i < n; i++) P(add(lerp(a, b, rand()), J(j)), w); };
// filled parallelogram: corner o, edges u and v
const plane = (o, u, v, n, w = 0.55) => { for (let i = 0; i < n; i++) P(add(add(o, mul(u, rand())), add(mul(v, rand()), J(0.004))), w); };
const rectEdges = (o, u, v, n, j, w) => { const c = [o, add(o, u), add(add(o, u), v), add(o, v)]; for (let k = 0; k < 4; k++) line(c[k], c[(k + 1) % 4], Math.round(n / 4), j, w); };
// box: 12 edges + faint faces
const box = (c, s, nEdge, nFace) => {
  const [x, y, z] = c, [a, b, d] = mul(s, 0.5);
  const v = (i, j, k) => [x + i * a, y + j * b, z + k * d];
  const E = [[[-1,-1,-1],[1,-1,-1]],[[-1,1,-1],[1,1,-1]],[[-1,-1,1],[1,-1,1]],[[-1,1,1],[1,1,1]],[[-1,-1,-1],[-1,1,-1]],[[1,-1,-1],[1,1,-1]],[[-1,-1,1],[-1,1,1]],[[1,-1,1],[1,1,1]],[[-1,-1,-1],[-1,-1,1]],[[1,-1,-1],[1,-1,1]],[[-1,1,-1],[-1,1,1]],[[1,1,-1],[1,1,1]]];
  for (const [p, q] of E) line(v(...p), v(...q), Math.round(nEdge / 12), 0.006, 1);
  plane(v(-1, -1, 1), [s[0], 0, 0], [0, s[1], 0], nFace, 0.4);
  plane(v(-1, 1, -1), [s[0], 0, 0], [0, 0, s[2]], nFace / 2, 0.4);
  plane(v(1, -1, -1), [0, s[1], 0], [0, 0, s[2]], nFace / 2, 0.35);
};
const circle = (c, r, n, axis = 'z', j = 0.006, w = 1) => { for (let i = 0; i < n; i++) { const a = rand() * Math.PI * 2, ca = Math.cos(a) * r, sa = Math.sin(a) * r; P(add(c, add(axis === 'z' ? [ca, sa, 0] : axis === 'y' ? [ca, 0, sa] : [0, ca, sa], J(j))), w); } };
const disc = (c, r, n, axis = 'z', w = 0.55) => { for (let i = 0; i < n; i++) { const a = rand() * Math.PI * 2, rr = Math.sqrt(rand()) * r, ca = Math.cos(a) * rr, sa = Math.sin(a) * rr; P(add(c, axis === 'z' ? [ca, sa, 0] : axis === 'y' ? [ca, 0, sa] : [0, ca, sa]), w); } };
const sphere = (c, r, n, w = 0.8) => { for (let i = 0; i < n; i++) { const z = rand() * 2 - 1, a = rand() * Math.PI * 2, q = Math.sqrt(1 - z * z); P(add(c, [q * Math.cos(a) * r, z * r, q * Math.sin(a) * r]), w); } };
const cylinderY = (c, r, h, n, w = 0.7) => { for (let i = 0; i < n; i++) { const a = rand() * Math.PI * 2; P(add(c, [Math.cos(a) * r, rand() * h, Math.sin(a) * r]), w); } circle(add(c, [0, h, 0]), r, n / 3, 'y', 0.004, 1); disc(add(c, [0, h, 0]), r, n / 4, 'y', 0.5); };
const bezier = (p0, p1, p2, p3, n, j = 0.005, w = 1) => { for (let i = 0; i < n; i++) { const t = rand(), m = 1 - t; P(add(add(mul(p0, m * m * m), mul(p1, 3 * m * m * t)), add(add(mul(p2, 3 * m * t * t), mul(p3, t * t * t)), J(j))), w); } };

// ---------- render ----------
function render(name, { yaw = -0.5, pitch = 0.32, dist = 6, zoom = 1, cy = 0 } = {}) {
  const cY = Math.cos(yaw), sY = Math.sin(yaw), cP = Math.cos(pitch), sP = Math.sin(pitch);
  const f = 560 * zoom;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${BG}"/><g fill="${INK}">`;
  const proj = pts.map(([x, y, z, w]) => {
    const x1 = cY * x + sY * z, z1 = -sY * x + cY * z;
    const y2 = cP * (y - cy) - sP * z1, z2 = sP * (y - cy) + cP * z1;
    const k = f / (dist - z2);
    return [W / 2 + x1 * k, H / 2 - y2 * k, z2, w];
  }).sort((a, b) => a[2] - b[2]);
  // fit: centre the object and scale it to fill ~84% x 78% of the card
  const xs = proj.map((p) => p[0]).sort((a, b) => a - b), ys = proj.map((p) => p[1]).sort((a, b) => a - b);
  const q = (arr, t) => arr[Math.floor(t * (arr.length - 1))];
  const x0 = q(xs, 0.005), x1 = q(xs, 0.995), y0 = q(ys, 0.005), y1 = q(ys, 0.995);
  const fit = Math.min((W * 0.84) / (x1 - x0), (H * 0.78) / (y1 - y0));
  for (const p of proj) {
    p[0] = W / 2 + (p[0] - (x0 + x1) / 2) * fit;
    p[1] = H / 2 + (p[1] - (y0 + y1) / 2) * fit;
  }
  for (const [sx, sy, z, w] of proj) {
    if (sx < -5 || sy < -5 || sx > W + 5 || sy > H + 5) continue;
    const depth = Math.min(1, Math.max(0.35, 0.7 + z * 0.18));
    const a = (0.25 + 0.6 * rand()) * w * depth;
    const r = 0.7 + rand() * 0.9;
    out += `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${r.toFixed(2)}" fill-opacity="${a.toFixed(2)}"/>`;
  }
  out += '</g></svg>';
  writeFileSync(`${outDir}/${name}.svg`, out);
  pts = [];
}

// 1. Data annotation & QA — monitor with an annotated image and a check badge
{
  const sw = 3.2, sh = 2.0, o = [-sw / 2, -0.55, 0];
  box([0, 0.45, -0.12], [sw + 0.24, sh + 0.24, 0.18], 2400, 2200); // bezel
  // the image on screen: mountains + sun
  bezier(add(o, [0.1, 0.25, 0.02]), add(o, [0.9, 1.3, 0.02]), add(o, [1.3, 1.2, 0.02]), add(o, [1.9, 0.5, 0.02]), 700, 0.006, 0.7);
  bezier(add(o, [1.4, 0.5, 0.02]), add(o, [2.2, 1.5, 0.02]), add(o, [2.6, 1.3, 0.02]), add(o, [3.1, 0.3, 0.02]), 700, 0.006, 0.7);
  disc(add(o, [2.55, 1.6, 0.02]), 0.18, 400, 'z', 0.8);
  // two bounding boxes with corner handles and label tabs
  for (const [x, y, w, h] of [[0.35, 0.2, 1.4, 1.2], [1.95, 1.3, 0.85, 0.6]]) {
    const b = add(o, [x, y, 0.05]);
    rectEdges(b, [w, 0, 0], [0, h, 0], 1300, 0.007, 1.15);
    for (const c of [[0, 0], [w, 0], [w, h], [0, h]]) disc(add(b, [c[0], c[1], 0.01]), 0.06, 90, 'z', 1.2);
    plane(add(b, [0, h + 0.02, 0.01]), [Math.min(0.55, w * 0.5), 0, 0], [0, 0.15, 0], 260, 1);
  }
  // stand + base
  line([0, -0.9, -0.15], [0, -1.35, -0.2], 500, 0.05, 0.8);
  plane([-0.75, -1.4, -0.7], [1.5, 0, 0], [0, 0, 0.9], 900, 0.6);
  // check badge
  circle([1.95, -0.85, 0.35], 0.42, 900, 'z', 0.008, 1.1);
  line([1.72, -0.88, 0.36], [1.88, -1.05, 0.36], 250, 0.012, 1.3);
  line([1.88, -1.05, 0.36], [2.2, -0.65, 0.36], 400, 0.012, 1.3);
  render('work-1', { yaw: -0.38, pitch: 0.18, zoom: 0.95, cy: 0.15 });
}

// 2. Digital illustration — drawing tablet, stylus and a sketched stroke
{
  const t = [-1.9, 0, -1.2];
  box([0, 0.06, 0], [3.8, 0.12, 2.4], 2600, 2600);
  rectEdges(add(t, [0.35, 0.13, 0.3]), [3.1, 0, 0], [0, 0, 1.8], 1100, 0.006, 0.8); // active area
  bezier(add(t, [0.6, 0.14, 1.7]), add(t, [1.2, 0.14, 0.2]), add(t, [2.0, 0.14, 2.2]), add(t, [3.1, 0.14, 0.6]), 1500, 0.01, 1.2);
  bezier(add(t, [0.8, 0.14, 1.2]), add(t, [1.5, 0.14, 1.6]), add(t, [1.9, 0.14, 0.8]), add(t, [2.6, 0.14, 1.1]), 700, 0.008, 0.8);
  // stylus lying diagonally, tip touching the end of the stroke
  const tip = add(t, [3.1, 0.16, 0.6]), back = add(t, [1.5, 1.2, -0.6]);
  for (let i = 0; i < 2200; i++) {
    const s = rand(), a = rand() * Math.PI * 2, axis = lerp(tip, back, s);
    const r = s < 0.12 ? 0.11 * (s / 0.12) : 0.11;
    P(add(axis, [Math.cos(a) * r * 0.8, Math.sin(a) * r, Math.sin(a) * r * 0.6]), s < 0.12 ? 1.2 : 0.85);
  }
  render('work-2', { yaw: -0.25, pitch: 0.62, zoom: 1.05, dist: 6.2 });
}

// 3. Visual asset creation — stacked design layers with shapes
{
  for (let k = 0; k < 3; k++) {
    const y = -0.7 + k * 0.62, o = [-1.5, y, -1.1];
    plane(o, [3, 0, 0], [0, 0, 2.2], 1300, k === 2 ? 0.55 : 0.35);
    rectEdges(o, [3, 0, 0], [0, 0, 2.2], 1500, 0.006, 1);
  }
  const top = [-1.5, 0.55, -1.1];
  circle(add(top, [0.75, 0.01, 1.1]), 0.45, 900, 'y', 0.007, 1.25);
  line(add(top, [1.45, 0.01, 1.6]), add(top, [1.9, 0.01, 0.6]), 350, 0.007, 1.25);
  line(add(top, [1.9, 0.01, 0.6]), add(top, [2.35, 0.01, 1.6]), 350, 0.007, 1.25);
  line(add(top, [2.35, 0.01, 1.6]), add(top, [1.45, 0.01, 1.6]), 350, 0.007, 1.25);
  rectEdges(add(top, [2.45, 0.01, 0.25]), [0.4, 0, 0], [0, 0, 0.4], 400, 0.006, 1.1);
  // cursor arrow hovering above the top layer
  const c = [0.9, 1.15, 0.6];
  line(c, add(c, [0, -0.45, 0.15]), 250, 0.008, 1.2);
  line(c, add(c, [0.3, -0.32, 0.1]), 250, 0.008, 1.2);
  line(add(c, [0, -0.45, 0.15]), add(c, [0.3, -0.32, 0.1]), 200, 0.008, 1.2);
  render('work-3', { yaw: -0.55, pitch: 0.55, zoom: 1.05, dist: 6.4 });
}

// 4. Site mapping & documentation — folded map, route, pin and a golf flag
{
  const panels = [[-1.8, 0.0], [-0.6, 0.18], [0.6, 0.0], [1.8, 0.18]];
  for (let k = 0; k < 3; k++) {
    const [x0, y0] = panels[k], [x1, y1] = panels[k + 1];
    const a = [x0, y0, -1.1], u = [x1 - x0, y1 - y0, 0], v = [0, 0, 2.2];
    plane(a, u, v, 1300, 0.45);
    rectEdges(a, u, v, 900, 0.006, 0.9);
    for (let g = 1; g < 4; g++) line(add(a, mul(v, g / 4)), add(add(a, mul(v, g / 4)), u), 160, 0.004, 0.5);
  }
  // dotted route
  for (let i = 0; i < 26; i++) {
    const t = i / 25, x = -1.5 + t * 3.0, z = 0.6 - Math.sin(t * Math.PI * 1.6) * 0.7;
    const y = x < -0.6 ? 0.03 + ((x + 1.8) / 1.2) * 0.18 : x < 0.6 ? 0.21 - ((x + 0.6) / 1.2) * 0.18 : 0.03 + ((x - 0.6) / 1.2) * 0.18;
    disc([x, y + 0.01, z], 0.045, 40, 'y', 1.2);
  }
  // location pin
  sphere([-1.25, 1.25, 0.55], 0.32, 1500, 0.9);
  circle([-1.25, 1.25, 0.88], 0.12, 250, 'z', 0.006, 1.3);
  for (let i = 0; i < 900; i++) { const s = rand(), a = rand() * Math.PI * 2, r = 0.26 * (1 - s); P([-1.25 + Math.cos(a) * r, 1.05 - s * 0.98, 0.55 + Math.sin(a) * r], 0.85); }
  // golf flag at the end of the route
  line([1.45, 0.1, 0.45], [1.45, 1.45, 0.45], 600, 0.008, 1.1);
  plane([1.45, 1.05, 0.45], [0.55, 0.2, 0], [0, 0.38, 0], 700, 0.9);
  circle([1.45, 0.11, 0.45], 0.16, 300, 'y', 0.006, 1);
  render('work-4', { yaw: -0.35, pitch: 0.5, zoom: 1.0, dist: 6.4, cy: 0.35 });
}

// 5. Bookkeeping & records — open ledger, calculator and coins
{
  // ledger: two gently curved pages
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2600; i++) {
      const u = rand(), v = rand();
      const x = side * (0.05 + u * 1.55), y = 0.12 * Math.sin(u * Math.PI) + 0.02 * (1 - u);
      P([x - 0.7, y - 0.4, -1.0 + v * 1.9], 0.45);
    }
    for (let r = 1; r < 9; r++) for (let i = 0; i < 120; i++) {
      const u = 0.1 + rand() * 0.8;
      P([side * (0.05 + u * 1.55) - 0.7, 0.12 * Math.sin(u * Math.PI) - 0.38, -1.0 + (r / 9) * 1.9 + gauss() * 0.004], 1);
    }
    line([side * 1.6 - 0.7, -0.4, -1.0], [side * 1.6 - 0.7, -0.4, 0.9], 300, 0.006, 1);
  }
  line([-0.7, -0.38, -1.0], [-0.7, -0.38, 0.9], 400, 0.006, 1.2); // spine
  // calculator
  box([1.55, -0.15, 0.25], [1.0, 0.18, 1.45], 1800, 1500);
  plane([1.2, -0.05, -0.35], [0.7, 0, 0], [0, 0, 0.3], 350, 1); // display
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) disc([1.25 + c * 0.3, -0.05, 0.15 + r * 0.22], 0.07, 70, 'y', 1.1);
  // coin stack
  for (let k = 0; k < 5; k++) cylinderY([0.25 + (k % 2) * 0.02, -0.4 + k * 0.09, 1.15], 0.32, 0.08, 520, 0.7);
  render('work-5', { yaw: -0.42, pitch: 0.6, zoom: 1.05, dist: 6.2, cy: -0.1 });
}
console.log('wrote', outDir);
