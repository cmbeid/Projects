import type { SongParams } from '../data/types';
import type { Mixer } from './index';
import { barSeconds, composeBar, stepSeconds, type Note } from './song';

/**
 * The score: a four-channel chip band, the way an old handheld would have
 * played a city builder. Two pulse waves (the lead and the arpeggio), a
 * triangle bass and a noise channel for drums — nothing else, no reverb, no
 * pads, no drones.
 *
 * Every district has its own tune (see `SongParams` and `song.ts`): a waltz
 * on the beach, a jig in the harbour, a march in the market, a machine in the
 * foundry, a slow thin hymn in the Spire, something muffled underwater, a
 * fast bright climb above the clouds and a polka on the far shore. Each bar
 * is composed and scheduled a little ahead on the audio clock, so timing
 * never drifts with the frame rate. A new district's tune starts at the top
 * of its next bar.
 */

const midi = (n: number): number => 440 * 2 ** ((n - 69) / 12);

/** Seconds of tune scheduled ahead of the clock. */
const LOOKAHEAD = 1.2;
const INTERVAL_MS = 150;

const LEVEL: Record<Note['ch'], number> = {
  lead: 0.1,
  harm: 0.05,
  bass: 0.16,
  kick: 0.5,
  snare: 0.14,
  hat: 0.05,
  clank: 0.05,
};

export class Music {
  private song: SongParams;
  private districtId: string;
  private pending: { song: SongParams; id: string } | null = null;
  private night = false;
  private timer: number | null = null;
  private bar = 0;
  private nextBar = 0;
  private bus: GainNode | null = null;
  private muffle: BiquadFilterNode | null = null;
  private echo: GainNode | null = null;
  private readonly waves = new Map<number, PeriodicWave>();
  /** Notes scheduled so far; the browser check reads it to prove the score is running. */
  scheduled = 0;

  constructor(private readonly m: Mixer, song: SongParams, districtId: string) {
    this.song = song;
    this.districtId = districtId;
  }

  start(): void {
    if (this.timer !== null) return;
    const { ctx } = this.m;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.55;
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = this.cutoff(this.song);
    this.bus.connect(this.muffle).connect(this.m.music);
    // A short slap-back on the lead only, the one bit of space a chip band gets.
    const delay = ctx.createDelay(1);
    delay.delayTime.value = stepSeconds(this.song) * 3;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    this.echo = ctx.createGain();
    this.echo.gain.value = 0.35;
    this.echo.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(this.bus);
    this.nextBar = ctx.currentTime + 0.15;
    this.timer = window.setInterval(() => this.schedule(), INTERVAL_MS);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    if (this.bus) this.bus.gain.setTargetAtTime(0, this.m.ctx.currentTime, 0.2);
  }

  /** Moves to another district's tune, from the top, at the next bar. */
  setDistrict(song: SongParams, districtId: string): void {
    if (districtId === this.districtId && !this.pending) {
      this.song = song;
      return;
    }
    this.pending = { song, id: districtId };
  }

  /** At night the band thins out to the arpeggio and the bass. */
  setNight(night: boolean): void {
    this.night = night;
  }

  private cutoff(song: SongParams): number {
    return song.muffle ? 9000 * (1 - song.muffle) + 400 : 16000;
  }

  /** A pulse wave of a given duty, built from its Fourier series and cached. */
  private pulseWave(duty: number): PeriodicWave {
    const hit = this.waves.get(duty);
    if (hit) return hit;
    const n = 48;
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
    // After a stall, pick up from now rather than firing a burst of bars.
    if (this.nextBar < ctx.currentTime - 0.5) this.nextBar = ctx.currentTime + 0.05;
    while (this.nextBar < ctx.currentTime + LOOKAHEAD) {
      if (this.pending) {
        this.song = this.pending.song;
        this.districtId = this.pending.id;
        this.pending = null;
        this.bar = 0;
        this.muffle?.frequency.setTargetAtTime(this.cutoff(this.song), this.nextBar, 0.3);
      }
      const step = stepSeconds(this.song);
      for (const n of composeBar(this.song, this.bar, this.night)) this.play(n, this.nextBar + n.step * step, n.len * step);
      this.nextBar += barSeconds(this.song);
      this.bar += 1;
    }
  }

  private play(n: Note, t: number, len: number): void {
    switch (n.ch) {
      case 'lead':
        this.tone(t, len, n.midi, LEVEL.lead * n.vel, this.pulseWave(this.song.duty), true);
        break;
      case 'harm':
        this.tone(t, len, n.midi, LEVEL.harm * n.vel, this.pulseWave(0.25), false);
        break;
      case 'bass':
        this.tone(t, len, n.midi, LEVEL.bass * n.vel, 'triangle', false);
        break;
      case 'kick':
        this.kick(t, LEVEL.kick * n.vel);
        break;
      case 'clank':
        for (const f of [820, 1130]) this.tone(t, 0.05, 0, LEVEL.clank * n.vel, this.pulseWave(0.5), false, f);
        break;
      default:
        this.noise(t, n.ch === 'snare' ? 0.11 : 0.03, n.ch === 'snare' ? 1400 : 7000, LEVEL[n.ch] * n.vel);
    }
    this.scheduled += 1;
  }

  /** One chip voice: hard attack, held, and cut off just short of the next note. */
  private tone(t: number, len: number, note: number, peak: number, wave: PeriodicWave | OscillatorType, lead: boolean, freq?: number): void {
    const { ctx } = this.m;
    const o = ctx.createOscillator();
    if (wave instanceof PeriodicWave) o.setPeriodicWave(wave);
    else o.type = wave;
    o.frequency.value = freq ?? midi(note);
    const g = ctx.createGain();
    const end = t + Math.max(0.03, len * 0.92);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.004);
    // The lead sags a little over a long note, like a cheap sound chip's envelope.
    if (lead) g.gain.linearRampToValueAtTime(peak * 0.7, end);
    else g.gain.setValueAtTime(peak, end - 0.01);
    g.gain.linearRampToValueAtTime(0, end + 0.01);
    if (lead && len > 0.3) {
      // Delayed vibrato on the long notes.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.5;
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(14, t + Math.min(0.35, len * 0.6));
      lfo.connect(depth).connect(o.detune);
      lfo.start(t);
      lfo.stop(end + 0.05);
    }
    o.connect(g).connect(this.bus!);
    if (lead) g.connect(this.echo!);
    o.start(t);
    o.stop(end + 0.05);
  }

  /** The kick: a triangle diving from a thud to nothing. */
  private kick(t: number, peak: number): void {
    const { ctx } = this.m;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(170, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.linearRampToValueAtTime(0, t + 0.13);
    o.connect(g).connect(this.bus!);
    o.start(t);
    o.stop(t + 0.15);
  }

  private noise(t: number, len: number, cutoff: number, peak: number): void {
    const { ctx } = this.m;
    const src = ctx.createBufferSource();
    src.buffer = this.m.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.linearRampToValueAtTime(0, t + len);
    src.connect(f).connect(g).connect(this.bus!);
    src.start(t, Math.random() * 1.5);
    src.stop(t + len + 0.02);
  }
}
