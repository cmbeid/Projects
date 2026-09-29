import { describe, expect, it } from 'vitest';
import { HELD_ITEMS, ITEM_ICONS } from '../src/data/items';
import { BUILDABLE, COLS, mapBosses, MAPS, pathTiles, ROWS, terrainAt, waypointXY } from '../src/data/maps';
import { SPECIES, species } from '../src/data/species';
import { LINES, levelCost, lineDexes, lineForDex, MAX_LEVEL, MEGAS } from '../src/data/towers';
import { effectiveness } from '../src/data/types';
import { REGIONS } from '../src/data/regions';

describe('type chart', () => {
  it('knows the classics', () => {
    expect(effectiveness('water', ['fire'])).toBe(2);
    expect(effectiveness('electric', ['ground'])).toBe(0);
    expect(effectiveness('grass', ['rock', 'ground'])).toBe(4);
    expect(effectiveness('fire', ['water', 'rock'])).toBe(0.25);
    expect(effectiveness('normal', ['ghost', 'poison'])).toBe(0);
    expect(effectiveness('dragon', ['fairy'])).toBe(0);
  });
});

describe('maps', () => {
  for (const map of MAPS) {
    describe(map.name, () => {
      it('has a 9 × 15 grid', () => {
        expect(map.grid).toHaveLength(ROWS);
        for (const row of map.grid) expect(row).toHaveLength(COLS);
      });

      it('has paths made of straight runs that start off the map', () => {
        for (const path of map.paths) {
          const first = waypointXY(path[0]!);
          expect(first.x < 0 || first.y < 0 || first.x >= COLS || first.y >= ROWS).toBe(true);
          for (let i = 1; i < path.length; i += 1) {
            const a = waypointXY(path[i - 1]!);
            const b = waypointXY(path[i]!);
            if (!b.warp) expect(a.x === b.x || a.y === b.y).toBe(true);
          }
        }
      });

      it('leaves room to build', () => {
        const onPath = pathTiles(map);
        let land = 0;
        for (let y = 0; y < ROWS; y += 1) {
          for (let x = 0; x < COLS; x += 1) {
            const t = terrainAt(map, x, y);
            if (!onPath.has(`${x},${y}`) && BUILDABLE.has(t)) land += 1;
          }
        }
        expect(land).toBeGreaterThanOrEqual(30);
        expect(onPath.size).toBeGreaterThanOrEqual(20);
      });

      it('only uses species that exist', () => {
        for (const p of map.pool) expect(SPECIES.has(p.dex)).toBe(true);
        for (const b of mapBosses(map)) {
          expect(SPECIES.has(b.dex)).toBe(true);
          if (b.mega) expect(SPECIES.has(b.mega)).toBe(true);
          for (const dex of b.escort) expect(SPECIES.has(dex)).toBe(true);
          for (const ab of b.abilities) if (ab.kind === 'summon') expect(SPECIES.has(ab.dex)).toBe(true);
        }
      });
    });
  }

  it('awards every region’s 8 badges once each, in their own regions', () => {
    const badges = MAPS.map((m) => m.badge).filter((b): b is number => Boolean(b));
    expect(badges.sort((a, b) => a - b)).toEqual(Object.values(REGIONS).flatMap((r) => r.badges).sort((a, b) => a - b));
    expect(badges).toHaveLength(72);
    for (const m of MAPS) if (m.badge) expect(REGIONS[m.regionId].badges).toContain(m.badge);
  });
});

describe('tower lines', () => {
  it('has 141 lines, every Pokémon in them known', () => {
    expect(LINES).toHaveLength(141);
    expect(new Set(LINES.map((l) => l.id)).size).toBe(LINES.length);
    for (const l of LINES) for (const dex of lineDexes(l)) expect(SPECIES.has(dex)).toBe(true);
  });

  it('can catch every catch-only line somewhere', () => {
    const wild = new Set(MAPS.flatMap((m) => m.pool.map((p) => p.dex)));
    for (const l of LINES.filter((x) => x.unlock.kind === 'catch')) {
      expect(lineDexes(l).some((dex) => wild.has(dex)), l.name).toBe(true);
    }
  });

  it('maps each dex to one line', () => {
    expect(lineForDex(5)?.id).toBe('charmander');
    expect(lineForDex(135)?.id).toBe('eevee');
    expect(lineForDex(19)).toBeUndefined();
  });

  it('prices each level more than the last', () => {
    for (const l of LINES) {
      for (let lv = 2; lv < MAX_LEVEL; lv += 1) expect(levelCost(l, lv)).toBeGreaterThan(levelCost(l, lv - 1));
    }
  });

  it('gives each Mega Evolution a form, from a stage some line reaches', () => {
    const stages = new Set(LINES.flatMap(lineDexes));
    for (const [dex, mega] of MEGAS) {
      expect(stages.has(dex), `#${dex}`).toBe(true);
      expect(SPECIES.has(mega.form), `#${mega.form}`).toBe(true);
    }
  });

  it('gives every line a stage at level 1', () => {
    for (const l of LINES) expect(l.stages[0]!.level).toBe(1);
  });
});

describe('items', () => {
  it('has an icon for everything', () => {
    for (const h of HELD_ITEMS) expect(ITEM_ICONS).toContain(h.icon ?? h.key);
  });
  it('names every species', () => {
    expect(species(25).name).toBe('Pikachu');
  });
});
