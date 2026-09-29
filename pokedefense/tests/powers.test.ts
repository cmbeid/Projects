import { describe, expect, it } from 'vitest';
import { NO_TRAINER } from '../src/data/items';
import { COLS, mapDef, ROWS } from '../src/data/maps';
import { DYNAMAX_BAND, DYNAMAX_SECONDS, MAX_LEVEL, TERA_ORB, Z_RING } from '../src/data/towers';
import {
  canDynamax, canPlace, canTera, canZMove, dynamax, type Enemy, type Game, levelUp, newGame, placeTower, startWave, STEP, step, terastallize, type Tower, zMove,
} from '../src/game/game';
import { restoreGame, serializeGame } from '../src/game/snapshot';

const setup = { difficulty: 'normal' as const, items: {}, balls: {}, trainer: NO_TRAINER, seed: 5 };
const battle = (mapId: string, team: string[], held: Record<string, string> = {}): Game =>
  newGame({ ...setup, map: mapDef(mapId), team, held });

/** A fully grown tower on the buildable tile nearest (x, y). */
function grownTower(g: Game, lineId: string, x: number, y: number): Tower {
  g.money = 1e6;
  const spots: [number, number][] = [];
  for (let ty = 0; ty < ROWS; ty += 1) for (let tx = 0; tx < COLS; tx += 1) if (!canPlace(g, lineId, tx, ty)) spots.push([tx, ty]);
  spots.sort((a, b) => Math.hypot(a[0] - x, a[1] - y) - Math.hypot(b[0] - x, b[1] - y));
  const t = placeTower(g, lineId, spots[0]![0], spots[0]![1]) as Tower;
  while (t.level < MAX_LEVEL) levelUp(g, t.id, { branch: 0 });
  return t;
}

/** Step until some enemy is on the field, or a boss if `boss`. */
function until(g: Game, test: (e: Enemy) => boolean): Enemy {
  for (let i = 0; i < 60 * 120; i += 1) {
    const found = g.enemies.find((e) => e.alive && test(e));
    if (found) return found;
    step(g);
  }
  throw new Error('nothing came');
}

describe('Alola: Z-Moves and Totems', () => {
  it('unleashes one enormous hit, once a battle, with a Z-Ring', () => {
    const g = battle('verdant-cavern', ['litten', 'popplio'], { litten: Z_RING });
    const t = grownTower(g, 'litten', 2, 7);
    const other = grownTower(g, 'popplio', 4, 5);
    expect(canZMove(g, t)).toBe(false); // nothing in reach yet
    startWave(g);
    const e = until(g, (x) => Math.hypot(x.x - t.x - 0.5, x.y - t.y - 0.5) < t.stats.range);
    expect(canZMove(g, t)).toBe(true);
    expect(canZMove(g, other)).toBe(false); // not holding the ring
    const before = e.hp;
    expect(zMove(g, t.id)).toBe(true);
    expect(e.hp).toBeLessThan(before);
    expect(g.zUsed).toBe(true);
    expect(canZMove(g, t)).toBe(false);
  });

  it('has a Totem call two allies when it is hurt', () => {
    const map = mapDef('verdant-cavern');
    const g = battle('verdant-cavern', []);
    g.lives = 999;
    g.wave = map.waves - 1;
    startWave(g);
    const totem = until(g, (e) => e.boss);
    expect(totem.totem).not.toBeNull();
    const count = g.enemies.filter((e) => e.alive).length;
    totem.hp = totem.maxHp * 0.4;
    step(g);
    expect(totem.totem!.called).toBe(true);
    expect(g.enemies.filter((e) => e.alive).length).toBeGreaterThanOrEqual(count + 2);
  });
});

describe('Galar: Dynamax', () => {
  it('turns a tower’s attacks into Max Moves for a while, and changes the weather to suit it', () => {
    const g = battle('turffield', ['litten', 'popplio'], { litten: DYNAMAX_BAND, popplio: DYNAMAX_BAND });
    const t = grownTower(g, 'litten', 2, 6);
    const other = grownTower(g, 'popplio', 5, 6);
    const before = { ...t.stats };
    expect(canDynamax(g, t)).toBe(true);
    expect(dynamax(g, t.id)).toBe(true);
    expect(t.stats.attack).toBe('splash');
    expect(t.stats.damage).toBeGreaterThan(before.damage);
    expect(g.weather).toBe('sun');
    // Once a battle, for all towers.
    expect(canDynamax(g, other)).toBe(false);
    for (let i = 0; i < (DYNAMAX_SECONDS + 1) / STEP; i += 1) step(g);
    expect(t.stats.attack).toBe(before.attack);
    expect(t.stats.damage).toBeCloseTo(before.damage);
    // The sun stays out.
    expect(g.weather).toBe('sun');
  });

  it('sends out a gym leader’s ace Dynamaxed, and shrinks it back after a while', () => {
    const map = mapDef('turffield');
    const g = battle('turffield', []);
    g.lives = 999;
    g.wave = map.waves - 1;
    startWave(g);
    const boss = until(g, (e) => e.boss);
    expect(boss.dynamaxUntil).toBeGreaterThan(g.t);
    for (let i = 0; i < 31 / STEP && boss.alive; i += 1) step(g);
    if (boss.alive) expect(boss.dynamaxUntil).toBe(0);
  });

  it('Gigantamaxes Leon’s Charizard when it is hurt', () => {
    expect(mapDef('wyndon-stadium').boss.mega).toBe(10196);
  });
});

describe('Paldea: Terastallizing', () => {
  it('gives a tower the Tera type you choose, a little harder, for the rest of the battle', () => {
    const g = battle('cortondo', ['litten', 'popplio'], { litten: TERA_ORB, popplio: TERA_ORB });
    const t = grownTower(g, 'litten', 2, 6);
    const other = grownTower(g, 'popplio', 5, 6);
    const damage = t.stats.damage;
    expect(canTera(g, t)).toBe(true);
    expect(terastallize(g, t.id, 'ghost')).toBe(true);
    expect(t.stats.type).toBe('ghost');
    expect(t.stats.damage).toBeCloseTo(damage * 1.2);
    expect(canTera(g, other)).toBe(false);
    // It lasts: a level's worth of time later, it's still Ghost.
    for (let i = 0; i < 60 / STEP; i += 1) step(g);
    expect(t.stats.type).toBe('ghost');
  });

  it('sends out each gym leader’s ace in its Tera type, and keeps it through a saved battle', () => {
    const map = mapDef('cortondo');
    const g = battle('cortondo', []);
    g.lives = 999;
    g.wave = map.waves - 1;
    startWave(g);
    const boss = until(g, (e) => e.boss);
    expect(boss.tera).toBe('bug');
    expect(boss.sp.types).toEqual(['bug']);
    const r = restoreGame(serializeGame(g), { ...setup, team: [], held: {} })!;
    expect(r.enemies.find((e) => e.boss)!.sp.types).toEqual(['bug']);
  });

  it('remembers every power spent, and the weather, through a saved battle', () => {
    const g = battle('turffield', ['litten'], { litten: DYNAMAX_BAND });
    const t = grownTower(g, 'litten', 2, 6);
    dynamax(g, t.id);
    const r = restoreGame(serializeGame(g), { ...setup, team: ['litten'], held: { litten: DYNAMAX_BAND } })!;
    expect([r.dynamaxUsed, r.weather, r.towers[0]!.dynamaxUntil > r.t]).toEqual([true, 'sun', true]);
  });
});
