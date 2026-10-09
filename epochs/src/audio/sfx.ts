import { getMixer, type Mixer } from './index';

/**
 * Sound effects. Soft and wooden for the everyday clicks, so that a city
 * clicked a hundred times an hour never grates; brighter for the moments
 * that matter — a new tech, a wonder, a new age.
 */

const midi = (n: number): number => 440 * 2 ** ((n - 69) / 12);

function blip(m: Mixer, o: { freq: number; type?: OscillatorType; at?: number; peak?: number; len?: number; slide?: number; reverb?: boolean }): void {
  const t = m.ctx.currentTime + (o.at ?? 0);
  const len = o.len ?? 0.08;
  const osc = m.ctx.createOscillator();
  osc.type = o.type ?? 'triangle';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.freq * o.slide, t + len);
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

function run(m: Mixer, notes: readonly number[], gap: number, o: { type?: OscillatorType; peak?: number; len?: number; at?: number; reverb?: boolean } = {}): void {
  notes.forEach((n, i) => blip(m, { freq: midi(n), at: (o.at ?? 0) + i * gap, len: o.len ?? gap * 2, peak: o.peak ?? 0.1, type: o.type ?? 'triangle', reverb: o.reverb ?? false }));
}

export function sfxClick(): void {
  const m = getMixer();
  if (!m) return;
  blip(m, { freq: 900, len: 0.03, peak: 0.05 });
}

/** A building going up: two knocks of a mallet and a little rise, higher the dearer it was. */
export function sfxBuild(price: number): void {
  const m = getMixer();
  if (!m) return;
  hiss(m, { type: 'bandpass', cutoff: 900, peak: 0.25, len: 0.05 });
  hiss(m, { type: 'bandpass', cutoff: 1100, peak: 0.2, len: 0.05, at: 0.1 });
  const lift = Math.min(10, Math.floor(Math.log10(1 + price)));
  const penta = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];
  run(m, [0, 2].map((k) => 64 + penta[Math.min(penta.length - 1, lift + k)]!), 0.07, { at: 0.18, peak: 0.08 });
}

export function sfxModernize(): void {
  const m = getMixer();
  if (!m) return;
  hiss(m, { type: 'lowpass', cutoff: 2500, to: 300, peak: 0.2, len: 0.25 });
  run(m, [67, 71, 74, 79], 0.05, { at: 0.15, peak: 0.07 });
}

export function sfxDemolish(): void {
  const m = getMixer();
  if (!m) return;
  hiss(m, { type: 'lowpass', cutoff: 2000, to: 120, peak: 0.35, len: 0.5 });
  blip(m, { freq: 140, slide: 0.4, len: 0.35, peak: 0.2 });
}

export function sfxAssign(up: boolean): void {
  const m = getMixer();
  if (!m) return;
  blip(m, { freq: up ? 660 : 440, len: 0.05, peak: 0.06 });
}

/** A new idea: a quick bright arpeggio with a shimmer. */
export function sfxResearch(): void {
  const m = getMixer();
  if (!m) return;
  run(m, [72, 76, 79, 84, 88], 0.06, { peak: 0.07, type: 'sine', reverb: true });
}

export function sfxWonderStage(): void {
  const m = getMixer();
  if (!m) return;
  blip(m, { freq: 110, len: 0.4, peak: 0.25, slide: 0.7 });
  run(m, [60, 67, 72], 0.1, { peak: 0.08, at: 0.1, reverb: true });
}

export function sfxWonderDone(): void {
  const m = getMixer();
  if (!m) return;
  run(m, [60, 64, 67, 72, 76, 79, 84], 0.09, { peak: 0.08, reverb: true });
  for (const n of [48, 55, 60]) blip(m, { freq: midi(n), len: 1.4, peak: 0.12, at: 0.63, reverb: true });
}

/** A new age: a slow fanfare that hangs in the air. */
export function sfxEra(): void {
  const m = getMixer();
  if (!m) return;
  const notes = [55, 60, 64, 67, 72];
  notes.forEach((n, i) => blip(m, { freq: midi(n), at: i * 0.18, len: 1.2, peak: 0.1, type: 'sawtooth', reverb: true }));
  for (const n of [36, 43, 48]) blip(m, { freq: midi(n), at: 0.9, len: 2.4, peak: 0.15, reverb: true });
  hiss(m, { type: 'lowpass', cutoff: 200, to: 4000, peak: 0.1, len: 1.2 });
}

export function sfxFestival(): void {
  const m = getMixer();
  if (!m) return;
  run(m, [74, 78, 81, 78, 83, 81, 78, 74, 76, 78, 81, 86], 0.075, { peak: 0.06, type: 'square', len: 0.07 });
  [0, 4, 8].forEach((i) => hiss(m, { at: i * 0.075, cutoff: 1200, type: 'bandpass', peak: 0.18, len: 0.06 }));
}

/** The Chronicle opens: a page turning and a two-note question. */
export function sfxChronicle(): void {
  const m = getMixer();
  if (!m) return;
  hiss(m, { type: 'bandpass', cutoff: 3000, to: 1200, peak: 0.12, len: 0.18 });
  run(m, [69, 74], 0.16, { at: 0.12, peak: 0.08, type: 'sine', reverb: true });
}

export function sfxAnswer(): void {
  const m = getMixer();
  if (!m) return;
  run(m, [74, 69], 0.1, { peak: 0.06, type: 'sine' });
}

export function sfxBorn(): void {
  const m = getMixer();
  if (!m) return;
  blip(m, { freq: midi(88 + Math.floor(Math.random() * 3) * 2), len: 0.08, peak: 0.025, type: 'sine' });
}

export function sfxWarn(): void {
  const m = getMixer();
  if (!m) return;
  blip(m, { freq: 220, len: 0.25, peak: 0.1, type: 'square', slide: 0.8 });
}

/** The colony ship lifting off: a long rising roar and a chord that keeps climbing. */
export function sfxLaunch(): void {
  const m = getMixer();
  if (!m) return;
  hiss(m, { type: 'lowpass', cutoff: 120, to: 6000, peak: 0.4, len: 3.5 });
  blip(m, { freq: 55, slide: 8, len: 3.5, peak: 0.2, type: 'sawtooth' });
  run(m, [60, 64, 67, 72, 76, 79, 84, 88, 91, 96], 0.25, { at: 1, peak: 0.07, type: 'sine', len: 1, reverb: true });
}
