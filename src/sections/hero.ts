import { gsap } from 'gsap';

/** Fade the hero labels in once the preloader has assembled the silhouette. */
export function revealHero(reduced: boolean, delay = 0) {
  const items = document.querySelectorAll<HTMLElement>('.hero-name, .hero-title, .hero-hint');
  return gsap.fromTo(
    items,
    { autoAlpha: 0, y: reduced ? 0 : 12 },
    { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.08, delay },
  );
}

export function hideHeroForIntro() {
  gsap.set('.hero-name, .hero-title, .hero-hint', { autoAlpha: 0 });
}
