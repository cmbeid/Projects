import type { EraSong } from '../data/types';
import type { Mixer } from './index';
import { barSeconds, composeBar, stepSeconds, type Note, type Voice } from './song';

/**
 * The score. Each era's tune is composed a bar at a time (see `song.ts`)
 * and scheduled a little ahead on the audio clock, so timing never drifts
 * with the frame rate. A new era's tune starts at the top of its next bar,
 * and the room changes with it: the early eras play in a big stone hall of
 * reverb, the industrial ones dry, and space in a long, cold wash.
 */

const midi = (n: number): number => 440 * 2 ** ((n - 69) / 12);

const LOOKAHEAD = 1.2;
const INTERVAL_MS = 150;

const LEVEL: Record<Voice, number> = {
  flute: 0.12,
  reed: 0.06,
  pluck: 0.09,
  chant: 0.11,
  organ: 0.035,
  lead: 0.06,
  synth: 0.045,
  pad: 0.035,
  drone: 0.09,
  bass: 0.15,
  kick: 0.45,
  tom: 0.3,
  snare: 0.12,
  clap: 0.14,
  hat: 0.04,
  shaker: 0.05,
  clank: 0.05,
};

/** How much of each era goes to the reverb. */
const ROOM: Record<EraSong['ensemble'], number> = {
  stone: 0.5,
  bronze: 0.35,
  classical: 0.35,
  medieval: 0.6,
  renaissance: 0.25,
  industrial: 0.08,
  modern: 0.12,
  space: 0.75,
};

export class Music {
  private song: EraSong;
  private pending: EraSong | null = null;
  private night = false;
  private timer: number | null = null;
  private bar = 0;
  private nextBar = 0;
  private bus: GainNode | null = null;
  private send: GainNode | null = null;
  private readonly waves = new Map<number, PeriodicWave>();
  /** Notes scheduled so far; the browser check reads it to prove the score is running. */
  scheduled = 0;

  constructor(
    private readonly m: Mixer,
    song: EraSong,
  ) {
    this.song = song;
  }

  start(): void {
    if (this.timer !== null) return;
    const { ctx } = this.m;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.6;
    this.bus.connect(this.m.music);
    this.send = ctx.createGain();
    this.send.gain.value = ROOM[this.song.ensemble];
    this.bus.connect(this.send).connect(this.m.reverb);
    this.nextBar = ctx.currentTime + 0.15;
    this.timer = window.setInterval(() => this.schedule(), INTERVAL_MS);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    if (this.bus) this.bus.gain.setTargetAtTime(0, this.m.ctx.currentTime, 0.2);
  }

  setSong(song: EraSong): void {
    if (song === this.song) return;
    this.pending = song;
  }

  setNight(night: boolean): void {
    this.night = night;
  }

  private pulse(duty: number): PeriodicWave {
    const hit = this.waves.get(duty);
    if (hit) return hit;
    const n = 40;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    const wave = this.m.ctx.createPeriodicWave(real, imag);
    this.waves.set(duty, wave);
    return wave;
  }

  private schedule(): void {
    const { ctx } = this.m;
    if (ctx.state !== 'running' || !this.bus) return;
    if (this.nextBar < ctx.currentTime - 0.5) this.nextBar = ctx.currentTime + 0.05;
    while (this.nextBar < ctx.currentTime + LOOKAHEAD) {
      if (this.pending) {
        this.song = this.pending;
        this.pending = null;
        this.bar = 0;
        this.send?.gain.setTargetAtTime(ROOM[this.song.ensemble], this.nextBar, 0.5);
      }
      const step = stepSeconds(this.song);
      for (const n of composeBar(this.song, this.bar, this.night)) this.play(n, this.nextBar + n.step * step, n.len * step);
      this.nextBar += barSeconds(this.song);
      this.bar += 1;
    }
  }

