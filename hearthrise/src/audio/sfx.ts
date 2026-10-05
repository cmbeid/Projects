import { getMixer, type Mixer } from './index';

/**
 * Sound effects in the same voice as the score: square and triangle blips
 * and short bursts of noise, the way a handheld would have made them. Built
 * fresh per play and left to be garbage collected; nothing here lives longer
 * than a second or two, and nothing goes through the reverb.
 */

const midi = (n: number): number => 440 * 2 ** ((n - 69) / 12);

function blip(
  m: Mixer,
  opts: { freq: number; type?: OscillatorType; at?: number; peak?: number; len?: number; slide?: number },
): void {
  const t = m.ctx.currentTime + (opts.at ?? 0);
  const len = opts.len ?? 0.08;
  const o = m.ctx.createOscillator();
  o.type = opts.type ?? 'square';
  o.frequency.setValueAtTime(opts.freq, t);
  if (opts.slide) o.frequency.exponentialRampToValueAtTime(opts.freq * opts.slide, t + len);
  const g = m.ctx.createGain();
  const peak = opts.peak ?? 0.08;
  g.gain.setValueAtTime(peak, t);
  g.gain.setValueAtTime(peak, t + len * 0.7);
  g.gain.linearRampToValueAtTime(0, t + len);
  o.connect(g).connect(m.sfx);
  o.start(t);
  o.stop(t + len + 0.02);
}

function hiss(m: Mixer, opts: { at?: number; peak?: number; len?: number; cutoff?: number; type?: BiquadFilterType; to?: number }): void {
  const t = m.ctx.currentTime + (opts.at ?? 0);
  const len = opts.len ?? 0.08;
  const src = m.ctx.createBufferSource();
  src.buffer = m.noise;
  const f = m.ctx.createBiquadFilter();
  f.type = opts.type ?? 'highpass';
  f.frequency.setValueAtTime(opts.cutoff ?? 3000, t);
  if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + len);
  const g = m.ctx.createGain();
  g.gain.setValueAtTime(opts.peak ?? 0.2, t);
  g.gain.linearRampToValueAtTime(0, t + len);
  src.connect(f).connect(g).connect(m.sfx);
  src.start(t, Math.random() * 1.5);
  src.stop(t + len + 0.02);
}

/** A run of square notes, `gap` seconds apart. */
function run(m: Mixer, notes: readonly number[], gap: number, opts: { type?: OscillatorType; peak?: number; len?: number; at?: number } = {}): void {
  notes.forEach((n, i) => blip(m, { freq: midi(n), at: (opts.at ?? 0) + i * gap, len: opts.len ?? gap * 0.9, peak: opts.peak ?? 0.07, type: opts.type ?? 'square' }));
}

let lastHit = 0;

/** The hammer: a click of noise and a short falling blip, higher for richer salvage. */
export function sfxHit(value: number, crit: boolean): void {
  const m = getMixer();
  if (!m) return;
  // The Festival swings eight times a second; thin them so they do not smear.
  const now = m.ctx.currentTime;
  if (now - lastHit < 0.05) return;
  lastHit = now;
  const f = (180 + Math.min(500, Math.log10(1 + value) * 60)) * (0.95 + Math.random() * 0.1);
  hiss(m, { cutoff: 2500, peak: 0.16, len: 0.04 });
  blip(m, { freq: f, slide: 0.5, len: 0.06, peak: 0.08 });
  if (crit) run(m, [84, 91], 0.04, { peak: 0.05 });
}

/** Rubble collapsing; a landmark comes down with a long rumble and a fanfare. */
export function sfxClear(landmark: boolean): void {
  const m = getMixer();
  if (!m) return;
  hiss(m, { type: 'lowpass', cutoff: 3000, to: 200, peak: 0.3, len: landmark ? 0.6 : 0.2 });
  if (landmark) {
    blip(m, { freq: 110, type: 'triangle', slide: 0.4, len: 0.5, peak: 0.25 });
    run(m, [72, 76, 79, 84], 0.07, { at: 0.3 });
    blip(m, { freq: midi(84), at: 0.58, len: 0.35, peak: 0.07 });
  }
}

export function sfxRelic(): void {
  const m = getMixer();
  if (!m) return;
  run(m, [88, 91, 96, 100], 0.045, { peak: 0.05 });
}

