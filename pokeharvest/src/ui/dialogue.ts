/**
 * Dialogue: a box along the bottom with the speaker's name and portrait.
 * Tap (or press Space) to move on. Lines queue up, so a story beat that
 * arrives while a menu is open waits its turn.
 */
import { sfx } from '../audio/index';
import { PALETTES, type PaletteId } from '../data/people';
import { personImage } from '../render/farmer';
import { h } from './dom';

export interface Say {
  name: string;
  palette: PaletteId | null;
  text: string;
}

let host: HTMLElement | null = null;
const queue: { lines: Say[]; done: () => void }[] = [];
let showing = false;

export function dialogueOpen(): boolean {
  return showing;
}

export function setDialogueHost(el: HTMLElement): void {
  host = el;
}

/** Show lines one after another; resolves once the last is dismissed. */
export function say(lines: Say[]): Promise<void> {
  return new Promise((done) => {
    queue.push({ lines, done });
    if (!showing) next();
  });
}

function portrait(palette: PaletteId): HTMLCanvasElement {
  const c = h('canvas', { className: 'talk-face pixel', width: 16, height: 16 });
  c.getContext('2d')!.drawImage(personImage(PALETTES[palette], 'down', 0), 0, 0);
  return c;
}

function next(): void {
  const job = queue.shift();
  if (!job || !host) {
    showing = false;
    return;
  }
  showing = true;
  let i = 0;
  const box = h('div.talk', { role: 'dialog', 'aria-live': 'polite' });
  const show = (): void => {
    const line = job.lines[i]!;
    box.replaceChildren(
      ...(line.palette ? [portrait(line.palette)] : []),
      h('div.talk-body', {}, line.name ? h('div.talk-name', {}, line.name) : null, h('div.talk-text', {}, line.text), h('div.talk-more', {}, i < job.lines.length - 1 ? '▼' : '✓')),
    );
  };
  const advance = (): void => {
    sfx.click();
    i += 1;
    if (i < job.lines.length) {
      show();
      return;
    }
    box.remove();
    window.removeEventListener('keydown', onKey);
    job.done();
    next();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') {
      e.preventDefault();
      advance();
    }
  };
  box.addEventListener('click', advance);
  window.addEventListener('keydown', onKey);
  show();
  host.append(box);
}
