import type { ParticleSystem } from '../particles/ParticleSystem';

const RING_RADIUS_VB = 82; // radius of #ring-path in the SVG viewBox (200 units wide)

/** Curved SVG text around the particle sphere. */
export function setupGlobe(system: ParticleSystem, sphereRadius: number, spin: number) {
  const panel = document.querySelector<HTMLElement>('.globe')!;
  const svg = panel.querySelector<SVGSVGElement>('.globe-ring')!;
  const rot = panel.querySelector<SVGGElement>('.globe-ring-rot')!;

  const resize = () => {
    const rPx = sphereRadius * system.pixelsPerWorldUnit() * system.scale;
    const size = ((rPx * 1.22) / RING_RADIUS_VB) * 200;
    svg.style.width = svg.style.height = `${size}px`;
  };

  system.onFrame((time) => {
    if (panel.style.visibility === 'hidden' || panel.style.visibility === '') return;
    // Rotate against the sphere so the words appear to orbit it.
    rot.setAttribute('transform', `rotate(${(-time * spin * 40) % 360})`);
  });

  return { resize };
}
