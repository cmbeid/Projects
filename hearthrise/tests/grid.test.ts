import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/progression';
import { derive } from '../src/game/derive';
import { demolish, levelCost, move, place, upgradeType } from '../src/game/economy';
import { newGame } from '../src/game/engine';
import { adjacencyMult, adjacencyScore, buildingAt, canPlace, flooded, previewPlacement, tileOpen } from '../src/game/grid';
import type { GameState } from '../src/state/types';

/** A game with building switched on, plenty of coin, and the first wards of the first two districts open. */
function city(maxWard = 12): GameState {
  const s = newGame(3);
  s.features.push('build', 'crews', 'upgrades');
  s.story.id = null;
  s.maxWard = s.furthestEver = maxWard;
  s.coins = 1e12;
  s.inventory = { planks: 999, bricks: 999, ironwork: 999, canvas: 999, cobble: 999 };
  return s;
}

describe('the grid', () => {
  it('opens a row of land per ward', () => {
    const s = city(3);
    expect(tileOpen(s, 0, 0, 2)).toBe(true);
    expect(tileOpen(s, 0, 0, 3)).toBe(false);
    expect(tileOpen(s, 1, 0, 0)).toBe(false);
  });

  it('places buildings on open, free ground only', () => {
    const s = city();
    expect(place(s, 'tent', 0, 0, 0)).not.toBeNull();
    expect(canPlace(s, 'tent', 0, 0, 0)).toBe(false);
    expect(canPlace(s, 'tent', 0, 6, 0)).toBe(false);
    expect(canPlace(s, 'tent', 1, 0, 7)).toBe(false);
    expect(buildingAt(s, 0, 0, 0)?.type).toBe('tent');
  });

  it('prices every level of a type on one ladder, placed or levelled', () => {
    const s = city();
    const first = levelCost(s, 'tent');
    place(s, 'tent', 0, 0, 0);
    const second = levelCost(s, 'tent');
    expect(second).toBeGreaterThan(first);
    upgradeType(s, 'tent', 1);
    expect(levelCost(s, 'tent')).toBeGreaterThan(second);
    expect(s.buildings[0]!.lvl).toBe(2);
  });

  it('scores neighbours: a garden helps a tent, a workshop hurts it', () => {
    const s = city();
    const tent = place(s, 'tent', 0, 1, 1)!;
    place(s, 'garden', 0, 0, 1);
    expect(adjacencyScore(s, tent)).toBe(2);
    place(s, 'workshop', 0, 2, 1);
    expect(adjacencyScore(s, tent)).toBe(0);
    expect(adjacencyMult(s, tent)).toBe(1);
    // Corners do not count.
    place(s, 'garden', 0, 0, 0);
    expect(adjacencyScore(s, tent)).toBe(0);
  });

  it('doubles bad neighbours in the Market Ward', () => {
    const s = city(20);
    s.inventory['roof-tiles'] = 99;
    const tent = place(s, 'tent', 2, 0, 0)!;
    place(s, 'gang', 2, 1, 0);
    expect(adjacencyScore(s, tent)).toBe(-2);
  });

  it('previews a placement without making it', () => {
    const s = city();
    place(s, 'tent', 0, 1, 1);
    const p = previewPlacement(s, 'garden', 0, 2, 1);
    expect(p.neighbours).toEqual([{ uid: s.buildings[0]!.uid, delta: 2 }]);
    expect(s.buildings.length).toBe(1);
  });

  it('never lets a building fall below the floor, however bad its street', () => {
    const s = city();
    const tent = place(s, 'tent', 0, 1, 1)!;
    for (const [x, y] of [[0, 1], [2, 1], [1, 0], [1, 2]] as const) place(s, 'workshop', 0, x, y);
    expect(adjacencyMult(s, tent)).toBe(BALANCE.adjacencyFloor);
  });

  it('moves buildings for free and refunds half when one comes down', () => {
    const s = city();
    const b = place(s, 'tent', 0, 0, 0)!;
    const coins = s.coins;
    expect(move(s, b.uid, 0, 3, 3)).toBe(true);
    expect(s.coins).toBe(coins);
    expect(buildingAt(s, 0, 3, 3)?.uid).toBe(b.uid);
    expect(demolish(s, b.uid)).toBe(true);
    expect(s.coins).toBeGreaterThan(coins);
    expect(s.buildings.length).toBe(0);
  });

  it('floods the Harbour’s low rows at high tide, until there is a sea wall', () => {
    const s = city(16);
    const stall = place(s, 'stall', 1, 0, 7)!;
    s.time = 1;
    expect(flooded(s, stall)).toBe(true);
    s.time = BALANCE.tideHigh + 1;
    expect(flooded(s, stall)).toBe(false);
    s.time = 1;
    s.fixtures.push('seawall');
    expect(flooded(s, stall)).toBe(false);
  });

  it('runs workplaces short-handed without homes, and full with them', () => {
    const s = city();
    place(s, 'stall', 0, 0, 0);
    expect(derive(s).city.employ).toBe(0);
    place(s, 'tent', 0, 1, 0);
    expect(derive(s).city.employ).toBe(1);
    expect(derive(s).taxPerSec).toBeGreaterThan(0);
  });
});
