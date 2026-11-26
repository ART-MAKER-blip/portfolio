import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/** Lenis smooth scroll wired into GSAP's ticker. Returns null for reduced motion (native scroll). */
export function setupSmoothScroll(reduced: boolean): Lenis | null {
  if (reduced) return null;
  const lenis = new Lenis({ lerp: 0.06, wheelMultiplier: 0.7 }); // calmer, floatier wheel scrolling
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}
