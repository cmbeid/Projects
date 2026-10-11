import { describe, expect, it } from 'vitest';
import { storyForSector } from '../src/data/story';
import { generateSector, hops, ROWS } from '../src/game/galaxy';
import { started } from './helpers';

describe('sector maps', () => {
  for (let index = 0; index < 6; index++) {
    it(`sector ${index + 1} is connected, has stations, and pins every mission`, () => {
      for (const seed of [1, 2, 3, 4, 5]) {
        const s = started();
        const sec = generateSector(s, index, seed * 97 + index);
        s.sector = sec;
        const d = hops(s, 0);
        expect(d.every((x) => Number.isFinite(x))).toBe(true);
        expect(sec.nodes[0]!.kind).toBe('entry');
        expect(sec.nodes[sec.nodes.length - 1]!.kind).toBe('gate');
        expect(sec.nodes[sec.nodes.length - 1]!.row).toBe(ROWS - 1);
        expect(sec.nodes.filter((n) => n.kind === 'station').length).toBeGreaterThanOrEqual(2);
        for (const m of storyForSector(index)) {
          if (m.objective.k === 'rescue') continue;
          const n = sec.nodes.find((x) => x.story === m.id);
          expect(n, `${m.id} pinned`).toBeTruthy();
          if (m.objective.k === 'land') {
            const p = n!.planets.find((x) => x.objective === m.id);
            expect(p?.biome).toBe(m.objective.biome);
          }
          if (m.objective.k === 'deliver') expect(n!.kind).toBe('station');
          if (m.objective.k === 'defeat') expect(n!.kind).toBe('patrol');
        }
        for (const n of sec.nodes) expect(n.x).toBeGreaterThan(0), expect(n.x).toBeLessThan(1);
      }
    });
  }

  it('the same seed makes the same map', () => {
    const a = started();
    const b = started();
    expect(JSON.stringify(generateSector(a, 2, 42).nodes.map((n) => [n.kind, n.links]))).toBe(
      JSON.stringify(generateSector(b, 2, 42).nodes.map((n) => [n.kind, n.links])),
    );
  });
});
