import { getMixer, type Mixer } from './index';

/**
 * Sound effects, all synthesised. Soft clicks for the menus, chirps and
 * crunches for landings, heavier thumps for the ship.
 */

const midi = (n: number): number => 440 * 2 ** ((n - 69) / 12);

function blip(m: Mixer, o: { freq: number; type?: OscillatorType; at?: number; peak?: number; len?: number; slide?: number; reverb?: boolean }): void {
  const t = m.ctx.currentTime + (o.at ?? 0);
  const len = o.len ?? 0.08;
  const osc = m.ctx.createOscillator();
  osc.type = o.type ?? 'triangle';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freq * o.slide), t + len);
  const g = m.ctx.createGain();
  const peak = o.peak ?? 0.12;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  osc.connect(g).connect(m.sfx);
  if (o.reverb) g.connect(m.reverb);
  osc.start(t);
  osc.stop(t + len + 0.02);
}

function hiss(m: Mixer, o: { at?: number; peak?: number; len?: number; cutoff?: number; type?: BiquadFilterType; to?: number }): void {
  const t = m.ctx.currentTime + (o.at ?? 0);
  const len = o.len ?? 0.08;
  const src = m.ctx.createBufferSource();
  src.buffer = m.noise;
  const f = m.ctx.createBiquadFilter();
  f.type = o.type ?? 'highpass';
  f.frequency.setValueAtTime(o.cutoff ?? 3000, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + len);
  const g = m.ctx.createGain();
  g.gain.setValueAtTime(o.peak ?? 0.15, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(f).connect(g).connect(m.sfx);
  src.start(t, Math.random() * 1.5);
  src.stop(t + len + 0.02);
}

function run(m: Mixer, notes: readonly number[], gap: number, o: { type?: OscillatorType; peak?: number; reverb?: boolean } = {}): void {
  notes.forEach((n, i) => blip(m, { freq: midi(n), at: i * gap, len: gap * 2.5, peak: o.peak ?? 0.09, type: o.type ?? 'triangle', reverb: o.reverb ?? true }));
}

function play(fn: (m: Mixer) => void): void {
  const m = getMixer();
  if (m) fn(m);
}

export const sfx = {
  click: (): void => play((m) => blip(m, { freq: 1100, len: 0.03, peak: 0.04, type: 'sine' })),
  deny: (): void => play((m) => blip(m, { freq: 220, len: 0.12, peak: 0.07, type: 'square', slide: 0.7 })),
  jump: (): void =>
    play((m) => {
      blip(m, { freq: 110, len: 0.7, peak: 0.12, type: 'sawtooth', slide: 6 });
      hiss(m, { type: 'bandpass', cutoff: 300, to: 4000, len: 0.7, peak: 0.12 });
      blip(m, { freq: 880, at: 0.6, len: 0.4, peak: 0.06, type: 'sine', reverb: true });
    }),
  event: (): void => play((m) => run(m, [69, 76, 74], 0.09, { type: 'sine', peak: 0.07 })),
  good: (): void => play((m) => run(m, [72, 76, 79], 0.07)),
  bad: (): void => play((m) => run(m, [64, 60, 55], 0.09, { type: 'square', peak: 0.05 })),
  story: (): void => play((m) => run(m, [62, 69, 74, 78, 81], 0.12, { type: 'sine', peak: 0.08 })),
  level: (): void => play((m) => run(m, [72, 76, 79, 84, 88], 0.06, { peak: 0.08 })),
  buy: (): void => play((m) => (blip(m, { freq: 1320, len: 0.05, peak: 0.06 }), blip(m, { freq: 1760, at: 0.05, len: 0.08, peak: 0.06 }))),
  craft: (): void => play((m) => (hiss(m, { type: 'bandpass', cutoff: 1800, len: 0.12, peak: 0.12 }), blip(m, { freq: 660, at: 0.1, len: 0.15, peak: 0.07 }))),
  upgrade: (): void =>
    play((m) => {
      for (let i = 0; i < 3; i++) hiss(m, { type: 'bandpass', cutoff: 900 + i * 300, at: i * 0.09, len: 0.06, peak: 0.18 });
      run(m, [67, 71, 74, 79], 0.08);
    }),
  laser: (enemy: boolean): void => play((m) => blip(m, { freq: enemy ? 900 : 1400, len: 0.18, peak: 0.07, type: 'sawtooth', slide: 0.25 })),
  missile: (): void => play((m) => (hiss(m, { type: 'lowpass', cutoff: 2000, to: 300, len: 0.35, peak: 0.14 }), blip(m, { freq: 180, len: 0.3, peak: 0.06, type: 'square', slide: 0.5 }))),
  ion: (): void => play((m) => blip(m, { freq: 600, len: 0.3, peak: 0.07, type: 'sine', slide: 3 })),
  hit: (): void => play((m) => (hiss(m, { type: 'lowpass', cutoff: 1200, to: 120, len: 0.3, peak: 0.25 }), blip(m, { freq: 90, len: 0.25, peak: 0.12, type: 'sine', slide: 0.5 }))),
  boom: (): void =>
    play((m) => {
      hiss(m, { type: 'lowpass', cutoff: 2400, to: 60, len: 1.2, peak: 0.35 });
      blip(m, { freq: 70, len: 1, peak: 0.2, type: 'sine', slide: 0.3 });
    }),
  shoot: (): void => play((m) => blip(m, { freq: 1600, len: 0.07, peak: 0.04, type: 'square', slide: 0.4 })),
  gather: (): void => play((m) => (hiss(m, { type: 'bandpass', cutoff: 2500, len: 0.05, peak: 0.1 }), blip(m, { freq: 520 + Math.random() * 200, len: 0.06, peak: 0.05 }))),
  pickup: (): void => play((m) => run(m, [79, 84], 0.05, { peak: 0.07 })),
  hurt: (): void => play((m) => blip(m, { freq: 260, len: 0.12, peak: 0.08, type: 'square', slide: 0.5 })),
  kill: (): void => play((m) => (hiss(m, { type: 'bandpass', cutoff: 800, len: 0.15, peak: 0.12 }), blip(m, { freq: 300, len: 0.15, peak: 0.06, slide: 0.4 }))),
  skill: (): void => play((m) => blip(m, { freq: 440, len: 0.3, peak: 0.08, type: 'sine', slide: 2, reverb: true })),
  liftoff: (): void => play((m) => (hiss(m, { type: 'bandpass', cutoff: 200, to: 2000, len: 1, peak: 0.2 }), blip(m, { freq: 80, len: 1, peak: 0.1, type: 'sawtooth', slide: 3 }))),
  warn: (): void => play((m) => (blip(m, { freq: 880, len: 0.1, peak: 0.06, type: 'square' }), blip(m, { freq: 880, at: 0.18, len: 0.1, peak: 0.06, type: 'square' }))),
};
