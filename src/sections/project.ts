import type { ParticleSystem } from '../particles/ParticleSystem';
import { layoutRect } from './contact';

/** Make the particle frame hug the featured project's preview image. */
export function setupProject(system: ParticleSystem, frameName: string) {
  const stage = document.querySelector<HTMLElement>('.stage')!;
  const media = document.querySelector<HTMLElement>('.project-media')!;

  const resize = () => {
    const r = layoutRect(media, stage);
    const pad = Math.max(10, window.innerWidth * 0.012);
    system.fitFrameToRect(frameName, { x: r.x - pad, y: r.y - pad, width: r.width + pad * 2, height: r.height + pad * 2 });
  };

  return { resize };
}
