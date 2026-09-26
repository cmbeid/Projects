/**
 * Sound: each Pokémon's cry, from `public/cries/`, the Game Boy music in
 * `./music.ts`, and tiny synthesised effects — a few oscillators or a burst of
 * noise — for everything else.
 *
 * Everything runs through one mixer:
 *
 *   effects ─┐
 *   cries   ─┼─ master (mute) ─ speakers
 *   music   ─┘
 *
 * so each has its own volume slider and mute silences the lot without
 * stopping anything, which keeps the music in time.
 *
 * Browsers only allow audio after a user gesture, so the context is created
 * lazily by `unlock`, which the first tap calls. Cries are downloaded ahead of
 * time but can only be decoded once that context exists.
 */
import { cryUrl } from '../data/species';

export type Bus = 'sfx' | 'cries' | 'music';
export type Volumes = Record<Bus, number>;

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let master: GainNode | null = null;
const buses: Partial<Record<Bus, GainNode>> = {};
let volumes: Volumes = { sfx: 80, cries: 70, music: 50 };
let muted = false;
const unlockListeners: (() => void)[] = [];

/** Downloaded, not yet decoded. */
const pendingCries = new Map<number, ArrayBuffer>();
const requestedCries = new Set<number>();
const cries = new Map<number, AudioBuffer>();

/** Slider position (0–100) to gain. Squared, so the middle of the slider sounds like the middle. */
export function sliderGain(value: number): number {
  const v = Math.min(100, Math.max(0, value)) / 100;
  return v * v;
}

export function setMuted(value: boolean): void {
  muted = value;
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02);
}

export function setVolumes(next: Volumes): void {
  volumes = { ...next };
  if (!ctx) return;
  for (const bus of ['sfx', 'cries', 'music'] as const) {
    buses[bus]?.gain.setTargetAtTime(sliderGain(volumes[bus]), ctx.currentTime, 0.02);
  }
}

/** Each bus's current gain, for checking the sliders do what they say. */
export function busGains(): Partial<Volumes> {
  return Object.fromEntries(Object.entries(buses).map(([k, node]) => [k, node.gain.value]));
}

/** The node a bus's sounds connect to, or null before audio is unlocked. */
export function busNode(bus: Bus): GainNode | null {
  return buses[bus] ?? null;
}

export function audioContext(): AudioContext | null {
  return ctx;
}

/** Run `fn` once audio is available: now if it already is. */
export function onUnlock(fn: () => void): void {
  if (ctx) fn();
  else unlockListeners.push(fn);
}

export function unlock(): void {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  try {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    for (const bus of ['sfx', 'cries', 'music'] as const) {
      const node = ctx.createGain();
      node.gain.value = sliderGain(volumes[bus]);
      node.connect(master);
      buses[bus] = node;
    }
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    decodeCries();
    for (const fn of unlockListeners.splice(0)) fn();
  } catch {
    ctx = null;
  }
}

/** Pause all sound while the page is hidden, and pick it back up after. */
export function suspend(hidden: boolean): void {
  if (!ctx) return;
  if (hidden) void ctx.suspend();
  else void ctx.resume();
}

/** Start downloading cries. Missing ones just fall back to synth sounds. */
export function loadCries(dexes: readonly number[]): void {
  for (const dex of dexes) {
    if (requestedCries.has(dex)) continue;
    requestedCries.add(dex);
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

function ready(bus: Bus): { ac: AudioContext; out: GainNode } | null {
  const out = buses[bus];
  return ctx && out && ctx.state === 'running' ? { ac: ctx, out } : null;
}

/**
 * Play a Pokémon's cry. `rate` below 1 plays it lower and slower. Returns
 * false when it could not play, so the caller can fall back to a synth sound.
 */
export function cry(dex: number, { rate = 1, volume = 0.5 }: { rate?: number; volume?: number } = {}): boolean {
  const buffer = cries.get(dex);
  if (!buffer) return false;
  const r = ready('cries');
  if (!r) return true; // suspended: nothing to fall back to either
  const src = r.ac.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  const gain = r.ac.createGain();
  gain.gain.value = volume;
  src.connect(gain).connect(r.out);
  src.start();
  return true;
}

function tone(freq: number, endFreq: number, duration: number, type: OscillatorType, volume: number, delay = 0): void {
  const r = ready('sfx');
  if (!r) return;
  const t = r.ac.currentTime + delay;
  const osc = r.ac.createOscillator();
  const gain = r.ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(r.out);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function hiss(duration: number, volume: number, cutoff: number): void {
  const r = ready('sfx');
  if (!r || !noise) return;
  const t = r.ac.currentTime;
  const src = r.ac.createBufferSource();
  src.buffer = noise;
  const filter = r.ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const gain = r.ac.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(filter).connect(gain).connect(r.out);
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
  item: () => [660, 880, 1320].forEach((f, i) => tone(f, f, 0.1, 'square', 0.05, i * 0.07)),
  pickup: () => [988, 1319, 1976].forEach((f, i) => tone(f, f, 0.12, 'square', 0.06, i * 0.08)),
  quake: () => {
    hiss(1.1, 0.5, 300);
    tone(60, 30, 1, 'sine', 0.4);
  },
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, f * 0.97, 0.3, 'triangle', 0.1, i * 0.18)),
  click: () => tone(800, 600, 0.05, 'square', 0.04),
  /** A short blip at the effects volume, for previewing the slider. */
  preview: () => tone(880, 880, 0.08, 'square', 0.06),
};
