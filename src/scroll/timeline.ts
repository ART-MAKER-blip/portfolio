import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { ParticleSystem } from '../particles/ParticleSystem';

gsap.registerPlugin(ScrollTrigger);

/** Shape order — must match the array passed to ParticleSystem.setShapes(). */
export const SHAPE = { portrait: 0, globe: 1, map: 2, cdo: 3, ribbons: 4, cap: 5, network: 6, project: 7, wisp: 8, frame: 9 } as const;

/** How many viewport heights of scrolling one timeline unit takes. */
const SCREENS_PER_UNIT = 0.7; // half the scrolling per stage (the particles keep their own slow pace)

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
  // the name disintegrates like the portrait: each letter scatters upward, spins, blurs and fades
  hide($('.hero-title'), 0.3);
  hide($('.hero-hint'), 0.2, 0.2);
  tl.to(
    '.hero-intro .char',
    {
      x: () => (reduced ? 0 : gsap.utils.random(-180, 180)),
      y: () => (reduced ? 0 : gsap.utils.random(-260, -40)),
      rotation: () => (reduced ? 0 : gsap.utils.random(-70, 70)),
      opacity: 0,
      filter: reduced ? 'blur(0px)' : 'blur(9px)',
      duration: 0.5,
      ease: 'power2.in',
      stagger: { each: 0.014, from: 'random' },
    },
    0.25,
  );
  tl.set($('.hero'), { autoAlpha: 0 }, 1.0);
  morph(SHAPE.globe, 0.6);

  // 2. Globe
  show($('.globe'), 1.25);
  tl.addLabel('globe', 1.8);
  hide($('.globe'), 2.15);

  // 3. Location: the Philippines…
  morph(SHAPE.map, 2.3);
  show($('.location'), 2.95);
  tl.addLabel('location', 3.4);
  hide($('.location'), 3.65);

  // …then zoom into Mindanao: every particle flies outward from Cagayan de Oro and a pin drops on it
  morph(SHAPE.cdo, 3.7, 1.1);
  show($('.cdo'), 4.45);
  tl.addLabel('cdo', 4.95);
  hide($('.cdo'), 5.35);

  // 4. About me (the zoomed map dissolves into the ribbons)
  morph(SHAPE.ribbons, 5.45);
  show($('.approach'), 6.05);
  tl.addLabel('approach', 6.65);
  hide($('.approach'), 7.3);

  // 5. Education & certifications
  morph(SHAPE.cap, 7.45);
  show($('.education'), 8.05);
  tl.addLabel('education', 8.65);
  hide($('.education'), 9.25);

  // 6. Skills
  morph(SHAPE.network, 9.4);
  show($('.skills'), 10.0);
  tl.addLabel('skills', 10.6);
  hide($('.skills'), 11.3);

  // 7. Featured project: preview image with a particle frame around it
  morph(SHAPE.project, 11.45);
  show($('.project'), 12.05);
  tl.addLabel('project', 12.7);
  hide($('.project'), 13.45);

  // 8. Areas of work: horizontal strip moves with scroll
  morph(SHAPE.wisp, 13.55, 0.8);
  tl.fromTo($('.works'), { autoAlpha: 0, y: reduced ? 0 : 80 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power2.out' }, 13.8);
  tl.fromTo(
    strip,
    { x: () => (reduced ? 0 : window.innerWidth * 0.25) },
    { x: () => -(strip.scrollWidth - window.innerWidth), duration: 3.0, ease: 'none' },
    13.8,
  );
  tl.addLabel('works', 15.3);
  hide($('.works'), 16.8, 0.35);

  // 9. Outro
  show($('.more'), 17.1, 0.3);
  tl.addLabel('more', 17.45);
  hide($('.more'), 17.7, 0.3);
  morph(SHAPE.frame, 17.8, 1.1);
  show($('.contact'), 18.5, 0.4);
  tl.addLabel('contact', 19.15);
  tl.to({}, { duration: 0.3 }, 19.15); // hold at the end

  tl.addLabel('hero', 0);

  const st = ScrollTrigger.create({
    trigger: stage,
    start: 'top top',
    end: () => `+=${window.innerHeight * tl.duration() * SCREENS_PER_UNIT}`,
    pin: true,
    scrub: reduced ? true : 0.6, // text and panels follow the scroll closely
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
