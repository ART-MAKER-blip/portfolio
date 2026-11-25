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
const { animate, createTimeline, stagger, splitText, scrambleText, onScroll, utils } = anime;

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

if (reduceMotion) {
  root.classList.remove('anim-pending');
} else {
  intro();
  scrollRide();
  root.classList.remove('anim-pending');
}

if (finePointer && !reduceMotion) {
  hoverScramble('.chip-list span');
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

// ---------- Scroll ride: text slides in and out with the scroll position ----------
// Each element enters from one side (left, right or below), holds while it's in the
// middle of the screen, then carries on out the other side. Scrolling back reverses it.
function slideOnScroll(el, from) {
  const dx = from === 'left' ? -1 : from === 'right' ? 1 : 0;
  const dy = from === 'up' ? 1 : 0;
  const away = (k) => ({ x: `${dx * k * 38}vw`, y: `${dy * k * 24}vh` });
  animate(el, {
    keyframes: {
      '0%': { ...away(1), opacity: 0 },
      '30%': { x: '0vw', y: '0vh', opacity: 1 },
      '72%': { x: '0vw', y: '0vh', opacity: 1 },
      '100%': { ...away(-0.6), opacity: 0 },
    },
    ease: 'linear',
    autoplay: onScroll({ target: el, enter: 'bottom top', leave: 'top bottom', sync: 0.8 }),
  });
}

// run `fn` once, the first time `el` scrolls into view
function onFirstView(el, fn) {
  const io = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    io.disconnect();
    fn();
  }, { rootMargin: '0px 0px -20% 0px' });
  io.observe(el);
}

function scrollRide() {
  const cycle = ['left', 'up', 'right'];
  const each = (selector, dirs) =>
    document.querySelectorAll(selector).forEach((el, i) => slideOnScroll(el, dirs[i % dirs.length]));

  // the hero text drifts off to the left as you scroll away from it
  const hero = document.querySelector('.hero');
  if (hero) {
    animate('.hero-copy', {
      x: ['0vw', '-28vw'],
      opacity: [1, 0],
      ease: 'linear',
      autoplay: onScroll({ target: hero, enter: 'top top', leave: 'top bottom', sync: 0.8 }),
    });
  }

  each('.section .section-tag', ['left']);
  each('.section h2', ['right', 'left']);
  each('.about-card', ['up']);
  each('.about-highlights > div', cycle);
  each('.job-card', ['left', 'right']);
  each('.edu-card', ['right', 'left']);
  each('.skill-group', ['left', 'right']);
  each('.contact-meta', ['up']);

  // section labels decode the first time they arrive
  document.querySelectorAll('.section .section-tag').forEach((tag) => {
    onFirstView(tag, () => animate(tag, { innerHTML: scrambleText({ chars: 'uppercase', cursor: '_' }) }));
  });

  // skill tags pop in one after another
  document.querySelectorAll('.skill-group').forEach((group) => {
    const chips = group.querySelectorAll('.chip-list span');
    utils.set(chips, { opacity: 0, scale: 0.85 });
    onFirstView(group, () => animate(chips, {
      opacity: 1, scale: 1, duration: 600, ease: 'outBack', delay: stagger(40, { start: 250 }),
    }));
  });
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