export function sfxCoin(): void {
  const m = getMixer();
  if (!m) return;
  blip(m, { freq: midi(83), len: 0.06, peak: 0.06 });
  blip(m, { freq: midi(88), at: 0.06, len: 0.16, peak: 0.06 });
}

export function sfxBuy(): void {
  const m = getMixer();
  if (!m) return;
  run(m, [72, 79], 0.05, { peak: 0.06 });
}

/** A building going up: two thuds and a little climb, higher the dearer the building. */
export function sfxPlace(price: number): void {
  const m = getMixer();
  if (!m) return;
  blip(m, { freq: 140, type: 'triangle', slide: 0.5, len: 0.1, peak: 0.25 });
  blip(m, { freq: 140, type: 'triangle', slide: 0.5, len: 0.1, peak: 0.2, at: 0.12 });
  const lift = Math.min(12, Math.floor(Math.log10(1 + price)));
  const penta = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33];
  run(m, [0, 2, 4].map((k) => 67 + penta[Math.min(penta.length - 1, lift + k)]!), 0.06, { at: 0.26, peak: 0.06 });
}

export function sfxDemolish(): void {
  const m = getMixer();
  if (!m) return;
  hiss(m, { type: 'lowpass', cutoff: 2000, to: 120, peak: 0.35, len: 0.5 });
  blip(m, { freq: 220, slide: 0.25, len: 0.4, peak: 0.08 });
}

export function sfxTick(): void {
  const m = getMixer();
  if (!m) return;
  blip(m, { freq: 1600, len: 0.02, peak: 0.03 });
}

/** The level-up jingle: up a major arpeggio, with the triangle underneath. */
export function sfxLevel(): void {
  const m = getMixer();
  if (!m) return;
  run(m, [72, 76, 79, 84, 88], 0.07, { peak: 0.06 });
  blip(m, { freq: midi(48), type: 'triangle', len: 0.4, peak: 0.2 });
  blip(m, { freq: midi(55), type: 'triangle', at: 0.28, len: 0.3, peak: 0.2 });
}

export function sfxCraft(): void {
  const m = getMixer();
  if (!m) return;
  for (const n of [76, 79, 83]) blip(m, { freq: midi(n), len: 0.25, peak: 0.04 });
  hiss(m, { cutoff: 6000, peak: 0.12, len: 0.05 });
}

/** The workshop: a saw stroke, as a chip would do it. */
export function sfxRefine(): void {
  const m = getMixer();
  if (!m) return;
  hiss(m, { type: 'bandpass', cutoff: 1500, to: 2800, peak: 0.06, len: 0.15 });
}

export function sfxEdict(id: string): void {
  const m = getMixer();
  if (!m) return;
  if (id === 'rush' || id === 'charge') {
    hiss(m, { type: 'lowpass', cutoff: 4000, to: 100, peak: 0.4, len: 0.45 });
    blip(m, { freq: 200, type: 'triangle', slide: 0.2, len: 0.4, peak: 0.3 });
  } else if (id === 'survey') {
    run(m, [79, 83, 86, 91, 95, 98], 0.05, { peak: 0.05, type: 'triangle' });
  } else {
    // The Festival: a quick reel.
    run(m, [74, 78, 81, 78, 83, 81, 78, 74, 76, 78, 81, 86], 0.07, { peak: 0.05 });
    [0, 4, 8].forEach((i) => hiss(m, { at: i * 0.07, cutoff: 1200, peak: 0.12, len: 0.05 }));
  }
}

export function sfxMission(): void {
  const m = getMixer();
  if (!m) return;
  run(m, [72, 76, 79], 0.09, { peak: 0.07 });
  blip(m, { freq: midi(84), at: 0.27, len: 0.4, peak: 0.07 });
}

/** The sea coming in over everything: a long wash of noise, and a slow fall down the scale. */
export function sfxTide(): void {
  const m = getMixer();
  if (!m) return;
  hiss(m, { type: 'lowpass', cutoff: 300, to: 3000, peak: 0.35, len: 1.6 });
  hiss(m, { type: 'lowpass', cutoff: 3000, to: 200, peak: 0.3, len: 1.8, at: 1.6 });
  run(m, [84, 83, 79, 76, 74, 72, 67, 64, 60], 0.2, { type: 'triangle', peak: 0.12, at: 0.4 });
}
