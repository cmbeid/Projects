import { describe, expect, it } from 'vitest';
import { ENCOUNTERS } from '../src/data/encounters';
import { MAPS, MAP_IDS, mapSize, tileAt, walkable } from '../src/data/maps';
import { SPECIES } from '../src/data/species';
import { passableOn } from '../src/game/helpers';
import { pathTo } from '../src/game/path';
import { tapTile, tick } from '../src/game/world';
import { run, stand, world } from './helpers';

describe('maps and Route 1', () => {
  it('has rectangular maps with warps on walkable tiles, each way', () => {
    for (const id of MAP_IDS) {
      const { w } = mapSize(id);
      for (const row of MAPS[id].rows) expect(row.length, id).toBe(w);
      for (const warp of MAPS[id].warps) {
        expect(walkable(tileAt(id, warp.x, warp.y))).toBe(true);
        expect(walkable(tileAt(warp.to, warp.tx, warp.ty))).toBe(true);
      }
    }
  });

  it('lets you reach every patch of tall grass from the entrance', () => {
    const ok = passableOn('route1');
    MAPS.route1.rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === 'g') expect(pathTo({ x: 11, y: 1 }, { x, y }, ok), `${x},${y}`).not.toBeNull();
    }));
  });

  it('only lists real Pokémon', () => {
    for (const zones of Object.values(ENCOUNTERS)) for (const z of zones ?? []) for (const s of [...z.day, ...z.night]) expect(SPECIES.has(s.dex)).toBe(true);
  });

  it('walks out of the farm gate onto Route 1, with the party', () => {
    const w = world(7);
    stand(w, 11, 29);
    tapTile(w, 11, 31);
    run(w, 3);
    expect(w.map).toBe('route1');
    expect(w.helpers[0]!.y).toBeLessThan(5);
  });

  it('finds wild Pokémon in the tall grass', () => {
    const w = world(4);
    w.map = 'route1';
    stand(w, 2, 2);
    let steps = 0;
    while (!w.battle && steps < 400) {
      tapTile(w, steps % 2 ? 2 : 5, 3);
      for (let i = 0; i < 60 && !w.battle; i += 1) tick(w, 1 / 30);
      steps += 1;
    }
    expect(w.battle).not.toBeNull();
    expect(w.battle!.wild.level).toBeGreaterThanOrEqual(2);
    expect(w.battle!.wild.level).toBeLessThanOrEqual(5);
  });

  it("won't till Route 1", () => {
    const w = world();
    w.map = 'route1';
    stand(w, 5, 1);
    tapTile(w, 6, 1);
    run(w, 1);
    expect(Object.keys(w.plots)).toHaveLength(0);
  });
});
