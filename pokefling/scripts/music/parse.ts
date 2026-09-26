/**
 * Turns Pokémon Crystal's music, as disassembled by pret/pokecrystal, into
 * note lists a Web Audio synth can play.
 *
 * Rather than translate each channel on its own, this runs the song the way
 * the Game Boy's sound engine does: one frame at a time, all four channels in
 * order, each fetching commands until it reaches a note and then holding it
 * for that many frames. That keeps the engine's quirks exact for free — a
 * `tempo` command on one channel retimes all four from that frame, note
 * lengths carry their fractional frames forward, and loops run as the engine
 * runs them — so the only thing left to decide is when each channel has come
 * back round to where its loop started.
 *
 * Everything here is pure; `scripts/fetch-music.ts` does the downloading.
 * The engine behaviour it copies is in pokecrystal's audio/engine.asm.
 */

/** The Game Boy's frame rate: note timing is counted in these. */
export const FRAME_RATE = 59.7275;

export type ChannelKind = 'pulse' | 'wave' | 'noise';

/** Pulse: [frame, frames, hz, volume 0–15, fade −7…7 (negative rises), duty 0–3, pan −1/0/1]. */
export type PulseNote = [number, number, number, number, number, number, number];
/** Wave: [frame, frames, hz, level 0–3 (0 mute, 1 full, 2 half, 3 quarter), wave index, pan]. */
export type WaveNote = [number, number, number, number, number, number];
/** Noise: [frame, frames, drum id, pan]. */
export type NoiseNote = [number, number, string, number];

export interface Channel {
  kind: ChannelKind;
  notes: (PulseNote | WaveNote | NoiseNote)[];
  /** Frame the loop starts from, or null for a channel that plays once. */
  loop: number | null;
  /** Frame at which the channel ends, or jumps back to `loop`. */
  end: number;
}

/** One step of a drum: [frames, volume 0–15, fade (negative rises), NR43 noise byte]. */
export type DrumStep = [number, number, number, number];

export interface Song {
  id: string;
  frameRate: number;
  channels: Channel[];
  /** Drum sounds used by the noise channel, by id (`kit:instrument`). */
  drums: Record<string, DrumStep[]>;
  /** The 32-step wave shapes the wave channel uses, by index (values 0–15). */
  waves: Record<string, number[]>;
}

// --- source parsing -----------------------------------------------------

interface Instruction {
  op: string;
  args: string[];
  /** Instruction index a label argument resolves to, for jumps and calls. */
  target?: number;
  line: number;
}

interface Program {
  code: Instruction[];
  labels: Map<string, number>;
}

const JUMPS = new Set(['sound_call', 'sound_jump', 'sound_loop', 'channel']);

/** Split asm into instructions, resolving `.local` labels to their enclosing global label. */
export function parseAsm(source: string): Program {
  const code: Instruction[] = [];
  const labels = new Map<string, number>();
  const pendingRefs: { index: number; ref: string }[] = [];
  let scope = '';

  source.split('\n').forEach((raw, i) => {
    const line = raw.replace(/;.*/, '').trim();
    if (!line) return;
    // Labels start in the first column; the colon is optional (`.loop1` appears bare).
    const label = /^\S/.test(raw) ? /^([.A-Za-z_][\w.]*):{0,2}$/.exec(line) : null;
    if (label) {
      const name = label[1]!;
      if (name.startsWith('.')) labels.set(scope + name, code.length);
      else {
        scope = name;
        labels.set(name, code.length);
      }
      return;
    }
    const [op, ...rest] = line.split(/\s+/);
    const args = rest.join(' ').split(',').map((a) => a.trim()).filter(Boolean);
    const index = code.length;
    code.push({ op: op!, args, line: i + 1 });
    if (JUMPS.has(op!)) {
      const ref = args[args.length - 1]!;
      pendingRefs.push({ index, ref: ref.startsWith('.') ? scope + ref : ref });
    }
  });

  for (const { index, ref } of pendingRefs) {
    const target = labels.get(ref);
    if (target === undefined) throw new Error(`line ${code[index]!.line}: unknown label ${ref}`);
    code[index]!.target = target;
  }
  return { code, labels };
}

