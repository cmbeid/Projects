import { describe, expect, it } from 'vitest';
import { NO_TRAINER } from '../src/data/items';
import { MAPS, mapDef } from '../src/data/maps';
import { REGION_IDS, REGIONS } from '../src/data/regions';
import { line, LINES } from '../src/data/towers';
import { playOut } from '../src/game/bot';
import { ICE_SLIDE, newGame, placeTower, startWave, step, type Tower, weatherBoost } from '../src/game/game';
import { towerStats } from '../src/game/stats';
import { buildWave } from '../src/game/waves';
import { freshProgress, lineUnlocked, mapUnlocked, type Progress, regionMaps, regionUnlocked } from '../src/state/save';

function champion(p: Progress, region: 'kanto' | 'johto' | 'hoenn'): Progress {
  for (const m of regionMaps(region)) if (!m.endless) p.results[m.id] = { normal: 1, hard: 0, best: 0 };
  return p;
}

describe('regions', () => {
  it('opens each region once the one before has a Champion', () => {
    const p = freshProgress();
    expect(REGION_IDS.map((id) => regionUnlocked(p, id))).toEqual([true, false, false]);
    expect(mapUnlocked(p, mapDef('sprout-tower'))).toBe(false);
    champion(p, 'kanto');
    expect(REGION_IDS.map((id) => regionUnlocked(p, id))).toEqual([true, true, false]);
    expect(mapUnlocked(p, mapDef('sprout-tower'))).toBe(true);
    expect(mapUnlocked(p, mapDef('ilex-forest'))).toBe(false);
    expect(mapUnlocked(p, mapDef('mt-silver'))).toBe(false);
    champion(p, 'johto');
    expect(mapUnlocked(p, mapDef('mt-silver'))).toBe(true);
    expect(regionUnlocked(p, 'hoenn')).toBe(true);
  });

  it('gives each region’s starters on arrival, and its badge towers with its badges', () => {
    const p = freshProgress();
    expect(lineUnlocked(p, line('cyndaquil'))).toBe(false);
    champion(p, 'kanto');
    for (const id of REGIONS.johto.starters) expect(lineUnlocked(p, line(id))).toBe(true);
    expect(lineUnlocked(p, line('mareep'))).toBe(false);
    p.results['sprout-tower'] = { normal: 2, hard: 0, best: 0 };
    expect(lineUnlocked(p, line('mareep'))).toBe(true);
    expect(lineUnlocked(p, line('treecko'))).toBe(false);
  });

  it('keeps every region in order: nine campaign maps then an endless one, a League last', () => {
    for (const id of REGION_IDS) {
      const maps = regionMaps(id);
      expect(maps).toHaveLength(10);
      expect(maps[9]!.endless).toBe(true);
      expect(maps[8]!.id).toBe(REGIONS[id].league);
      expect(maps[9]!.id).toBe(REGIONS[id].endless);
    }
    expect(MAPS).toHaveLength(30);
  });

  it('gives every region its three starters as towers', () => {
    for (const id of REGION_IDS) for (const s of REGIONS[id].starters) expect(LINES.some((l) => l.id === s)).toBe(true);
  });
});

describe('Johto and Hoenn mechanics', () => {
  it('lets weather boost and weaken types', () => {
    expect(weatherBoost('rain', 'water')).toBeGreaterThan(1);
    expect(weatherBoost('rain', 'fire')).toBeLessThan(1);
    expect(weatherBoost('sun', 'fire')).toBeGreaterThan(1);
    expect(weatherBoost(undefined, 'fire')).toBe(1);
  });

  it('wears enemies down in a sandstorm', () => {
    const g = newGame({ map: mapDef('sky-pillar'), difficulty: 'normal', team: [], items: {}, balls: {}, held: {}, trainer: NO_TRAINER, seed: 3 });
    startWave(g);
    for (let i = 0; i < 60 * 3 && !g.enemies.length; i += 1) step(g);
    const e = g.enemies.find((x) => !x.sp.types.some((t) => ['rock', 'ground', 'steel'].includes(t)))!;
    const before = e.hp;
    for (let i = 0; i < 60; i += 1) step(g);
    expect(e.hp).toBeLessThan(before);
  });

  it('makes enemies slide faster over ice', () => {
    const g = newGame({ map: mapDef('lake-of-rage'), difficulty: 'normal', team: [], items: {}, balls: {}, held: {}, trainer: NO_TRAINER, seed: 3 });
    expect(g.iceSet.size).toBeGreaterThan(0);
    expect(ICE_SLIDE).toBeGreaterThan(1);
  });

  it('sends Tate & Liza out together, one down each lane', () => {
    const map = mapDef('mossdeep');
    const bosses = buildWave(map, map.waves).filter((s) => s.boss);
    expect(bosses.map((b) => b.dex).sort()).toEqual([337, 338]);
    expect(new Set(bosses.map((b) => b.path)).size).toBe(2);
  });

  it('turns a sandy Trapinch into a Flygon that can hit flyers', () => {
    const l = line('trapinch');
    const at = (level: number) => towerStats(l, { level, branch: null, move: null, held: null, ledge: false });
    expect(at(1).groundOnly).toBe(true);
    expect(at(5).groundOnly).toBe(false);
    expect(at(5).dex).toBe(330);
  });

  it('lets Ralts become Gardevoir or Gallade', () => {
    const l = line('ralts');
    const at = (branch: number) => towerStats(l, { level: 5, branch, move: null, held: null, ledge: false });
    expect(at(0).dex).toBe(282);
    expect(at(1).dex).toBe(475);
  });

  it('speeds Torchic up wave after wave', () => {
    const g = newGame({ map: mapDef('petalburg-woods'), difficulty: 'normal', team: ['torchic'], items: {}, balls: {}, held: {}, trainer: NO_TRAINER, seed: 3 });
    const t = placeTower(g, 'torchic', 2, 5) as Tower;
    expect(t.stats.effects.accelerate).toBeGreaterThan(0);
    startWave(g);
    for (let i = 0; i < 60 * 120 && g.cleared < 1; i += 1) step(g);
    expect(t.wavesFought).toBe(1);
  });

  it('can be won by the bot on the first maps of Johto and Hoenn', () => {
    const johtoTeam = ['totodile', 'cyndaquil', 'chikorita', 'pikachu', 'geodude', 'abra', 'machop', 'pidgey'];
    const hoennTeam = ['treecko', 'torchic', 'mudkip', 'totodile', 'houndour', 'mareep', 'skarmory', 'machop'];
    for (const [id, team] of [['sprout-tower', johtoTeam], ['petalburg-woods', hoennTeam]] as const) {
      const g = newGame({ map: mapDef(id), difficulty: 'normal', team: [...team], items: {}, balls: {}, held: {}, trainer: NO_TRAINER, seed: 1 });
      playOut(g);
      expect(g.status, id).toBe('won');
    }
  });
});
