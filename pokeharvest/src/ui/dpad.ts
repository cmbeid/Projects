/**
 * The on-screen d-pad: four directions and an A button (use the tile in
 * front of you). Hold a direction to keep walking, and slide your thumb
 * between directions. Its size, opacity and position are settings, and it
 * can be dragged anywhere in "Move d-pad" mode.
 */
import type { Dir } from '../game/model';
import type { DpadSettings } from '../state/save';
import { h } from './dom';

const SIZES = { S: 120, M: 150, L: 184 } as const;

export interface Dpad {
  el: HTMLElement;
  /** The direction held now, if any. */
  held(): Dir | null;
  apply(s: DpadSettings): void;
  /** Drag mode: the pad can be moved; `onDone` gets the new position. */
  editPosition(onDone: (x: number, y: number) => void): void;
}

export function createDpad(onAct: () => void): Dpad {
  let held: Dir | null = null;
  const pad = h('div.dpad-cross', { 'aria-label': 'Direction pad' });
  const buttons: Record<Dir, HTMLElement> = {
    up: h('div.dpad-btn.up', { 'aria-label': 'Up' }, '▲'),
    down: h('div.dpad-btn.down', { 'aria-label': 'Down' }, '▼'),
    left: h('div.dpad-btn.left', { 'aria-label': 'Left' }, '◀'),
    right: h('div.dpad-btn.right', { 'aria-label': 'Right' }, '▶'),
  };
  pad.append(buttons.up, buttons.left, h('div.dpad-hub'), buttons.right, buttons.down);
  const a = h('button.dpad-a', { 'aria-label': 'Use' }, 'A');
  const done = h('button.btn.primary.dpad-done', {}, 'Done');
  const el = h('div.dpad', {}, pad, a, done);

  /** The direction under a point: whichever arm of the cross it's nearest. */
  const dirAt = (e: PointerEvent): Dir | null => {
    const r = pad.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < r.width * 0.12) return held;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  };
  const set = (d: Dir | null): void => {
    held = d;
    for (const [k, b] of Object.entries(buttons)) b.classList.toggle('on', k === d);
  };
  let editing = false;
  pad.addEventListener('pointerdown', (e) => {
    if (editing) return;
    e.preventDefault();
    pad.setPointerCapture(e.pointerId);
    set(dirAt(e));
  });
  pad.addEventListener('pointermove', (e) => {
    if (!editing && pad.hasPointerCapture(e.pointerId)) set(dirAt(e));
  });
  const release = (): void => set(null);
  pad.addEventListener('pointerup', release);
  pad.addEventListener('pointercancel', release);
  a.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!editing) onAct();
  });

  let finish: ((x: number, y: number) => void) | null = null;
  // Drag the whole pad about in edit mode.
  el.addEventListener('pointerdown', (e) => {
    if (!editing || e.target === done) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    const start = { x: e.clientX, y: e.clientY, left: el.offsetLeft, top: el.offsetTop };
    const move = (m: PointerEvent): void => {
      const parent = el.parentElement!.getBoundingClientRect();
      const left = Math.max(0, Math.min(parent.width - el.offsetWidth, start.left + m.clientX - start.x));
      const top = Math.max(0, Math.min(parent.height - el.offsetHeight, start.top + m.clientY - start.y));
      el.style.left = `${(left / parent.width) * 100}%`;
      el.style.top = `${(top / parent.height) * 100}%`;
    };
    const up = (): void => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  });
  done.addEventListener('click', () => {
    editing = false;
    el.classList.remove('editing');
    const parent = el.parentElement!.getBoundingClientRect();
    finish?.((el.offsetLeft / parent.width) * 100, (el.offsetTop / parent.height) * 100);
  });

  return {
    el,
    held: () => held,
    apply: (s) => {
      el.hidden = !s.enabled;
      el.style.setProperty('--dpad', `${SIZES[s.size]}px`);
      el.style.opacity = String(s.opacity / 100);
      el.style.left = `${s.x}%`;
      el.style.top = `${s.y}%`;
    },
    editPosition: (onDone) => {
      editing = true;
      finish = onDone;
      el.hidden = false;
      el.style.opacity = '1';
      el.classList.add('editing');
    },
  };
}
