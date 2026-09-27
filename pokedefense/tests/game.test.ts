import { describe, expect, it } from 'vitest';
import { NO_TRAINER } from '../src/data/items';
import { mapDef, MAPS } from '../src/data/maps';
import { playOut } from '../src/game/bot';
import {
  canPlace, catchChance, retryWave, chooseMove, type Game, levelUp, newGame, placeTower, sellTower, sellValue, startWave, step,
  throwBall, type Tower, usePowerup,
} from '../src/game/game';
import { buildPath, pointAt } from '../src/game/path';
import { towerStats } from '../src/game/stats';
import { buildWave, hpScale, isBossWave } from '../src/game/waves';
import { line } from '../src/data/towers';

function game(mapId = 'viridian-forest', extra: Partial<Parameters<typeof newGame>[0]> = {}): Game {
  return newGame({
    map: mapDef(mapId), difficulty: 'normal', team: ['charmander', 'squirtle', 'bulbasaur', 'pidgey', 'diglett', 'eevee', 'magikarp'],
    items: {}, balls: { 'poke-ball': 3 }, held: {}, trainer: NO_TRAINER, seed: 7, ...extra,
  });
}

function run(g: Game, seconds: number): void {
  for (let i = 0; i < seconds * 60; i += 1) step(g);
}

describe('paths', () => {
  it('walks from the first waypoint to the last', () => {
    const p = buildPath(mapDef('viridian-forest'), 0);
    expect(pointAt(p, 0)).toMatchObject({ x: 1.5, y: -0.5 });
    const end = pointAt(p, p.length);
    expect(end.x).toBeCloseTo(5.5);
    expect(end.y).toBeCloseTo(15.5);
  });

  it('jumps across a warp without walking it', () => {
    const map = mapDef('silph-co');
    const p = buildPath(map, 0);
    // (-1,1) → (7,1) → (7,4) → (1,4): 8 + 3 + 6 tiles, then the warp to (7,7).
    const at = pointAt(p, 17.01);
    expect(at.x).toBeCloseTo(7.5 - 0.01, 1);
    expect(at.y).toBeCloseTo(7.5);
  });
});

describe('waves', () => {
  it('builds the same wave every time', () => {
    const map = mapDef('mt-moon');
    expect(buildWave(map, 7)).toEqual(buildWave(map, 7));
  });

  it('ends every map with its boss', () => {
    for (const map of MAPS.filter((m) => !m.endless)) {
      expect(isBossWave(map, map.waves)).toBe(true);
      expect(buildWave(map, map.waves).some((s) => s.boss?.dex === map.boss.dex)).toBe(true);
    }
  });

  it('grows HP with waves and tiers', () => {
    expect(hpScale(1, 10)).toBeGreaterThan(hpScale(1, 1));
    expect(hpScale(5, 1)).toBeGreaterThan(hpScale(1, 1));
  });
});

