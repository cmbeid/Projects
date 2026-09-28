/**
 * Reads the Nintendo DS sound archive (a `.sdat`, as in Pokémon Black and
 * White) and plays its sequences (SSEQ) into the same note list the MIDI
 * reader makes, so `arrange()` folds them down to the four Game Boy
 * channels like any other song.
 *
 * An SDAT holds a symbol table (names), an info table (which file and
 * instrument bank each sequence uses), a file table, and the files. A
 * sequence is a byte-code program per track: notes that wait their length,
 * rests, jumps, calls and counted loops. A jump back to somewhere the track
 * has already been is the song's loop. The bank tells us which programs are
 * drum sets; notes played on those become the noise channel.
 *
 * The format as documented by the DS homebrew community (Nitro Composer file
 * notes, sseq2mid, VGMTrans).
 */
import type { Parsed, RawNote } from './midi';

const u8 = (b: Uint8Array, at: number): number => b[at]!;
const u16 = (b: Uint8Array, at: number): number => b[at]! | (b[at + 1]! << 8);
const u24 = (b: Uint8Array, at: number): number => u16(b, at) | (b[at + 2]! << 16);
const u32 = (b: Uint8Array, at: number): number => (u16(b, at) | (u16(b, at + 2) << 16)) >>> 0;
const tag = (b: Uint8Array, at: number): string => String.fromCharCode(...b.subarray(at, at + 4));

export interface SdatSequence {
  name: string;
  /** The SSEQ file. */
  data: Uint8Array;
  /** The SBNK file it plays with, if present. */
  bank: Uint8Array | null;
}

/** Every named sequence in an SDAT. */
export function readSdat(sdat: Uint8Array): SdatSequence[] {
  if (tag(sdat, 0) !== 'SDAT') throw new Error('not an SDAT file');
  const symb = u32(sdat, 0x10);
  const info = u32(sdat, 0x18);
  const fat = u32(sdat, 0x20);
  if (!symb) throw new Error('this SDAT has no symbol table, so its songs have no names');
  if (tag(sdat, symb) !== 'SYMB' || tag(sdat, info) !== 'INFO' || tag(sdat, fat) !== 'FAT ') throw new Error('bad SDAT blocks');

  const file = (id: number): Uint8Array | null => {
    if (id >= u32(sdat, fat + 8)) return null;
    const entry = fat + 12 + id * 16;
    return sdat.subarray(u32(sdat, entry), u32(sdat, entry) + u32(sdat, entry + 4));
  };
  const name = (at: number): string => {
    let end = at;
    while (sdat[end]) end += 1;
    return String.fromCharCode(...sdat.subarray(at, end));
  };
  // Record lists: 0 sequences, 2 banks.
  const symbSeq = symb + u32(sdat, symb + 8);
  const infoSeq = info + u32(sdat, info + 8);
  const infoBank = info + u32(sdat, info + 8 + 2 * 4);

  const out: SdatSequence[] = [];
  const count = u32(sdat, infoSeq);
  for (let k = 0; k < count; k += 1) {
    const entry = u32(sdat, infoSeq + 4 + k * 4);
    const nameAt = k < u32(sdat, symbSeq) ? u32(sdat, symbSeq + 4 + k * 4) : 0;
    if (!entry || !nameAt) continue;
    const data = file(u16(sdat, info + entry));
    if (!data) continue;
    const bankId = u16(sdat, info + entry + 4);
    const bankEntry = bankId < u32(sdat, infoBank) ? u32(sdat, infoBank + 4 + bankId * 4) : 0;
    out.push({ name: name(symb + nameAt), data, bank: bankEntry ? file(u16(sdat, info + bankEntry)) : null });
  }
  return out;
}

/** Programs in a bank that are drum sets (instrument type 16). */
export function drumPrograms(sbnk: Uint8Array | null): Set<number> {
  const drums = new Set<number>();
  if (!sbnk || tag(sbnk, 0) !== 'SBNK') return drums;
  const data = 0x10;
  const count = u32(sbnk, data + 8 + 32);
  for (let k = 0; k < count; k += 1) if (u8(sbnk, data + 8 + 32 + 4 + k * 4) === 16) drums.add(k);
  return drums;
}

/** The DS sequencer counts 48 ticks to a quarter note. */
const DIVISION = 48;
/** Stop a track that never loops or ends after this long (about 10 minutes at 120 bpm). */
const MAX_TICKS = DIVISION * 1200;
/** The channel the MIDI reader treats as drums. */
const DRUM_CHANNEL = 9;

