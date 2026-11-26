/**
 * Shape generators. Every generator returns a Float32Array of `count * 3`
 * xyz positions in world units (the scene is framed so ~6.3 units are visible
 * vertically at desktop sizes).
 */

const TAU = Math.PI * 2;

function gauss(): number {
  // Box–Muller
  let u = 0;
  while (u === 0) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * Math.random());
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load shape image: ${url}`));
    img.src = url;
  });
}

export interface ImageSampleOptions {
  /** World-space height of the sampled shape. */
  height: number;
  /** Fraction of points placed on the outline (0 = solid fill, 1 = outline only). */
  edgeBias?: number;
  /** Alpha threshold (0..1) for a pixel to count as "inside". */
  threshold?: number;
  /** Outline thickness in sample pixels. */
  edgeWidth?: number;
  /** Random z depth. */
  depth?: number;
  /** Extra z bulge towards the centre of the shape (gives flat images some volume). */
  bulge?: number;
  /** Longest side of the offscreen sampling canvas. */
  resolution?: number;
  /** World-space offset applied after centring. */
  offset?: [number, number, number];
}

/**
 * Draw an image (PNG, SVG, …) into a hidden 2D canvas, read its pixels, and
 * rejection-sample points where alpha > threshold. Optionally biases a share of
 * points onto the outline so silhouettes and maps read clearly.
 */
export function sampleImage(img: HTMLImageElement, count: number, opts: ImageSampleOptions): Float32Array {
  const {
    height,
    edgeBias = 0.3,
    threshold = 0.5,
    edgeWidth = 2,
    depth = 0.15,
    bulge = 0,
    resolution = 512,
    offset = [0, 0, 0],
  } = opts;

  const iw = img.naturalWidth || img.width || resolution;
  const ih = img.naturalHeight || img.height || resolution;
  const k = resolution / Math.max(iw, ih);
  const w = Math.max(1, Math.round(iw * k));
  const h = Math.max(1, Math.round(ih * k));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const alpha = new Float32Array(w * h);
  const thr = threshold * 255;
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const a = data[i * 4 + 3];
      alpha[i] = a / 255;
      if (a > thr) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) throw new Error('Shape image has no opaque pixels above the threshold.');

  const inside = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && alpha[y * w + x] * 255 > thr;

  // Outline pixels: inside, with an outside pixel within `edgeWidth`.
  const edges: number[] = [];
  if (edgeBias > 0) {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!inside(x, y)) continue;
        if (
          !inside(x - edgeWidth, y) || !inside(x + edgeWidth, y) ||
          !inside(x, y - edgeWidth) || !inside(x, y + edgeWidth)
        ) edges.push(y * w + x);
      }
    }
  }

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const cx = minX + bw / 2;
  const cy = minY + bh / 2;
  const s = height / bh;

  const out = new Float32Array(count * 3);
  const nEdge = edges.length ? Math.floor(count * edgeBias) : 0;

  const write = (i: number, px: number, py: number) => {
    const nx = (px - cx) / (bw / 2);
    const ny = (py - cy) / (bh / 2);
    const r2 = Math.min(1, nx * nx * 0.8 + ny * ny * 0.5);
    out[i * 3] = (px - cx) * s + offset[0];
    out[i * 3 + 1] = -(py - cy) * s + offset[1];
    out[i * 3 + 2] = (Math.random() - 0.5) * depth + bulge * (1 - r2) + offset[2];
  };

  for (let i = 0; i < nEdge; i++) {
    const idx = edges[(Math.random() * edges.length) | 0];
    write(i, (idx % w) + Math.random(), Math.floor(idx / w) + Math.random());
  }

  // Rejection sampling for the fill, weighted by alpha.
  let guard = 0;
  for (let i = nEdge; i < count; ) {
    const px = minX + Math.random() * bw;
    const py = minY + Math.random() * bh;
    const a = alpha[(py | 0) * w + (px | 0)];
    if (a * 255 > thr && Math.random() < a) {
      write(i, px, py);
      i++;
    } else if (++guard > count * 200) {
      // Degenerate image: duplicate already-placed points instead of hanging.
      const j = (Math.random() * Math.max(1, i)) | 0;
      out.copyWithin(i * 3, j * 3, j * 3 + 3);
      i++;
    }
  }
  return out;
}

/** Sphere surface with a hint of latitude/longitude lines. */
export function sphere(count: number, radius = 1.6): Float32Array {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    let theta: number;
    let phi: number;
    const r = Math.random();
    if (r < 0.14) {
      // latitude rings every 22.5°
      const ring = Math.floor(Math.random() * 7) - 3;
      phi = Math.PI / 2 - ring * (Math.PI / 8) + gauss() * 0.006;
      theta = Math.random() * TAU;
    } else if (r < 0.26) {
      // meridians every 30°
      theta = Math.floor(Math.random() * 12) * (TAU / 12) + gauss() * 0.006;
      phi = Math.acos(2 * Math.random() - 1);
    } else {
      theta = Math.random() * TAU;
      phi = Math.acos(2 * Math.random() - 1);
    }
    const rr = radius * (1 + gauss() * 0.008);
    out[i * 3] = rr * Math.sin(phi) * Math.cos(theta);
    out[i * 3 + 1] = rr * Math.cos(phi);
    out[i * 3 + 2] = rr * Math.sin(phi) * Math.sin(theta);
  }
  return out;
}

/** Several loose, twisting bands that drift across the screen. */
export function ribbons(count: number, bands = 5, width = 12): Float32Array {
  const out = new Float32Array(count * 3);
  const params = Array.from({ length: bands }, (_, b) => ({
    y: (b - (bands - 1) / 2) * 0.55 + gauss() * 0.1,
    freq: 0.35 + Math.random() * 0.35,
    amp: 0.35 + Math.random() * 0.45,
    phase: Math.random() * TAU,
    twist: 0.3 + Math.random() * 0.6,
    thick: 0.18 + Math.random() * 0.22,
  }));
  for (let i = 0; i < count; i++) {
    const p = params[i % bands];
    const x = (Math.random() - 0.5) * width;
    const v = (Math.random() - 0.5) * p.thick + gauss() * 0.02;
    const ang = x * p.twist + p.phase;
    out[i * 3] = x;
    out[i * 3 + 1] = p.y + Math.sin(x * p.freq + p.phase) * p.amp + v * Math.cos(ang);
    out[i * 3 + 2] = Math.cos(x * p.freq * 0.7 + p.phase) * 0.8 + v * Math.sin(ang) * 2;
  }
  return out;
}

/** A faint, diffuse stream that sits behind the works strip. */
export function wisp(count: number, width = 16): Float32Array {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * width;
    out[i * 3] = x;
    out[i * 3 + 1] = Math.sin(x * 0.45) * 0.7 - 0.3 + gauss() * 0.45;
    out[i * 3 + 2] = -1 + gauss() * 0.9;
  }
  return out;
}

/** Rough rectangular frame (perimeter + loose scatter), sized in world units. */
export function frame(
  count: number,
  w: number,
  h: number,
  cx = 0,
  cy = 0,
  thickness = 0.03,
  out: Float32Array = new Float32Array(count * 3),
): Float32Array {
  const perim = 2 * (w + h);
  for (let i = 0; i < count; i++) {
    let x: number;
    let y: number;
    const t = Math.random() * perim;
    if (t < w) { x = -w / 2 + t; y = h / 2; }
    else if (t < w + h) { x = w / 2; y = h / 2 - (t - w); }
    else if (t < 2 * w + h) { x = w / 2 - (t - w - h); y = -h / 2; }
    else { x = -w / 2; y = -h / 2 + (t - 2 * w - h); }

    const loose = Math.random() < 0.08;
    const spread = loose ? thickness * 6 : thickness;
    out[i * 3] = cx + x + gauss() * spread;
    out[i * 3 + 1] = cy + y + gauss() * spread;
    out[i * 3 + 2] = gauss() * (loose ? 0.25 : 0.04);
  }
  return out;
}

/** Gaussian dust cloud used as the preloader's starting state. */
export function noiseCloud(count: number, radius = 5): Float32Array {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    out[i * 3] = gauss() * radius * 0.9;
    out[i * 3 + 1] = gauss() * radius * 0.55;
    out[i * 3 + 2] = gauss() * radius * 0.5;
  }
  return out;
}

/**
 * Annotation bounding boxes (Experience stage): rectangles at different depths,
 * each with corner handles and a small label tab, like boxes drawn on a dataset image.
 */
export function boxes(count: number): Float32Array {
  const rects = [
    { w: 3.3, h: 2.4, x: 0.1, y: 0.15, z: -1.0 },
    { w: 2.3, h: 1.5, x: -1.25, y: 0.75, z: 0.35 },
    { w: 1.35, h: 1.95, x: 1.35, y: 0.25, z: -0.35 },
    { w: 1.1, h: 0.75, x: 0.25, y: -1.3, z: 0.6 },
    { w: 0.85, h: 0.85, x: -2.05, y: -1.15, z: 0.0 },
    { w: 1.25, h: 0.9, x: 2.2, y: -1.4, z: 0.2 },
  ];
  const weights = rects.map((r) => r.w + r.h);
  const total = weights.reduce((a, b) => a + b, 0);
  const pick = () => {
    let t = Math.random() * total;
    for (let i = 0; i < rects.length; i++) if ((t -= weights[i]) <= 0) return rects[i];
    return rects[0];
  };

  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = pick();
    const kind = Math.random();
    let x: number;
    let y: number;
    let z = r.z + gauss() * 0.03;
    if (kind < 0.74) {
      // outline
      const perim = 2 * (r.w + r.h);
      const t = Math.random() * perim;
      if (t < r.w) { x = -r.w / 2 + t; y = r.h / 2; }
      else if (t < r.w + r.h) { x = r.w / 2; y = r.h / 2 - (t - r.w); }
      else if (t < 2 * r.w + r.h) { x = r.w / 2 - (t - r.w - r.h); y = -r.h / 2; }
      else { x = -r.w / 2; y = -r.h / 2 + (t - 2 * r.w - r.h); }
      x += gauss() * 0.012;
      y += gauss() * 0.012;
    } else if (kind < 0.88) {
      // corner handles
      const sx = Math.random() < 0.5 ? -1 : 1;
      const sy = Math.random() < 0.5 ? -1 : 1;
      x = (sx * r.w) / 2 + (Math.random() - 0.5) * 0.1;
      y = (sy * r.h) / 2 + (Math.random() - 0.5) * 0.1;
    } else if (kind < 0.96) {
      // label tab above the top-left corner
      x = -r.w / 2 + Math.random() * Math.min(0.55, r.w * 0.5);
      y = r.h / 2 + 0.02 + Math.random() * 0.14;
    } else {
      // loose dust around the box
      x = gauss() * r.w * 0.5;
      y = gauss() * r.h * 0.5;
      z += gauss() * 0.3;
    }
    out[i * 3] = r.x + x;
    out[i * 3 + 1] = r.y + y;
    out[i * 3 + 2] = z;
  }
  return out;
}

/**
 * A small network (Skills stage): four hubs — one per skill group — with satellite
 * nodes and connecting lines.
 */
export function network(count: number): Float32Array {
  const hubs = [
    [-1.7, 0.95, 0.0],
    [1.55, 1.1, -0.45],
    [-1.25, -1.15, 0.35],
    [1.75, -0.95, 0.15],
  ];
  const sats: number[][] = [];
  const edges: Array<[number[], number[]]> = [];
  hubs.forEach((h) => {
    for (let k = 0; k < 7; k++) {
      const a = Math.random() * TAU;
      const d = 0.55 + Math.random() * 0.55;
      const s = [h[0] + Math.cos(a) * d, h[1] + Math.sin(a) * d * 0.8, h[2] + gauss() * 0.3];
      sats.push(s);
      edges.push([h, s]);
    }
  });
  for (let i = 0; i < hubs.length; i++) for (let j = i + 1; j < hubs.length; j++) edges.push([hubs[i], hubs[j]]);

  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const kind = Math.random();
    let p: number[];
    if (kind < 0.34) {
      const h = hubs[(Math.random() * hubs.length) | 0];
      p = [h[0] + gauss() * 0.2, h[1] + gauss() * 0.2, h[2] + gauss() * 0.2];
    } else if (kind < 0.56) {
      const s = sats[(Math.random() * sats.length) | 0];
      p = [s[0] + gauss() * 0.045, s[1] + gauss() * 0.045, s[2] + gauss() * 0.045];
    } else if (kind < 0.92) {
      const [a, b] = edges[(Math.random() * edges.length) | 0];
      const t = Math.random();
      p = [a[0] + (b[0] - a[0]) * t + gauss() * 0.012, a[1] + (b[1] - a[1]) * t + gauss() * 0.012, a[2] + (b[2] - a[2]) * t + gauss() * 0.012];
    } else {
      p = [gauss() * 2.4, gauss() * 1.5, gauss() * 1.2];
    }
    out[i * 3] = p[0];
    out[i * 3 + 1] = p[1];
    out[i * 3 + 2] = p[2];
  }
  return out;
}
