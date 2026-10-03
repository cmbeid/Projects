import { getMixer, type Mixer } from './index';

/**
 * Sound effects, each a few oscillators or a burst of noise shaped by an
 * envelope. Built fresh per play and left to be garbage collected; nothing
 * here lives longer than a couple of seconds.
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

/** The pick on rock. Pitch rises with the value of the ore, so a rich vein *sounds* rich. */
export function sfxHit(oreValue: number, crit: boolean): void {
  const m = getMixer();
  if (!m) return;
  // Frenzy can fire a dozen of these a second; thin them so they do not smear.
  const now = m.ctx.currentTime;
  if (now - lastHit < 0.045) return;
  lastHit = now;
  const base = 520 + Math.min(900, Math.log10(1 + oreValue) * 110);
  const f = base * (0.96 + Math.random() * 0.08);
  noise(m, { freq: 2600, q: 0.8, peak: 0.25, decay: 0.05 });
  tone(m, { freq: f, type: 'triangle', peak: 0.12, decay: 0.12 });
  tone(m, { freq: f * 2.76, peak: 0.05, decay: 0.08 });
  if (crit) {
    tone(m, { freq: f * 1.5, type: 'square', peak: 0.05, decay: 0.18, wet: 0.4 });
    noise(m, { freq: 5000, q: 2, peak: 0.12, decay: 0.12, wet: 0.3 });
  }
}

export function sfxBreak(seam: boolean): void {
  const m = getMixer();
  if (!m) return;
  noise(m, { type: 'lowpass', freq: 3000, to: 200, peak: 0.45, decay: seam ? 0.6 : 0.3 });
  tone(m, { freq: seam ? 90 : 130, glide: 0.4, peak: 0.4, decay: seam ? 0.7 : 0.25 });
  if (seam) {
    [0, 3, 7, 10].forEach((n, i) => tone(m, { freq: midi(74 + n), type: 'triangle', at: 0.08 + i * 0.07, peak: 0.07, decay: 1.4, wet: 0.8 }));
  }
}

export function sfxGem(): void {
  const m = getMixer();
  if (!m) return;
  [0, 7, 12, 19].forEach((n, i) =>
    tone(m, { freq: midi(81 + n), type: 'sine', at: i * 0.06, peak: 0.09, decay: 1.2, wet: 0.9 }),
  );
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

export function sfxTick(): void {
  const m = getMixer();
  if (!m) return;
  tone(m, { freq: 1400, peak: 0.04, decay: 0.03 });
}

export function sfxLevel(): void {
  const m = getMixer();
  if (!m) return;
  // Minor with an added ninth: a fanfare that does not quite trust itself.
  [0, 3, 7, 14, 15].forEach((n, i) => tone(m, { freq: midi(67 + n), type: 'triangle', at: i * 0.09, peak: 0.09, decay: 0.9, wet: 0.7 }));
}

export function sfxCraft(): void {
  const m = getMixer();
  if (!m) return;
  for (const [ratio, peak] of [[1, 0.14], [2.41, 0.08], [3.93, 0.05], [5.4, 0.03]] as const) {
    tone(m, { freq: 380 * ratio, peak, decay: 0.9, wet: 0.5 });
  }
  noise(m, { freq: 4000, q: 1, peak: 0.2, decay: 0.05 });
}

export function sfxSmelt(): void {
  const m = getMixer();
  if (!m) return;
  noise(m, { freq: 900, to: 400, q: 0.7, peak: 0.08, attack: 0.08, decay: 0.5 });
}

export function sfxSkill(id: string): void {
  const m = getMixer();
  if (!m) return;
  if (id === 'power' || id === 'dynamite') {
    noise(m, { freq: 300, to: 2400, q: 1.2, peak: 0.25, attack: 0.12, decay: 0.12 });
    tone(m, { freq: 70, glide: 0.5, at: 0.18, peak: 0.6, decay: 0.6 });
    noise(m, { type: 'lowpass', freq: 1800, to: 120, at: 0.18, peak: 0.5, decay: 0.7, wet: 0.4 });
  } else if (id === 'dowse') {
    for (let i = 0; i < 8; i++) tone(m, { freq: midi(76 + [0, 2, 3, 7, 10, 12, 14, 19][i]!), at: i * 0.05, peak: 0.05, decay: 1.5, wet: 1 });
  } else {
    noise(m, { freq: 600, to: 3000, q: 3, peak: 0.2, attack: 0.3, decay: 0.4, wet: 0.3 });
  }
}

export function sfxMission(): void {
  const m = getMixer();
  if (!m) return;
  [0, 5, 10].forEach((n, i) => tone(m, { freq: midi(72 + n), type: 'sine', at: i * 0.14, peak: 0.12, decay: 1.6, wet: 0.9 }));
}

export function sfxDescent(): void {
  const m = getMixer();
  if (!m) return;
  noise(m, { type: 'lowpass', freq: 400, to: 60, peak: 0.6, attack: 0.4, decay: 3.5, wet: 0.6 });
  tone(m, { freq: 55, glide: 0.5, peak: 0.5, attack: 0.3, decay: 3.5 });
  [0, 1, 6, 7].forEach((n, i) => tone(m, { freq: midi(60 + n), at: 1 + i * 0.4, peak: 0.05, attack: 0.5, decay: 3, wet: 1 }));
}