/** Play an SSEQ into notes, a tempo map and its loop points. */
export function readSseq(sseq: Uint8Array, drums: ReadonlySet<number> = new Set()): Parsed {
  if (tag(sseq, 0) !== 'SSEQ') throw new Error('not an SSEQ file');
  const base = u32(sseq, 0x18);
  const code = sseq.subarray(base);
  const notes: RawNote[] = [];
  const tempos: Parsed['tempos'] = [{ tick: 0, usPerQuarter: 500_000 }];
  let loopStart: number | null = null;
  let loopEnd: number | null = null;
  let lastTick = 0;
  let nextId = 0;

  const starts: { track: number; at: number }[] = [{ track: 0, at: 0 }];
  for (let t = 0; t < starts.length; t += 1) {
    const { track, at } = starts[t]!;
    let pc = at;
    let tick = 0;
    let program = 0;
    let volume = 127;
    let expression = 127;
    let transpose = 0;
    let noteWait = true;
    const visited = new Map<number, number>();
    const calls: number[] = [];
    const loops: { at: number; left: number }[] = [];

    const varLen = (): number => {
      let v = 0;
      for (;;) {
        const c = code[pc++]!;
        v = (v << 7) | (c & 0x7f);
        if (!(c & 0x80)) return v;
      }
    };

    // 0xA0 (random) and 0xA1 (variable) prefix a command and replace its
    // last argument: with a range (we take the low end), or a variable
    // number (we can't know its value, so use `fallback`). 0xA2 ("if") runs
    // the next command as if the condition held.
    let prefix = 0;
    const last = (read: () => number, fallback: number): number => {
      if (prefix === 0xa0) {
        const low = (u16(code, pc) << 16) >> 16;
        pc += 4;
        return low;
      }
      if (prefix === 0xa1) {
        pc += 1;
        return fallback;
      }
      return read();
    };
    const byte = (): number => code[pc++]!;

    run: while (pc < code.length && tick < MAX_TICKS) {
      if (!visited.has(pc)) visited.set(pc, tick);
      let cmd = code[pc++]!;
      prefix = 0;
      if (cmd === 0xa0 || cmd === 0xa1 || cmd === 0xa2) {
        prefix = cmd;
        cmd = code[pc++]!;
      }
      if (cmd < 0x80) {
        const velocity = byte();
        const length = Math.max(0, last(varLen, DIVISION / 4));
        if (length > 0) {
          notes.push({
            start: tick, end: tick + length, pitch: cmd + transpose, id: nextId++,
            channel: drums.has(program) ? DRUM_CHANNEL : track === DRUM_CHANNEL ? 15 : track,
            loudness: (velocity * volume * expression) / (127 * 127),
          });
        }
        if (noteWait) tick += length;
        continue;
      }
      switch (cmd) {
        case 0x80: tick += Math.max(0, last(varLen, 0)); break;
        case 0x81: program = last(varLen, program); break;
        case 0x93: starts.push({ track: code[pc]!, at: u24(code, pc + 1) }); pc += 4; break;
        case 0x94: {
          const to = u24(code, pc);
          pc += 3;
          if (visited.has(to)) {
            loopStart = loopStart === null ? visited.get(to)! : Math.min(loopStart, visited.get(to)!);
            loopEnd = Math.max(loopEnd ?? 0, tick);
            break run;
          }
          pc = to;
          break;
        }
        case 0x95: calls.push(pc + 3); pc = u24(code, pc); break;
        case 0xfd: if (!calls.length) break run; pc = calls.pop()!; break;
        case 0xd4: loops.push({ at: pc + 1, left: code[pc]! }); pc += 1; break;
        case 0xfc: {
          const loop = loops[loops.length - 1];
          if (!loop) break;
          if (loop.left === 0) {
            // A loop with no count repeats for ever: the song's loop.
            const from = visited.get(loop.at) ?? 0;
            loopStart = loopStart === null ? from : Math.min(loopStart, from);
            loopEnd = Math.max(loopEnd ?? 0, tick);
            break run;
          }
          loop.left -= 1;
          if (loop.left > 0) pc = loop.at;
          else loops.pop();
          break;
        }
        case 0xc1: volume = last(byte, volume); break;
        case 0xd5: expression = last(byte, expression); break;
        case 0xc3: transpose = (last(byte, transpose) << 24) >> 24; break;
        case 0xc7: noteWait = last(byte, 1) !== 0; break;
        case 0xe1: {
          const bpm = last(() => { pc += 2; return u16(code, pc - 2); }, 120) || 120;
          if (tempos[tempos.length - 1]!.tick === tick) tempos.pop();
          tempos.push({ tick, usPerQuarter: Math.round(60_000_000 / bpm) });
          break;
        }
        case 0xe0: case 0xe3: last(() => { pc += 2; return 0; }, 0); break;
        case 0xfe: pc += 2; break;
        case 0xff: break run;
        default:
          if (cmd >= 0xb0 && cmd <= 0xbd) {
            pc += 1; // variable number
            last(() => { pc += 2; return 0; }, 0);
          } else if (cmd >= 0xc0 && cmd <= 0xdf) {
            last(byte, 0); // pan, bend, envelope and the other one-byte settings
          } else {
            throw new Error(`unknown SSEQ command 0x${cmd.toString(16)} at 0x${(pc - 1).toString(16)}`);
          }
      }
    }
    lastTick = Math.max(lastTick, tick);
  }
  tempos.sort((a, b) => a.tick - b.tick);
  return { division: DIVISION, notes, tempos, loopStart, loopEnd, lastTick };
}
