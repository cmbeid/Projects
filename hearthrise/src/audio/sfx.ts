import { getMixer, type Mixer } from './index';

/**
 * Sound effects, each a few oscillators or a burst of noise shaped by an
 * envelope. Built fresh per play and left to be garbage collected; nothing
 * here lives longer than a few seconds.
 */

const midi = (n: number): number => 440 * 2 ** ((n - 69) / 12);

function env(g: GainNode, t: number, peak: number, attack: number, decay: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone(
  m: Mixer,
  opts: { freq: number; type?: OscillatorType; at?: number; peak?: number; attack?: number; decay?: number; glide?: number; wet?: number },
): void {
  const t = m.ctx.currentTime + (opts.at ?? 0);
  const o = m.ctx.createOscillator();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(opts.freq, t);
  if (opts.glide) o.frequency.exponentialRampToValueAtTime(opts.freq * opts.glide, t + (opts.attack ?? 0.005) + (opts.decay ?? 0.2));
  const g = m.ctx.createGain();
  env(g, t, opts.peak ?? 0.2, opts.attack ?? 0.005, opts.decay ?? 0.2);
  o.connect(g).connect(m.sfx);
  if (opts.wet) {
    const w = m.ctx.createGain();
    w.gain.value = opts.wet;
    g.connect(w).connect(m.reverb);
  }
  o.start(t);
  o.stop(t + (opts.attack ?? 0.005) + (opts.decay ?? 0.2) + 0.05);
}

function noise(
  m: Mixer,
  opts: { at?: number; peak?: number; attack?: number; decay?: number; type?: BiquadFilterType; freq: number; to?: number; q?: number; wet?: number },
): void {
  const t = m.ctx.currentTime + (opts.at ?? 0);
  const src = m.ctx.createBufferSource();
  src.buffer = m.noise;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = m.ctx.createBiquadFilter();
  f.type = opts.type ?? 'bandpass';
  f.frequency.setValueAtTime(opts.freq, t);
  if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + (opts.attack ?? 0.005) + (opts.decay ?? 0.2));
  f.Q.value = opts.q ?? 1;
  const g = m.ctx.createGain();
  env(g, t, opts.peak ?? 0.3, opts.attack ?? 0.003, opts.decay ?? 0.15);
  src.connect(f).connect(g).connect(m.sfx);
  if (opts.wet) {
    const w = m.ctx.createGain();
    w.gain.value = opts.wet;
    g.connect(w).connect(m.reverb);
  }
  src.start(t, Math.random() * 1.5);
  src.stop(t + (opts.attack ?? 0.003) + (opts.decay ?? 0.15) + 0.05);
}

let lastHit = 0;

/** Hammer on old masonry. Pitch rises with the value of the salvage, so a rich heap *sounds* rich. */
export function sfxHit(value: number, crit: boolean): void {
  const m = getMixer();
  if (!m) return;
  // The Festival swings eight times a second; thin them so they do not smear.
  const now = m.ctx.currentTime;
  if (now - lastHit < 0.05) return;
  lastHit = now;
  const base = 320 + Math.min(700, Math.log10(1 + value) * 90);
  const f = base * (0.95 + Math.random() * 0.1);
  noise(m, { freq: 1800, q: 0.7, peak: 0.22, decay: 0.06 });
  tone(m, { freq: f, type: 'triangle', peak: 0.12, decay: 0.09, glide: 0.8 });
  tone(m, { freq: f * 0.5, peak: 0.1, decay: 0.07 });
  if (crit) {
    tone(m, { freq: f * 2, type: 'square', peak: 0.04, decay: 0.15, wet: 0.4 });
    noise(m, { type: 'lowpass', freq: 900, to: 200, peak: 0.25, decay: 0.2 });
  }
}

/** A heap of rubble collapsing; a landmark comes down with a rumble and a bright chord. */
export function sfxClear(landmark: boolean): void {
  const m = getMixer();
  if (!m) return;
  noise(m, { type: 'lowpass', freq: 2400, to: 160, peak: 0.42, decay: landmark ? 0.9 : 0.32 });
  noise(m, { freq: 3500, q: 0.6, peak: 0.08, at: 0.05, decay: 0.25 });
  if (landmark) {
    tone(m, { freq: 70, glide: 0.5, peak: 0.45, decay: 1.1 });
    [0, 4, 7, 12].forEach((n, i) => tone(m, { freq: midi(72 + n), type: 'triangle', at: 0.25 + i * 0.08, peak: 0.07, decay: 1.6, wet: 0.8 }));
  }
}

export function sfxRelic(): void {
  const m = getMixer();
  if (!m) return;
  [0, 4, 7, 12].forEach((n, i) => tone(m, { freq: midi(84 + n), at: i * 0.06, peak: 0.08, decay: 1.1, wet: 0.9 }));
}

export function sfxCoin(): void {
  const m = getMixer();
  if (!m) return;
  tone(m, { freq: midi(88), type: 'square', peak: 0.05, decay: 0.06 });
  tone(m, { freq: midi(95), type: 'square', at: 0.06, peak: 0.05, decay: 0.16 });
}

