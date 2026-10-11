import { getMixer, onReady, type Mixer } from './index';

/**
 * A generative ambient score. A drone on the sector's root, slow pad chords
 * from its mode, and sparse bells; a fight adds a pulsing bass and ticking
 * hats, and a landing filters everything through the planet's air. Notes are
 * scheduled a little ahead on the audio clock, so the timing stays even when
 * the page is busy.
 */

const MODES: Record<string, number[]> = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
};

export interface Mood {
  root: number;
  mode: string;
  bpm: number;
  combat: boolean;
  /** 0 = open space, 1 = muffled through a helmet. */
  muffle: number;
  tension: number;
}

const midi = (n: number): number => 440 * 2 ** ((n - 69) / 12);

class Score {
  mood: Mood = { root: 50, mode: 'aeolian', bpm: 70, combat: false, muffle: 0, tension: 0 };
  private beat = 0;
  private next = 0;
  private filter: BiquadFilterNode;
  private bus: GainNode;
  private drone: OscillatorNode[] = [];
  private droneGain: GainNode;
  scheduled = 0;

  constructor(private m: Mixer) {
    this.bus = m.ctx.createGain();
    this.bus.gain.value = 0.8;
    this.filter = m.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 9000;
    this.bus.connect(this.filter).connect(m.music);
    this.droneGain = m.ctx.createGain();
    this.droneGain.gain.value = 0.05;
    this.droneGain.connect(this.bus);
    for (const [mult, type] of [[0.5, 'sine'], [0.5 * 1.5, 'triangle'], [0.25, 'sine']] as const) {
      const o = m.ctx.createOscillator();
      o.type = type;
      o.frequency.value = midi(this.mood.root) * mult;
      o.connect(this.droneGain);
      o.start();
      this.drone.push(o);
    }
    this.next = m.ctx.currentTime + 0.2;
    setInterval(() => this.tick(), 100);
  }

  setMood(next: Partial<Mood>): void {
    const changedRoot = next.root !== undefined && next.root !== this.mood.root;
    this.mood = { ...this.mood, ...next };
    const t = this.m.ctx.currentTime;
    if (changedRoot) {
      const mults = [0.5, 0.75, 0.25];
      this.drone.forEach((o, i) => o.frequency.setTargetAtTime(midi(this.mood.root) * mults[i]!, t, 1.5));
    }
    this.filter.frequency.setTargetAtTime(this.mood.muffle ? 1400 : 9000, t, 0.4);
    this.droneGain.gain.setTargetAtTime(this.mood.combat ? 0.07 : 0.05, t, 0.5);
  }

  private note(deg: number, oct: number): number {
    const scale = MODES[this.mood.mode] ?? MODES['aeolian']!;
    const d = ((deg % 7) + 7) % 7;
    return this.mood.root + scale[d]! + 12 * (oct + Math.floor(deg / 7));
  }

  private voice(freq: number, at: number, len: number, o: { type?: OscillatorType; peak?: number; attack?: number; reverb?: boolean; cutoff?: number }): void {
    const ctx = this.m.ctx;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    const attack = o.attack ?? 0.01;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(o.peak ?? 0.05, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    let out: AudioNode = g;
    if (o.cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.cutoff;
      g.connect(f);
      out = f;
    }
    osc.connect(g);
    out.connect(this.bus);
    if (o.reverb !== false) out.connect(this.m.reverb);
    osc.start(at);
    osc.stop(at + len + 0.05);
    this.scheduled++;
  }

  private hat(at: number, peak: number): void {
    const ctx = this.m.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.m.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    src.connect(f).connect(g).connect(this.bus);
    src.start(at, Math.random());
    src.stop(at + 0.06);
  }

  private tick(): void {
    const ctx = this.m.ctx;
    if (ctx.state !== 'running') return;
    const bpm = this.mood.bpm * (this.mood.combat ? 1.6 : 1);
    const step = 60 / bpm / 2;
    if (this.next < ctx.currentTime - 1) this.next = ctx.currentTime + 0.05;
    while (this.next < ctx.currentTime + 0.4) {
      const at = this.next;
      const b = this.beat;
      // Pads: a new chord every two bars, rooted on a wandering degree.
      if (b % 16 === 0) {
        const roots = [0, 5, 3, 4, 0, 2, 5, 4];
        const deg = roots[(b / 16) % roots.length]!;
        for (const off of [0, 2, 4]) this.voice(midi(this.note(deg + off, 0)), at, step * 16, { type: 'triangle', peak: 0.025, attack: step * 4, cutoff: 1200 });
      }
      // Bells: sparse, more of them when calm.
      const bellChance = this.mood.combat ? 0.12 : 0.22 - this.mood.tension * 0.1;
      if (b % 2 === 0 && hash(b * 7 + this.mood.root) < bellChance) {
        const deg = Math.floor(hash(b * 13) * 7);
        this.voice(midi(this.note(deg, 2)), at, 2.4, { peak: 0.035 });
        this.voice(midi(this.note(deg, 2)) * 2.01, at, 1.2, { peak: 0.01 });
      }
      if (this.mood.combat) {
        if (b % 2 === 0) this.voice(midi(this.note(b % 16 < 8 ? 0 : 5, -1)), at, step * 1.6, { type: 'sawtooth', peak: 0.04, cutoff: 500, reverb: false });
        this.hat(at, b % 4 === 2 ? 0.05 : 0.025);
      }
      this.beat++;
      this.next += step;
    }
  }
}

function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

let score: Score | null = null;
let pending: Partial<Mood> = {};

export function startMusic(): void {
  onReady((m) => {
    if (score) return;
    score = new Score(m);
    score.setMood(pending);
    (window as unknown as { __music?: Score }).__music = score;
  });
}

export function setMood(m: Partial<Mood>): void {
  pending = { ...pending, ...m };
  if (score && getMixer()) score.setMood(m);
}
