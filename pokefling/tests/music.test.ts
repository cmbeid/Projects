import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { convertSong, hzFor, parseAsm, periodFor, type PulseNote, type Song } from '../scripts/music/parse';
import { TRACKS } from '../src/data/music';
import { envelopePoints } from '../src/audio/music';

const NO_DRUMS = { drumkits: {}, waves: [[...Array(32).keys()].map((i) => i % 16)] };

function song(body: string): Song {
  return convertSong('test', `Music_Test:
	channel_count 1
	channel 1, Music_Test_Ch1

Music_Test_Ch1:
${body}`, NO_DRUMS);
}

describe('pokecrystal music parser', () => {
  it('reads labels with and without colons, and scopes local ones', () => {
    const program = parseAsm('Global:\n\tnote C_, 1\n.local\n\trest 1\nOther::\n.local:\n\trest 1\n');
    expect(program.labels.get('Global')).toBe(0);
    expect(program.labels.get('Global.local')).toBe(1);
    expect(program.labels.get('Other.local')).toBe(2);
  });

  it('pitches `octave 4` A at 880 Hz, as the engine does', () => {
    // `octave 4` is stored as 8 − 4, and the engine shifts the table value
    // right 7 − 4 times: the lowest octave is C2, so octave 4 sounds as A5.
    const hz = hzFor(periodFor(10, 8 - 4, 0, 0), 'pulse');
    expect(hz).toBeGreaterThan(875);
    expect(hz).toBeLessThan(885);
    // The wave channel sounds an octave lower for the same register value.
    expect(hzFor(periodFor(10, 8 - 4, 0, 0), 'wave')).toBeCloseTo(hz / 2);
  });

  it('times notes as speed × length × tempo / 256 frames, carrying the remainder', () => {
    const { channels } = song(`	tempo 256
	note_type 12, 10, 1
	octave 4
	note C_, 1
	note D_, 2
	sound_ret`);
    const notes = channels[0]!.notes as PulseNote[];
    expect(notes.map((n) => [n[0], n[1]])).toEqual([[0, 12], [12, 24]]);
    // Volume and fade come from note_type.
    expect(notes[0]![3]).toBe(10);
    expect(notes[0]![4]).toBe(1);
    expect(channels[0]!.loop).toBeNull();
    expect(channels[0]!.end).toBe(36);
  });

  it('keeps fractional frames: three notes of 1.5 frames take 4 frames, not 3', () => {
    const { channels } = song(`	tempo 128
	note_type 3, 10, 1
	octave 4
	note C_, 1
	note C_, 1
	note C_, 1
	sound_ret`);
    const notes = channels[0]!.notes as PulseNote[];
    // 3 × 128 / 256 = 1.5 frames each: 1, 2, 1 as the remainder carries.
    expect(notes.map((n) => n[1])).toEqual([1, 2, 1]);
  });

  it('runs a finite loop body `count` times, calls and returns, and finds the loop point', () => {
    const { channels } = song(`	tempo 256
	note_type 1, 10, 1
	octave 4
	note C_, 1
.mainloop:
	sound_call .sub
	sound_loop 3, .mainloop
	note E_, 1
	sound_loop 0, .mainloop
.sub:
	note D_, 1
	sound_ret`);
    const ch = channels[0]!;
    const pitches = (ch.notes as PulseNote[]).map((n) => Math.round(n[2]));
    const [c, d, e] = [periodFor(1, 8 - 4, 0, 0), periodFor(3, 8 - 4, 0, 0), periodFor(5, 8 - 4, 0, 0)].map((p) => Math.round(hzFor(p, 'pulse')));
    expect(pitches).toEqual([c, d, d, d, e]);
    expect(ch.loop).toBe(1);
    expect(ch.end).toBe(5);
  });

  it('follows a loop into another channel\'s code, as Mt. Moon\'s first channel does', () => {
    const result = convertSong('test', `Music_Test:
	channel_count 2
	channel 1, Music_Test_Ch1
	channel 2, Music_Test_Ch2

Music_Test_Ch1:
	tempo 256
	note_type 1, 10, 1
	octave 4
	rest 2
	sound_loop 0, Music_Test_Ch2.mainloop

Music_Test_Ch2:
	note_type 1, 10, 1
	octave 4
.mainloop:
	note C_, 1
	sound_loop 0, .mainloop`, NO_DRUMS);
    expect(result.channels[0]!.loop).toBe(2);
    expect(result.channels[0]!.notes.length).toBe(1);
  });

  it('retimes every channel when one changes tempo', () => {
    const result = convertSong('test', `Music_Test:
	channel_count 2
	channel 1, Music_Test_Ch1
	channel 2, Music_Test_Ch2

Music_Test_Ch1:
	tempo 256
	note_type 1, 10, 1
	octave 4
	note C_, 4
	tempo 512
	note C_, 4
	sound_ret

Music_Test_Ch2:
	note_type 1, 10, 1
	octave 4
	note C_, 2
	note C_, 2
	note C_, 2
	sound_ret`, NO_DRUMS);
    const ch2 = result.channels[1]!.notes as PulseNote[];
    // The third note starts at frame 4, after channel 1's tempo doubles lengths.
    expect(ch2.map((n) => [n[0], n[1]])).toEqual([[0, 2], [2, 2], [4, 4]]);
  });

  it('refuses commands it does not understand', () => {
    expect(() => song('\tpitch_sweep 3, 4\n\tsound_ret')).toThrow(/unsupported command pitch_sweep/);
  });
});