export function sfxBuy(): void {
  const m = getMixer();
  if (!m) return;
  tone(m, { freq: midi(72), type: 'triangle', peak: 0.1, decay: 0.08 });
  tone(m, { freq: midi(79), type: 'triangle', at: 0.05, peak: 0.1, decay: 0.15 });
}

/**
 * A building going up: a wooden thunk, two hammer taps, and a little
 * pentatonic figure that climbs higher the dearer the building.
 */
export function sfxPlace(price: number): void {
  const m = getMixer();
  if (!m) return;
  noise(m, { type: 'lowpass', freq: 700, to: 120, peak: 0.35, decay: 0.18 });
  tone(m, { freq: 110, glide: 0.6, peak: 0.25, decay: 0.2 });
  noise(m, { freq: 2200, q: 2, peak: 0.12, at: 0.12, decay: 0.04 });
  noise(m, { freq: 2400, q: 2, peak: 0.1, at: 0.24, decay: 0.04 });
  const lift = Math.min(12, Math.floor(Math.log10(1 + price)));
  const penta = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];
  [0, 2, 4].forEach((k, i) => tone(m, { freq: midi(67 + penta[Math.min(penta.length - 1, lift + k)]!), type: 'triangle', at: 0.35 + i * 0.07, peak: 0.07, decay: 0.7, wet: 0.6 }));
}

export function sfxDemolish(): void {
  const m = getMixer();
  if (!m) return;
  noise(m, { type: 'lowpass', freq: 1800, to: 90, peak: 0.45, decay: 0.7 });
  tone(m, { freq: 90, glide: 0.4, peak: 0.3, decay: 0.6 });
}

export function sfxTick(): void {
  const m = getMixer();
  if (!m) return;
  tone(m, { freq: 1300, peak: 0.04, decay: 0.03 });
}

export function sfxLevel(): void {
  const m = getMixer();
  if (!m) return;
  // A plain major arpeggio: the town band, slightly out of breath.
  [0, 4, 7, 12, 16].forEach((n, i) => tone(m, { freq: midi(67 + n), type: 'triangle', at: i * 0.08, peak: 0.09, decay: 0.8, wet: 0.6 }));
}

export function sfxCraft(): void {
  const m = getMixer();
  if (!m) return;
  for (const [ratio, peak] of [[1, 0.14], [2.41, 0.08], [3.93, 0.05], [5.4, 0.03]] as const) {
    tone(m, { freq: 420 * ratio, peak, decay: 0.9, wet: 0.5 });
  }
  noise(m, { freq: 4000, q: 1, peak: 0.2, decay: 0.05 });
}

/** The workshop: a saw stroke. */
export function sfxRefine(): void {
  const m = getMixer();
  if (!m) return;
  noise(m, { freq: 1400, to: 2600, q: 4, peak: 0.05, attack: 0.08, decay: 0.18 });
}

export function sfxEdict(id: string): void {
  const m = getMixer();
  if (!m) return;
  if (id === 'rush' || id === 'charge') {
    noise(m, { freq: 300, to: 2400, q: 1.2, peak: 0.25, attack: 0.12, decay: 0.12 });
    tone(m, { freq: 70, glide: 0.5, at: 0.18, peak: 0.6, decay: 0.6 });
    noise(m, { type: 'lowpass', freq: 1800, to: 120, at: 0.18, peak: 0.5, decay: 0.7, wet: 0.4 });
  } else if (id === 'survey') {
    for (let i = 0; i < 6; i++) tone(m, { freq: midi(79 + [0, 2, 4, 7, 9, 12][i]!), at: i * 0.07, peak: 0.05, decay: 1.4, wet: 1 });
  } else {
    // The Festival: a fiddle-ish reel, four bars of it at a gallop.
    const reel = [0, 4, 7, 4, 9, 7, 4, 2, 0, 4, 7, 12];
    reel.forEach((n, i) => tone(m, { freq: midi(74 + n), type: 'sawtooth', at: i * 0.09, peak: 0.035, decay: 0.12 }));
    reel.forEach((_, i) => i % 4 === 0 && noise(m, { freq: 180, q: 1, at: i * 0.09, peak: 0.25, decay: 0.08 }));
  }
}

export function sfxMission(): void {
  const m = getMixer();
  if (!m) return;
  [0, 4, 9].forEach((n, i) => tone(m, { freq: midi(72 + n), at: i * 0.14, peak: 0.12, decay: 1.5, wet: 0.9 }));
}

/** The sea coming in over everything: a long rising wash, then a low settling chord. */
export function sfxTide(): void {
  const m = getMixer();
  if (!m) return;
  noise(m, { type: 'lowpass', freq: 200, to: 1600, peak: 0.55, attack: 1.6, decay: 2.8, wet: 0.7 });
  noise(m, { freq: 3000, q: 0.5, peak: 0.12, attack: 1.4, decay: 2.2, wet: 0.5 });
  tone(m, { freq: 55, peak: 0.35, attack: 1, decay: 3.5 });
  [0, 7, 12, 16].forEach((n, i) => tone(m, { freq: midi(55 + n), at: 2 + i * 0.35, peak: 0.05, attack: 0.4, decay: 3, wet: 1 }));
}
