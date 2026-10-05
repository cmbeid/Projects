import { describe, expect, it } from 'vitest';
import atlas from '../src/sprites/atlas.json';
import { buildSprites } from '../src/sprites/defs';
import { spritesHash } from '../src/sprites/hash';
import { BUILDINGS } from '../src/data/buildings';
import { DISTRICTS } from '../src/data/districts';
import { MATERIALS } from '../src/data/materials';
import { EDICTS } from '../src/data/progression';
import { CONSUMABLES, FIXTURES } from '../src/data/recipes';
import { REGALIA } from '../src/data/regalia';

describe('sprites', () => {
  it('the committed atlas matches the definitions (run `npm run bake`)', () => {
    expect(atlas.hash).toBe(spritesHash(buildSprites()));
  });

  it('has a sprite for everything the game draws', () => {
    const names = new Set(Object.keys(atlas.frames));
    const want = [
      ...DISTRICTS.flatMap((d) => [`ruin-${d.id}-0`, `ruin-${d.id}-1`, `landmark-${d.id}`, `rubble-${d.id}`]),
      ...MATERIALS.map((m) => `item-${m.id}`),
      ...MATERIALS.filter((m) => m.kind === 'salvage').map((m) => `bits-${m.id}`),
      ...REGALIA.map((g) => `regalia-${g.id}`),
      ...BUILDINGS.map((b) => `bld-${b.id}`),
      ...CONSUMABLES.map((c) => `use-${c.id}`),
      ...FIXTURES.map((f) => `fix-${f.id}`),
      ...EDICTS.map((k) => `edict-${k.id}`),
      'founder-0', 'founder-1', 'tool-hammer', 'walker-0-0', 'walker-2-1', 'crack-1', 'crack-2', 'crack-3',
    ];
    expect(want.filter((n) => !names.has(n))).toEqual([]);
  });

  it('draws each building at its footprint', () => {
    const frames = atlas.frames as unknown as Record<string, [number, number, number, number]>;
    for (const b of BUILDINGS) {
      const [, , w, h] = frames[`bld-${b.id}`]!;
      expect([w, h]).toEqual([b.w * 16, b.h * 16]);
    }
  });
});
