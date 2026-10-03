import { describe, expect, it } from 'vitest';
import atlas from '../src/sprites/atlas.json';
import { buildSprites } from '../src/sprites/defs';
import { spritesHash } from '../src/sprites/hash';
import { BIOMES } from '../src/data/biomes';
import { GEAR } from '../src/data/gear';
import { MATERIALS } from '../src/data/materials';
import { CONSUMABLES, FIXTURES } from '../src/data/recipes';
import { SKILLS } from '../src/data/progression';

describe('sprites', () => {
  it('the committed atlas matches the definitions (run `npm run bake`)', () => {
    expect(atlas.hash).toBe(spritesHash(buildSprites()));
  });

  it('has a sprite for everything the game draws', () => {
    const names = new Set(Object.keys(atlas.frames));
    const want = [
      ...BIOMES.flatMap((b) => [`rock-${b.id}-0`, `rock-${b.id}-1`, `seam-${b.id}`]),
      ...MATERIALS.map((m) => `item-${m.id}`),
      ...MATERIALS.filter((m) => m.kind === 'ore').map((m) => `vein-${m.id}`),
      ...GEAR.map((g) => `gear-${g.id}`),
      ...CONSUMABLES.map((c) => `use-${c.id}`),
      ...FIXTURES.map((f) => `fix-${f.id}`),
      ...SKILLS.map((k) => `skill-${k.id}`),
      'miner-0', 'miner-1', 'drone-0', 'rig-0', 'excavator-0', 'crack-1', 'crack-2', 'crack-3',
    ];
    expect(want.filter((n) => !names.has(n))).toEqual([]);
  });
});