const PITCHES: Record<string, number> = {
  C_: 1, 'C#': 2, D_: 3, 'D#': 4, E_: 5, F_: 6, 'F#': 7, G_: 8, 'G#': 9, A_: 10, 'A#': 11, B_: 12,
};

/**
 * pokecrystal's FrequencyTable (audio/notes.asm): Game Boy period registers
 * for two octaves, as signed 16-bit values. The engine shifts these right
 * once per octave above the lowest.
 */
const FREQUENCY_TABLE = [
  0, 0xf82c, 0xf89d, 0xf907, 0xf96b, 0xf9ca, 0xfa23, 0xfa77, 0xfac7, 0xfb12, 0xfb58, 0xfb9b, 0xfbda,
  0xfc16, 0xfc4e, 0xfc83, 0xfcb5, 0xfce5, 0xfd11, 0xfd3b, 0xfd63, 0xfd89, 0xfdac, 0xfdcd, 0xfded,
].map((v) => (v >= 0x8000 ? v - 0x10000 : v));

/**
 * The period register value for a note, exactly as the engine's
 * GetFrequency computes it.
 *
 * `octaveCmd` is the low bits of the octave command byte, which the `octave n`
 * macro stores as 8 − n.
 */
export function periodFor(pitch: number, octaveCmd: number, transposeOctaves: number, transposePitch: number): number {
  let value = FREQUENCY_TABLE[pitch + transposePitch];
  if (value === undefined) throw new Error(`pitch ${pitch}+${transposePitch} is off the frequency table`);
  for (let a = transposeOctaves + octaveCmd; a < 7; a += 1) value >>= 1;
  return value & 0x7ff;
}

/** Hz for a period register value. The wave channel sounds an octave below the pulse channels. */
export function hzFor(period: number, kind: 'pulse' | 'wave'): number {
  return (kind === 'pulse' ? 131072 : 65536) / (2048 - period);
}

function num(arg: string | undefined, line: number): number {
  if (arg === undefined) throw new Error(`line ${line}: missing argument`);
  if (arg === 'TRUE') return 1;
  if (arg === 'FALSE') return 0;
  const n = arg.startsWith('$') ? parseInt(arg.slice(1), 16) : arg.startsWith('%') ? parseInt(arg.slice(1), 2) : Number(arg);
  if (!Number.isFinite(n)) throw new Error(`line ${line}: not a number: ${arg}`);
  return n;
}

// --- the engine ----------------------------------------------------------

interface ChannelState {
  index: number;
  kind: ChannelKind;
  pc: number;
  done: boolean;
  /** Frames left on the current note; the channel reads on when this hits zero. */
  wait: number;
  speed: number;
  octave: number;
  transposeOctaves: number;
  transposePitch: number;
  volume: number;
  fade: number;
  duty: number;
  pan: number;
  noise: boolean;
  kit: number;
  tempo: number;
  modifier: number;
  loopCount: number | null;
  callReturn: number | null;
  /** Where this channel has already been, with nothing on the call or loop stack. */
  visited: Map<number, number>;
  out: Channel;
}

/** Commands that only matter to the hardware in ways this synth does not model. */
const IGNORED = new Set(['vibrato', 'pitch_offset', 'volume', 'pitch_slide', 'db']);

const MAX_FRAMES = 60 * 60 * 10;

export interface ConvertOptions {
  drumkits: Record<number, (DrumStep[] | undefined)[]>;
  waves: number[][];
}

