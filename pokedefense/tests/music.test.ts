import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TRACKS, trackFile, trackSource } from '../src/data/music';
import { KALOS_SCORES } from '../scripts/music/kalos';
import { compileScore, readChannel } from '../scripts/music/score';
import { arrange, convertMidi, parseMidi } from '../scripts/music/midi';
import { drumPrograms, readSdat, readSseq } from '../scripts/music/sseq';
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

const mtrk = (events: number[]): number[] => [0x4d, 0x54, 0x72, 0x6b, 0, 0, (events.length >> 8) & 0xff, events.length & 0xff, ...events];
const marker = (text: string, type = 0x01): number[] => [0xff, type, text.length, ...[...text].map((c) => c.charCodeAt(0))];

/**
 * Platinum's layout: a note, LABEL01, a CALL02 at the same tick, a note,
 * JUMP01 back to LABEL01; then the called stretch (LABEL02, one note, return).
 */
function platinumMidi(): Uint8Array {
  const events = [
    0, 0x90, 60, 100, 48, 0x80, 60, 0,
    0, ...marker('LABEL01'),
    0, ...marker('CALL02'),
    0, 0x90, 64, 100, 48, 0x80, 64, 0,
    0, ...marker('JUMP01'),
    0, ...marker('LABEL02'),
    0, 0x90, 72, 100, 24, 0x80, 72, 0,
    0, ...marker('\u00fd', 0x06),
    0, 0xff, 0x2f, 0,
  ];
  return new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 1, 0, 48, ...mtrk(events)]);
}

/** Wrap sequence code in an SSEQ file. */
function sseq(code: number[]): Uint8Array {
  const size = 0x1c + code.length;
  const le32 = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
  return new Uint8Array([
    ...[...'SSEQ'].map((c) => c.charCodeAt(0)), 0xff, 0xfe, 0x00, 0x01, ...le32(size), 0x10, 0, 1, 0,
    ...[...'DATA'].map((c) => c.charCodeAt(0)), ...le32(size - 0x10), ...le32(0x1c), ...code,
  ]);
}

