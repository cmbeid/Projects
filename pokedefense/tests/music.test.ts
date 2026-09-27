import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TRACKS, trackSource } from '../src/data/music';
import { convertMidi, parseMidi } from '../scripts/music/midi';
import type { Song } from '../scripts/music/parse';

/** A tiny type-1 MIDI: a tempo, a loop, a C major arpeggio over a bass C. */
function tinyMidi(): Uint8Array {
  const vlq = (n: number): number[] => (n < 0x80 ? [n] : [0x80 | (n >> 7), n & 0x7f]);
  const track = (events: number[]): number[] => [0x4d, 0x54, 0x72, 0x6b, 0, 0, (events.length >> 8) & 0xff, events.length & 0xff, ...events];
  const meta = [0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20, 0, 0xff, 0x06, 1, 0x5b, ...vlq(96), 0xff, 0x06, 1, 0x5d, 0, 0xff, 0x2f, 0];
  const tune = [0, 0x90, 60, 100, 24, 0x80, 60, 0, 0, 0x90, 64, 100, 24, 0x80, 64, 0, 0, 0x90, 67, 100, 48, 0x80, 67, 0, 0, 0xff, 0x2f, 0];
  const bass = [0, 0x91, 36, 100, 96, 0x81, 36, 0, 0, 0xff, 0x2f, 0];
  return new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 3, 0, 24, ...track(meta), ...track(tune), ...track(bass)]);
}

describe('MIDI arrangement', () => {
  it('reads notes, tempo and the loop markers', () => {
    const p = parseMidi(tinyMidi());
    expect(p.notes.map((n) => n.pitch).sort()).toEqual([36, 60, 64, 67]);
    expect(p.tempos[0]!.usPerQuarter).toBe(500_000);
    expect([p.loopStart, p.loopEnd]).toEqual([0, 96]);
  });

  it('gives the tune to pulse 1 and the bass to the wave channel', () => {
    const song = convertMidi('tiny', tinyMidi());
    const [lead, , bass] = song.channels;
    expect(lead!.notes.map((n) => Math.round(n[2] as number))).toEqual([262, 330, 392]);
    expect(bass!.kind).toBe('wave');
    expect(Math.round(bass!.notes[0]![2] as number)).toBe(65);
    // Four beats at 120 bpm is two seconds.
    expect(lead!.end).toBe(Math.round(2 * song.frameRate));
    expect(lead!.loop).toBe(0);
  });

  it('converted every Hoenn track into a looping song', () => {
    for (const id of TRACKS.filter((t) => trackSource(t).from === 'emerald')) {
      const song = JSON.parse(readFileSync(`public/music/${id}.json`, 'utf8')) as Song;
      expect(song.channels.length, id).toBeGreaterThanOrEqual(3);
      for (const ch of song.channels) {
        expect(ch.notes.length, `${id} ${ch.kind}`).toBeGreaterThan(0);
        expect(ch.loop, id).not.toBeNull();
        // One voice never plays two notes at once.
        for (let i = 1; i < ch.notes.length; i += 1) expect(ch.notes[i]![0]).toBeGreaterThanOrEqual(ch.notes[i - 1]![0] as number);
      }
    }
  });
});