/** Run a song's four channels until each has looped or finished, and collect the notes. */
export function convertSong(id: string, source: string, options: ConvertOptions): Song {
  const program = parseAsm(source);
  const header = program.code.filter((c) => c.op === 'channel');
  if (header.length === 0) throw new Error(`${id}: no channels`);

  const channels: ChannelState[] = header.map((c) => {
    const index = num(c.args[0], c.line);
    const kind: ChannelKind = index <= 2 ? 'pulse' : index === 3 ? 'wave' : 'noise';
    return {
      index, kind, pc: c.target!, done: false, wait: 0, speed: 12, octave: 3, transposeOctaves: 0, transposePitch: 0,
      volume: 0, fade: 0, duty: 2, pan: 0, noise: false, kit: 0, tempo: 0x100, modifier: 0, loopCount: null, callReturn: null,
      visited: new Map(), out: { kind, notes: [], loop: null, end: 0 },
    };
  });
  // The engine processes channels in hardware order within each frame.
  channels.sort((a, b) => a.index - b.index);

  const drums: Record<string, DrumStep[]> = {};
  const wavesUsed: Record<string, number[]> = {};

  const setTempo = (tempo: number): void => {
    for (const ch of channels) {
      ch.tempo = tempo;
      ch.modifier = 0;
    }
  };

  /** Read commands until a note or rest, which sets how long to wait. */
  const advance = (ch: ChannelState, frame: number): void => {
    for (let guard = 0; guard < 10_000; guard += 1) {
      const ins = program.code[ch.pc];
      if (!ins) throw new Error(`${id} ch${ch.index}: ran off the end of the code`);
      const clean = ch.callReturn === null && ch.loopCount === null;
      if (clean && !ch.visited.has(ch.pc)) ch.visited.set(ch.pc, frame);
      const at = `${id} ch${ch.index} line ${ins.line}`;
      const [a, b, c] = ins.args;
      ch.pc += 1;

      switch (ins.op) {
        case 'note':
        case 'drum_note':
        case 'rest': {
          const pitchName = ins.op === 'rest' ? '__' : a!;
          const length = num(ins.op === 'rest' ? a : b, ins.line);
          const pitch = ins.op === 'drum_note' || (ch.kind === 'noise' && ins.op === 'note')
            ? num(pitchName, ins.line)
            : pitchName === '__' ? 0 : PITCHES[pitchName];
          if (pitch === undefined) throw new Error(`${at}: unknown pitch ${pitchName}`);
          // SetNoteDuration: only the low byte of speed × length survives.
          const units = (ch.speed * length) & 0xff;
          const total = units * ch.tempo + ch.modifier;
          ch.modifier = total & 0xff;
          const frames = Math.max(1, total >> 8);
          ch.wait = frames;
          if (pitch > 0) emit(ch, frame, frames, pitch, at);
          return;
        }
        case 'octave':
          ch.octave = (8 - num(a, ins.line)) & 7;
          break;
        case 'note_type':
        case 'drum_speed':
          ch.speed = num(a, ins.line);
          if (ins.op === 'note_type' && ch.kind !== 'noise' && b !== undefined) {
            ch.volume = num(b, ins.line);
            ch.fade = num(c, ins.line);
          }
          break;
        case 'volume_envelope':
          ch.volume = num(a, ins.line);
          ch.fade = num(b, ins.line);
          break;
        case 'duty_cycle':
          ch.duty = num(a, ins.line) & 3;
          break;
        case 'duty_cycle_pattern':
          ch.duty = num(a, ins.line) & 3;
          break;
        case 'transpose':
          ch.transposeOctaves = num(a, ins.line);
          ch.transposePitch = num(b, ins.line);
          break;
        case 'tempo':
          setTempo(num(a, ins.line));
          break;
        case 'stereo_panning': {
          const left = num(a, ins.line);
          const right = num(b, ins.line);
          ch.pan = left && !right ? -1 : right && !left ? 1 : 0;
          break;
        }
        case 'toggle_noise':
          ch.noise = !ch.noise;
          if (ch.noise) ch.kit = num(a, ins.line);
          break;
        case 'sound_call':
          if (ch.callReturn !== null) throw new Error(`${at}: nested sound_call`);
          ch.callReturn = ch.pc;
          ch.pc = ins.target!;
          break;
        case 'sound_ret':
          if (ch.callReturn === null) {
            ch.done = true;
            ch.out.end = frame;
            return;
          }
          ch.pc = ch.callReturn;
          ch.callReturn = null;
          break;
        case 'sound_loop': {
          const count = num(a, ins.line);
          if (count === 0) {
            if (jumpForever(ch, ins.target!, frame)) return;
            break;
          }
          // Music_Loop: the body runs `count` times in all.
          if (ch.loopCount === null) ch.loopCount = count - 1;
          if (ch.loopCount === 0) {
            ch.loopCount = null;
            break;
          }
          ch.loopCount -= 1;
          ch.pc = ins.target!;
          break;
        }
        case 'sound_jump':
          if (jumpForever(ch, ins.target!, frame)) return;
          break;
        default:
          if (!IGNORED.has(ins.op)) throw new Error(`${at}: unsupported command ${ins.op}`);
      }
    }
    throw new Error(`${id} ch${ch.index}: no note after 10000 commands`);
  };

  /** An unconditional jump. Returns true when it closes the channel's loop. */
  const jumpForever = (ch: ChannelState, target: number, frame: number): boolean => {
    const seen = ch.callReturn === null && ch.loopCount === null ? ch.visited.get(target) : undefined;
    ch.pc = target;
    if (seen === undefined) return false;
    ch.done = true;
    ch.out.loop = seen;
    ch.out.end = frame;
    return true;
  };

  const emit = (ch: ChannelState, frame: number, frames: number, pitch: number, at: string): void => {
    if (ch.kind === 'noise') {
      if (!ch.noise) return;
      const kit = options.drumkits[ch.kit];
      const steps = kit?.[pitch];
      if (!steps) throw new Error(`${at}: no drum ${pitch} in kit ${ch.kit}`);
      const drumId = `${ch.kit}:${pitch}`;
      drums[drumId] = steps;
      ch.out.notes.push([frame, frames, drumId, ch.pan]);
      return;
    }
    const period = periodFor(pitch, ch.octave, ch.transposeOctaves, ch.transposePitch);
    const hz = Math.round(hzFor(period, ch.kind) * 100) / 100;
    if (ch.kind === 'wave') {
      // For the wave channel the envelope byte is volume level and wave shape.
      const wave = ch.fade & 0xf;
      const shape = options.waves[wave];
      if (!shape) throw new Error(`${at}: no wave ${wave}`);
      wavesUsed[wave] = shape;
      ch.out.notes.push([frame, frames, hz, ch.volume & 3, wave, ch.pan]);
    } else {
      ch.out.notes.push([frame, frames, hz, ch.volume, ch.fade, ch.duty, ch.pan]);
    }
  };

  for (let frame = 0; frame < MAX_FRAMES; frame += 1) {
    for (const ch of channels) {
      if (ch.done) continue;
      if (ch.wait > 1) {
        ch.wait -= 1;
        continue;
      }
      advance(ch, frame);
    }
    if (channels.every((ch) => ch.done)) {
      return { id, frameRate: FRAME_RATE, channels: channels.map((ch) => ch.out), drums, waves: wavesUsed };
    }
  }
  throw new Error(`${id}: still playing after ${MAX_FRAMES} frames without looping`);
}

