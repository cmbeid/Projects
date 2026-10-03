import type { MusicParams } from '../data/types';
import type { Mixer } from './index';

/**
 * The score: generative, slow, and never quite the same twice.
 *
 * Five layers, each scheduled a little ahead on the audio clock so timing
 * never drifts with the frame rate:
 *
 * - a **drone**, two detuned voices on the root and a fifth (a tritone in
 *   The Hollow), breathing through a slowly moving filter;
 * - **pads**, three-note chords from the biome's scale that swell in over
 *   seconds and fade over more;
 * - **bells**, sparse plucked notes walking the scale with long rests, now
 *   and then bent onto an uneasy interval;
 * - **breath**, a filtered-noise swell every half a minute or so, like air
 *   moving somewhere far below;
 * - and in the deepest places, a **heartbeat** that is not yours.
 *
 * Each biome's `MusicParams` set the key, mode, pace, murk and unease. On a
 * biome change the drone crossfades and the next phrase picks up the rest.
 */

const midi = (n: number): number => 440 * 2 ** ((n - 69) / 12);

interface DroneVoice {
  oscs: OscillatorNode[];
  lfo: OscillatorNode;
  out: GainNode;
}

const LOOKAHEAD = 0.8;
const INTERVAL_MS = 120;

export class Music {
  private params: MusicParams;
  private biomeId = '';
  private drone: DroneVoice | null = null;
  private timer: number | null = null;
  private nextBeat = 0;
  private beat = 0;
  /** Scale degree the bell melody is currently on. */
  private degree = 0;
  private chordRoot = 0;
  private nextBreath = 0;
  private nextHeart = 0;
  /** Notes scheduled so far; the browser check reads it to prove the score is running. */
  scheduled = 0;

  constructor(private readonly m: Mixer, params: MusicParams, biomeId: string) {
    this.params = params;
    this.biomeId = biomeId;
  }

  start(): void {
    if (this.timer !== null) return;
    const t = this.m.ctx.currentTime + 0.1;
    this.nextBeat = t + 0.5;
    this.nextBreath = t + 8 + Math.random() * 10;
    this.nextHeart = t + 12;
    this.drone = this.makeDrone(this.params, 6);
    this.timer = window.setInterval(() => this.schedule(), INTERVAL_MS);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    if (this.drone) this.releaseDrone(this.drone, 2);
    this.drone = null;
  }

  /** Moves to another biome's sound. The drone crossfades; the rest follows at the next phrase. */
  setBiome(params: MusicParams, biomeId: string): void {
    if (biomeId === this.biomeId) return;
    this.biomeId = biomeId;
    this.params = params;
    if (this.timer === null) return;
    if (this.drone) this.releaseDrone(this.drone, 6);
    this.drone = this.makeDrone(params, 8);
    this.degree = 0;
    this.chordRoot = 0;
  }

  private makeDrone(p: MusicParams, fadeIn: number): DroneVoice {
    const { ctx } = this.m;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.16, t + fadeIn);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = p.filter * 0.35;
    filter.Q.value = 2;
    // The filter breathes on a long cycle; the depth of it is the "wind".
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.035 + Math.random() * 0.02;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = p.filter * 0.18;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start(t);

    const oscs: OscillatorNode[] = [];
    const root = p.root - 24;
    for (const [note, type, detune, level] of [
      [root, 'sine', 0, 0.9],
      [root, 'triangle', 7, 0.35],
      [root + p.droneInterval, 'sine', -5, 0.4],
      [root + 12, 'triangle', 3, 0.12],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = midi(note);
      o.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = level;
      o.connect(g).connect(filter);
      o.start(t);
      oscs.push(o);
    }
    filter.connect(out);
    out.connect(this.m.music);
    const send = ctx.createGain();
    send.gain.value = 0.4;
    out.connect(send).connect(this.m.reverb);
    return { oscs, lfo, out };
  }

  private releaseDrone(d: DroneVoice, seconds: number): void {
    const t = this.m.ctx.currentTime;
    d.out.gain.cancelScheduledValues(t);
    d.out.gain.setValueAtTime(Math.max(0.0001, d.out.gain.value), t);
    d.out.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    for (const o of d.oscs) o.stop(t + seconds + 0.1);
    d.lfo.stop(t + seconds + 0.1);
  }

  private schedule(): void {
    const { ctx } = this.m;
    if (ctx.state !== 'running') return;
    const horizon = ctx.currentTime + LOOKAHEAD;
    // Catch up gracefully after a stall rather than firing a burst of notes.
    if (this.nextBeat < ctx.currentTime - 1) this.nextBeat = ctx.currentTime + 0.1;
    while (this.nextBeat < horizon) {
      this.onBeat(this.nextBeat);
      this.nextBeat += this.params.beat * (0.92 + Math.random() * 0.16);
      this.beat += 1;
    }
    if (this.nextBreath < horizon) {
      this.breath(this.nextBreath);
      this.nextBreath += 22 + Math.random() * 26;
    }
    if (this.params.unease >= 0.2 && this.nextHeart < horizon) {
      this.heartbeat(this.nextHeart);
      this.nextHeart += 7 + Math.random() * 6;
    }
  }

