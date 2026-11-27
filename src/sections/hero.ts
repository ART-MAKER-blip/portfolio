import { gsap } from 'gsap';

const rand = gsap.utils.random;

/** Split "Hi, I'm" and the name into one span per letter so each can drift like a particle. */
export function splitHeroName() {
  document.querySelectorAll<HTMLElement>('.hero-intro .word').forEach((word) => {
    const text = word.textContent ?? '';
    word.textContent = '';
    for (const ch of text) {
      const span = document.createElement('span');
      span.className = 'char';
      span.textContent = ch;
      span.setAttribute('aria-hidden', 'true');
      word.appendChild(span);
    }
  });
}

export function hideHeroForIntro() {
  gsap.set('.hero-title, .hero-hint', { autoAlpha: 0 });
  gsap.set('.hero-intro .char', { opacity: 0 });
}

/** The name settles out of a blurred scatter while the portrait assembles, then the labels fade in. */
export function revealHero(reduced: boolean, delay = 0) {
  const tl = gsap.timeline({ delay });
  tl.fromTo(
    '.hero-intro .char',
    {
      opacity: 0,
      x: () => (reduced ? 0 : rand(-140, 140)),
      y: () => (reduced ? 0 : rand(30, 180)),
      rotation: () => (reduced ? 0 : rand(-40, 40)),
      filter: reduced ? 'blur(0px)' : 'blur(10px)',
    },
    {
      opacity: 1,
      x: 0,
      y: 0,
      rotation: 0,
      filter: 'blur(0px)',
      duration: reduced ? 0.6 : 1.3,
      ease: 'power3.out',
      stagger: { each: 0.035, from: 'random' },
    },
  );
  tl.fromTo(
    '.hero-title, .hero-hint',
    { autoAlpha: 0, y: reduced ? 0 : 12 },
    { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.08 },
    0.6,
  );
  return tl;
}