// --- drum kits and waves ---------------------------------------------------

/** Parse audio/drumkits.asm into kit → instrument → steps. */
export function parseDrumkits(source: string): Record<number, (DrumStep[] | undefined)[]> {
  const program = parseAsm(source);
  const labelAt = new Map<number, string>();
  for (const [name, index] of program.labels) labelAt.set(index, name);

  const stepsAt = (start: number): DrumStep[] => {
    const steps: DrumStep[] = [];
    for (let pc = start; pc < program.code.length; pc += 1) {
      const ins = program.code[pc]!;
      if (ins.op === 'sound_ret') return steps;
      if (ins.op !== 'noise_note') throw new Error(`drumkits line ${ins.line}: unexpected ${ins.op}`);
      const [len, vol, fade, freq] = ins.args.map((x) => num(x, ins.line)) as [number, number, number, number];
      steps.push([(len & 0xf) + 1, vol, fade, freq]);
    }
    return steps;
  };

  // Kits are runs of `dw` lines after a DrumkitN label; the first run is the table of kits.
  const kits: Record<number, (DrumStep[] | undefined)[]> = {};
  for (const [name, start] of program.labels) {
    const match = /^Drumkit(\d+)$/.exec(name);
    if (!match) continue;
    const instruments: (DrumStep[] | undefined)[] = [];
    for (let pc = start; program.code[pc]?.op === 'dw'; pc += 1) {
      const ref = program.code[pc]!.args[0]!;
      const target = program.labels.get(ref);
      instruments.push(target === undefined ? undefined : stepsAt(target));
    }
    kits[Number(match[1])] = instruments;
  }
  return kits;
}

/** Parse audio/wave_samples.asm into 32-step shapes. */
export function parseWaves(source: string): number[][] {
  return source
    .split('\n')
    .map((l) => l.replace(/;.*/, '').trim())
    .filter((l) => l.startsWith('dn '))
    .map((l) => l.slice(3).split(',').map((x) => Number(x.trim())));
}
