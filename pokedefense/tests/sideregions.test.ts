import { describe, expect, it } from 'vitest';
import { NO_TRAINER } from '../src/data/items';
import { COLS, mapDef, ROWS, terrainAt } from '../src/data/maps';
import { ALPHA_HP, canPlace, type Enemy, type Game, newGame, placeTower, powerupReady, startWave, step } from '../src/game/game';
import { restoreGame, serializeGame } from '../src/game/snapshot';
import { buildWave } from '../src/game/waves';

const setup = { difficulty: 'normal' as const, items: { 'x-attack': 2 }, balls: {}, held: {}, trainer: NO_TRAINER, seed: 7 };
const battle = (mapId: string, team: string[]): Game => newGame({ ...setup, map: mapDef(mapId), team });

function until(g: Game, test: (e: Enemy) => boolean): Enemy {
  for (let i = 0; i < 60 * 180; i += 1) {
    const found = g.enemies.find((e) => e.alive && test(e));
    if (found) return found;
    step(g);
  }
  throw new Error('nothing came');
}

function bossWave(mapId: string): { g: Game; boss: Enemy } {
  const g = battle(mapId, []);
  g.lives = 999;
  g.wave = g.map.waves - 1;
  startWave(g);
  return { g, boss: until(g, (e) => e.boss && e.dex === g.map.boss.dex) };
}

describe('the Orange Crew’s rules', () => {
  it('lets only swimmers battle on Mikan Island', () => {
    const g = battle('mikan-island', ['venonat', 'marill']);
    g.money = 1e6;
    let water: [number, number] | undefined;
    for (let y = 0; y < ROWS && !water; y += 1) for (let x = 0; x < COLS; x += 1) if (terrainAt(g.map, x, y) === 'water' && !g.pathSet.has(`${x},${y}`)) water = [x, y];
    expect(canPlace(g, 'venonat', water![0], water![1])).toBe('rule');
    expect(canPlace(g, 'marill', water![0], water![1])).toBeNull();
  });

  it('caps Navel Island at six towers', () => {
    const g = battle('navel-island', ['vulpix']);
    g.money = 1e6;
    let placed = 0;
    let last: string | null = null;
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const err = canPlace(g, 'vulpix', x, y);
        if (err === null) {
          placeTower(g, 'vulpix', x, y);
          placed += 1;
        } else if (err === 'limit') last = err;
      }
    }
    expect(placed).toBe(6);
    expect(last).toBe('limit');
  });

  it('allows no items on Pinkan Island', () => {
    const g = battle('pinkan-island', ['vulpix']);
    expect(g.items['x-attack']).toBe(0);
    expect(powerupReady(g, 'x-attack')).toBe(false);
    expect(battle('valencia-island', ['vulpix']).items['x-attack']).toBe(2);
  });
});

describe('Hisui', () => {
  it('sends out Alphas: bigger, far tougher, and worth more', () => {
    const map = mapDef('obsidian-fieldlands');
    const wave = Array.from({ length: map.waves }, (_, i) => i + 1).find((w) => buildWave(map, w).some((s) => s.alpha))!;
    expect(wave).toBeDefined();
    const g = battle('obsidian-fieldlands', []);
    g.lives = 999;
    g.wave = wave - 1;
    startWave(g);
    const alpha = until(g, (e) => e.alpha);
    const plain = until(g, (e) => !e.alpha && e.dex === alpha.dex && e.wave === alpha.wave);
    expect(alpha.maxHp / plain.maxHp).toBeCloseTo(ALPHA_HP, 1);
    expect(alpha.bounty).toBeGreaterThan(plain.bounty * 2);
  });

  it('has a frenzied Noble shield itself and stun towers at two-thirds and one-third HP', () => {
    const { g, boss } = bossWave('obsidian-fieldlands');
    expect(boss.frenzy).toBe(2);
    boss.hp = boss.maxHp * 0.6;
    step(g);
    expect(boss.frenzy).toBe(1);
    expect(boss.status.shieldUntil).toBeGreaterThan(g.t);
    boss.hp = boss.maxHp * 0.3;
    step(g);
    expect(boss.frenzy).toBe(0);
  });
});

describe('Kitakami', () => {
  it('has Ogerpon change mask, and type, as it’s worn down — even through a saved battle', () => {
    const { g, boss } = bossWave('timeless-woods');
    expect(boss.sp.types).toEqual(['grass']);
    boss.hp = boss.maxHp * 0.7;
    step(g);
    expect([boss.dex, boss.sp.types]).toEqual([10273, ['water']]);
    const r = restoreGame(serializeGame(g), { ...setup, team: [], held: {} })!;
    const again = r.enemies.find((e) => e.boss)!;
    expect(again.sp.types).toEqual(['water']);
    again.hp = again.maxHp * 0.45;
    step(r);
    expect([again.dex, again.sp.types]).toEqual([10274, ['fire']]);
  });

  it('wakes Terapagos into its Terastal, then Stellar, Form', () => {
    const { g, boss } = bossWave('blueberry-league');
    boss.hp = boss.maxHp * 0.6;
    step(g);
    expect(boss.dex).toBe(10276);
    boss.hp = boss.maxHp * 0.3;
    step(g);
    expect(boss.dex).toBe(10277);
  });
});
