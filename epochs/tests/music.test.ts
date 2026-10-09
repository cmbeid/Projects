import { describe, expect, it } from 'vitest';
import { barSeconds, composeBar, ENSEMBLES, stepsPerBar } from '../src/audio/song';
import { ERAS } from '../src/data/eras';

function seeded(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
}

describe('the score', () => {
  it('gives every era its own ensemble, tempo and meter', () => {
    expect(new Set(ERAS.map((e) => e.song.ensemble)).size).toBe(ERAS.length);
    expect(new Set(ERAS.map((e) => `${e.song.bpm}/${e.song.meter}`)).size).toBe(ERAS.length);
    expect(new Set(ERAS.map((e) => ENSEMBLES[e.song.ensemble].melody)).size).toBeGreaterThanOrEqual(5);
  });

  it('keeps every note inside its bar and in range', () => {
    for (const e of ERAS) {
      const rand = seeded(1);
      for (let bar = 0; bar < 32; bar++) {
        for (const n of composeBar(e.song, bar, false, rand)) {
          expect(n.step).toBeGreaterThanOrEqual(0);
          expect(n.step + n.len).toBeLessThanOrEqual(stepsPerBar(e.song));
          if (n.voice === 'bass' || n.voice === 'drone') expect(n.midi).toBeLessThan(60);
          if (n.midi) expect(n.midi).toBeGreaterThan(20);
          if (n.midi) expect(n.midi).toBeLessThan(100);
        }
      }
      expect(barSeconds(e.song)).toBeGreaterThan(1);
      expect(barSeconds(e.song)).toBeLessThan(6);
    }
  });

  it('comes home to the tonic every eight bars', () => {
    for (const e of ERAS) {
      const melody = ENSEMBLES[e.song.ensemble].melody;
      const last = composeBar(e.song, 7, false, seeded(2)).filter((n) => n.voice === melody).at(-1)!;
      expect((((last.midi - e.song.key) % 12) + 12) % 12).toBe(0);
    }
  });

  it('drops the drums at night', () => {
    const p = ERAS[6]!.song;
    const night = composeBar(p, 0, true, seeded(3));
    expect(night.some((n) => n.voice === 'kick' || n.voice === 'clap')).toBe(false);
    expect(composeBar(p, 0, false, seeded(3)).some((n) => n.voice === 'kick')).toBe(true);
  });
});