describe('towers', () => {
  it('evolves as it levels', () => {
    const l = line('charmander');
    const at = (level: number) => towerStats(l, { level, branch: null, move: null, held: null, ledge: false });
    expect(at(1).dex).toBe(4);
    expect(at(3).dex).toBe(5);
    expect(at(6).dex).toBe(6);
    expect(at(6).damage).toBeGreaterThan(at(1).damage * 4);
  });

  it('turns Magikarp into a real threat', () => {
    const l = line('magikarp');
    const at = (level: number) => towerStats(l, { level, branch: null, move: null, held: null, ledge: false });
    expect(at(2).damage).toBeLessThan(3);
    expect(at(3).dex).toBe(130);
    expect(at(3).damage).toBeGreaterThan(30);
  });

  it('boosts matching types with held items and range on ledges', () => {
    const l = line('charmander');
    const plain = towerStats(l, { level: 1, branch: null, move: null, held: null, ledge: false });
    const boosted = towerStats(l, { level: 1, branch: null, move: null, held: 'charcoal', ledge: true });
    expect(boosted.damage).toBeCloseTo(plain.damage * 1.25);
    expect(boosted.range).toBeCloseTo(plain.range + 0.5);
    expect(towerStats(l, { level: 1, branch: null, move: null, held: 'mystic-water', ledge: false }).damage).toBeCloseTo(plain.damage);
  });

  it('places only on the right ground', () => {
    const g = game();
    expect(canPlace(g, 'charmander', 1, 1)).toBe('terrain'); // path
    expect(canPlace(g, 'charmander', 0, 0)).toBe('terrain'); // tree
    expect(canPlace(g, 'charmander', 3, 1)).toBeNull();
    expect(canPlace(g, 'diglett', 1, 1)).toBeNull(); // Diglett lives under the path
    expect(canPlace(g, 'diglett', 3, 1)).toBe('terrain');
    expect(canPlace(g, 'abra', 3, 1)).toBe('team');
  });

  it('charges, levels, evolves and refunds', () => {
    const g = game();
    g.money = 10_000;
    const t = placeTower(g, 'charmander', 3, 1) as Tower;
    expect(g.money).toBe(10_000 - 100);
    // Sold before any wave: a full refund.
    expect(sellValue(g, t)).toBe(100);
    levelUp(g, t.id);
    levelUp(g, t.id);
    expect(t.stats.dex).toBe(5);
    expect(g.events.some((e) => e.kind === 'level' && e.evolved)).toBe(true);
    startWave(g);
    expect(sellValue(g, t)).toBe(Math.floor(t.invested * 0.7));
    const before = g.money;
    sellTower(g, t.id);
    expect(g.money).toBe(before + Math.floor(t.invested * 0.7));
    expect(g.towers).toHaveLength(0);
  });

  it('makes Eevee choose a stone', () => {
    const g = game();
    g.money = 10_000;
    const t = placeTower(g, 'eevee', 3, 1) as Tower;
    levelUp(g, t.id);
    levelUp(g, t.id);
    expect(levelUp(g, t.id)).toBe('branch');
    expect(levelUp(g, t.id, { branch: 1 })).toBeNull();
    expect(t.stats.dex).toBe(135);
    expect(t.stats.type).toBe('electric');
  });

  it('learns one signature move at the top level', () => {
    const g = game();
    g.money = 100_000;
    const t = placeTower(g, 'squirtle', 3, 1) as Tower;
    expect(chooseMove(g, t.id, 0)).toBe('invalid');
    for (let i = 0; i < 5; i += 1) levelUp(g, t.id);
    expect(chooseMove(g, t.id, 0)).toBeNull();
    expect(t.stats.attack).toBe('beam');
    expect(chooseMove(g, t.id, 1)).toBe('invalid');
  });
});