describe('committed music', () => {
  it.each([...TRACKS])('%s converts to something playable', (id) => {
    const track = JSON.parse(readFileSync(`public/music/${id}.json`, 'utf8')) as Song;
    expect(track.channels.length).toBeGreaterThanOrEqual(3);
    for (const ch of track.channels) {
      expect(ch.notes.length).toBeGreaterThan(0);
      expect(ch.end).toBeGreaterThan(0);
      if (ch.loop !== null) expect(ch.end).toBeGreaterThan(ch.loop);
      if (ch.kind !== 'noise') {
        for (const n of ch.notes) {
          expect(n[2]).toBeGreaterThan(30);
          expect(n[2]).toBeLessThan(8000);
        }
      } else {
        for (const n of ch.notes) expect(track.drums[n[2] as string]).toBeDefined();
      }
    }
  });
});

describe('note envelopes', () => {
  const LEVEL = 0.1;
  const cases = [
    ['a steady note', 10, 0],
    ['a note that fades out before it ends', 12, 1],
    ['a note that fades out slowly', 12, 7],
    ['a note that swells', 4, -2],
    ['a silent note', 0, 3],
    ['a full-volume swell (nothing to swell to)', 15, -3],
  ] as const;

  it.each(cases)('%s starts and ends in silence and never jumps', (_name, volume, fade) => {
    for (const duration of [0.001, 0.05, 0.4, 2]) {
      const points = envelopePoints(1, 1 + duration, volume, fade, LEVEL);
      // Silence at both ends: no note may start or stop with a click.
      expect(points[0]).toEqual([1, 0]);
      expect(points[points.length - 1]![1]).toBe(0);
      for (let i = 1; i < points.length; i += 1) {
        // Only ramps between points, forward in time: nothing to jump.
        expect(points[i]![0]).toBeGreaterThanOrEqual(points[i - 1]![0]);
        // Never louder than the channel's full level. The pop came from the
        // release briefly jumping to a fresh gain node's default of 1.0.
        expect(points[i]![1]).toBeGreaterThanOrEqual(0);
        expect(points[i]![1]).toBeLessThanOrEqual(LEVEL + 1e-9);
      }
    }
  });

  it('follows the hardware envelope: a fade of 1 loses a level every 1/64 s', () => {
    const points = envelopePoints(0, 1, 8, 1, LEVEL);
    // Starts at 8/15, reaches silence after 8/64 s, and stays there.
    expect(points[1]![1]).toBeCloseTo((8 / 15) * LEVEL * (1 - 0.003 / (8 / 64)), 6);
    expect(points).toContainEqual([8 / 64, 0]);
    expect(points[points.length - 2]).toEqual([1, 0]);
  });
});
