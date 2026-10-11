import { describe, expect, it } from 'vitest';
import atlas from '../src/sprites/atlas.json';
import { BIOMES, FAUNA } from '../src/data/biomes';
import { CLASSES } from '../src/data/crew';
import { ENEMIES } from '../src/data/enemies';
import { CONSUMABLES, MATERIALS } from '../src/data/materials';
import { NODE_KINDS } from '../src/data/sectors';
import { buildSprites } from '../src/sprites/defs';
import { spritesHash } from '../src/sprites/hash';

describe('sprites', () => {
  it('the committed atlas matches the definitions (run `npm run bake`)', () => {
    expect(atlas.hash).toBe(spritesHash(buildSprites()));
  });

  it('has a sprite for everything the game draws', () => {
    const names = new Set(Object.keys(atlas.frames));
    const want = [
      'ship-wren', 'ent-lander', 'ent-cache', 'ent-terminal', 'ent-pod', 'ent-objective', 'ent-turret', 'icon-colonist', 'icon-day',
      ...ENEMIES.map((e) => e.sprite),
      ...BIOMES.flatMap((b) => [`planet-${b.id}`, `planet-${b.id}-big`, `tile-${b.id}-floor0`, `tile-${b.id}-floor1`, `tile-${b.id}-wall`, `tile-${b.id}-rock`, `tile-${b.id}-liquid0`, `tile-${b.id}-liquid1`, `tile-${b.id}-hazard`]),
      ...FAUNA.flatMap((f) => [`fauna-${f.id}-0`, `fauna-${f.id}-1`, `fauna-${f.id}-alpha`]),
      ...CLASSES.flatMap((c) => [`explorer-${c.id}-0`, `explorer-${c.id}-1`, `class-${c.id}`]),
      ...MATERIALS.map((m) => `mat-${m.id}`),
      ...MATERIALS.filter((m) => !m.refined).map((m) => `ent-node-${m.id}`),
      ...CONSUMABLES.map((c) => `item-${c.id}`),
      ...NODE_KINDS.map((k) => `node-${k.id}`),
      ...['weapons', 'shields', 'engines', 'sensors', 'life'].map((x) => `sub-${x}`),
      ...['weapon', 'suit', 'tool', 'module'].map((x) => `gear-${x}`),
      ...['fuel', 'food', 'energy', 'hull', 'credits'].map((x) => `res-${x}`),
    ];
    expect(want.filter((n) => !names.has(n))).toEqual([]);
  });

  it('every enemy ship looks different', () => {
    const px = new Map(buildSprites().map((s) => [s.name, s.px.join()]));
    const pics = ENEMIES.map((e) => px.get(e.sprite));
    expect(new Set(pics).size).toBe(pics.length);
  });
});
