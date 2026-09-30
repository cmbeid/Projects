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

function seq(notes: readonly (readonly [freq: number, at: number, dur: number])[], type: OscillatorType, volume: number): void {
  for (const [f, at, dur] of notes) tone(f, f, dur, type, volume, at);
}

export const sfx = {
  fire: () => { hiss(0.18, 0.12, 1400); tone(220, 120, 0.15, 'sawtooth', 0.025); },
  water: () => tone(500, 1100, 0.1, 'sine', 0.06),
  electric: () => { tone(1400, 700, 0.08, 'square', 0.03); hiss(0.08, 0.08, 6000); },
  grass: () => tone(700, 500, 0.08, 'triangle', 0.06),
  ice: () => { tone(1800, 2400, 0.07, 'triangle', 0.04); tone(2600, 2000, 0.07, 'sine', 0.03, 0.03); },
  fighting: () => { tone(160, 60, 0.08, 'sine', 0.25); hiss(0.05, 0.12, 2500); },
  poison: () => { tone(300, 450, 0.06, 'sine', 0.06); tone(350, 520, 0.06, 'sine', 0.05, 0.05); },
  ground: () => { tone(90, 40, 0.25, 'sine', 0.3); hiss(0.2, 0.15, 400); },
  flying: () => hiss(0.12, 0.1, 3500),
  psychic: () => tone(600, 900, 0.18, 'sine', 0.05),
  bug: () => tone(320, 300, 0.09, 'sawtooth', 0.025),
  rock: () => { tone(140, 70, 0.14, 'square', 0.05); hiss(0.1, 0.12, 900); },
  ghost: () => tone(700, 250, 0.22, 'sine', 0.05),
  dragon: () => { tone(110, 90, 0.25, 'sawtooth', 0.05); tone(165, 130, 0.25, 'sawtooth', 0.035); },
  dark: () => tone(260, 130, 0.12, 'sawtooth', 0.04),
  steel: () => { tone(1200, 1150, 0.12, 'square', 0.025); tone(1800, 1750, 0.1, 'square', 0.015); },
  fairy: () => seq([[1568, 0, 0.08], [2093, 0.05, 0.1]], 'sine', 0.04),
  normal: () => tone(420, 260, 0.06, 'square', 0.03),
  superEffective: () => tone(900, 1300, 0.06, 'square', 0.03),
  faint: () => tone(500, 180, 0.2, 'square', 0.035),
  bossFaint: () => { hiss(0.8, 0.4, 700); tone(120, 40, 0.8, 'sine', 0.35); },
  leak: () => seq([[440, 0, 0.12], [330, 0.12, 0.2]], 'square', 0.08),
  waveStart: () => seq([[523, 0, 0.1], [784, 0.1, 0.18]], 'square', 0.05),
  bossStart: () => seq([[196, 0, 0.25], [185, 0.25, 0.25], [175, 0.5, 0.5]], 'sawtooth', 0.07),
  waveClear: () => seq([[659, 0, 0.08], [784, 0.08, 0.08], [1047, 0.16, 0.2]], 'square', 0.05),
  place: () => seq([[392, 0, 0.06], [587, 0.06, 0.1]], 'square', 0.05),
  sell: () => seq([[1319, 0, 0.06], [1047, 0.06, 0.1]], 'square', 0.04),
  coin: () => seq([[1976, 0, 0.05], [2637, 0.05, 0.12]], 'square', 0.03),
  levelUp: () => seq([[523, 0, 0.07], [659, 0.07, 0.07], [784, 0.14, 0.07], [1047, 0.21, 0.14]], 'square', 0.05),
  /** The evolution jingle: a rising trill that holds, then resolves. */
  evolve: () => {
    const notes: [number, number, number][] = [];
    for (let i = 0; i < 10; i += 1) notes.push([i % 2 ? 784 : 988 + i * 20, i * 0.11, 0.1]);
    notes.push([1047, 1.15, 0.12], [1319, 1.27, 0.12], [1568, 1.39, 0.3]);
    seq(notes, 'square', 0.045);
  },
  move: () => seq([[784, 0, 0.1], [988, 0.1, 0.1], [1175, 0.2, 0.1], [1568, 0.3, 0.3]], 'triangle', 0.08),
  throw: () => { hiss(0.25, 0.1, 3000); tone(400, 900, 0.25, 'sine', 0.04); },
  shake: () => tone(300, 200, 0.06, 'square', 0.07),
  caught: () => seq([[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.1], [1047, 0.3, 0.1], [784, 0.42, 0.08], [1047, 0.52, 0.35]], 'square', 0.06),
  breakFree: () => { hiss(0.12, 0.2, 2000); tone(600, 300, 0.12, 'square', 0.05); },
  powerup: () => seq([[660, 0, 0.1], [880, 0.07, 0.1], [1320, 0.14, 0.14]], 'square', 0.05),
  thunder: () => { hiss(0.6, 0.5, 5000); tone(80, 30, 0.6, 'sawtooth', 0.2); },
  quake: () => { hiss(1.1, 0.5, 300); tone(60, 30, 1, 'sine', 0.4); },
  stun: () => { tone(1500, 900, 0.18, 'square', 0.04); hiss(0.18, 0.12, 5000); },
  teleport: () => tone(400, 1600, 0.14, 'sine', 0.05),
  shiny: () => seq([[2093, 0, 0.08], [2637, 0.08, 0.08], [3136, 0.16, 0.14]], 'sine', 0.05),
  pickup: () => seq([[988, 0, 0.08], [1319, 0.08, 0.08], [1976, 0.16, 0.14]], 'square', 0.05),
  deny: () => tone(200, 160, 0.12, 'square', 0.05),
  win: () => seq([[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.12], [1047, 0.36, 0.4]], 'square', 0.07),
  lose: () => seq([[392, 0, 0.3], [330, 0.18, 0.3], [262, 0.36, 0.5]], 'triangle', 0.1),
  click: () => tone(800, 600, 0.04, 'square', 0.03),
  /** A short blip at the effects volume, for previewing the slider. */
  preview: () => tone(880, 880, 0.08, 'square', 0.06),
};
