"""
Turn a portrait photo into the hero's 3D particle model.

    python3 scripts/face-points.py <photo.png> public/face.bin [--preview out.png]

Steps: cut the subject out of a plain, low-saturation background (flood fill from the
image border), sculpt a depth map (head ellipsoid + nose, brow, cheeks, lips, chin,
eye sockets, neck and shoulders, plus fine relief from the photo's shading), then
scatter points: denser where the photo is brighter, with extra points on the outline
and on strong facial edges. Writes int16 xyz triples (x/y/z × 8000), shuffled so any
prefix is an even sample. Only this point cloud is published, not the photo.

Feature positions below are in the source photo's pixels (842×710 pfp.png).
"""
import subprocess
import sys

import numpy as np

src, out = sys.argv[1], sys.argv[2]
preview = sys.argv[sys.argv.index("--preview") + 1] if "--preview" in sys.argv else None
rng = np.random.default_rng(11)

W, H = map(int, subprocess.check_output(["magick", "identify", "-format", "%w %h", src]).split())
raw = subprocess.check_output(["magick", src, "-alpha", "off", "-depth", "8", "rgb:-"])
img = np.frombuffer(raw, np.uint8).reshape(H, W, 3).astype(np.float32) / 255.0
mx, mn = img.max(2), img.min(2)
sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
lum = img @ np.array([0.299, 0.587, 0.114], np.float32)


def shift(a, dy, dx, fill=False):
    out_ = np.full_like(a, fill)
    ys, yd = (slice(dy, None), slice(None, -dy)) if dy > 0 else (slice(None, dy or None), slice(-dy, None))
    xs, xd = (slice(dx, None), slice(None, -dx)) if dx > 0 else (slice(None, dx or None), slice(-dx, None))
    out_[ys, xs] = a[yd, xd]
    return out_


def dilate(a):
    return a | shift(a, 1, 0) | shift(a, -1, 0) | shift(a, 0, 1) | shift(a, 0, -1)


def erode(a):
    return ~dilate(~a)


def box_blur(a, r):
    k = 2 * r + 1
    p = np.pad(a, r, mode="edge")
    c = p.cumsum(0).cumsum(1)
    c = np.pad(c, ((1, 0), (1, 0)))
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)


# ---- 1. cut out: background = low-saturation pixels connected to the image border ----
bglike = (sat < 0.13) & (mx > 0.33)
reach = np.zeros_like(bglike)
reach[0, :] = bglike[0, :]
reach[:, 0] = bglike[:, 0]
reach[:, -1] = bglike[:, -1]
while True:
    nxt = dilate(reach) & bglike
    if (nxt == reach).all():
        break
    reach = nxt
mask = ~reach
# opening: cut thin slivers of shadowed curtain off the outline
for _ in range(5):
    mask = erode(mask)
for _ in range(5):
    mask = dilate(mask)
# keep only the region connected to the face (seed: between the eyes)
keep = np.zeros_like(mask)
keep[int(H * 0.38), int(W * 0.57)] = True
while True:
    nxt = dilate(keep) & mask
    if (nxt == keep).all():
        break
    keep = nxt
mask = keep
mask = box_blur(mask.astype(np.float32), 2) > 0.5
mask &= box_blur(mask.astype(np.float32), 7) > 0.4  # drop thin specks at the edges

# ---- 2. depth (model units; x right, y down in pixels) ----
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
s = 5.0 / H  # model height 5 units


def bump(cx, cy, rx, ry, amp):
    return amp * np.exp(-(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2) / 2)


head = 1 - ((xx - 485) / 210) ** 2 - ((yy - 270) / 245) ** 2
z_head = np.where(head > 0, 1.25 * np.sqrt(np.clip(head, 0, 1)), -9)
z_head = (z_head
          + bump(478, 312, 20, 38, 0.32)                                 # nose
          + bump(480, 238, 90, 18, 0.08)                                 # brow
          - bump(420, 265, 30, 18, 0.16) - bump(545, 272, 30, 18, 0.16)  # eye sockets
          + bump(398, 365, 42, 38, 0.1) + bump(565, 370, 42, 38, 0.1)    # cheeks
          + bump(470, 392, 40, 14, 0.09)                                 # lips
          + bump(470, 470, 45, 26, 0.1))                                 # chin
neck = 1 - ((xx - 470) / 120) ** 2
z_neck = np.where((neck > 0) & (yy > 380), 0.75 * np.sqrt(np.clip(neck, 0, 1)) - 0.15, -9)
torso = 1 - ((xx - 400) / 480) ** 2
z_torso = np.where((torso > 0) & (yy > 430), 1.0 * np.sqrt(np.clip(torso, 0, 1)) - 0.55, -9)
z = np.maximum(np.maximum(z_head, z_neck), z_torso)
z = np.where(z < -5, -0.4, z)
detail = lum - box_blur(lum, 6)  # fine relief from shading
z = z + 0.35 * detail * (sat > 0.15)
z = box_blur(z, 2)

# ---- 3. scatter points ----
inside = np.argwhere(mask)
ys_, xs_ = inside[:, 0], inside[:, 1]
# unsharp mask: boost local contrast so eyes, brows, nostrils and the mouth read clearly
sharp = np.clip(lum + 1.6 * (lum - box_blur(lum, 9)), 0, 1)
tone = 0.035 + 0.965 * np.clip(sharp[ys_, xs_] / 0.7, 0, 1) ** 2.3
N_FILL = 52000
fill_idx = rng.choice(len(inside), N_FILL, p=tone / tone.sum())

gx = shift(lum, 0, -1) - shift(lum, 0, 1)
gy = shift(lum, -1, 0) - shift(lum, 1, 0)
grad = np.hypot(gx, gy) * mask
outline = mask & ~erode(mask)
feat = grad > np.quantile(grad[mask], 0.93)
edge_pts = np.argwhere(outline | (feat & erode(erode(mask))))
N_EDGE = 10000
edge_idx = rng.choice(len(edge_pts), N_EDGE)

py = np.concatenate([ys_[fill_idx], edge_pts[edge_idx, 0]]).astype(np.float32)
px = np.concatenate([xs_[fill_idx], edge_pts[edge_idx, 1]]).astype(np.float32)
py += rng.random(len(py)); px += rng.random(len(px))
zz = z[np.clip(py.astype(int), 0, H - 1), np.clip(px.astype(int), 0, W - 1)] + rng.normal(0, 0.012, len(py))

ys_m, xs_m = np.nonzero(mask)
cx, cy = (xs_m.min() + xs_m.max()) / 2, (ys_m.min() + ys_m.max()) / 2
pts = np.stack([(px - cx) * s, -(py - cy) * s, zz], 1)
pts = pts[rng.permutation(len(pts))]
np.round(pts * 8000).astype("<i2").tofile(out)
print(f"{len(pts)} points → {out}; x {pts[:,0].min():.2f}..{pts[:,0].max():.2f}, y {pts[:,1].min():.2f}..{pts[:,1].max():.2f}, z {pts[:,2].min():.2f}..{pts[:,2].max():.2f}")

if preview:
    m = (mask * 255).astype(np.uint8)
    subprocess.run(["magick", "-size", f"{W}x{H}", "-depth", "8", "gray:-", preview], input=m.tobytes(), check=True)
