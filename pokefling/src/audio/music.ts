/**
 * Plays the Game Boy music converted by `scripts/fetch-music.ts`.
 *
 * A small lookahead sequencer: a timer wakes every 100 ms and schedules the
 * notes due in the next ~0.6 s on the Web Audio clock, so timing stays tight
 * however busy the page is. Each of the four channels is voiced the way the
 * hardware voices it — pulse waves at four duty cycles, a 32-step wave
 * table, and LFSR noise for drums — with the Game Boy's stepped volume
 * envelopes approximated as ramps. Channels loop independently, as they do
 * on the real thing.
 */
import type { DrumStep, NoiseNote, PulseNote, Song, WaveNote } from '../../scripts/music/parse';
import { musicUrl, type TrackId } from '../data/music';
import { audioContext, busNode, onUnlock } from './index';

const LOOKAHEAD = 0.6;
const TICK_MS = 100;
const FADE = 0.5;
/** Per-channel loudness, so four channels together do not clip. */
const LEVEL = { pulse: 0.1, wave: 0.16, noise: 0.07 } as const;
/** Gap before a song that does not loop (the title theme) starts again, in frames. */
const RESTART_GAP = 120;

const songs = new Map<TrackId, Promise<Song | null>>();

function loadSong(id: TrackId): Promise<Song | null> {
  let promise = songs.get(id);
  if (!promise) {
    promise = fetch(musicUrl(id))
      .then((r) => (r.ok ? (r.json() as Promise<Song>) : null))
      .catch(() => null);
    songs.set(id, promise);
  }
  return promise;
}

/** Fetch tracks ahead of time, so switching to them is instant. */
export function preloadMusic(ids: readonly TrackId[]): void {
  for (const id of ids) void loadSong(id);
}

// --- instruments -----------------------------------------------------------

interface Instruments {
  duty: PeriodicWave[];
  waves: Map<string, PeriodicWave>;
  noise15: AudioBuffer;
  noise7: AudioBuffer;
}

let instruments: Instruments | null = null;

/** A pulse wave `duty` of the time high, as Fourier coefficients. */
function pulseWave(ac: AudioContext, duty: number): PeriodicWave {
  const n = 64;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k += 1) {
    real[k] = Math.sin(2 * Math.PI * k * duty) / (k * Math.PI);
    imag[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (k * Math.PI);
  }
  return ac.createPeriodicWave(real, imag);
}

/** The wave channel's 32 four-bit samples, as a periodic wave. */
function tableWave(ac: AudioContext, samples: number[]): PeriodicWave {
  const n = samples.length;
  const harmonics = n / 2;
  const real = new Float32Array(harmonics);
  const imag = new Float32Array(harmonics);
  for (let k = 1; k < harmonics; k += 1) {
    let re = 0;
    let im = 0;
    samples.forEach((s, i) => {
      const v = (s - 7.5) / 7.5;
      re += v * Math.cos((2 * Math.PI * k * i) / n);
      im += v * Math.sin((2 * Math.PI * k * i) / n);
    });
    real[k] = (2 * re) / n;
    imag[k] = (2 * im) / n;
  }
  return ac.createPeriodicWave(real, imag);
}

/**
 * The noise channel's LFSR output, one shift per sample. Played back at
 * clock / sampleRate, it reproduces the hardware's noise at any clock. The
 * 7-bit mode repeats every 127 steps, which is what gives some drums a tone.
 */
function lfsrNoise(ac: AudioContext, short: boolean): AudioBuffer {
  const buffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const data = buffer.getChannelData(0);
  let lfsr = 0x7fff;
  for (let i = 0; i < data.length; i += 1) {
    const bit = (lfsr ^ (lfsr >> 1)) & 1;
    lfsr = (lfsr >> 1) | (bit << 14);
    if (short) lfsr = (lfsr & ~0x40) | (bit << 6);
    data[i] = lfsr & 1 ? -1 : 1;
  }
  return buffer;
}

function getInstruments(ac: AudioContext): Instruments {
  if (!instruments) {
    instruments = {
      duty: [0.125, 0.25, 0.5, 0.75].map((d) => pulseWave(ac, d)),
      waves: new Map(),
      noise15: lfsrNoise(ac, false),
      noise7: lfsrNoise(ac, true),
    };
  }
  return instruments;
}

/** Fade in and out over this long, so no note starts or stops with a click. */
const EDGE = 0.003;

