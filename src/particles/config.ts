/**
 * Tuning knobs. Everything visual about the particle field lives here.
 * See README → "Tuning" for what each one does.
 */

const coarse = window.matchMedia('(pointer: coarse)').matches;
const small = window.matchMedia('(max-width: 768px)').matches;

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isMobile = coarse || small;

export const config = {
  /** Total points. Desktop / mobile / reduced-motion. */
  count: reducedMotion ? 20_000 : isMobile ? 36_000 : 80_000,

  /** Device-pixel-ratio cap (2 = crisp on retina without 3x cost). */
  maxDpr: isMobile ? 1.75 : 2,

  /** Base point size in CSS pixels at the camera distance. */
  pointSize: isMobile ? 2.4 : 2.1,

  /** Base point alpha (multiplied by per-point random 0.45–1). */
  opacity: 0.62,

  /** Particle colour on the #232329 background. */
  color: '#d9d9de',

  /** 0 = every point moves together, ~0.7 = long organic dissolve. */
  stagger: 0.55,

  /** 1 = plain smoothstep; 2–3 = snappier middle, softer ends. */
  easePower: 1.6,

  /** Noise displacement at rest (shimmer) and the extra amount mid-transition. */
  noiseRest: reducedMotion ? 0 : 0.018,
  noiseMorph: reducedMotion ? 0 : 0.55,
  /** Spatial frequency of the noise field. */
  noiseScale: 0.55,

  /** Mouse repulsion radius (world units) and push distance. */
  mouseRadius: 0.6,
  mouseStrength: reducedMotion ? 0 : 0.22,

  /** Hero parallax rotation (radians at the screen edge). Unused since hover-turn replaced it. */
  parallax: reducedMotion ? 0 : 0.22,

  /** Hover turn: how far each 3D model turns toward the cursor (radians at the screen edge). */
  hoverYaw: reducedMotion ? 0 : 0.75,
  hoverPitch: reducedMotion ? 0 : 0.4,

  /** Globe spin speed (radians / second). */
  globeSpin: reducedMotion ? 0 : 0.12,
};
