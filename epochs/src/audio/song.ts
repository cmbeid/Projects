import type { Ensemble, EraSong } from '../data/types';

/**
 * The composer behind the score: turns an era's `EraSong` into the notes of
 * one bar at a time. Pure — no Web Audio here — so the tests can check that
 * every era really does sound like itself.
 *
 * A tune is eight bars of chords, played as A A′ B A′. The melody walks the
 * era's motif from each chord's root; the B section turns it upside down and
 * lifts it. What changes most from era to era is not the tune but who plays
 * it: each ensemble has its own voices, its own way of accompanying, and its
 * own drums.
 */

export type Voice =
  | 'flute' // breathy sine with vibrato
  | 'reed' // nasal narrow pulse
  | 'pluck' // lyre, harp, harpsichord: a fast decay
  | 'chant' // soft triangle, sung
  | 'organ' // square, held
  | 'lead' // bright pulse
  | 'synth' // detuned pulse pair
  | 'pad' // slow swell
  | 'drone' // a held bass under everything
  | 'bass'
  | 'kick'
  | 'tom'
  | 'snare'
  | 'clap'
  | 'hat'
  | 'shaker'
  | 'clank';

export interface Note {
  voice: Voice;
  /** Sixteenths into the bar. */
  step: number;
  /** Length in sixteenths. */
  len: number;
  midi: number;
  vel: number;
}

export interface EnsembleDef {
  melody: Voice;
  /** A second melody a third or a sixth under, or none. */
  second?: Voice;
  /** How the chord is played. */
  accomp: 'none' | 'drone' | 'arp' | 'arpDown' | 'stabs' | 'pad' | 'ostinato';
  accompVoice: Voice;
  bass: 'drone' | 'root' | 'walk' | 'pulse' | 'octaves' | 'none';
  /** Hits per drum voice, as steps of a bar of `meter` beats. Built per meter. */
  drums: (spb: number) => Partial<Record<Voice, readonly number[]>>;
  /** How busy the melody is: notes a beat, on average. */
  density: number;
}

const evenly = (spb: number, every: number, offset = 0): number[] => {
  const out: number[] = [];
  for (let s = offset; s < spb; s += every) out.push(s);
  return out;
};

export const ENSEMBLES: Record<Ensemble, EnsembleDef> = {
  // Bone flute, a drone and log drums by the fire.
  stone: {
    melody: 'flute',
    accomp: 'none',
    accompVoice: 'pad',
    bass: 'drone',
    drums: (spb) => ({ tom: [0, 6, spb / 2 + 2], shaker: evenly(spb, 4, 2) }),
    density: 0.75,
  },
  // A reed pipe and a lyre over a frame drum, in seven.
  bronze: {
    melody: 'reed',
    accomp: 'arp',
    accompVoice: 'pluck',
    bass: 'root',
    drums: () => ({ tom: [0, 8, 16], shaker: [4, 12, 20, 24] }),
    density: 1,
  },
  // Aulos and lyre: a dance in three.
  classical: {
    melody: 'reed',
    second: 'flute',
    accomp: 'arp',
    accompVoice: 'pluck',
    bass: 'root',
    drums: (spb) => ({ tom: [0], shaker: evenly(spb, 4, 4) }),
    density: 1.25,
  },
  // Plainchant over a drone, a tabor keeping time.
  medieval: {
    melody: 'chant',
    second: 'chant',
    accomp: 'drone',
    accompVoice: 'organ',
    bass: 'drone',
    drums: () => ({ tom: [0, 6], shaker: [2, 8, 10] }),
    density: 0.9,
  },
  // Harpsichord counterpoint and a walking bass.
  renaissance: {
    melody: 'pluck',
    second: 'pluck',
    accomp: 'arpDown',
    accompVoice: 'pluck',
    bass: 'walk',
    drums: () => ({}),
    density: 1.75,
  },
  // A machine: an ostinato, an anvil, a hard minor tune.
  industrial: {
    melody: 'lead',
    accomp: 'ostinato',
    accompVoice: 'organ',
    bass: 'pulse',
    drums: (spb) => ({ kick: evenly(spb, 4), snare: [4, 12], clank: [6, 14], hat: evenly(spb, 2, 1) }),
    density: 1.25,
  },
  // Synth pop: four on the floor, claps and a bright lead.
  modern: {
    melody: 'synth',
    accomp: 'stabs',
    accompVoice: 'synth',
    bass: 'octaves',
    drums: (spb) => ({ kick: evenly(spb, 4), clap: [4, 12], hat: evenly(spb, 4, 2) }),
    density: 1.5,
  },
  // Pads that never quite land, a slow arpeggio, almost no drums.
  space: {
    melody: 'flute',
    accomp: 'pad',
    accompVoice: 'pad',
    bass: 'drone',
    drums: (spb) => ({ shaker: [spb - 4] }),
    density: 0.5,
  },
};