/** A point on a gain curve: ramp linearly to `value` by `time`. */
export type EnvelopePoint = [time: number, value: number];

/**
 * The gain curve for one note, shaped like the hardware envelope: start at
 * `volume`/15 of `level` and step one level every `fade`/64 s — down, or up
 * when fade is negative — until the note ends.
 *
 * Every point is a ramp from the one before, starting from silence and
 * ending in it, so the curve never jumps: a jump in gain is heard as a pop.
 */
export function envelopePoints(t: number, end: number, volume: number, fade: number, level: number): EnvelopePoint[] {
  const start = (volume / 15) * level;
  const attack = Math.min(t + EDGE, end);
  /** The envelope's value at time `x`, ignoring the attack and release. */
  const at = (x: number): number => {
    if (fade > 0) return start * Math.max(0, 1 - (x - t) / ((volume * fade) / 64 || Infinity));
    if (fade < 0) return Math.min(level, start + (level - start) * ((x - t) / (((15 - volume) * -fade) / 64 || Infinity)));
    return start;
  };
  const points: EnvelopePoint[] = [[t, 0], [attack, at(attack)]];
  // The envelope's own corner — where it reaches silence or full — if the note lasts that long.
  const corner = fade > 0 ? t + (volume * fade) / 64 : fade < 0 ? t + ((15 - volume) * -fade) / 64 : Infinity;
  if (corner > attack && corner < end) points.push([corner, at(corner)]);
  points.push([end, at(end)], [end + EDGE, 0]);
  return points;
}

function applyEnvelope(gain: AudioParam, points: EnvelopePoint[]): void {
  const [first, ...rest] = points;
  gain.setValueAtTime(first![1], first![0]);
  for (const [time, value] of rest) gain.linearRampToValueAtTime(value, time);
}

function envelope(gain: AudioParam, t: number, end: number, volume: number, fade: number, level: number): void {
  applyEnvelope(gain, envelopePoints(t, end, volume, fade, level));
}

// --- playback --------------------------------------------------------------

interface ChannelCursor {
  next: number;
  /** Frames added to note times for each completed loop. */
  offset: number;
  loop: number;
  end: number;
}

interface Playing {
  id: TrackId;
  song: Song;
  out: GainNode;
  panners: Record<number, StereoPannerNode>;
  start: number;
  cursors: ChannelCursor[];
  stopAt: number | null;
}

let current: Playing | null = null;
const fading: Playing[] = [];
let wanted: TrackId | null = null;
let timer: number | null = null;

function scheduleNote(p: Playing, kind: 'pulse' | 'wave' | 'noise', note: PulseNote | WaveNote | NoiseNote, at: number): void {
  const ac = audioContext();
  if (!ac) return;
  const inst = getInstruments(ac);
  const fps = p.song.frameRate;
  const duration = note[1] / fps;
  const end = at + duration;
  const pan = p.panners[note[note.length - 1] as number] ?? p.panners[0]!;
  const gain = ac.createGain();
  gain.connect(pan);

  if (kind === 'noise') {
    const steps = p.song.drums[(note as NoiseNote)[2]];
    if (!steps) return;
    let t = at;
    let src: AudioBufferSourceNode | null = null;
    steps.forEach((step: DrumStep, i) => {
      if (t >= end) return;
      const [frames, volume, fade, nr43] = step;
      const shift = nr43 >> 4;
      const short = (nr43 & 8) !== 0;
      const divisor = nr43 & 7 || 0.5;
      const clock = 524288 / divisor / 2 ** (shift + 1);
      const s = ac.createBufferSource();
      s.buffer = short ? inst.noise7 : inst.noise15;
      s.loop = true;
      s.playbackRate.value = Math.min(16, Math.max(0.01, clock / ac.sampleRate));
      const stepGain = ac.createGain();
      s.connect(stepGain).connect(gain);
      const last = i === steps.length - 1;
      const stepEnd = last ? end : Math.min(end, t + frames / fps);
      envelope(stepGain.gain, t, stepEnd, volume, fade, LEVEL.noise);
      s.start(t);
      s.stop(stepEnd + EDGE + 0.005);
      src = s;
      t = stepEnd;
    });
    if (src) (src as AudioBufferSourceNode).onended = () => gain.disconnect();
    return;
  }

  const osc = ac.createOscillator();
  osc.frequency.value = note[2] as number;
  if (kind === 'pulse') {
    const [, , , volume, fade, duty] = note as PulseNote;
    osc.setPeriodicWave(inst.duty[duty] ?? inst.duty[2]!);
    envelope(gain.gain, at, end, volume, fade, LEVEL.pulse);
  } else {
    const [, , , level, waveIndex] = note as WaveNote;
    let wave = inst.waves.get(String(waveIndex));
    const samples = p.song.waves[String(waveIndex)];
    if (!wave && samples) {
      wave = tableWave(ac, samples);
      inst.waves.set(String(waveIndex), wave);
    }
    if (wave) osc.setPeriodicWave(wave);
    const loudness = [0, 1, 0.5, 0.25][level] ?? 0;
    // The wave channel has no envelope: a flat level, faded in and out.
    applyEnvelope(gain.gain, envelopePoints(at, end, 15, 0, loudness * LEVEL.wave));
  }
  osc.connect(gain);
  osc.start(at);
  osc.stop(end + EDGE + 0.005);
  osc.onended = () => gain.disconnect();
}

