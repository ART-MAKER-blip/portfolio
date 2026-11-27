import type { ParticleSystem } from '../particles/ParticleSystem';

/**
 * Make the hero laptop interactive:
 * - the code on screen types itself out, line by line, then clears and starts again;
 * - typing on your real keyboard presses the matching key on the particle keyboard
 *   and adds code to the screen (auto-typing pauses while you type);
 * - clicking sends a quick burst of key presses.
 */

// The particle keyboard: 5 rows × 13 keys, rows from the back (next to the screen) to the front.
const LAYOUT: string[][] = [
  ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', 'backspace'],
  ['tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']'],
  ['capslock', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'", 'enter'],
  ['shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', 'arrowup', 'shift'],
  ['control', 'alt', 'meta', ' ', ' ', ' ', ' ', ' ', ' ', ' ', 'arrowleft', 'arrowdown', 'arrowright'],
];
const KEYMAP = new Map<string, number[]>();
LAYOUT.forEach((row, r) =>
  row.forEach((name, c) => {
    const list = KEYMAP.get(name) ?? [];
    list.push(r * 13 + c);
    KEYMAP.set(name, list);
  }),
);
// shifted characters land on the same key as their base character
const SHIFTED: Record<string, string> = {
  '~': '`', '!': '1', '@': '2', '#': '3', $: '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0',
  _: '-', '+': '=', '{': '[', '}': ']', ':': ';', '"': "'", '<': ',', '>': '.', '?': '/', '=': '-',
};

const SCREEN_TIME = 7; // seconds to auto-type a full screen
const FULL = 1.2; // past this the screen is "full" and clears
const PER_KEY = 0.014; // code added per real keystroke

export function setupLaptop(system: ParticleSystem, reduced: boolean) {
  const { laptop } = system;
  laptop.typed = reduced ? FULL : 0;
  let lastUserKey = -Infinity;
  let now = 0;

  const heroShown = () => system.state.progress < 0.5 && !document.body.classList.contains('is-loading');

  const press = (indices: number[]) => {
    for (const i of indices) laptop.keys[i] = 1;
  };
  const addCode = (amount: number) => {
    laptop.typed += amount;
    if (laptop.typed > FULL) laptop.typed = 0; // screen full: clear and keep coding
  };

  window.addEventListener('keydown', (e) => {
    if (!heroShown()) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
    const indices = KEYMAP.get(k) ?? KEYMAP.get(SHIFTED[e.key] ?? '') ?? [(Math.random() * 65) | 0];
    press(indices);
    lastUserKey = now;
    if (!reduced) addCode(PER_KEY);
  });

  window.addEventListener('click', (e) => {
    if (!heroShown() || (e.target as HTMLElement).closest('a, button')) return;
    lastUserKey = now;
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        press([(Math.random() * 65) | 0]);
        if (!reduced) addCode(PER_KEY * 1.5);
      }, i * 55);
    }
  });

  system.onFrame((time, dt) => {
    now = time;
    // keys spring back up
    for (let i = 0; i < 65; i++) if (laptop.keys[i] > 0) laptop.keys[i] = Math.max(0, laptop.keys[i] - dt * 5);
    // auto-typing, paused for a moment after you type
    if (!reduced && time - lastUserKey > 2.5) addCode(dt / SCREEN_TIME);
  });

  // tell desktop visitors they can type
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const hint = document.querySelector<HTMLElement>('.hero-hint');
    if (hint) hint.textContent = 'Scroll · or start typing';
  }
}