export const STEPS_PER_BEAT = 4;

export function stepsPerBar(p: EraSong): number {
  return p.meter * STEPS_PER_BEAT;
}

export function stepSeconds(p: EraSong): number {
  return 60 / p.bpm / STEPS_PER_BEAT;
}

export function barSeconds(p: EraSong): number {
  return stepSeconds(p) * stepsPerBar(p);
}

/** A scale degree (any integer, wrapping into octaves) as a MIDI note. */
export function degreeToMidi(p: EraSong, degree: number, octave = 0): number {
  const n = p.scale.length;
  const o = Math.floor(degree / n);
  const i = ((degree % n) + n) % n;
  return p.key + 12 * (octave + o) + p.scale[i]!;
}

export function sectionOf(bar: number): 'A' | "A'" | 'B' {
  const s = Math.floor(bar / 8) % 4;
  return s === 2 ? 'B' : s === 0 ? 'A' : "A'";
}

/** Splits a bar into note lengths, about `density` notes a beat, on a seeded roll. */
function rhythm(spb: number, density: number, rand: () => number): [number, number][] {
  const out: [number, number][] = [];
  const unit = density >= 1.5 ? 2 : density >= 1 ? 4 : 4;
  let s = 0;
  while (s < spb) {
    let len = unit;
    const r = rand();
    if (density < 1 && r < 0.5) len = unit * 2;
    else if (density >= 1.5 && r < 0.3) len = unit * 2;
    else if (density < 1.5 && r < 0.25) len = unit * 2;
    len = Math.min(len, spb - s);
    out.push([s, len]);
    s += len;
  }
  return out;
}

function melody(p: EraSong, e: EnsembleDef, bar: number, rand: () => number): Note[] {
  const section = sectionOf(bar);
  const root = p.progression[bar % p.progression.length]!;
  const spb = stepsPerBar(p);
  const out: Note[] = [];
  // Every fourth bar breathes: two long notes, the last of the phrase going home.
  if (bar % 4 === 3) {
    const half = Math.floor(spb / 2);
    const home = bar % 8 === 7 ? 0 : root + 2;
    out.push({ voice: e.melody, step: 0, len: half, midi: degreeToMidi(p, root + 4), vel: 0.9 });
    out.push({ voice: e.melody, step: half, len: spb - half, midi: degreeToMidi(p, home), vel: 0.85 });
    return out;
  }
  const motif = section === 'B' ? p.motif.map((x) => -x) : p.motif;
  const base = root + (section === 'B' ? 2 : 0);
  rhythm(spb, e.density, rand).forEach(([step, len], i) => {
    let degree = base + motif[(i + (bar % 4)) % motif.length]!;
    if (section === "A'" && rand() < 0.25) degree += rand() < 0.5 ? 1 : -1;
    out.push({ voice: e.melody, step, len, midi: degreeToMidi(p, degree), vel: i === 0 ? 1 : 0.8 });
  });
  return out;
}

