import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import 'lenis/dist/lenis.css';
import './style.css';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { config, reducedMotion, isMobile } from './particles/config';
import { ParticleSystem, type ShapeDef } from './particles/ParticleSystem';
import { loadImage, sampleImage, sphere, ribbons, wisp, frame, boxes, network } from './particles/shapes';
import { buildTimeline } from './scroll/timeline';
import { setupSmoothScroll } from './scroll/smooth';
import { hideHeroForIntro, revealHero } from './sections/hero';
import { setupGlobe } from './sections/globe';
import { buildWorks, setupWavyFrames } from './sections/works';
import { setupContact } from './sections/contact';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

const base = import.meta.env.BASE_URL;
const ASSETS = {
  portrait: `${base}silhouette.png`, // PLACEHOLDER — swap for your own silhouette (transparent PNG/SVG)
  map: `${base}philippines.svg`, // rough outline of the Philippines
  cap: `${base}cap.svg`, // graduation cap for the Education stage
};
const SPHERE_RADIUS = 1.6;
/** On wide screens, shift the shapes of text-heavy stages to the empty side of the screen. */
const SIDE = isMobile ? 0 : 1;
/** On phones the long copy sits at the bottom, so lift those shapes into the top half. */
const LIFT = isMobile ? 1 : 0;

const counter = document.querySelector<HTMLElement>('.preloader-count')!;
const setLoad = (p: number) => (counter.textContent = `${Math.round(p * 100)}%`);

/** Move every point of a shape by (dx, dy) world units. */
function shift(positions: Float32Array, dx: number, dy = 0) {
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] += dx;
    positions[i + 1] += dy;
  }
  return positions;
}

async function init() {
  const canvas = document.querySelector<HTMLCanvasElement>('#webgl')!;
  const system = new ParticleSystem(canvas);
  system.resize();
  system.start(); // render the noise cloud while assets load
  hideHeroForIntro();

  // --- Load assets & build shapes ---
  let loaded = 0;
  const tick = <T,>(p: Promise<T>) => p.then((v) => (setLoad(++loaded / 4), v));
  const [portraitImg, mapImg, capImg] = await Promise.all([
    tick(loadImage(ASSETS.portrait)),
    tick(loadImage(ASSETS.map)),
    tick(loadImage(ASSETS.cap)),
    tick(document.fonts.ready),
  ]);

  const n = config.count;
  const shapes: ShapeDef[] = [
    {
      name: 'portrait',
      positions: sampleImage(portraitImg, n, { height: 5.4, edgeBias: 0.3, depth: 0.25, bulge: 0.6, offset: [0, -0.75, 0] }),
    },
    { name: 'globe', positions: sphere(n, SPHERE_RADIUS), rotation: (t) => t * config.globeSpin },
    { name: 'map', positions: sampleImage(mapImg, n, { height: 5.0, edgeBias: 0.55, edgeWidth: 2, depth: 0.12 }) },
    { name: 'ribbons', positions: ribbons(n), drift: 1 },
    { name: 'boxes', positions: shift(boxes(n), 1.65 * SIDE, 2.6 * LIFT), rotation: (t) => Math.sin(t * 0.25) * 0.18 },
    { name: 'cap', positions: sampleImage(capImg, n, { height: 2.7, edgeBias: 0.45, depth: 0.2, bulge: 0.35, offset: [-2.5 * SIDE, 0.1, 0] }), rotation: (t) => Math.sin(t * 0.3) * 0.35 },
    { name: 'network', positions: shift(network(n), 2.0 * SIDE, 2.4 * LIFT), rotation: (t) => Math.sin(t * 0.2) * 0.3 }, // sway (a full spin would orbit the screen centre)
    { name: 'wisp', positions: wisp(n), drift: 0.8, alpha: 0.3 },
    { name: 'frame', positions: frame(n, 5, 1.6) },
  ];
  system.setShapes(shapes);

  // --- Sections & scroll ---
  buildWorks();
  const globe = setupGlobe(system, SPHERE_RADIUS, config.globeSpin);
  const contact = setupContact(system, 'frame');
  const lenis = setupSmoothScroll(reducedMotion);
  lenis?.stop();
  const { tl, st, scrollFor } = buildTimeline(system, reducedMotion);
  setupWavyFrames(system, () => st.getVelocity(), reducedMotion);

  const layout = () => {
    system.resize();
    globe.resize();
    contact.resize();
  };
  layout();
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(layout, 120);
  });

  // Pause rendering when the tab is hidden.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) system.stop();
    else system.start();
  });

  // --- Preloader: assemble from noise into the silhouette ---
  const preloader = document.querySelector<HTMLElement>('.preloader')!;
  const introDuration = reducedMotion ? 0.8 : 2.8;
  gsap.to(preloader, { autoAlpha: 0, duration: 0.6, delay: 0.2 });
  gsap.to(system.state, {
    intro: 1,
    duration: introDuration,
    ease: reducedMotion ? 'none' : 'power2.inOut',
    onComplete: () => {
      document.body.classList.remove('is-loading');
      lenis?.start();
      ScrollTrigger.refresh();
    },
  });
  revealHero(reducedMotion, introDuration * 0.6);

  if (import.meta.env.DEV) {
    // Debug hook for the screenshot/verification script.
    Object.assign(window, { __portfolio: { system, tl, st, scrollFor, lenis } });
  }
}

init().catch((err) => {
  console.error(err);
  counter.textContent = 'Error';
});
