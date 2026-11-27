import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import 'lenis/dist/lenis.css';
import './style.css';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { config, reducedMotion, isMobile } from './particles/config';
import { ParticleSystem, type ShapeDef } from './particles/ParticleSystem';
import { loadImage, sampleImage, sphere, ribbons, wisp, frame, zoomMap } from './particles/shapes';
import { sampleSdf, robotBust, robotEyes, capModel, network3d } from './particles/models';
import { buildTimeline } from './scroll/timeline';
import { setupSmoothScroll } from './scroll/smooth';
import { hideHeroForIntro, revealHero, splitHeroName } from './sections/hero';
import { setupGlobe } from './sections/globe';
import { buildWorks, setupWavyFrames } from './sections/works';
import { setupContact } from './sections/contact';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

const base = import.meta.env.BASE_URL;
const ASSETS = {
  map: `${base}philippines.svg`, // rough outline of the Philippines
};
const SPHERE_RADIUS = 1.6;
/** On wide screens, shift the shapes of text-heavy stages to the empty side of the screen. */
const SIDE = isMobile ? 0 : 1;
/** On phones the long copy sits at the bottom, so lift those shapes into the top half. */
const LIFT = isMobile ? 1 : 0;

const counter = document.querySelector<HTMLElement>('.preloader-count')!;
const setLoad = (p: number) => (counter.textContent = `${Math.round(p * 100)}%`);

/** Let the browser paint (so the loading % updates) between heavy shape builds. */
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

async function init() {
  const canvas = document.querySelector<HTMLCanvasElement>('#webgl')!;
  const system = new ParticleSystem(canvas);
  system.resize();
  system.start(); // render the noise cloud while assets load
  splitHeroName();
  hideHeroForIntro();

  // --- Load assets & build the 3D models ---
  const steps = 6;
  let done = 0;
  const step = () => setLoad(++done / steps);
  const [mapImg] = await Promise.all([loadImage(ASSETS.map).then((v) => (step(), v)), document.fonts.ready.then(step)]);
  await nextFrame();

  const n = config.count;
  const ROBOT = 1.45;
  const robot = sampleSdf(robotBust, n, { min: [-1.7, -2.6, -0.85], max: [1.7, 1.45, 1.0], scale: ROBOT, offset: [0, -0.1, 0] });
  // pack the eyeballs densely so they glow
  robot.set(robotEyes(Math.floor(n * 0.035), ROBOT, [0, -0.1, 0]), Math.floor(n * 0.965) * 3);
  step();
  await nextFrame();

  const cap = sampleSdf(capModel, n, { min: [-1.2, -0.6, -1.2], max: [1.2, 0.6, 1.2], scale: 1.75, tiltX: 0.42 });
  step();
  await nextFrame();
  const map = sampleImage(mapImg, n, { height: 5.0, edgeBias: 0.55, edgeWidth: 2, depth: 0.45 });
  step();
  await nextFrame();
  // Cagayan de Oro (8.48° N, 124.65° E) in the map shape's world units. The map SVG uses
  // x = (lon − 116.8)·60, y = (21.2 − lat)·60, and sampleImage centres the islands' bounding
  // box (x 24…588, y 156…924) and scales its height to 5 units.
  const mapUnit = 5.0 / (924 - 156);
  const CDO: [number, number] = [((124.65 - 116.8) * 60 - 306) * mapUnit, -((21.2 - 8.48) * 60 - 540) * mapUnit];
  const cdo = zoomMap(map, CDO, 3.4, [-0.6 * SIDE, -0.35]);
  const network = network3d(n);
  step();

  const shapes: ShapeDef[] = [
    { name: 'robot', positions: robot, rotation: (t) => Math.sin(t * 0.22) * 0.22, offset: [1.65 * SIDE, 0.9 * LIFT, 0] }, // right of the name (lifted above it on phones)
    { name: 'globe', positions: sphere(n, SPHERE_RADIUS), rotation: (t) => t * config.globeSpin },
    { name: 'map', positions: map, tilt: 0.7 },
    { name: 'cdo', positions: cdo, tilt: 0.5 },
    { name: 'ribbons', positions: ribbons(n), drift: 1, tilt: 0.4 },
    { name: 'cap', positions: cap, rotation: (t) => t * 0.14, offset: [-2.5 * SIDE, 0.1, 0] },
    { name: 'network', positions: network, rotation: (t) => t * 0.07, offset: [2.0 * SIDE, 2.4 * LIFT, 0] },
    { name: 'wisp', positions: wisp(n), drift: 0.8, alpha: 0.3, tilt: 0 },
    { name: 'frame', positions: frame(n, 5, 1.6), tilt: 0 },
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

  // --- Preloader: assemble from noise into the robot ---
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
  revealHero(reducedMotion, introDuration * 0.4);

  if (import.meta.env.DEV) {
    // Debug hook for the screenshot/verification script.
    Object.assign(window, { __portfolio: { system, tl, st, scrollFor, lenis } });
  }
}

init().catch((err) => {
  console.error(err);
  counter.textContent = 'Error';
});
