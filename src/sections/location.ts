import type { ParticleSystem } from '../particles/ParticleSystem';

/**
 * Pin the map labels to the particle map: "Philippines" beside the islands and
 * "Cagayan de Oro City" next to the location pin. Positions are given in the
 * particle field's world units and converted to CSS pixels on every resize.
 */
export function setupLocationLabels(
  system: ParticleSystem,
  mapLabelAt: [number, number],
  pinAt: [number, number],
) {
  const mapLabel = document.querySelector<HTMLElement>('.map-label')!;
  const pinLabel = document.querySelector<HTMLElement>('.pin-label')!;

  const place = (el: HTMLElement, [x, y]: [number, number]) => {
    const ppw = system.pixelsPerWorldUnit() * system.scale;
    el.style.left = `${window.innerWidth / 2 + x * ppw}px`;
    el.style.top = `${window.innerHeight / 2 - y * ppw}px`;
  };

  const resize = () => {
    place(mapLabel, mapLabelAt);
    place(pinLabel, pinAt);
  };

  return { resize };
}
