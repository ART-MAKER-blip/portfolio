// 3D simplex noise — Ashima Arts / Stefan Gustavson (MIT license).
const simplexNoise = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// Three decorrelated noise channels — a cheap, divergence-ish vector field.
vec3 snoiseVec3(vec3 p) {
  return vec3(
    snoise(p),
    snoise(p + vec3(31.416, -47.853, 12.793)),
    snoise(p + vec3(-233.12, 113.84, -67.21))
  );
}
`;

export const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uLocal;        // 0..1 progress between the bound "from" and "to" shapes
uniform float uIntro;        // 0..1 preloader assembly (noise cloud -> first shape)
uniform float uStagger;      // 0..~0.8  how much per-point delay is spread over the transition
uniform float uEasePower;    // >1 sharpens the per-point smoothstep
uniform float uNoiseRest;    // displacement at rest
uniform float uNoiseMorph;   // extra displacement at the middle of a transition
uniform float uNoiseScale;
uniform float uSize;
uniform float uPixelRatio;
uniform float uSizeScale;    // camera distance used for size attenuation
uniform float uReduced;      // 1 = prefers-reduced-motion: crossfade instead of morph
uniform float uOpacity;

uniform vec3  uMouse;
uniform float uMouseRadius;
uniform float uMouseStrength;

uniform float uRotFrom;      // per-shape Y rotation (e.g. spinning globe)
uniform float uRotTo;
uniform float uDriftFrom;    // per-shape wave drift (ribbons / wisp)
uniform float uDriftTo;
uniform float uAlphaFrom;    // per-shape alpha multiplier
uniform float uAlphaTo;
uniform vec3  uOffsetFrom;   // per-shape position (applied after the hover turn)
uniform vec3  uOffsetTo;
uniform float uTiltFrom;     // per-shape weight of the hover turn (0 = fixed to the page)
uniform float uTiltTo;
uniform vec2  uTilt;         // hover turn: x = yaw, y = pitch (radians)

attribute vec3 aFrom;
attribute vec3 aTo;
attribute vec3 aNoise;
attribute float aSeed;

varying float vAlpha;

${simplexNoise}

vec3 rotY(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

vec3 drift(vec3 p, float amt) {
  if (amt <= 0.0) return p;
  float t = uTime;
  p.y += sin(p.x * 0.75 + t * 0.45 + p.z * 0.9) * 0.22 * amt;
  p.z += cos(p.x * 0.5 - t * 0.3 + p.y) * 0.35 * amt;
  p.x += sin(t * 0.25 + p.y * 1.3) * 0.12 * amt;
  return p;
}

// Turn a shape around its own centre to follow the cursor.
vec3 hoverTurn(vec3 p, float weight) {
  if (weight <= 0.0) return p;
  float yaw = uTilt.x * weight, pitch = uTilt.y * weight;
  float c = cos(yaw), s = sin(yaw);
  p = vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  c = cos(pitch); s = sin(pitch);
  return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
}

float ease(float x) {
  x = smoothstep(0.0, 1.0, x);
  return uEasePower == 1.0 ? x : (x < 0.5 ? 0.5 * pow(2.0 * x, uEasePower) : 1.0 - 0.5 * pow(2.0 * (1.0 - x), uEasePower));
}

void main() {
  vec3 a = hoverTurn(drift(rotY(aFrom, uRotFrom), uDriftFrom), uTiltFrom) + uOffsetFrom;
  vec3 b = hoverTurn(drift(rotY(aTo, uRotTo), uDriftTo), uTiltTo) + uOffsetTo;

  // Per-point stagger: mostly random seed, partly a low-frequency spatial field,
  // so the dissolve travels in soft patches instead of uniform salt-and-pepper.
  float spatial = snoise(a * 0.35) * 0.5 + 0.5;
  float offset = mix(aSeed, spatial, 0.35) * uStagger;
  float local = clamp((uLocal - offset) / max(1.0 - uStagger, 0.0001), 0.0, 1.0);
  local = ease(local);

  vec3 p;
  float fade = 1.0;
  if (uReduced > 0.5) {
    // Simple fade: points fade out on the old shape, then fade in on the new one.
    p = uLocal < 0.5 ? a : b;
    fade = abs(1.0 - 2.0 * uLocal);
  } else {
    p = mix(a, b, local);
  }

  // Preloader: assemble from a noise cloud.
  float intro = clamp((uIntro - aSeed * 0.45) / 0.55, 0.0, 1.0);
  intro = smoothstep(0.0, 1.0, intro);
  p = mix(aNoise, p, intro);

  // Dust shimmer — strongest mid-transition and while assembling.
  float morph = sin(3.14159265 * local);
  float amp = uNoiseRest + uNoiseMorph * max(morph, 1.0 - intro);
  p += snoiseVec3(p * uNoiseScale + vec3(0.0, 0.0, uTime * 0.12) + aSeed * 0.15) * amp;

  vec4 world = modelMatrix * vec4(p, 1.0);

  // Mouse repulsion in world space (z = 0 plane).
  vec2 d = world.xy - uMouse.xy;
  float len = length(d);
  float push = (1.0 - smoothstep(0.0, uMouseRadius, len)) * uMouseStrength;
  world.xy += (d / max(len, 0.0001)) * push;

  vec4 mv = viewMatrix * world;
  gl_Position = projectionMatrix * mv;

  float sizeJitter = 0.55 + fract(aSeed * 91.7) * 0.9;
  gl_PointSize = uSize * sizeJitter * uPixelRatio * (uSizeScale / -mv.z);

  vAlpha = mix(uAlphaFrom, uAlphaTo, local) * fade * uOpacity * (0.45 + 0.55 * fract(aSeed * 13.37));
}
`;

export const fragmentShader = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, d) * vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
}
`;