  private noteOf(degree: number, octave: number): number {
    const sc = this.params.scale;
    const len = sc.length;
    const o = Math.floor(degree / len);
    const i = ((degree % len) + len) % len;
    return this.params.root + 12 * (octave + o) + sc[i]!;
  }

  private onBeat(t: number): void {
    const p = this.params;
    // A new chord every eight beats.
    if (this.beat % 8 === 0) {
      const moves = [0, 3, 4, -2, 5, -3];
      this.chordRoot = (this.chordRoot + moves[Math.floor(Math.random() * moves.length)]!) % p.scale.length;
      this.pad(t, [this.chordRoot, this.chordRoot + 2, this.chordRoot + 4], p.beat * 8);
    }
    // Bells: mostly rests. The silence is half the music.
    if (Math.random() < 0.32) {
      const step = [-2, -1, -1, 1, 1, 2, 0, 3][Math.floor(Math.random() * 8)]!;
      this.degree = Math.max(-3, Math.min(9, this.degree + step));
      let note = this.noteOf(this.degree, 1);
      if (Math.random() < p.unease) note += Math.random() < 0.5 ? 1 : 6;
      this.bell(t, note, Math.random() < 0.2 ? 0.07 : 0.045);
      // Occasionally an answering note, an octave down and late.
      if (Math.random() < 0.25) this.bell(t + p.beat * 1.5, note - 12, 0.035);
    }
  }

  private pad(t: number, degrees: number[], length: number): void {
    const { ctx } = this.m;
    const p = this.params;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(p.filter * 0.5, t);
    filter.frequency.linearRampToValueAtTime(p.filter, t + length * 0.5);
    filter.frequency.linearRampToValueAtTime(p.filter * 0.4, t + length);
    const g = ctx.createGain();
    const attack = length * 0.35;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + attack);
    g.gain.setValueAtTime(0.05, t + length * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length * 1.25);
    filter.connect(g);
    g.connect(this.m.music);
    const send = ctx.createGain();
    send.gain.value = 0.9;
    g.connect(send).connect(this.m.reverb);
    for (const d of degrees) {
      for (const detune of [-8, 8]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midi(this.noteOf(d, 0));
        o.detune.value = detune;
        o.connect(filter);
        o.start(t);
        o.stop(t + length * 1.3);
        this.scheduled += 1;
      }
    }
  }

  /** A soft FM bell: a sine carrier with an inharmonic modulator that decays faster than it does. */
  private bell(t: number, note: number, peak: number): void {
    const { ctx } = this.m;
    const f = midi(note);
    const car = ctx.createOscillator();
    car.frequency.value = f;
    const mod = ctx.createOscillator();
    mod.frequency.value = f * 3.5;
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(f * 1.2, t);
    modGain.gain.exponentialRampToValueAtTime(f * 0.01, t + 1.2);
    mod.connect(modGain).connect(car.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
    car.connect(g).connect(this.m.music);
    const send = ctx.createGain();
    send.gain.value = 1.4;
    g.connect(send).connect(this.m.reverb);
    car.start(t);
    mod.start(t);
    car.stop(t + 3.6);
    mod.stop(t + 3.6);
    this.scheduled += 1;
  }

  private breath(t: number): void {
    const { ctx } = this.m;
    const src = ctx.createBufferSource();
    src.buffer = this.m.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 3;
    f.frequency.setValueAtTime(250, t);
    f.frequency.linearRampToValueAtTime(520, t + 2.5);
    f.frequency.linearRampToValueAtTime(200, t + 6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09 + this.params.unease * 0.15, t + 2.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 6.5);
    src.connect(f).connect(g).connect(this.m.music);
    const send = ctx.createGain();
    send.gain.value = 0.8;
    g.connect(send).connect(this.m.reverb);
    src.start(t);
    src.stop(t + 7);
    this.scheduled += 1;
  }

  /** Two low thumps, the second softer. Something large, asleep, far below. */
  private heartbeat(t: number): void {
    const { ctx } = this.m;
    for (const [at, peak] of [[0, 0.28], [0.32, 0.16]] as const) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(58, t + at);
      o.frequency.exponentialRampToValueAtTime(32, t + at + 0.3);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + at);
      g.gain.exponentialRampToValueAtTime(peak, t + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.45);
      o.connect(g).connect(this.m.music);
      o.start(t + at);
      o.stop(t + at + 0.5);
    }
    this.scheduled += 1;
  }
}
