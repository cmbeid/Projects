import type { SongParams } from '../data/types';

/**
 * The composer behind the chip score: turns a district's `SongParams` into
 * the notes of one bar at a time. Pure — no Web Audio here — so the tests can
 * check that each district really does have its own meter, tempo and range.
 *
 * A tune is eight bars of chords played four times over in A A′ B A′ form:
 * the lead walks the district's motif from each chord's root, varies it the
 * second time round, turns it upside down and lifts it a third for the B
 * section, and comes home to the tonic at the end of every eight bars. The
 * second pulse channel arpeggiates the chord, the triangle plays the bass,
 * and the noise channel keeps the dance.
 */

export type Channel = 'lead' | 'harm' | 'bass' | 'kick' | 'snare' | 'hat' | 'clank';

export interface Note {
  ch: Channel;
  /** Steps into the bar. A step is a sixteenth note (in 6/8, a sixteenth of the eighth-note beat's pair). */
  step: number;
  /** Length in steps. */
  len: number;
  /** MIDI note; ignored by the drums. */
  midi: number;
  /** 0–1 loudness within the channel. */
  vel: number;
}

export function stepsPerBeat(p: SongParams): number {
  return p.meter === 6 ? 2 : 4;
}

export function stepsPerBar(p: SongParams): number {
  return p.meter * stepsPerBeat(p);
}

export function stepSeconds(p: SongParams): number {
  return 60 / p.bpm / stepsPerBeat(p);
}

export function barSeconds(p: SongParams): number {
  return stepSeconds(p) * stepsPerBar(p);
}

/** A scale degree (any integer, wrapping into octaves) as a MIDI note. */
export function degreeToMidi(p: SongParams, degree: number, octave = 0): number {
  const n = p.scale.length;
  const o = Math.floor(degree / n);
  const i = ((degree % n) + n) % n;
  return p.key + 12 * (octave + o) + p.scale[i]!;
}

/** Rhythms for the lead, by meter, as [step, length] pairs. */
const RHYTHMS: Record<SongParams['meter'], readonly (readonly [number, number])[][]> = {
  2: [
    [[0, 2], [2, 2], [4, 2], [6, 2]],
    [[0, 3], [3, 1], [4, 4]],
    [[0, 1], [1, 1], [2, 2], [4, 2], [6, 2]],
  ],
  3: [
    [[0, 4], [4, 2], [6, 2], [8, 4]],
    [[0, 6], [6, 2], [8, 4]],
    [[0, 2], [2, 2], [4, 4], [8, 2], [10, 2]],
  ],
  4: [
    [[0, 2], [2, 2], [4, 4], [8, 2], [10, 2], [12, 4]],
    [[0, 3], [3, 1], [4, 4], [8, 4], [12, 4]],
    [[0, 2], [2, 1], [3, 1], [4, 2], [6, 2], [8, 6], [14, 2]],
  ],
  6: [
    [[0, 4], [4, 2], [6, 4], [10, 2]],
    [[0, 2], [2, 2], [4, 2], [6, 2], [8, 2], [10, 2]],
    [[0, 6], [6, 2], [8, 2], [10, 2]],
  ],
};

/** The four sections of a tune, eight bars each. */
export function sectionOf(bar: number): 'A' | "A'" | 'B' {
  const s = Math.floor(bar / 8) % 4;
  return s === 2 ? 'B' : s === 0 ? 'A' : "A'";
}

function leadBar(p: SongParams, bar: number, rand: () => number): Note[] {
  const section = sectionOf(bar);
  const root = p.progression[bar % p.progression.length]!;
  const spb = stepsPerBar(p);
  const out: Note[] = [];
  // The fourth bar of each phrase breathes: one or two long notes.
  if (bar % 4 === 3) {
    const home = bar % 8 === 7 ? 0 : root + 2;
    out.push({ ch: 'lead', step: 0, len: spb / 2, midi: degreeToMidi(p, root + 4), vel: 0.9 });
    out.push({ ch: 'lead', step: spb / 2, len: spb / 2, midi: degreeToMidi(p, home), vel: 0.85 });
    return out;
  }
  const rhythms = RHYTHMS[p.meter];
  const rhythm = rhythms[(bar % 4) % rhythms.length]!;
  const motif = section === 'B' ? p.motif.map((x) => -x) : p.motif;
  const base = root + (section === 'B' ? 2 : 0);
  rhythm.forEach(([step, len], i) => {
    let degree = base + motif[(i + (bar % 4)) % motif.length]!;
    // The second time through, the tune wanders a little.
    if (section === "A'" && rand() < 0.25) degree += rand() < 0.5 ? 1 : -1;
    out.push({ ch: 'lead', step, len, midi: degreeToMidi(p, degree), vel: i === 0 ? 1 : 0.8 });
  });
  return out;
}

