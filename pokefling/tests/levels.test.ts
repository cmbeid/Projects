import { describe, expect, it } from 'vitest';
import { LEVELS, WORLDS } from '../src/data/levels';
import { TARGETS } from '../src/data/roster';
import { maxScore, starThresholds, starsFor, targetPoints } from '../src/game/scoring';
import { GROUND_Y, SLING } from '../src/game/world';

interface Box { x: number; y: number; w: number; h: number }

/** Overlap deeper than rounding: touching faces are fine, interpenetration is not. */
function overlaps(a: Box, b: Box): boolean {
  const ox = (a.w + b.w) / 2 - Math.abs(a.x - b.x);
  const oy = (a.h + b.h) / 2 - Math.abs(a.y - b.y);
  return ox > 0.5 && oy > 0.5;
}

describe('levels', () => {
  it('are numbered 1..n in order, in known worlds', () => {
    expect(LEVELS.map((l) => l.id)).toEqual(LEVELS.map((_, i) => i + 1));
    for (const level of LEVELS) expect(WORLDS[level.world]).toBeDefined();
  });

  describe.each(LEVELS.map((l) => [l.id, l] as const))('level %i', (_id, level) => {
    it('has something to hit and something to hit it with', () => {
      expect(level.targets.length).toBeGreaterThan(0);
      expect(level.launchers.length).toBeGreaterThanOrEqual(level.par);
      expect(level.par).toBeGreaterThan(0);
    });

    it('keeps everything on the field, clear of the sling', () => {
      const things: Box[] = [
        ...level.blocks,
        ...level.targets.map((t) => ({ x: t.x, y: t.y, w: TARGETS[t.kind].radius * 2, h: TARGETS[t.kind].radius * 2 })),
      ];
      for (const b of things) {
        expect(b.x - b.w / 2).toBeGreaterThan(SLING.x + 300);
        expect(b.x + b.w / 2).toBeLessThan(level.width);
        expect(b.y + b.h / 2).toBeLessThanOrEqual(GROUND_Y + 0.01);
      }
    });

    it('has no two things occupying the same space', () => {
      const things: (Box & { label: string })[] = [
        ...level.blocks.map((b, i) => ({ ...b, label: `block ${i} (${b.material})` })),
        ...level.terrain.map((t, i) => ({ ...t, label: `terrain ${i}` })),
        ...level.targets.map((t, i) => {
          const r = TARGETS[t.kind].radius;
          return { x: t.x, y: t.y, w: r * 1.4, h: r * 1.4, label: `target ${i} (${t.kind})` };
        }),
      ];
      for (let i = 0; i < things.length; i += 1) {
        for (let j = i + 1; j < things.length; j += 1) {
          const a = things[i]!;
          const b = things[j]!;
          expect(overlaps(a, b), `${a.label} overlaps ${b.label}`).toBe(false);
        }
      }
    });

    it('has reachable, ordered star thresholds', () => {
      const [two, three] = starThresholds(level);
      expect(two).toBeGreaterThan(targetPoints(level));
      expect(three).toBeGreaterThan(two);
      expect(three).toBeLessThanOrEqual(maxScore(level));
    });
  });
});

describe('stars', () => {
  const level = LEVELS[0]!;
  it('are zero for a loss, whatever the score', () => {
    expect(starsFor(level, 1e9, false)).toBe(0);
  });
  it('are at least one for any win', () => {
    expect(starsFor(level, 0, true)).toBe(1);
  });
  it('are three at the top threshold', () => {
    expect(starsFor(level, starThresholds(level)[1], true)).toBe(3);
  });
});
