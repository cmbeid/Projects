/**
 * Arranges a pokeemerald MIDI file for the Game Boy's four channels, in the
 * same `Song` format `parse.ts` produces from pokecrystal, so the one synth in
 * `src/audio/music.ts` plays both.
 *
 * Emerald's songs have eight to ten parts. They are folded down the way a
 * chiptune cover would: at every moment, the highest sounding note goes to
 * pulse 1 (nearly always the melody), the next highest to pulse 2, and the
 * lowest to the wave channel as bass. A General MIDI drum channel, where a
 * song has one, becomes the noise channel.
 *
 * The m4a engine marks loops with MIDI marker events `[` and `]`; the song
 * loops between them, as it does in the game.
 */
import { type Channel, FRAME_RATE, type NoiseNote, type PulseNote, type Song, type WaveNote } from './parse';

interface RawNote {
  start: number;
  end: number;
  pitch: number;
  /** Velocity scaled by the channel's volume, 0–127. */
  loudness: number;
  channel: number;
  id: number;
}

interface Parsed {
  division: number;
  notes: RawNote[];
  tempos: { tick: number; usPerQuarter: number }[];
  loopStart: number | null;
  loopEnd: number | null;
  lastTick: number;
}

export function parseMidi(bytes: Uint8Array): Parsed {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (at: number, n: number): string => String.fromCharCode(...bytes.subarray(at, at + n));
  if (text(0, 4) !== 'MThd') throw new Error('not a MIDI file');
  const tracks = view.getUint16(10);
  const division = view.getUint16(12);
  if (division & 0x8000) throw new Error('SMPTE timing is not supported');

  const notes: RawNote[] = [];
  const tempos: Parsed['tempos'] = [];
  let loopStart: number | null = null;
  let loopEnd: number | null = null;
  let lastTick = 0;
  let nextId = 0;
  let pos = 8 + view.getUint32(4);

  for (let t = 0; t < tracks; t += 1) {
    if (text(pos, 4) !== 'MTrk') throw new Error(`bad track header at ${pos}`);
    const len = view.getUint32(pos + 4);
    let i = pos + 8;
    const endAt = i + len;
    pos = endAt;
    let tick = 0;
    let status = 0;
    const volume = new Array<number>(16).fill(100);
    const expression = new Array<number>(16).fill(127);
    const open = new Map<string, RawNote>();
    const readVar = (): number => {
      let v = 0;
      for (;;) {
        const c = bytes[i++]!;
        v = (v << 7) | (c & 0x7f);
        if (!(c & 0x80)) return v;
      }
    };
    const close = (channel: number, pitch: number): void => {
      const key = `${channel}:${pitch}`;
      const n = open.get(key);
      if (n) {
        n.end = tick;
        if (n.end > n.start) notes.push(n);
        open.delete(key);
      }
    };

    while (i < endAt) {
      tick += readVar();
      let st = bytes[i]!;
      if (st & 0x80) {
        i += 1;
        if (st < 0xf0) status = st;
      } else {
        st = status;
      }
      if (st === 0xff) {
        const type = bytes[i++]!;
        const l = readVar();
        if (type === 0x51) tempos.push({ tick, usPerQuarter: (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]! });
        if (type === 0x06 || type === 0x01) {
          const mark = text(i, l).trim();
          if (mark === '[') loopStart = tick;
          if (mark === ']') loopEnd = tick;
        }
        i += l;
        continue;
      }
      if (st === 0xf0 || st === 0xf7) {
        i += readVar();
        continue;
      }
      const kind = st & 0xf0;
      const channel = st & 0x0f;
      const a = bytes[i++]!;
      const b = kind === 0xc0 || kind === 0xd0 ? 0 : bytes[i++]!;
      if (kind === 0x90 && b > 0) {
        close(channel, a);
        open.set(`${channel}:${a}`, {
          start: tick, end: tick, pitch: a, channel, id: nextId++,
          loudness: (b * volume[channel]! * expression[channel]!) / (127 * 127),
        });
      } else if (kind === 0x80 || (kind === 0x90 && b === 0)) {
        close(channel, a);
      } else if (kind === 0xb0 && a === 7) {
        volume[channel] = b;
      } else if (kind === 0xb0 && a === 11) {
        expression[channel] = b;
      }
    }
    for (const key of [...open.keys()]) {
      const [c, p] = key.split(':').map(Number) as [number, number];
      close(c, p);
    }
    lastTick = Math.max(lastTick, tick);
  }
  tempos.sort((x, y) => x.tick - y.tick);
  if (!tempos.length || tempos[0]!.tick > 0) tempos.unshift({ tick: 0, usPerQuarter: 500_000 });
  return { division, notes, tempos, loopStart, loopEnd, lastTick };
}

/** Tick → Game Boy frame, through the tempo map. */
function frameClock(p: Parsed): (tick: number) => number {
  return (tick) => {
    let seconds = 0;
    for (let k = 0; k < p.tempos.length; k += 1) {
      const t = p.tempos[k]!;
      const until = Math.min(tick, p.tempos[k + 1]?.tick ?? Infinity);
      if (until <= t.tick) break;
      seconds += ((until - t.tick) / p.division) * (t.usPerQuarter / 1e6);
    }
    return seconds * FRAME_RATE;
  };
}

