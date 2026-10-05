import type { MusicParams } from '../data/types';
import type { Mixer } from './index';

/**
 * The score: generative, unhurried, and never quite the same twice.
 *
 * Six layers, each scheduled a little ahead on the audio clock so timing
 * never drifts with the frame rate:
 *
 * - a **drone**, detuned voices on the root and a fifth (a tritone in the
 *   Spire, until something changes), breathing through a slowly moving filter;
 * - **pads**, three-note chords from the district's scale that swell in over
 *   seconds and fade over more;
 * - **bells**, sparse plucked notes walking the scale, now and then bent onto
 *   an uneasy interval;
 * - the **bustle**, a plucked ostinato on the chord tones: barely there at
 *   the camp, busy in the Market, mechanical in the Foundry, gone in the Spire;
 * - **surf**, a filtered-noise wash every half a minute or so, the sea on
 *   the shingle;
 * - and in the Spire, a **toll**: a bell far too deep to be a bell.
 *
 * Each district's `MusicParams` set the key, mode, pace, brightness, unease
 * and bustle. On a district change the drone crossfades and the next phrase
 * picks up the rest.
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
  private districtId = '';
  private drone: DroneVoice | null = null;
  private timer: number | null = null;
  private nextBeat = 0;
  private beat = 0;
  /** Scale degree the bell melody is currently on. */
  private degree = 0;
  private chordRoot = 0;
  private nextSurf = 0;
  private nextToll = 0;
  /** Notes scheduled so far; the browser check reads it to prove the score is running. */
  scheduled = 0;

  constructor(private readonly m: Mixer, params: MusicParams, districtId: string) {
    this.params = params;
    this.districtId = districtId;
  }

  start(): void {
    if (this.timer !== null) return;
    const t = this.m.ctx.currentTime + 0.1;
    this.nextBeat = t + 0.5;
    this.nextSurf = t + 8 + Math.random() * 10;
    this.nextToll = t + 10;
    this.drone = this.makeDrone(this.params, 6);
    this.timer = window.setInterval(() => this.schedule(), INTERVAL_MS);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    if (this.drone) this.releaseDrone(this.drone, 2);
    this.drone = null;
  }

  /** Moves to another district's sound. The drone crossfades; the rest follows at the next phrase. */
  setDistrict(params: MusicParams, districtId: string): void {
    if (districtId === this.districtId) return;
    this.districtId = districtId;
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
    if (this.nextSurf < horizon) {
      this.surf(this.nextSurf);
      this.nextSurf += 20 + Math.random() * 24;
    }
    if (this.params.toll && this.nextToll < horizon) {
      this.toll(this.nextToll);
      this.nextToll += 14 + Math.random() * 10;
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
    // The bustle: on and between the beats, a chord tone plucked short.
    for (const half of [0, 0.5]) {
      if (Math.random() >= p.bustle) continue;
      const tones = [this.chordRoot, this.chordRoot + 2, this.chordRoot + 4];
      const degree = tones[Math.floor(Math.random() * tones.length)]!;
      this.pluck(t + half * p.beat, this.noteOf(degree, half ? 1 : 0), 0.025 + 0.02 * p.bustle);
    }
  }

  /** A short plucked string: a triangle with a fast filter fall. */
  private pluck(t: number, note: number, peak: number): void {
    const { ctx } = this.m;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = midi(note);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(this.params.filter * 2, t);
    f.frequency.exponentialRampToValueAtTime(200, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(f).connect(g).connect(this.m.music);
    const send = ctx.createGain();
    send.gain.value = 0.3;
    g.connect(send).connect(this.m.reverb);
    o.start(t);
    o.stop(t + 0.4);
    this.scheduled += 1;
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

  /** The sea on the shingle: a slow wash in, a longer hiss out. */
  private surf(t: number): void {
    const { ctx } = this.m;
    const src = ctx.createBufferSource();
    src.buffer = this.m.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 0.7;
    f.frequency.setValueAtTime(300, t);
    f.frequency.linearRampToValueAtTime(1400, t + 2.2);
    f.frequency.linearRampToValueAtTime(500, t + 7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07 + this.params.unease * 0.12, t + 2.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 7.5);
    src.connect(f).connect(g).connect(this.m.music);
    const send = ctx.createGain();
    send.gain.value = 0.6;
    g.connect(send).connect(this.m.reverb);
    src.start(t);
    src.stop(t + 8);
    this.scheduled += 1;
  }

  /** A bell too deep to be a bell, somewhere under the Spire. */
  private toll(t: number): void {
    const { ctx } = this.m;
    const f = midi(this.params.root - 24);
    for (const [ratio, peak, decay] of [[1, 0.16, 9], [2.0, 0.06, 6], [2.76, 0.05, 5], [5.4, 0.02, 3]] as const) {
      const o = ctx.createOscillator();
      o.frequency.value = f * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g).connect(this.m.music);
      const send = ctx.createGain();
      send.gain.value = 0.8;
      g.connect(send).connect(this.m.reverb);
      o.start(t);
      o.stop(t + decay + 0.1);
    }
    this.scheduled += 1;
  }
}
