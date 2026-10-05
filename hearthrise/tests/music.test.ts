import { describe, expect, it } from 'vitest';
import { barSeconds, composeBar, stepsPerBar } from '../src/audio/song';
import { DISTRICTS } from '../src/data/districts';

/** A seeded roll, so the tunes compose the same way every run. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}

describe('the chip score', () => {
  it('gives every district its own tune: tempo, meter and key', () => {
    const shapes = new Set(DISTRICTS.map((d) => `${d.music.bpm}/${d.music.meter}/${d.music.key}/${d.music.drums}`));
    expect(shapes.size).toBe(DISTRICTS.length);
    expect(new Set(DISTRICTS.map((d) => d.music.drums)).size).toBeGreaterThanOrEqual(7);
  });

  it('keeps every note inside its bar and in a sensible range', () => {
    for (const d of DISTRICTS) {
      const rand = seeded(1);
      for (let bar = 0; bar < 32; bar++) {
        for (const n of composeBar(d.music, bar, false, rand)) {
          expect(n.step).toBeGreaterThanOrEqual(0);
          expect(n.step + n.len).toBeLessThanOrEqual(stepsPerBar(d.music));
          if (n.ch === 'lead') expect(n.midi).toBeGreaterThanOrEqual(48);
          if (n.ch === 'lead') expect(n.midi).toBeLessThanOrEqual(96);
          if (n.ch === 'bass') expect(n.midi).toBeLessThan(60);
        }
      }
      expect(barSeconds(d.music)).toBeGreaterThan(0.5);
      expect(barSeconds(d.music)).toBeLessThan(3);
    }
  });

  it('comes home to the tonic at the end of every eight bars', () => {
    for (const d of DISTRICTS) {
      const last = composeBar(d.music, 7, false, seeded(2)).filter((n) => n.ch === 'lead').at(-1)!;
      expect((last.midi - d.music.key) % 12).toBe(0);
    }
  });

  it('thins out at night: no drums, and quieter', () => {
    const p = DISTRICTS[2]!.music;
    const day = composeBar(p, 0, false, seeded(3));
    const night = composeBar(p, 0, true, seeded(3));
    expect(night.some((n) => n.ch === 'kick' || n.ch === 'snare')).toBe(false);
    expect(day.some((n) => n.ch === 'kick')).toBe(true);
    expect(night.length).toBeLessThan(day.length);
  });
});