function harmony(p: EraSong, e: EnsembleDef, bar: number): Note[] {
  const root = p.progression[bar % p.progression.length]!;
  const tones = [root, root + 2, root + 4, root + 7];
  const spb = stepsPerBar(p);
  const v = e.accompVoice;
  const out: Note[] = [];
  switch (e.accomp) {
    case 'none':
      break;
    case 'drone':
      out.push({ voice: v, step: 0, len: spb, midi: degreeToMidi(p, root, -1), vel: 0.6 });
      out.push({ voice: v, step: 0, len: spb, midi: degreeToMidi(p, root + 4, -1), vel: 0.5 });
      break;
    case 'pad':
      for (const k of [0, 1, 2]) out.push({ voice: v, step: 0, len: spb, midi: degreeToMidi(p, tones[k]!, -1), vel: 0.7 });
      break;
    case 'arp':
    case 'arpDown': {
      const order = e.accomp === 'arp' ? [0, 1, 2, 3, 2, 1] : [3, 2, 1, 0, 1, 2];
      for (let s = 0, i = 0; s < spb; s += 2, i++) out.push({ voice: v, step: s, len: 2, midi: degreeToMidi(p, tones[order[i % order.length]!]!, -1), vel: i % 3 === 0 ? 0.9 : 0.65 });
      break;
    }
    case 'stabs':
      for (let s = 2; s < spb; s += 4) for (const k of [1, 2]) out.push({ voice: v, step: s, len: 2, midi: degreeToMidi(p, tones[k]!, -1), vel: 0.7 });
      break;
    case 'ostinato':
      for (let s = 0, i = 0; s < spb; s += 2, i++) out.push({ voice: v, step: s, len: 1, midi: degreeToMidi(p, i % 4 === 3 ? root + 4 : root, -1), vel: 0.6 });
      break;
  }
  return out;
}

function bassLine(p: EraSong, e: EnsembleDef, bar: number): Note[] {
  const root = p.progression[bar % p.progression.length]!;
  const octave = p.key >= 64 ? -3 : -2;
  const r = degreeToMidi(p, root, octave);
  const fifth = degreeToMidi(p, root + 4, octave);
  const spb = stepsPerBar(p);
  const n = (step: number, len: number, midi: number, vel = 1): Note => ({ voice: e.bass === 'drone' ? 'drone' : 'bass', step, len, midi, vel });
  switch (e.bass) {
    case 'none':
      return [];
    case 'drone':
      return [n(0, spb, r, 0.8)];
    case 'root':
      return [n(0, Math.min(8, spb), r)];
    case 'walk': {
      const out: Note[] = [];
      for (let s = 0, i = 0; s < spb; s += 4, i++) out.push(n(s, 4, degreeToMidi(p, root + i, octave), 0.8));
      return out;
    }
    case 'pulse': {
      const out: Note[] = [];
      for (let s = 0; s < spb; s += 2) out.push(n(s, 1, s % 8 === 6 ? fifth : r, 0.9));
      return out;
    }
    case 'octaves': {
      const out: Note[] = [];
      for (let s = 0; s < spb; s += 2) out.push(n(s, 2, s % 4 === 2 ? r + 12 : r, 0.9));
      return out;
    }
  }
}

function drumBar(p: EraSong, e: EnsembleDef): Note[] {
  const out: Note[] = [];
  for (const [voice, steps] of Object.entries(e.drums(stepsPerBar(p))) as [Voice, readonly number[]][]) {
    for (const step of steps) if (step < stepsPerBar(p)) out.push({ voice, step, len: 1, midi: 0, vel: step === 0 ? 1 : 0.7 });
  }
  return out;
}

/** Every note of bar `bar`. At night the band thins out: no drums, a quieter tune. */
export function composeBar(p: EraSong, bar: number, night: boolean, rand: () => number = Math.random): Note[] {
  const e = ENSEMBLES[p.ensemble];
  const lead = melody(p, e, bar, rand);
  const notes: Note[] = [...harmony(p, e, bar), ...bassLine(p, e, bar)];
  if (e.second && sectionOf(bar) !== 'A') {
    // A second voice a third under, in the later sections.
    for (const n of lead) notes.push({ ...n, voice: e.second, midi: n.midi - (p.scale.length === 5 ? 3 : 4), vel: n.vel * 0.55 });
  }
  if (!night) notes.push(...lead, ...drumBar(p, e));
  else notes.push(...lead.map((x) => ({ ...x, vel: x.vel * 0.5 })));
  return notes;
}
