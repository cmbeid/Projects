/**
 * Sound: each Pokémon's cry, from `public/cries/`, plus tiny synthesised
 * effects — a few oscillators or a burst of noise — for everything else.
 *
 * Browsers only allow audio after a user gesture, so the context is created
 * lazily by `unlock`, which the first tap calls. Cries are downloaded at boot
 * but can only be decoded once that context exists.
 */
import { cryUrl } from './data/roster';

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let muted = false;

/** Downloaded, not yet decoded. */
const pendingCries = new Map<number, ArrayBuffer>();
const cries = new Map<number, AudioBuffer>();

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
    decodeCries();
  } catch {
    ctx = null;
  }
}

/** Start downloading cries. Missing ones just fall back to synth sounds. */
export function loadCries(dexes: readonly number[]): void {
  for (const dex of dexes) {
    fetch(cryUrl(dex))
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(String(response.status)))))
      .then((bytes) => {
        pendingCries.set(dex, bytes);
        decodeCries();
      })
      .catch(() => undefined);
  }
}

function decodeCries(): void {
  const ac = ctx;
  if (!ac) return;
  for (const [dex, bytes] of pendingCries) {
    pendingCries.delete(dex);
    ac.decodeAudioData(bytes).then((buffer) => cries.set(dex, buffer), () => undefined);
  }
}

/**
 * Play a Pokémon's cry. `rate` below 1 plays it lower and slower. Returns
 * false when it could not play, so the caller can fall back to a synth sound.
 */
export function cry(dex: number, { rate = 1, volume = 0.5 }: { rate?: number; volume?: number } = {}): boolean {
  const buffer = cries.get(dex);
  if (!buffer) return false;
  const ac = ready();
  if (!ac) return true; // muted or suspended: nothing to fall back to either
  const src = ac.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  const gain = ac.createGain();
  gain.gain.value = volume;
  src.connect(gain).connect(ac.destination);
  src.start();
  return true;
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
    hiss(0.25, 0.15, 2500);
    tone(300, 900, 0.18, 'sine', 0.06);
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