  private play(n: Note, t: number, len: number): void {
    const v = LEVEL[n.voice] * n.vel;
    switch (n.voice) {
      case 'flute':
        this.tone(t, len, midi(n.midi), v, 'sine', { attack: 0.06, vibrato: 10, breath: true });
        break;
      case 'reed':
        this.tone(t, len, midi(n.midi), v, this.pulse(0.18), { attack: 0.02, vibrato: 8, cutoff: 2800 });
        break;
      case 'pluck':
        this.tone(t, Math.min(len, 0.6), midi(n.midi), v, this.pulse(0.3), { attack: 0.003, decay: true, cutoff: 3200 });
        break;
      case 'chant':
        this.tone(t, len, midi(n.midi), v, 'triangle', { attack: 0.12, vibrato: 6 });
        break;
      case 'organ':
        this.tone(t, len, midi(n.midi), v, this.pulse(0.5), { attack: 0.03, cutoff: 1800 });
        break;
      case 'lead':
        this.tone(t, len, midi(n.midi), v, this.pulse(0.5), { attack: 0.005, vibrato: 12 });
        break;
      case 'synth':
        this.tone(t, len, midi(n.midi), v, this.pulse(0.25), { attack: 0.005, detune: 9, cutoff: 4200 });
        break;
      case 'pad':
        this.tone(t, len, midi(n.midi), v, 'triangle', { attack: Math.min(1.2, len * 0.5), detune: 7, release: 0.8 });
        break;
      case 'drone':
        this.tone(t, len, midi(n.midi), v, 'triangle', { attack: 0.3, release: 0.3 });
        break;
      case 'bass':
        this.tone(t, len, midi(n.midi), v, 'triangle', { attack: 0.005 });
        break;
      case 'kick':
        this.drop(t, 160, 40, 0.13, v);
        break;
      case 'tom':
        this.drop(t, 140, 70, 0.22, v);
        break;
      case 'snare':
        this.noise(t, 0.12, 1500, 'highpass', v);
        break;
      case 'clap':
        for (const d of [0, 0.012, 0.024]) this.noise(t + d, 0.06, 1200, 'bandpass', v);
        break;
      case 'hat':
        this.noise(t, 0.03, 7500, 'highpass', v);
        break;
      case 'shaker':
        this.noise(t, 0.07, 5000, 'highpass', v);
        break;
      case 'clank':
        for (const f of [820, 1130, 1660]) this.tone(t, 0.06, f, v, 'square', { attack: 0.001, decay: true });
        break;
    }
    this.scheduled += 1;
  }

  private tone(
    t: number,
    len: number,
    freq: number,
    peak: number,
    wave: OscillatorType | PeriodicWave,
    o: { attack: number; decay?: boolean; vibrato?: number; detune?: number; cutoff?: number; release?: number; breath?: boolean },
  ): void {
    const { ctx } = this.m;
    const end = t + Math.max(0.04, len * 0.95);
    const release = o.release ?? 0.04;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + o.attack);
    if (o.decay) g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.02), end);
    else g.gain.setValueAtTime(peak, Math.max(t + o.attack, end - 0.01));
    g.gain.linearRampToValueAtTime(0, end + release);
    let out: AudioNode = g;
    if (o.cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.cutoff;
      g.connect(f);
      out = f;
    }
    out.connect(this.bus!);
    const oscs = o.detune ? [-o.detune, o.detune] : [0];
    for (const dt of oscs) {
      const osc = ctx.createOscillator();
      if (wave instanceof PeriodicWave) osc.setPeriodicWave(wave);
      else osc.type = wave;
      osc.frequency.value = freq;
      osc.detune.value = dt;
      if (o.vibrato && len > 0.25) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 5.2;
        const depth = ctx.createGain();
        depth.gain.setValueAtTime(0, t);
        depth.gain.linearRampToValueAtTime(o.vibrato, t + Math.min(0.4, len * 0.6));
        lfo.connect(depth).connect(osc.detune);
        lfo.start(t);
        lfo.stop(end + release + 0.05);
      }
      osc.connect(g);
      osc.start(t);
      osc.stop(end + release + 0.05);
    }
    if (o.breath) this.noise(t, Math.min(0.12, len), 2500, 'bandpass', peak * 0.6);
  }

  private drop(t: number, from: number, to: number, len: number, peak: number): void {
    const { ctx } = this.m;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + len * 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(this.bus!);
    o.start(t);
    o.stop(t + len + 0.02);
  }

  private noise(t: number, len: number, cutoff: number, type: BiquadFilterType, peak: number): void {
    const { ctx } = this.m;
    const src = ctx.createBufferSource();
    src.buffer = this.m.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f).connect(g).connect(this.bus!);
    src.start(t, Math.random() * 1.5);
    src.stop(t + len + 0.02);
  }
}
