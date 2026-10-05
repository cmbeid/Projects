import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/progression';
import { runBot } from '../src/game/bot';
import { tap } from '../src/game/clearing';
import { derive } from '../src/game/derive';
import { buildingAllowed, place } from '../src/game/economy';
import { newGame, tick } from '../src/game/engine';
import { BUILDING } from '../src/data/buildings';
import { GUST_CYCLE, GUST_LENGTH } from '../src/game/grid';
import { activeStory, claimStory } from '../src/game/missions';
import { useConsumable } from '../src/game/founder';
import { EXPANSION_START, deserialize } from '../src/state/persistence';
import type { GameState } from '../src/state/types';

/** A game standing at `ward`, with enough of the Founder to survive there. */
function at(ward: number): GameState {
  const s = newGame(7);
  s.features.push('build', 'crews', 'upgrades', 'founder', 'workshops', 'drafting');
  s.story.id = null;
  s.ward = s.maxWard = s.furthestEver = ward;
  s.coins = 1e25;
  s.upgrades['tools'] = 400;
  s.ruinsHere = 0;
  return s;
}

describe('the Undercroft', () => {
  it('heals the ruin between blows until the caissons are in', () => {
    const s = at(41);
    s.ruin.hp = s.ruin.maxHp * 0.5;
    tick(s, 1);
    expect(s.ruin.hp).toBeGreaterThan(s.ruin.maxHp * 0.5);
    expect(derive(s).hazard.crew).toBe(BALANCE.hazardPenalty);
    s.fixtures.push('caissons');
    s.ruin.hp = s.ruin.maxHp * 0.5;
    tick(s, 1);
    expect(s.ruin.hp).toBeLessThanOrEqual(s.ruin.maxHp * 0.5);
    expect(derive(s).hazard.crew).toBe(1);
  });

  it('holds still for a while with Pump Grease', () => {
    const s = at(42);
    s.consumables.grease = 1;
    expect(useConsumable(s, 'grease')).toBe(true);
    s.ruin.hp = s.ruin.maxHp * 0.5;
    tick(s, 1);
    expect(s.ruin.hp).toBeLessThanOrEqual(s.ruin.maxHp * 0.5);
  });
});

describe('the Cloudline', () => {
  it('stops work in a gust, and Windbreaks shelter it', () => {
    const s = at(50);
    s.time = GUST_CYCLE * 10 + 1;
    expect(derive(s).hazard.tap).toBe(0.25);
    s.time = GUST_CYCLE * 10 + GUST_LENGTH + 1;
    expect(derive(s).hazard.tap).toBe(1);
    s.time = GUST_CYCLE * 10 + 1;
    s.fixtures.push('windbreaks');
    expect(derive(s).hazard.tap).toBe(1);
  });

  it('builds airship docks only once the windbreaks are up', () => {
    const s = at(50);
    const dock = BUILDING.get('airship-dock')!;
    expect(buildingAllowed(s, dock)).toBe(false);
    s.fixtures.push('windbreaks');
    expect(buildingAllowed(s, dock)).toBe(true);
  });
});

describe('the Far Shore', () => {
  it('halves the taxes until there is a treaty', () => {
    const s = at(58);
    s.inventory['shore-oak'] = 99;
    expect(place(s, 'fisher-row', 7, 0, 0)).not.toBeNull();
    expect(place(s, 'ferry-yard', 7, 1, 0)).not.toBeNull();
    s.furthestEver = 9;
    s.inventory['planks'] = 99;
    place(s, 'stall', 7, 0, 1);
    const before = derive(s).taxPerSec;
    expect(derive(s).hazard.tax).toBe(0.5);
    s.fixtures.push('treaty');
    expect(derive(s).taxPerSec).toBeCloseTo(before * 2);
  });
});

describe('the story past the Spire', () => {
  it('goes on from the choice into the Undercroft', () => {
    const s = at(41);
    s.story = { id: 'summit', base: 0 };
    expect(claimStory(s, 0)).toBe(true);
    expect(activeStory(s)?.id).toBe(EXPANSION_START);
    expect(claimStory(s)).toBe(true);
    expect(s.flags).toEqual(expect.arrayContaining(['rang', 'below']));
  });

  it('picks up a finished version-1 save at the first new mission', () => {
    const s = newGame(4) as unknown as Record<string, unknown>;
    s['version'] = 1;
    s['story'] = { id: null, base: 0 };
    const back = deserialize(JSON.stringify(s))!;
    expect(back.story.id).toBe(EXPANSION_START);
    expect(back.version).toBe(2);
    expect(back.buffs.grease).toBe(0);
  });

  it('leaves an unfinished version-1 save where it was', () => {
    const s = newGame(4) as unknown as Record<string, unknown>;
    s['version'] = 1;
    s['story'] = { id: 'silk', base: 3 };
    expect(deserialize(JSON.stringify(s))!.story).toEqual({ id: 'silk', base: 3 });
  });
});

describe('a player beyond the Spire', () => {
  it('keeps clearing and building for an hour without trouble', () => {
    const s = at(41);
    s.coins = 1e16;
    s.level = 120;
    s.features.push('passives', 'rush', 'survey', 'festival', 'tide');
    s.story = { id: EXPANSION_START, base: 0 };
    const clears = s.counters.clears;
    for (let i = 0; i < 20; i++) tap(s);
    runBot(s, 3600);
    expect(s.counters.clears).toBeGreaterThan(clears);
    expect(s.buildings.length).toBeGreaterThan(0);
    expect(Number.isFinite(s.coins)).toBe(true);
  });
});
