import { describe, expect, it } from 'vitest';
import { AREAS } from '../src/data/areas';
import { LEVELS } from '../src/data/levels';
import { ITEMS, TARGETS } from '../src/data/roster';
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
  it('are ten areas of six, in order, with unique ids', () => {
    expect(AREAS).toHaveLength(10);
    expect(LEVELS).toHaveLength(60);
    LEVELS.forEach((level, i) => {
      expect(level.area).toBe(Math.floor(i / 6));
      expect(level.index).toBe((i % 6) + 1);
    });
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
  });

  describe.each(LEVELS.map((l) => [l.id, l] as const))('%s', (_id, level) => {
    it('has something to hit and something to hit it with', () => {
      expect(level.targets.length).toBeGreaterThan(0);
      expect(level.launchers.length).toBeGreaterThanOrEqual(level.par);
      expect(level.par).toBeGreaterThan(0);
      expect(ITEMS[level.reward]).toBeDefined();
      for (const t of level.targets) expect(TARGETS[t.kind], t.kind).toBeDefined();
    });

    it('ends its area with the area boss, and only there', () => {
      const boss = AREAS[level.area]!.boss;
      const hasBoss = level.targets.some((t) => t.kind === boss);
      expect(hasBoss).toBe(level.index === 6);
    });

    it('keeps everything on the field, clear of the sling, and under any roof', () => {
      const things: Box[] = [
        ...level.blocks,
        ...level.targets.map((t) => ({ x: t.x, y: t.y, w: TARGETS[t.kind].radius * 2, h: TARGETS[t.kind].radius * 2 })),
      ];
      for (const b of things) {
        expect(b.x - b.w / 2).toBeGreaterThan(SLING.x + 300);
        expect(b.x + b.w / 2).toBeLessThan(level.width);
        expect(b.y + b.h / 2).toBeLessThanOrEqual(GROUND_Y + 0.01);
        if (level.ceiling !== undefined) expect(b.y - b.h / 2).toBeGreaterThan(level.ceiling);
      }
    });

    it('has no two things occupying the same space', () => {
      const things: (Box & { label: string })[] = [
        ...level.blocks.map((b, i) => ({ ...b, label: `block ${i} (${b.material} at ${b.x},${b.y})` })),
        ...level.terrain.map((t, i) => ({ ...t, label: `terrain ${i}` })),
        ...level.targets.map((t, i) => {
          const r = TARGETS[t.kind].radius;
          return { x: t.x, y: t.y, w: r * 1.4, h: r * 1.4, label: `target ${i} (${t.kind} at ${t.x},${t.y})` };
        }),
        ...(level.pickup ? [{ x: level.pickup.x, y: level.pickup.y, w: 32, h: 32, label: 'pickup' }] : []),
      ];
      for (let i = 0; i < things.length; i += 1) {
        for (let j = i + 1; j < things.length; j += 1) {
          const a = things[i]!;
          const b = things[j]!;
          expect(overlaps(a, b), `${a.label} overlaps ${b.label}`).toBe(false);
        }
      }
    });

    it('builds nothing over water except on rock', () => {
      for (const [x0, x1] of level.water ?? []) {
        expect(x0).toBeGreaterThan(SLING.x + 300);
        expect(x1).toBeLessThan(level.width);
        for (const b of level.blocks) {
          const onGround = Math.abs(b.y + b.h / 2 - GROUND_Y) < 0.5;
          if (onGround) expect(b.x + b.w / 2 <= x0 || b.x - b.w / 2 >= x1, `block at ${b.x} stands in water`).toBe(true);
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
