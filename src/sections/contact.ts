import type { ParticleSystem } from '../particles/ParticleSystem';

/** Offset of `el` relative to `ancestor`, ignoring CSS transforms. */
export function layoutRect(el: HTMLElement, ancestor: HTMLElement) {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y, width: el.offsetWidth, height: el.offsetHeight };
}

/** Make the particle frame hug the email address. */
export function setupContact(system: ParticleSystem, frameName: string) {
  const stage = document.querySelector<HTMLElement>('.stage')!;
  const email = document.querySelector<HTMLElement>('.contact-email')!;
  document.querySelector('.footer-year')!.textContent = String(new Date().getFullYear());

  const resize = () => {
    const r = layoutRect(email, stage);
    const padX = Math.max(20, window.innerWidth * 0.03);
    const padY = Math.max(12, window.innerHeight * 0.018);
    system.fitFrameToRect(frameName, {
      x: r.x - padX,
      y: r.y - padY,
      width: r.width + padX * 2,
      height: r.height + padY * 2,
    });
  };

  return { resize };
}