describe('battle', () => {
  it('knocks out wild Pokémon and pays for them', () => {
    const g = game();
    placeTower(g, 'charmander', 2, 2);
    placeTower(g, 'squirtle', 2, 4);
    const money = g.money;
    startWave(g);
    run(g, 40);
    expect(g.log.kills).toBeGreaterThan(0);
    expect(g.money).toBeGreaterThan(money);
    expect(g.cleared).toBe(1);
  });

  it('loses lives to Pokémon that get through', () => {
    const g = game();
    startWave(g);
    run(g, 60);
    expect(g.lives).toBeLessThan(g.maxLives);
    expect(g.log.leaked).toBeGreaterThan(0);
  });

  it('catches weakened Pokémon more easily', () => {
    const g = game();
    startWave(g);
    run(g, 2);
    const e = g.enemies[0]!;
    const full = catchChance(g, e, 'poke-ball');
    e.hp = 1;
    expect(catchChance(g, e, 'poke-ball')).toBeGreaterThan(full);
    expect(catchChance(g, e, 'master-ball')).toBe(1);
  });

  it('resolves a throw after the ball shakes', () => {
    const g = game(undefined, { balls: { 'master-ball': 1 } });
    startWave(g);
    run(g, 2);
    const e = g.enemies[0]!;
    const result = throwBall(g, 'master-ball', e.x, e.y);
    expect(result).toBe(e);
    run(g, 3);
    expect(g.log.caught.map((c) => c.dex)).toContain(e.dex);
    expect(g.balls['master-ball']).toBe(0);
  });

  it('uses power-ups once, then waits for the cooldown', () => {
    const g = game(undefined, { items: { 'x-attack': 2, 'full-restore': 1 } });
    expect(usePowerup(g, 'x-attack')).toBeNull();
    expect(usePowerup(g, 'x-attack')).toBe('cooldown');
    expect(g.items['x-attack']).toBe(1);
    expect(usePowerup(g, 'full-restore')).toBe('unused');
  });

  it('makes you retry a gym leader wave you fail', () => {
    const g = game();
    g.money = 10_000;
    // Skip to the boss wave, with one tower that can't stop Onix.
    g.wave = g.totalWaves - 1;
    g.cleared = g.totalWaves - 1;
    const t = placeTower(g, 'pidgey', 3, 1) as Tower;
    const money = g.money;
    startWave(g);
    for (let i = 0; i < 60 * 300 && g.status === 'playing'; i += 1) step(g);
    expect(g.status).toBe('retry');
    expect(g.events.some((e) => e.kind === 'bossFailed')).toBe(true);

    expect(retryWave(g)).toBe(true);
    expect(g.status).toBe('playing');
    expect(g.wave).toBe(g.totalWaves - 1);
    expect(g.money).toBe(money);
    expect(g.lives).toBe(g.maxLives);
    expect(g.enemies).toHaveLength(0);
    expect(g.towers.map((x) => x.id)).toEqual([t.id]);
    expect(g.towers[0]!.line).toBe(line('pidgey'));

    // Better prepared, the retried wave can be won.
    for (const [x, y] of [[2, 2], [2, 4], [3, 4], [2, 5], [0, 8], [2, 8], [2, 9], [3, 9]] as const) placeTower(g, 'squirtle', x, y);
    for (const tw of g.towers) for (let i = 0; i < 5; i += 1) levelUp(g, tw.id);
    startWave(g);
    for (let i = 0; i < 60 * 300 && g.status === 'playing'; i += 1) step(g);
    expect(g.status).toBe('won');
  });

  it('makes you retry even when the boss is the last of its wave to get through', () => {
    const g = game();
    g.wave = g.totalWaves - 1;
    g.cleared = g.totalWaves - 1;
    g.lives = g.maxLives = 200;
    startWave(g);
    // Nothing to stop them: the escorts leak first, then Onix, emptying the wave.
    for (let i = 0; i < 60 * 400 && g.status === 'playing'; i += 1) step(g);
    expect(g.status).toBe('retry');
    expect(g.lives).toBeGreaterThan(0);
  });

  it('still ends the battle when lives run out on an ordinary wave', () => {
    const g = game();
    g.lives = 1;
    startWave(g);
    for (let i = 0; i < 60 * 120 && g.status === 'playing'; i += 1) step(g);
    expect(g.status).toBe('lost');
  });

  it('can be won by the bot on the first map', () => {
    const g = game('viridian-forest', { team: ['charmander', 'squirtle', 'bulbasaur', 'pidgey'] });
    playOut(g);
    expect(g.status).toBe('won');
  });
});

describe('bosses', () => {
  it('walk at half their listed speed, leads at three quarters', async () => {
    const { BOSS_SPEED, LEAD_SPEED } = await import('../src/game/game');
    const g = game();
    g.wave = g.totalWaves - 1;
    startWave(g);
    for (let i = 0; i < 60 * 60 && !g.enemies.some((e) => e.boss); i += 1) step(g);
    const boss = g.enemies.find((e) => e.boss)!;
    expect(boss.speed).toBeCloseTo(mapDef('viridian-forest').boss.speed! * BOSS_SPEED);
    expect(LEAD_SPEED).toBeLessThan(1);
  });
});
