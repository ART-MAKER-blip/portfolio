import type { ParticleSystem } from '../particles/ParticleSystem';
import { projects } from './data';

/** Build the horizontal strip of project cards. */
export function buildWorks() {
  const strip = document.querySelector<HTMLElement>('.works-strip')!;
  strip.innerHTML = projects
    .map(
      (p) => `
      <div class="card" style="--card-color:${p.color}">
        <div class="card-media">
          <div class="card-frame"></div>
          <img class="card-img" src="${p.image}" alt="${p.alt}" loading="lazy" width="800" height="600" />
        </div>
        <div class="card-meta"><span class="card-client">${p.client}</span><span class="card-year">${p.year}</span></div>
      </div>`,
    )
    .join('');
  return strip;
}

/**
 * Wavy card frames: one shared feTurbulence/feDisplacementMap filter whose
 * displacement scale follows scroll velocity.
 */
export function setupWavyFrames(system: ParticleSystem, getVelocity: () => number, reduced: boolean) {
  const panel = document.querySelector<HTMLElement>('.works')!;
  const disp = document.querySelector<SVGFEDisplacementMapElement>('#wavy feDisplacementMap')!;
  const turb = document.querySelector<SVGFETurbulenceElement>('#wavy feTurbulence')!;

  const REST = 4; // px of displacement when still
  const MAX = 42; // px at fast scroll
  let current = REST;
  let lastWritten = -1;

  system.onFrame((time, dt) => {
    if (panel.style.visibility !== 'visible' && panel.style.visibility !== 'inherit') return;
    const v = reduced ? 0 : Math.abs(getVelocity());
    const target = REST + Math.min(v / 55, MAX - REST);
    current += (target - current) * (1 - Math.exp(-dt * 7));
    if (Math.abs(current - lastWritten) > 0.15) {
      disp.setAttribute('scale', current.toFixed(2));
      lastWritten = current;
    }
    if (!reduced && current > REST + 0.5) {
      const fx = 0.012 + Math.sin(time * 0.9) * 0.002;
      const fy = 0.018 + Math.cos(time * 0.7) * 0.003;
      turb.setAttribute('baseFrequency', `${fx.toFixed(4)} ${fy.toFixed(4)}`);
    }
  });
}
