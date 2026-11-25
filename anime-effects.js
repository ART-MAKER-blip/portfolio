// Entrance + hover animations, powered by Anime.js v4 (https://animejs.com).
// A classic script that loads Anime.js with a dynamic import, so it also works when the
// page is opened straight from disk (file://), where module script files are blocked.
// If Anime.js can't load, the page simply shows without animation.
(async () => {
const root = document.documentElement;
let anime;
try {
  anime = await import('https://cdn.jsdelivr.net/npm/animejs@4.5.0/+esm');
} catch (err) {
  root.classList.remove('anim-pending');
  return;
}
const { animate, createTimeline, stagger, splitText, scrambleText, utils } = anime;

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const SECTION_ITEMS =
  '.about-card, .about-highlights > div, .job-card, .edu-card, .skill-group, .contact-meta, .contact-box .btn';

if (reduceMotion) {
  root.classList.remove('anim-pending');
} else {
  intro();
  sectionReveals();
  root.classList.remove('anim-pending');
}

if (finePointer && !reduceMotion) {
  hoverScramble('.site-nav a, .chip-list span, .brand');
  magneticButtons('.btn');
}

// ---------- Hero: name rises letter by letter, labels decode ----------
function intro() {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const name = splitText('.hero h1', { chars: { wrap: 'clip' } });
  const bits = hero.querySelectorAll('.role, .summary, .cta-row .btn, .mini-stats li, .scroll-hint');

  utils.set(name.chars, { y: '110%' });
  utils.set(bits, { opacity: 0, y: 20 });
  utils.set('.hero .eyebrow', { opacity: 0 });

  createTimeline({ defaults: { ease: 'outExpo', duration: 1000 } })
    .add('.hero .eyebrow', {
      opacity: 1,
      innerHTML: scrambleText({ chars: 'uppercase', cursor: '_' }),
    }, 0)
    .add(name.chars, { y: '0%', duration: 1200, delay: stagger(24) }, 150)
    .add(bits, { opacity: 1, y: 0, delay: stagger(70) }, 600)
    .add('.mini-stats strong', {
      innerHTML: scrambleText({ chars: 'uppercase' }),
      delay: stagger(120),
    }, 950);
}

// ---------- Sections: heading words rise, label decodes, content cascades ----------
function sectionReveals() {
  const sections = [...document.querySelectorAll('main .section')].map((section) => {
    const heading = section.querySelector('h2');
    const words = heading ? splitText(heading, { words: { wrap: 'clip' } }).words : [];
    const tag = section.querySelector('.section-tag');
    const items = section.querySelectorAll(SECTION_ITEMS);
    const chips = section.querySelectorAll('.chip-list span');

    utils.set(words, { y: '105%' });
    if (tag) utils.set(tag, { opacity: 0 });
    utils.set(items, { opacity: 0, y: 28 });
    utils.set(chips, { opacity: 0, scale: 0.92 });
    return { section, words, tag, items, chips };
  });

  const play = ({ words, tag, items, chips }) => {
    const tl = createTimeline({ defaults: { ease: 'outExpo', duration: 1000 } });
    if (tag) tl.add(tag, { opacity: 1, innerHTML: scrambleText({ chars: 'uppercase', cursor: '_' }) }, 0);
    if (words.length) tl.add(words, { y: '0%', duration: 1100, delay: stagger(60) }, 80);
    if (items.length) tl.add(items, { opacity: 1, y: 0, delay: stagger(90) }, 300);
    if (chips.length) tl.add(chips, { opacity: 1, scale: 1, duration: 600, delay: stagger(25) }, 500);
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      play(sections.find((s) => s.section === entry.target));
    });
  }, { rootMargin: '0px 0px -25% 0px' });

  sections.forEach((s) => observer.observe(s.section));
}

// ---------- Hover: text decodes like a terminal ----------
function hoverScramble(selector) {
  document.querySelectorAll(selector).forEach((el) => {
    let busy = false;
    el.addEventListener('mouseenter', () => {
      if (busy) return;
      busy = true;
      animate(el, {
        innerHTML: scrambleText({ settleDuration: 220 }),
        onComplete: () => { busy = false; },
      });
    });
  });
}

// ---------- Buttons lean toward the cursor and spring back ----------
function magneticButtons(selector) {
  document.querySelectorAll(selector).forEach((btn) => {
    btn.addEventListener('pointermove', (ev) => {
      const r = btn.getBoundingClientRect();
      const dx = ev.clientX - (r.left + r.width / 2);
      const dy = ev.clientY - (r.top + r.height / 2);
      animate(btn, { x: dx * 0.18, y: dy * 0.3, duration: 400, ease: 'outQuad' });
    });
    btn.addEventListener('pointerleave', () => {
      animate(btn, { x: 0, y: 0, duration: 900, ease: 'outElastic(1, .5)' });
    });
  });
}
})();