function schedule(p: Playing, until: number): void {
  const fps = p.song.frameRate;
  p.song.channels.forEach((ch, i) => {
    const cursor = p.cursors[i]!;
    for (let guard = 0; guard < 2000; guard += 1) {
      const note = ch.notes[cursor.next];
      if (!note) {
        // End of the notes: go round again from the loop point.
        cursor.offset += cursor.end - cursor.loop;
        cursor.next = ch.notes.findIndex((n) => n[0] >= cursor.loop);
        if (cursor.next < 0) return;
        continue;
      }
      const at = p.start + (note[0] + cursor.offset) / fps;
      if (at > until) return;
      if (p.stopAt !== null && at > p.stopAt) return;
      // Notes already past (the tab was hidden, say) are skipped, not crammed in late.
      if (at >= audioContext()!.currentTime - 0.05) scheduleNote(p, ch.kind, note, Math.max(at, audioContext()!.currentTime));
      cursor.next += 1;
    }
  });
}

function tick(): void {
  const ac = audioContext();
  if (!ac) return;
  const until = ac.currentTime + LOOKAHEAD;
  if (current) schedule(current, until);
  for (let i = fading.length - 1; i >= 0; i -= 1) {
    const p = fading[i]!;
    if (p.stopAt !== null && ac.currentTime > p.stopAt + 0.2) {
      p.out.disconnect();
      fading.splice(i, 1);
    } else {
      schedule(p, Math.min(until, p.stopAt ?? until));
    }
  }
}

function startPlaying(id: TrackId, song: Song): void {
  const ac = audioContext();
  const bus = busNode('music');
  if (!ac || !bus) return;
  const out = ac.createGain();
  out.gain.setValueAtTime(0, ac.currentTime);
  out.gain.linearRampToValueAtTime(1, ac.currentTime + FADE);
  out.connect(bus);
  const panners: Record<number, StereoPannerNode> = {};
  for (const side of [-1, 0, 1]) {
    const panner = ac.createStereoPanner();
    panner.pan.value = side * 0.6;
    panner.connect(out);
    panners[side] = panner;
  }
  // A song that never loops (the title theme) restarts as a whole after a pause.
  const songEnd = Math.max(...song.channels.map((c) => c.end)) + RESTART_GAP;
  current = {
    id, song, out, panners, start: ac.currentTime + 0.05, stopAt: null,
    cursors: song.channels.map((c) => ({ next: 0, offset: 0, loop: c.loop ?? 0, end: c.loop === null ? songEnd : c.end })),
  };
  tick();
}

function fadeOutCurrent(): void {
  const ac = audioContext();
  if (!current || !ac) return;
  current.out.gain.cancelScheduledValues(ac.currentTime);
  current.out.gain.setValueAtTime(current.out.gain.value, ac.currentTime);
  current.out.gain.linearRampToValueAtTime(0, ac.currentTime + FADE);
  current.stopAt = ac.currentTime + FADE;
  fading.push(current);
  current = null;
}

/** Crossfade to a track. Asking for the one already playing does nothing. */
export function playMusic(id: TrackId): void {
  wanted = id;
  if (current?.id === id) return;
  onUnlock(() => {
    if (timer === null) timer = window.setInterval(tick, TICK_MS);
    void loadSong(id).then((song) => {
      if (wanted !== id || current?.id === id) return;
      fadeOutCurrent();
      if (song) startPlaying(id, song);
    });
  });
}

export function stopMusic(): void {
  wanted = null;
  fadeOutCurrent();
}
