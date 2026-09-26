/**
 * Tiny synthesised sound effects. No audio files: every sound is a few
 * oscillators or a burst of noise, so there is nothing to download or license.
 *
 * Browsers only allow audio after a user gesture, so the context is created
 * lazily by `unlock`, which the first tap calls.
 */

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let muted = false;

export function setMuted(value: boolean): void {
  muted = value;
}

export function unlock(): void {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  try {
    ctx = new AudioContext();
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  } catch {
    ctx = null;
  }
}

function ready(): AudioContext | null {
  return muted || !ctx || ctx.state !== 'running' ? null : ctx;
}

function tone(freq: number, endFreq: number, duration: number, type: OscillatorType, volume: number, delay = 0): void {
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function hiss(duration: number, volume: number, cutoff: number): void {
  const ac = ready();
  if (!ac || !noise) return;
  const t = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = noise;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(t, Math.random() * 0.5);
  src.stop(t + duration);
}

export const sfx = {
  stretch: () => tone(180, 240, 0.12, 'triangle', 0.08),
  launch: () => {
    hiss(0.25, 0.25, 2500);
    tone(300, 900, 0.18, 'sine', 0.1);
  },
  thud: (strength: number) => tone(120, 50, 0.12, 'sine', Math.min(0.35, strength / 40)),
  crack: () => hiss(0.18, 0.3, 1800),
  faint: () => {
    tone(600, 200, 0.25, 'square', 0.06);
    hiss(0.3, 0.12, 900);
  },
  boom: () => {
    hiss(0.7, 0.6, 700);
    tone(90, 30, 0.6, 'sine', 0.4);
  },
  ability: () => tone(500, 1400, 0.15, 'sawtooth', 0.06),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.22, 'square', 0.07, i * 0.12)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, f * 0.97, 0.3, 'triangle', 0.1, i * 0.18)),
  click: () => tone(800, 600, 0.05, 'square', 0.04),
};
