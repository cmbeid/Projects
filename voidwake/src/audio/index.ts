/**
 * The mixer. Everything is synthesised — there are no audio files — and runs
 * through one graph:
 *
 *   sfx   ─┐                 ┌─ dry ──────────┐
 *          ├─ (each voice) ──┤                ├─ master ─ compressor ─ out
 *   music ─┘                 └─ reverb send ──┘
 *
 * Browsers only allow sound after a user gesture, so the context is made
 * lazily by `unlock`, which the first tap calls.
 */

export type Bus = 'sfx' | 'music';

export interface Mixer {
  ctx: AudioContext;
  sfx: GainNode;
  music: GainNode;
  /** Send into the shared hall. Voices connect here as well as to their bus. */
  reverb: GainNode;
  noise: AudioBuffer;
}

let mixer: Mixer | null = null;
let master: GainNode | null = null;
let volumes: Record<Bus, number> = { sfx: 75, music: 55 };
let muted = false;
const readyListeners: ((m: Mixer) => void)[] = [];

/** Slider position (0–100) to gain. Squared, so the middle of the slider sounds like the middle. */
export function sliderGain(value: number): number {
  const v = Math.min(100, Math.max(0, value)) / 100;
  return v * v;
}

export function getMixer(): Mixer | null {
  return mixer;
}

export function onReady(fn: (m: Mixer) => void): void {
  if (mixer) fn(mixer);
  else readyListeners.push(fn);
}

function makeImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
  }
  return buf;
}

function makeNoise(ctx: AudioContext): AudioBuffer {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/** Creates the context on the first gesture. Safe to call on every tap. */
export function unlock(): void {
  if (mixer) {
    if (mixer.ctx.state === 'suspended') void mixer.ctx.resume();
    return;
  }
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  const ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);

  const hall = ctx.createConvolver();
  hall.buffer = makeImpulse(ctx, 4.5, 2.6);
  const wet = ctx.createGain();
  wet.gain.value = 0.55;
  hall.connect(wet).connect(master);
  const reverb = ctx.createGain();
  reverb.connect(hall);

  const sfx = ctx.createGain();
  sfx.gain.value = sliderGain(volumes.sfx);
  sfx.connect(master);
  const music = ctx.createGain();
  music.gain.value = sliderGain(volumes.music);
  music.connect(master);

  mixer = { ctx, sfx, music, reverb, noise: makeNoise(ctx) };
  if (ctx.state === 'suspended') void ctx.resume();
  for (const fn of readyListeners.splice(0)) fn(mixer);
}

export function setVolumes(next: Record<Bus, number>): void {
  volumes = { ...next };
  if (!mixer) return;
  const t = mixer.ctx.currentTime;
  mixer.sfx.gain.setTargetAtTime(sliderGain(volumes.sfx), t, 0.05);
  mixer.music.gain.setTargetAtTime(sliderGain(volumes.music), t, 0.3);
}

export function setMuted(value: boolean): void {
  muted = value;
  if (master && mixer) master.gain.setTargetAtTime(muted ? 0 : 1, mixer.ctx.currentTime, 0.05);
}

/** Pause everything when the page is hidden; the music scheduler stops with the clock. */
export function suspend(hidden: boolean): void {
  if (!mixer) return;
  if (hidden) void mixer.ctx.suspend();
  else void mixer.ctx.resume();
}
