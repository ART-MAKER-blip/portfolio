import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { ParticleSystem } from '../particles/ParticleSystem';

gsap.registerPlugin(ScrollTrigger);

/** Shape order — must match the array passed to ParticleSystem.setShapes(). */
export const SHAPE = { portrait: 0, globe: 1, map: 2, ribbons: 3, boxes: 4, cap: 5, network: 6, wisp: 7, frame: 8 } as const;

/** How many viewport heights of scrolling one timeline unit takes. */
const SCREENS_PER_UNIT = 0.85;

/**
 * One pinned master ScrollTrigger. The stage (100vh) is pinned while a
 * scrubbed timeline drives `system.state.progress` (the particle morph) and
 * every panel's in/out animation, including the horizontal works strip.
 */
export function buildTimeline(system: ParticleSystem, reduced: boolean) {
  const stage = document.querySelector<HTMLElement>('.stage')!;
  const bar = document.querySelector<HTMLElement>('.scroll-progress-bar')!;
  const strip = document.querySelector<HTMLElement>('.works-strip')!;
  const $ = (s: string) => document.querySelector<HTMLElement>(s)!;

  const dy = reduced ? 0 : 36;

  const tl = gsap.timeline({ defaults: { ease: 'none' } });

  const morph = (to: number, at: number, duration = 1) =>
    tl.to(system.state, { progress: to, duration, ease: 'none' }, at);
  const show = (el: HTMLElement, at: number, duration = 0.35) =>
    tl.fromTo(el, { autoAlpha: 0, y: dy }, { autoAlpha: 1, y: 0, duration, ease: 'power2.out' }, at);
  const hide = (el: HTMLElement, at: number, duration = 0.3) =>
    tl.to(el, { autoAlpha: 0, y: -dy, duration, ease: 'power2.in' }, at);

  // 1. Hero → globe
  tl.to(system.state, { parallaxWeight: 0, duration: 0.6 }, 0.3);
  hide($('.hero'), 0.45);
  morph(SHAPE.globe, 0.6);

  // 2. Globe
  show($('.globe'), 1.25);
  tl.addLabel('globe', 1.8);
  hide($('.globe'), 2.15);

  // 3. Location
  morph(SHAPE.map, 2.3);
  show($('.location'), 2.95);
  tl.addLabel('location', 3.45);
  hide($('.location'), 3.8);

  // 4. About (summary)
  morph(SHAPE.ribbons, 3.9);
  show($('.approach'), 4.5);
  tl.addLabel('approach', 5.1);
  hide($('.approach'), 5.75);

  // 5. Experience — longer copy, so it holds a little longer
  morph(SHAPE.boxes, 5.9);
  show($('.experience'), 6.5);
  tl.addLabel('experience', 7.15);
  hide($('.experience'), 7.95);

  // 6. Education & certifications
  morph(SHAPE.cap, 8.1);
  show($('.education'), 8.7);
  tl.addLabel('education', 9.3);
  hide($('.education'), 9.9);

  // 7. Skills
  morph(SHAPE.network, 10.05);
  show($('.skills'), 10.65);
  tl.addLabel('skills', 11.25);
  hide($('.skills'), 11.9);

  // 8. Areas of work — horizontal strip moves with scroll
  morph(SHAPE.wisp, 11.95, 0.8);
  tl.fromTo($('.works'), { autoAlpha: 0, y: reduced ? 0 : 80 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power2.out' }, 12.2);
  tl.fromTo(
    strip,
    { x: () => (reduced ? 0 : window.innerWidth * 0.25) },
    { x: () => -(strip.scrollWidth - window.innerWidth), duration: 3.0, ease: 'none' },
    12.2,
  );
  tl.addLabel('works', 13.7);
  hide($('.works'), 15.2, 0.35);

  // 9. Outro
  show($('.more'), 15.5, 0.3);
  tl.addLabel('more', 15.85);
  hide($('.more'), 16.1, 0.3);
  morph(SHAPE.frame, 16.2, 1.1);
  show($('.contact'), 16.9, 0.4);
  tl.addLabel('contact', 17.55);
  tl.to({}, { duration: 0.3 }, 17.55); // hold at the end

  tl.addLabel('hero', 0);

  const st = ScrollTrigger.create({
    trigger: stage,
    start: 'top top',
    end: () => `+=${window.innerHeight * tl.duration() * SCREENS_PER_UNIT}`,
    pin: true,
    scrub: reduced ? true : 0.6,
    animation: tl,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      bar.style.transform = `scaleY(${self.progress.toFixed(4)})`;
    },
  });

  /** Scroll position (px) of a timeline label — used by the verification script. */
  const scrollFor = (label: string) => st.start + (st.end - st.start) * (tl.labels[label] / tl.duration());

  return { tl, st, scrollFor };
}
