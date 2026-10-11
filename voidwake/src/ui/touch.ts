import type { AwayInput } from '../game/away/sim';

/**
 * The thumb controls for landings: a floating stick that appears wherever
 * the left thumb lands, and hold-to-act buttons. On a keyboard, WASD or the
 * arrows move, Space acts, E uses the skill, Q drinks air, R uses a medkit,
 * and Enter lifts off.
 */
export class AwayControls {
  input: AwayInput = { mx: 0, my: 0, act: false, skill: false };
  private keys = new Set<string>();
  private stickId: number | null = null;
  private origin = { x: 0, y: 0 };
  private stickEl: HTMLElement | null = null;
  onKey: ((k: 'o2' | 'medkit' | 'liftoff') => void) | null = null;

  constructor() {
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      this.keys.add(e.key.toLowerCase());
      if (e.key === ' ') e.preventDefault();
      const k = e.key.toLowerCase();
      if (k === 'q') this.onKey?.('o2');
      if (k === 'r') this.onKey?.('medkit');
      if (k === 'enter') this.onKey?.('liftoff');
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  bind(zone: HTMLElement, stick: HTMLElement, act: HTMLElement, skill: HTMLElement): void {
    this.stickEl = stick;
    stick.style.display = 'none';
    zone.addEventListener('pointerdown', (e) => {
      if (this.stickId !== null) return;
      this.stickId = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      const r = zone.getBoundingClientRect();
      this.origin = { x: e.clientX, y: e.clientY };
      stick.style.display = 'block';
      stick.style.left = `${e.clientX - r.left}px`;
      stick.style.top = `${e.clientY - r.top}px`;
      this.moveStick(e.clientX, e.clientY);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.stickId) this.moveStick(e.clientX, e.clientY);
    });
    const end = (e: PointerEvent): void => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      this.input.mx = 0;
      this.input.my = 0;
      stick.style.display = 'none';
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    const hold = (el: HTMLElement, key: 'act' | 'skill'): void => {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        this.input[key] = true;
      });
      const up = (): void => {
        this.input[key] = false;
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    };
    hold(act, 'act');
    hold(skill, 'skill');
  }

  private moveStick(x: number, y: number): void {
    const max = 50;
    let dx = x - this.origin.x;
    let dy = y - this.origin.y;
    const d = Math.hypot(dx, dy);
    if (d > max) {
      dx = (dx / d) * max;
      dy = (dy / d) * max;
    }
    this.input.mx = dx / max;
    this.input.my = dy / max;
    const knob = this.stickEl?.querySelector('i') as HTMLElement | null;
    if (knob) knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  /** The stick, merged with the keyboard. */
  read(): AwayInput {
    let mx = this.input.mx;
    let my = this.input.my;
    const k = this.keys;
    if (k.has('a') || k.has('arrowleft')) mx -= 1;
    if (k.has('d') || k.has('arrowright')) mx += 1;
    if (k.has('w') || k.has('arrowup')) my -= 1;
    if (k.has('s') || k.has('arrowdown')) my += 1;
    return { mx, my, act: this.input.act || k.has(' ') || k.has('j'), skill: this.input.skill || k.has('e') || k.has('k') };
  }

  reset(): void {
    this.input = { mx: 0, my: 0, act: false, skill: false };
    this.stickId = null;
  }
}
