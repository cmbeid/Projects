import { describe, expect, it } from 'vitest';
import { NO_TRAINER } from '../src/data/items';
import { MAPS, mapDef } from '../src/data/maps';
import { REGION_IDS, type RegionId, REGIONS } from '../src/data/regions';
import { KEY_STONE, line, LINES, MAX_LEVEL, MEGA_SECONDS } from '../src/data/towers';
import { playOut } from '../src/game/bot';
import { canMega, type Game, ICE_SLIDE, levelUp, megaEvolve, newGame, placeTower, proteanType, startWave, STEP, step, type Tower, weatherBoost } from '../src/game/game';
import { FOG_RANGE, towerStats } from '../src/game/stats';
import { buildWave } from '../src/game/waves';
import { freshProgress, lineUnlocked, mapUnlocked, type Progress, regionMaps, regionUnlocked } from '../src/state/save';

function champion(p: Progress, region: RegionId): Progress {
  for (const m of regionMaps(region)) if (!m.endless) p.results[m.id] = { normal: 1, hard: 0, best: 0 };
  return p;
}

describe('regions', () => {
  it('opens each region once the one before has a Champion', () => {
    const p = freshProgress();
    expect(REGION_IDS.map((id) => regionUnlocked(p, id))).toEqual([true, false, false, false, false, false]);
    expect(mapUnlocked(p, mapDef('sprout-tower'))).toBe(false);
    champion(p, 'kanto');
    expect(REGION_IDS.map((id) => regionUnlocked(p, id))).toEqual([true, true, false, false, false, false]);
    expect(mapUnlocked(p, mapDef('sprout-tower'))).toBe(true);
    expect(mapUnlocked(p, mapDef('ilex-forest'))).toBe(false);
    expect(mapUnlocked(p, mapDef('mt-silver'))).toBe(false);
    champion(p, 'johto');
    expect(mapUnlocked(p, mapDef('mt-silver'))).toBe(true);
    expect(regionUnlocked(p, 'hoenn')).toBe(true);
    for (const id of ['hoenn', 'sinnoh', 'unova'] as const) champion(p, id);
    expect(REGION_IDS.every((id) => regionUnlocked(p, id))).toBe(true);
    expect(mapUnlocked(p, mapDef('santalune-forest'))).toBe(true);
    expect(mapUnlocked(p, mapDef('glittering-cave'))).toBe(false);
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
    expect(MAPS).toHaveLength(60);
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

describe('Sinnoh, Unova and Kalos mechanics', () => {
  const battle = (id: string, team: string[] = [], held: Record<string, string> = {}): Game =>
    newGame({ map: mapDef(id), difficulty: 'normal', team, items: {}, balls: {}, held, trainer: NO_TRAINER, seed: 3 });

  it('shortens towers’ reach in fog, but not a Flying type’s or a Wide Lens holder’s', () => {
    const at = (id: string, fog: boolean, held: string | null = null) => towerStats(line(id), { level: 1, branch: null, move: null, held, ledge: false, fog }).range;
    expect(at('piplup', true)).toBeCloseTo(at('piplup', false) * FOG_RANGE);
    expect(at('pidove', true)).toBe(at('pidove', false));
    expect(at('piplup', true, 'wide-lens')).toBe(at('piplup', false, 'wide-lens'));
    const g = battle('hearthome', ['piplup']);
    const t = placeTower(g, 'piplup', 4, 7) as Tower;
    expect(t.stats.range).toBeCloseTo(at('piplup', false) * FOG_RANGE);
  });

  it('sends the Striaton triplets out together, one down each of three lanes', () => {
    const map = mapDef('striaton');
    const bosses = buildWave(map, map.waves).filter((s) => s.boss);
    expect(bosses.map((b) => b.dex).sort()).toEqual([512, 514, 516]);
    expect(new Set(bosses.map((b) => b.path)).size).toBe(3);
  });

  it('takes turns between an endless map’s legends', () => {
    const map = mapDef('spear-pillar');
    const bossAt = (wave: number) => buildWave(map, wave).find((s) => s.boss && s.boss.escort.length)!.dex;
    expect([bossAt(25), bossAt(50), bossAt(75), bossAt(100)]).toEqual([487, 483, 484, 487]);
  });

  it('lets Protean take whichever type hits hardest', () => {
    expect(proteanType('water', ['fire'])).toBe('water');
    expect(proteanType('water', ['grass', 'dragon'])).toBe('ice');
    expect(proteanType('water', ['psychic'])).toBe('dark');
  });

  it('Mega Evolves a grown tower holding a Key Stone: once a battle, for a while', () => {
    const g = battle('santalune-forest', ['riolu', 'gible'], { riolu: KEY_STONE, gible: KEY_STONE });
    g.money = 1e6;
    const a = placeTower(g, 'riolu', 2, 6) as Tower;
    const b = placeTower(g, 'gible', 6, 6) as Tower;
    expect(canMega(g, a)).toBe(false);
    while (a.level < MAX_LEVEL) levelUp(g, a.id);
    while (b.level < MAX_LEVEL) levelUp(g, b.id);
    const before = a.stats.damage;
    expect(canMega(g, a)).toBe(true);
    expect(megaEvolve(g, a.id)).toBe(true);
    expect(a.stats.dex).toBe(10059);
    expect(a.stats.damage).toBeGreaterThan(before * 1.4);
    // Only one Mega Evolution a battle.
    expect(canMega(g, b)).toBe(false);
    for (let i = 0; i < (MEGA_SECONDS + 1) / STEP; i += 1) step(g);
    expect(a.stats.dex).toBe(448);
    expect(a.stats.damage).toBeCloseTo(before);
  });

  it('won’t Mega Evolve without a Key Stone', () => {
    const g = battle('santalune-forest', ['riolu']);
    g.money = 1e6;
    const a = placeTower(g, 'riolu', 2, 6) as Tower;
    while (a.level < MAX_LEVEL) levelUp(g, a.id);
    expect(canMega(g, a)).toBe(false);
  });

  it('Mega Evolves Korrina’s Lucario once it’s hurt', () => {
    const map = mapDef('tower-of-mastery');
    expect(map.boss.mega).toBe(10059);
    const g = battle('tower-of-mastery');
    g.lives = 1000;
    g.wave = map.waves - 1;
    startWave(g);
    let lucario: Game['enemies'][number] | undefined;
    for (let i = 0; i < 60 * 60 && !lucario; i += 1) {
      step(g);
      lucario = g.enemies.find((e) => e.boss);
    }
    lucario!.hp = lucario!.maxHp * 0.4;
    step(g);
    expect(lucario!.dex).toBe(10059);
    expect(lucario!.origin).toBe(448);
  });
});