describe('DS sequences', () => {
  it('plays a Platinum call where it is made, and finds the loop', () => {
    const p = parseMidi(platinumMidi());
    const at = (pitch: number): number[] => p.notes.filter((n) => n.pitch === pitch).map((n) => n.start);
    expect(at(60)).toEqual([0]);
    // The call plays its 24 ticks at 48, pushing the next note to 72.
    expect(at(72)).toEqual([48]);
    expect(at(64)).toEqual([72]);
    expect([p.loopStart, p.loopEnd]).toEqual([48, 120]);
  });

  it('reads an SSEQ: two tracks, tempo, a counted loop, a call and the song loop', () => {
    // Track 0 opens track 1 at 0x20, sets 150 bpm, then: C (48) · loop ×2 { E (24) } · call G · jump back to the E loop.
    const t0 = [
      0xfe, 0x03, 0x00, 0x93, 0x01, 0x20, 0x00, 0x00, // 0x00: tracks 0 and 1; open track 1
      0xe1, 150, 0, // 0x08: tempo
      0x3c, 100, 48, // 0x0b: C4 for a beat
      0xd4, 2, 0x40, 100, 24, 0xfc, // 0x0e: twice E4 for half a beat
      0x95, 0x1c, 0x00, 0x00, // 0x14: call G
      0x94, 0x0e, 0x00, 0x00, // 0x18: loop back to the E loop
      0x43, 100, 24, 0xfd, // 0x1c: G4, return
    ];
    const t1 = [0x81, 3, 0x24, 90, 0x81, 0x40, 0xff]; // 0x20: program 3 (a drum set), C2 for 192 ticks, end
    const p = readSseq(sseq([...t0, ...t1]), new Set([3]));
    expect(p.tempos[0]!.usPerQuarter).toBe(400_000);
    const lead = p.notes.filter((n) => n.channel === 0).map((n) => [n.pitch, n.start]);
    expect(lead).toEqual([[60, 0], [64, 48], [64, 72], [67, 96]]);
    expect([p.loopStart, p.loopEnd]).toEqual([48, 120]);
    const drum = p.notes.find((n) => n.pitch === 36)!;
    expect(drum.channel).toBe(9);
    expect(drum.end - drum.start).toBe(192);
    const song = arrange('sseq', p);
    expect(song.channels.map((c) => c.kind)).toContain('noise');
  });

  it('finds sequences, their banks and the drum sets in an SDAT', () => {
    const le16 = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff];
    const le32 = (n: number): number[] => [...le16(n & 0xffff), ...le16(n >>> 16)];
    const seqFile = sseq([0x3c, 100, 48, 0xff]);
    // A bank with two instruments: 0 a plain sample, 1 a drum set.
    const bank = [...[...'SBNK'].map((c) => c.charCodeAt(0)), ...new Array(12).fill(0), ...[...'DATA'].map((c) => c.charCodeAt(0)), ...le32(0), ...new Array(32).fill(0), ...le32(2), 1, 0, 0, 0, 16, 0, 0, 0];
    const symb = 0x40;
    // SYMB: 8 list offsets, then the sequence list (1 name), then the name.
    const symbBlock = [...[...'SYMB'].map((c) => c.charCodeAt(0)), ...le32(0), ...le32(40), ...new Array(28).fill(0), ...le32(1), ...le32(48), ...[...'SEQ_BGM_TEST'].map((c) => c.charCodeAt(0)), 0];
    const info = symb + symbBlock.length;
    // INFO: 8 list offsets (sequences at 40, banks at 52), sequence entry at 60, bank entry at 72.
    const infoBlock = [
      ...[...'INFO'].map((c) => c.charCodeAt(0)), ...le32(0), ...le32(40), 0, 0, 0, 0, ...le32(52), ...new Array(20).fill(0),
      ...le32(1), ...le32(60), ...le32(0), // sequences: 1 → 60; (padding)
      ...le32(1), ...le32(72), // banks: 1 → 72
      ...le16(0), ...le16(0), ...le16(0), 127, 64, 64, 0, 0, 0, // sequence 0: file 0, bank 0
      ...le16(1), ...le16(0), ...le16(0), ...le16(0), // bank 0: file 1
    ];
    const fat = info + infoBlock.length;
    const files = fat + 12 + 2 * 16;
    const fatBlock = [...[...'FAT '].map((c) => c.charCodeAt(0)), ...le32(0), ...le32(2), ...le32(files), ...le32(seqFile.length), ...new Array(8).fill(0), ...le32(files + seqFile.length), ...le32(bank.length), ...new Array(8).fill(0)];
    const header = [...[...'SDAT'].map((c) => c.charCodeAt(0)), ...new Array(12).fill(0), ...le32(symb), ...le32(symbBlock.length), ...le32(info), ...le32(infoBlock.length), ...le32(fat), ...le32(fatBlock.length)];
    const sdat = new Uint8Array([...header, ...new Array(symb - header.length).fill(0), ...symbBlock, ...infoBlock, ...fatBlock, ...seqFile, ...bank]);
    const [seq] = readSdat(sdat);
    expect(seq!.name).toBe('SEQ_BGM_TEST');
    expect(readSseq(seq!.data).notes[0]!.pitch).toBe(60);
    expect([...drumPrograms(seq!.bank)]).toEqual([1]);
  });
});

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

  it('converted every Hoenn, Sinnoh and Kalos track into a looping song', () => {
    for (const id of TRACKS.filter((t) => ['emerald', 'platinum', 'score'].includes(trackSource(t).from))) {
      const song = JSON.parse(readFileSync(`public/music/${id}.json`, 'utf8')) as Song;
      expect(song.channels.length, id).toBeGreaterThanOrEqual(3);
      for (const ch of song.channels) {
        expect(ch.notes.length, `${id} ${ch.kind}`).toBeGreaterThan(0);
        expect(ch.loop, id).not.toBeNull();
        expect(ch.end - ch.loop!, id).toBeGreaterThan(5 * song.frameRate);
        // One voice never plays two notes at once.
        for (let i = 1; i < ch.notes.length; i += 1) expect(ch.notes[i]![0]).toBeGreaterThanOrEqual(ch.notes[i - 1]![0] as number);
      }
    }
  });
});

describe('score compiler', () => {
  it('reads notes, octaves, dots, ties, rests, repeats and the loop', () => {
    const { events, loop, end } = readChannel('o4 l8 c d4. | [ (e)2 r4 | > c2 ^4 <');
    expect(events.map((e) => [e.sound, e.tick, e.length])).toEqual([[60, 0, 24], [62, 24, 72], [64, 96, 24], [64, 120, 24], [72, 192, 144]]);
    expect([loop, end]).toEqual([96, 336]);
  });

  it('keeps every Kalos piece in step: all channels loop together', () => {
    for (const score of KALOS_SCORES.values()) {
      const song = compileScore(score);
      const ends = new Set(song.channels.map((c) => `${c.loop}-${c.end}`));
      expect(ends.size, score.id).toBe(1);
    }
  });

  it('stands a Platinum track in for each Unova one not yet converted', () => {
    for (const id of TRACKS.filter((t) => t.startsWith('u_'))) {
      const source = trackSource(id);
      if (source.from === 'sdat' && !source.file) expect(trackFile(id).startsWith('p_'), id).toBe(true);
    }
  });
});