const hz = (pitch: number): number => Math.round(440 * 2 ** ((pitch - 69) / 12) * 100) / 100;

/** Too quiet to count as the tune: ornaments and echo parts. */
const MIN_LOUDNESS = 18;

type Voice = { note: RawNote; start: number; end: number }[];

/**
 * Sweep through the song and, in each stretch where the set of sounding
 * notes doesn't change, give the highest to `top`, the next to `second` and
 * the lowest to `bottom`. A note keeps its voice for as long as it stays in
 * that position, so held notes aren't chopped up.
 */
function reduce(notes: RawNote[]): { top: Voice; second: Voice; bottom: Voice } {
  const times = [...new Set(notes.flatMap((n) => [n.start, n.end]))].sort((a, b) => a - b);
  const voices = { top: [] as Voice, second: [] as Voice, bottom: [] as Voice };
  const add = (voice: Voice, note: RawNote, start: number, end: number): void => {
    const last = voice[voice.length - 1];
    if (last && last.note === note && last.end === start) last.end = end;
    else voice.push({ note, start, end });
  };
  const byStart = [...notes].sort((a, b) => a.start - b.start);
  let from = 0;
  const active: RawNote[] = [];
  for (let k = 0; k < times.length - 1; k += 1) {
    const t = times[k]!;
    const next = times[k + 1]!;
    while (from < byStart.length && byStart[from]!.start <= t) active.push(byStart[from++]!);
    for (let j = active.length - 1; j >= 0; j -= 1) if (active[j]!.end <= t) active.splice(j, 1);
    if (!active.length) continue;
    const sorted = [...active].sort((a, b) => b.pitch - a.pitch || b.loudness - a.loudness);
    const tune = sorted.filter((n) => n.loudness >= MIN_LOUDNESS);
    const top = tune[0] ?? sorted[0]!;
    add(voices.top, top, t, next);
    const rest = sorted.filter((n) => n !== top && n.pitch !== top.pitch);
    const bottom = rest[rest.length - 1];
    if (bottom && bottom.pitch < 60) add(voices.bottom, bottom, t, next);
    const second = rest.find((n) => n !== bottom && n.pitch !== bottom?.pitch && n.loudness >= MIN_LOUDNESS);
    if (second) add(voices.second, second, t, next);
  }
  return voices;
}

/** A soft 32-step triangle for the bass, like pokecrystal's own wave shapes. */
const BASS_WAVE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

/** Noise-channel drums: [frames, volume, fade, NR43]. */
const DRUMS: Song['drums'] = {
  kick: [[3, 13, 1, 0x71], [4, 8, 1, 0x72]],
  snare: [[8, 11, 2, 0x42]],
  hat: [[3, 6, 1, 0x10]],
  tom: [[6, 10, 2, 0x63]],
};

function drumFor(pitch: number): string {
  if (pitch === 35 || pitch === 36) return 'kick';
  if (pitch === 38 || pitch === 40 || pitch === 39) return 'snare';
  if (pitch >= 42 && pitch <= 46) return 'hat';
  return 'tom';
}

const volumeOf = (loudness: number, max: number): number => Math.max(3, Math.min(15, Math.round((loudness / 127) * max)));

export function convertMidi(id: string, bytes: Uint8Array): Song {
  const p = parseMidi(bytes);
  const toFrame = frameClock(p);
  const loopStart = p.loopStart ?? 0;
  const loopEnd = p.loopEnd ?? p.lastTick;
  // Everything after the loop's end is never heard.
  const clip = (n: RawNote): RawNote | null => (n.start >= loopEnd ? null : { ...n, end: Math.min(n.end, loopEnd) });
  const pitched = p.notes.filter((n) => n.channel !== 9).map(clip).filter((n): n is RawNote => n !== null);
  const drums = p.notes.filter((n) => n.channel === 9).map(clip).filter((n): n is RawNote => n !== null);
  const { top, second, bottom } = reduce(pitched);

  const frames = (start: number, end: number): [number, number] => {
    const f0 = Math.round(toFrame(start));
    return [f0, Math.max(1, Math.round(toFrame(end)) - f0)];
  };
  const loop = Math.round(toFrame(loopStart));
  const end = Math.round(toFrame(loopEnd));
  const looping = p.loopStart !== null && p.loopEnd !== null;

  const pulse = (voice: Voice, maxVolume: number, duty: number, pan: number): Channel => ({
    kind: 'pulse',
    loop: looping ? loop : null,
    end,
    notes: voice.map((v): PulseNote => [...frames(v.start, v.end), hz(v.note.pitch), volumeOf(v.note.loudness, maxVolume), 0, duty, pan]),
  });
  const channels: Channel[] = [
    pulse(top, 13, 2, 0),
    pulse(second, 9, 1, 1),
    {
      kind: 'wave',
      loop: looping ? loop : null,
      end,
      notes: bottom.map((v): WaveNote => [...frames(v.start, v.end), hz(v.note.pitch), 2, 0, -1]),
    },
  ];
  if (drums.length) {
    channels.push({
      kind: 'noise',
      loop: looping ? loop : null,
      end,
      notes: drums.map((n): NoiseNote => [...frames(n.start, n.end), drumFor(n.pitch), 0]),
    });
  }
  return { id, frameRate: FRAME_RATE, channels, drums: drums.length ? DRUMS : {}, waves: { 0: BASS_WAVE } };
}
