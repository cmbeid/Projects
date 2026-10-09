import { describe, expect, it } from 'vitest';
import atlas from '../src/sprites/atlas.json';
import { LINES } from '../src/data/buildings';
import { ERAS } from '../src/data/eras';
import { RESOURCES } from '../src/data/resources';
import { WONDERS } from '../src/data/wonders';
import { buildSprites, buildingSprite } from '../src/sprites/defs';
import { spritesHash } from '../src/sprites/hash';

describe('sprites', () => {
  it('the committed atlas matches the definitions (run `npm run bake`)', () => {
    expect(atlas.hash).toBe(spritesHash(buildSprites()));
  });

  it('has a sprite for everything the game draws', () => {
    const names = new Set(Object.keys(atlas.frames));
    const want = [
      ...LINES.flatMap((l) => l.tiers.map((t) => buildingSprite(l.id, t.era))),
      ...WONDERS.map((w) => `wonder-${w.id}`),
      ...RESOURCES.map((r) => `res-${r.id}`),
      ...ERAS.map((e) => `era-${e.index}`),
      ...ERAS.flatMap((e) => [0, 1, 2].flatMap((k) => [`citizen-${e.index}-${k}-0`, `citizen-${e.index}-${k}-1`])),
      'icon-people', 'icon-land', 'icon-stability', 'icon-power', 'icon-heritage', 'icon-clock', 'cloud', 'scaffold',
    ];
    expect(want.filter((n) => !names.has(n))).toEqual([]);
  });

  it('draws every building one plot wide, and every wonder at its size', () => {
    const frames = atlas.frames as unknown as Record<string, [number, number, number, number]>;
    for (const l of LINES) for (const t of l.tiers) expect(frames[buildingSprite(l.id, t.era)]![2]).toBe(16);
    for (const w of WONDERS) expect(frames[`wonder-${w.id}`]!.slice(2)).toEqual([w.w, w.h]);
  });

  it('gives each line a different picture in every era', () => {
    const sprites = new Map(buildSprites().map((s) => [s.name, s.px.join()]));
    for (const l of LINES) {
      const pics = l.tiers.map((t) => sprites.get(buildingSprite(l.id, t.era)));
      expect(new Set(pics).size).toBe(pics.length);
    }
  });
});
