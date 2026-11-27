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

// 4. Front-end development — browser window with a page layout and a </> tag
{
  const o = [-1.9, -1.15, 0];
  box([0, 0.05, -0.1], [3.8, 2.5, 0.12], 2600, 2600); // window
  line([-1.9, 0.95, 0.0], [1.9, 0.95, 0.0], 500, 0.006, 1); // title bar
  for (let k = 0; k < 3; k++) circle([-1.7 + k * 0.2, 1.1, 0.01], 0.06, 120, 'z', 0.004, 1.2);
  plane(add(o, [0.6, 2.25, 0.01]), [2.9, 0, 0], [0, 0.07, 0], 250, 0.7); // address bar
  plane(add(o, [0.25, 1.65, 0.01]), [3.3, 0, 0], [0, 0.3, 0], 600, 0.75); // page header
  plane(add(o, [0.25, 0.25, 0.01]), [0.75, 0, 0], [0, 1.25, 0], 600, 0.55); // sidebar
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) rectEdges(add(o, [1.2 + c * 0.82, 0.3 + r * 0.66, 0.01]), [0.68, 0, 0], [0, 0.52, 0], 420, 0.005, 0.9); // cards
  // floating </> tag in front of the window
  const t = [0.3, -0.25, 0.9];
  line(add(t, [-0.85, 0, 0]), add(t, [-0.55, 0.3, 0]), 260, 0.01, 1.3); // <
  line(add(t, [-0.85, 0, 0]), add(t, [-0.55, -0.3, 0]), 260, 0.01, 1.3);
  line(add(t, [-0.15, -0.38, 0]), add(t, [0.15, 0.38, 0]), 300, 0.01, 1.3); // /
  line(add(t, [0.85, 0, 0]), add(t, [0.55, 0.3, 0]), 260, 0.01, 1.3); // >
  line(add(t, [0.85, 0, 0]), add(t, [0.55, -0.3, 0]), 260, 0.01, 1.3);
  render('work-4', { yaw: -0.38, pitch: 0.16, zoom: 1.0, dist: 6.2 });
}

// 5. Bash & cloud computing — a terminal window with a prompt, under a cloud
{
  box([0, -0.45, -0.1], [3.4, 2.0, 0.12], 2400, 2200); // terminal window
  line([-1.7, 0.3, 0.0], [1.7, 0.3, 0.0], 450, 0.006, 1);
  for (let k = 0; k < 3; k++) circle([-1.5 + k * 0.2, 0.43, 0.01], 0.06, 110, 'z', 0.004, 1.2);
  // prompt lines: "> ______"
  const rows = [[0.05, 1.6], [-0.3, 2.2], [-0.65, 1.2], [-1.0, 0.0]];
  for (const [y, len] of rows) {
    line([-1.45, y + 0.08, 0.02], [-1.3, y, 0.02], 120, 0.006, 1.3);
    line([-1.45, y - 0.08, 0.02], [-1.3, y, 0.02], 120, 0.006, 1.3);
    if (len) line([-1.15, y, 0.02], [-1.15 + len, y, 0.02], Math.round(len * 260), 0.01, 0.9);
  }
  plane([-1.15, -1.1, 0.02], [0.14, 0, 0], [0, 0.2, 0], 160, 1.3); // blinking cursor block
  // cloud: a cluster of spheres, flattened at the bottom
  for (const [x, y, r] of [[-0.6, 1.55, 0.42], [0.0, 1.8, 0.55], [0.6, 1.55, 0.42], [-0.25, 1.35, 0.4], [0.3, 1.35, 0.4]]) {
    for (let i = 0; i < 700; i++) {
      const z = rand() * 2 - 1, a = rand() * Math.PI * 2, q = Math.sqrt(1 - z * z);
      const py = y + z * r;
      if (py < 1.2) continue;
      P([x + q * Math.cos(a) * r, py, 0.2 + q * Math.sin(a) * r * 0.6], 0.85);
    }
  }
  // sync arrows between cloud and terminal
  for (const [x, up] of [[-0.35, true], [0.35, false]]) {
    line([x, 0.55, 0.3], [x, 1.1, 0.3], 220, 0.008, 1.1);
    const tip = up ? [x, 1.1, 0.3] : [x, 0.55, 0.3], d = up ? -0.15 : 0.15;
    line(tip, [x - 0.12, tip[1] + d, 0.3], 90, 0.008, 1.1);
    line(tip, [x + 0.12, tip[1] + d, 0.3], 90, 0.008, 1.1);
  }
  render('work-5', { yaw: -0.35, pitch: 0.18, zoom: 1.0, dist: 6.2, cy: 0.3 });
}
console.log('wrote', outDir);
