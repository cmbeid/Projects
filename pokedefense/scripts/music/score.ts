/**
 * Compiles a hand-written score into the same `Song` format the converted
 * game music uses, for the original Kalos tunes in `./kalos.ts`.
 *
 * Each channel is a string in a small MML-like notation:
 *
 *   c d e f g a b   a note; `+` or `#` after it sharpens, `-` flattens
 *   4 8 16 2 1      a length after a note or rest (a quarter is 4); `.` dots it
 *   r               a rest
 *   ^               a tie: holds the last note for the given length
 *   o4 < >          set the octave (o4 c is middle C), or step it down / up
 *   l8              the default length when a note gives none
 *   v12             volume (0–15)       ~2   fade (0 none; higher dies faster)
 *   [               the loop starts here
 *   ( … )3          play the bracketed part three times
 *   |               a bar line: ignored, for the reader
 *
 * The drum channel uses k (kick), s (snare), h (hat) and t (tom) for notes.
 */
import { DRUMS } from './midi';
import { type Channel, FRAME_RATE, type NoiseNote, type PulseNote, type Song, type WaveNote } from './parse';

export interface Score {
  id: string;
  /** Quarter notes per minute. */
  bpm: number;
  lead: string;
  harmony: string;
  bass: string;
  drums?: string;
  /** Pulse widths for lead and harmony: 0 thin … 2 square. */
  duty?: [number, number];
}

const TICKS = 48; // to a quarter note
const SEMITONE: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

interface Event {
  tick: number;
  length: number;
  /** MIDI pitch, or a drum id. */
  sound: number | string;
  volume: number;
  fade: number;
}

/** Unroll `( … )n` groups, innermost first. */
function expand(source: string): string {
  let s = source;
  const group = /\(([^()]*)\)(\d+)/;
  for (let m = group.exec(s); m; m = group.exec(s)) s = s.replace(m[0], ` ${m[1]} `.repeat(Number(m[2])));
  if (/[()]/.test(s)) throw new Error(`unbalanced brackets in: ${source.slice(0, 40)}…`);
  return s;
}

export function readChannel(source: string, drums = false): { events: Event[]; loop: number | null; end: number } {
  const s = expand(source).replace(/\|/g, ' ');
  const token = /\s*(?:([a-gkshtr^])([+#-]?)(\d*)(\.?)|o(\d)|l(\d+)(\.?)|v(\d+)|~(\d)|([<>[]))/y;
  const events: Event[] = [];
  let tick = 0;
  let octave = 4;
  let deflt = TICKS;
  let volume = 12;
  let fade = 0;
  let loop: number | null = null;
  const lengthOf = (digits: string, dot: string): number => {
    const base = digits ? (TICKS * 4) / Number(digits) : deflt;
    return dot ? base * 1.5 : base;
  };
  let at = 0;
  while (at < s.length) {
    if (!s.slice(at).trim()) break;
    token.lastIndex = at;
    const m = token.exec(s);
    if (!m) throw new Error(`can't read "${s.slice(at, at + 12).trim()}"`);
    at = token.lastIndex;
    const [, letter, accidental, digits, dot, oct, len, lenDot, vol, fd, sym] = m;
    if (letter) {
      const length = lengthOf(digits!, dot!);
      if (letter === '^') {
        const last = events[events.length - 1];
        if (last && last.tick + last.length === tick) last.length += length;
      } else if (letter !== 'r') {
        let sound: number | string;
        if (drums) {
          sound = { k: 'kick', s: 'snare', h: 'hat', t: 'tom' }[letter] ?? 'hat';
        } else {
          if (!(letter in SEMITONE)) throw new Error(`"${letter}" isn't a note`);
          sound = 12 * (octave + 1) + SEMITONE[letter]! + (accidental === '-' ? -1 : accidental ? 1 : 0);
        }
        events.push({ tick, length, sound, volume, fade });
      }
      tick += length;
    } else if (oct) octave = Number(oct);
    else if (len) deflt = lengthOf(len, lenDot!);
    else if (vol) volume = Math.min(15, Number(vol));
    else if (fd) fade = Number(fd);
    else if (sym === '<') octave -= 1;
    else if (sym === '>') octave += 1;
    else if (sym === '[') loop = tick;
  }
  return { events, loop, end: tick };
}

const hz = (pitch: number): number => Math.round(440 * 2 ** ((pitch - 69) / 12) * 100) / 100;
const BASS_WAVE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

export function compileScore(score: Score): Song {
  const toFrame = (tick: number): number => Math.round((tick / TICKS) * (60 / score.bpm) * FRAME_RATE);
  const span = (e: Event): [number, number] => {
    const f0 = toFrame(e.tick);
    // A frame of air between notes, so repeated notes sound as separate notes.
    const frames = toFrame(e.tick + e.length) - f0;
    return [f0, Math.max(1, frames > 3 ? frames - 1 : frames)];
  };
  const [leadDuty, harmonyDuty] = score.duty ?? [2, 1];
  const parts = {
    lead: readChannel(score.lead),
    harmony: readChannel(score.harmony),
    bass: readChannel(score.bass),
    drums: score.drums ? readChannel(score.drums, true) : null,
  };
  const frame = (ch: { loop: number | null; end: number }): Pick<Channel, 'loop' | 'end'> => ({
    loop: ch.loop === null ? null : toFrame(ch.loop),
    end: toFrame(ch.end),
  });
  const channels: Channel[] = [
    { kind: 'pulse', ...frame(parts.lead), notes: parts.lead.events.map((e): PulseNote => [...span(e), hz(e.sound as number), e.volume, e.fade, leadDuty, 0]) },
    { kind: 'pulse', ...frame(parts.harmony), notes: parts.harmony.events.map((e): PulseNote => [...span(e), hz(e.sound as number), e.volume, e.fade, harmonyDuty, 1]) },
    { kind: 'wave', ...frame(parts.bass), notes: parts.bass.events.map((e): WaveNote => [...span(e), hz(e.sound as number), 2, 0, -1]) },
  ];
  if (parts.drums) {
    channels.push({ kind: 'noise', ...frame(parts.drums), notes: parts.drums.events.map((e): NoiseNote => [toFrame(e.tick), Math.max(1, toFrame(e.tick + e.length) - toFrame(e.tick)), e.sound as string, 0]) });
  }
  return { id: score.id, frameRate: FRAME_RATE, channels, drums: parts.drums ? DRUMS : {}, waves: { 0: BASS_WAVE } };
}
