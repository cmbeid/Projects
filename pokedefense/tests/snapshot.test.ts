import { describe, expect, it } from 'vitest';
import { NO_TRAINER } from '../src/data/items';
import { mapDef } from '../src/data/maps';
import { botTurn, playOut } from '../src/game/bot';
import { type Game, hasNextWave, newGame, retryWave, startWave, step } from '../src/game/game';
import { restoreGame, serializeGame } from '../src/game/snapshot';
import { clearBattle, loadBattle, saveBattle } from '../src/state/save';

const setup = { difficulty: 'normal' as const, team: ['charmander', 'squirtle', 'bulbasaur', 'pidgey'], items: {}, balls: { 'poke-ball': 3 }, held: {}, trainer: NO_TRAINER, seed: 7 };

/** A battle a few waves in, with towers built and enemies on the path. */
function midBattle(mapId = 'viridian-forest'): Game {
  const g = newGame({ ...setup, map: mapDef(mapId) });
  let next = 0;
  while (g.wave < 4 || !g.enemies.length) {
    if (g.t >= next) {
      botTurn(g);
      next = g.t + 0.5;
      if (g.openWaves.size === 0 && hasNextWave(g)) startWave(g);
    }
    step(g);
    g.events.length = 0;
  }
  return g;
}

describe('saving a battle in progress', () => {
  it('restores it exactly: towers, enemies, money, waves, what is still to come', () => {
    const g = midBattle();
    const r = restoreGame(serializeGame(g), setup)!;
    expect(r).not.toBeNull();
    for (const key of ['t', 'money', 'lives', 'wave', 'cleared', 'nextId', 'status', 'pending', 'balls', 'items'] as const) {
      expect(r[key], key).toEqual(g[key]);
    }
    expect([...r.openWaves]).toEqual([...g.openWaves]);
    expect([...r.log.seen]).toEqual([...g.log.seen]);
    expect(r.towers.map((t) => [t.line.id, t.level, t.x, t.y, t.stats.damage])).toEqual(g.towers.map((t) => [t.line.id, t.level, t.x, t.y, t.stats.damage]));
    expect(r.enemies.map((e) => [e.dex, e.hp, e.dist])).toEqual(g.enemies.map((e) => [e.dex, e.hp, e.dist]));
    // Shared data is relinked, not copied.
    expect(r.towers[0]!.line).toBe(g.towers[0]!.line);
    expect(r.enemies[0]!.sp).toBe(g.enemies[0]!.sp);
    expect(r.map).toBe(g.map);
    expect(r.pathSet.size).toBe(g.pathSet.size);
  });

  it('carries on to the end after being restored', () => {
    const r = restoreGame(serializeGame(midBattle()), setup)!;
    playOut(r);
    expect(r.status).toBe('won');
  });

  it('keeps a failed gym leader’s wave ready to retry', () => {
    const map = mapDef('viridian-forest');
    const g = newGame({ ...setup, map });
    g.lives = 999;
    g.wave = map.waves - 1;
    startWave(g);
    for (let i = 0; i < 60 * 300 && g.status === 'playing'; i += 1) step(g);
    expect(g.status).toBe('retry');
    const r = restoreGame(serializeGame(g), setup)!;
    expect(r.status).toBe('retry');
    expect(r.checkpoint?.state.openWaves).toBeInstanceOf(Set);
    expect(retryWave(r)).toBe(true);
    expect(r.wave).toBe(map.waves - 1);
    // The gym leader still costs half your lives when it comes out again.
    startWave(r);
    for (let i = 0; i < 60 * 120 && !r.enemies.some((e) => e.boss); i += 1) step(r);
    expect(r.enemies.find((e) => e.boss)!.lives).toBe(10);
  });

  it('refuses what it can’t read', () => {
    const json = serializeGame(midBattle());
    expect(restoreGame('not json', setup)).toBeNull();
    expect(restoreGame(json.replace('"v":1', '"v":99'), setup)).toBeNull();
    expect(restoreGame(json.replace('"mapId":"viridian-forest"', '"mapId":"nowhere"'), setup)).toBeNull();
  });

  it('keeps the save in storage until the battle ends', () => {
    const data = new Map<string, string>();
    const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
    expect(loadBattle(store)).toBeNull();
    saveBattle({ mapId: 'viridian-forest', difficulty: 'hard', team: ['pikachu'], game: '{}', newLines: ['mew'] }, store);
    expect(loadBattle(store)).toEqual({ mapId: 'viridian-forest', difficulty: 'hard', team: ['pikachu'], game: '{}', newLines: ['mew'] });
    clearBattle(store);
    expect(loadBattle(store)).toBeNull();
  });
});