function harmonyBar(p: SongParams, bar: number): Note[] {
  const root = p.progression[bar % p.progression.length]!;
  const tones = [root, root + 2, root + 4, root + 7];
  const spb = stepsPerBar(p);
  const beat = stepsPerBeat(p);
  const out: Note[] = [];
  if (p.arp === 'none') return out;
  if (p.arp === 'stabs') {
    // Oom-pah: the chord on every beat but the first.
    for (let b = 1; b < p.meter; b++) {
      if (p.meter === 6 && b % 3 === 0) continue;
      for (const k of [1, 2]) out.push({ ch: 'harm', step: b * beat, len: Math.max(1, beat - 1), midi: degreeToMidi(p, tones[k]!, -1), vel: 0.8 });
    }
    return out;
  }
  const order = p.arp === 'up' ? [0, 1, 2, 3] : p.arp === 'updown' ? [0, 1, 2, 3, 2, 1] : [0, 2, 1, 2];
  const every = Math.max(1, Math.round(beat / p.arpRate));
  for (let step = 0, i = 0; step < spb; step += every, i++) {
    out.push({ ch: 'harm', step, len: every, midi: degreeToMidi(p, tones[order[i % order.length]!]!, -1), vel: i % order.length === 0 ? 0.9 : 0.7 });
  }
  return out;
}

function bassBar(p: SongParams, bar: number): Note[] {
  const root = p.progression[bar % p.progression.length]!;
  // Two octaves under the lead, or three for the high keys, so the bass stays a bass.
  const octave = p.key >= 64 ? -3 : -2;
  const r = degreeToMidi(p, root, octave);
  const fifth = degreeToMidi(p, root + 4, octave);
  const spb = stepsPerBar(p);
  const beat = stepsPerBeat(p);
  const n = (step: number, len: number, midi: number): Note => ({ ch: 'bass', step, len, midi, vel: 1 });
  switch (p.drums) {
    case 'waltz': return [n(0, beat, r)];
    case 'jig': return [n(0, 5, r), n(6, 5, fifth)];
    case 'march': return [n(0, 3, r), n(4, 3, fifth), n(8, 3, r), n(12, 3, fifth)];
    case 'machine':
    case 'drive': {
      const out: Note[] = [];
      for (let s = 0; s < spb; s += 2) out.push(n(s, 1, s % 4 === 2 ? r + 12 : r));
      return out;
    }
    case 'polka': return [n(0, 2, r), n(4, 2, fifth)];
    case 'shuffle': return [n(0, 6, r), n(10, 4, fifth)];
    case 'none': return [n(0, spb, r)];
  }
}

const DRUMS: Record<SongParams['drums'], Partial<Record<'kick' | 'snare' | 'hat' | 'clank', readonly number[]>>> = {
  waltz: { kick: [0], hat: [4, 8] },
  jig: { kick: [0, 6], hat: [2, 4, 8, 10] },
  march: { kick: [0, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  machine: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [1, 3, 5, 7, 9, 11, 13, 15], clank: [6, 14] },
  drive: { kick: [0, 6, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  polka: { kick: [0, 4], snare: [2, 6] },
  shuffle: { kick: [0, 10], snare: [8], hat: [4, 12] },
  none: {},
};

function drumBar(p: SongParams): Note[] {
  const out: Note[] = [];
  for (const [ch, steps] of Object.entries(DRUMS[p.drums]) as [Channel, readonly number[]][]) {
    for (const step of steps) out.push({ ch, step, len: 1, midi: 0, vel: step === 0 ? 1 : 0.75 });
  }
  return out;
}

/**
 * Every note of bar `bar` of the district's tune. At night the band thins
 * out: no drums, and the lead only plays in the A sections, softly.
 */
export function composeBar(p: SongParams, bar: number, night: boolean, rand: () => number = Math.random): Note[] {
  const lead = leadBar(p, bar, rand);
  const notes: Note[] = [...harmonyBar(p, bar), ...bassBar(p, bar)];
  if (!night) notes.push(...lead, ...drumBar(p));
  else if (sectionOf(bar) === 'A') notes.push(...lead.map((x) => ({ ...x, vel: x.vel * 0.5 })));
  return notes;
}
