import { describe, expect, it } from 'vitest';
import { STORY, STORY_V1_ORDER } from '../src/data/missions';
import { BALANCE } from '../src/data/progression';
import { derive } from '../src/game/derive';
import { buyMachine } from '../src/game/economy';
import { newGame, tick } from '../src/game/engine';
import { unlockFeature } from '../src/game/features';
import { MACHINE_BREAKS_PER_SECOND, damage, setDepth } from '../src/game/mining';
import { activeStory, claimStory, progress } from '../src/game/missions';
import { applyOffline } from '../src/game/offline';
import { strikeBargain } from '../src/game/prestige';
import { deserialize, serialize } from '../src/state/persistence';

describe('machines at a shallow depth', () => {
  it('clear at most four blocks a second, however strong they are', () => {
    const s = newGame(1);
    unlockFeature(s, 'drones');
    s.coins = 1e30;
    buyMachine(s, 'drone', 400);
    s.echoUpgrades['ghosts'] = 40;
    for (let i = 0; i < 100; i++) tick(s, 0.1);
    expect(s.counters.breaks).toBeLessThanOrEqual(10 * MACHINE_BREAKS_PER_SECOND + 1);
    expect(s.counters.breaks).toBeGreaterThan(30);
  });

  it('are held to the same cap offline', () => {
    const s = newGame(2);
    unlockFeature(s, 'drones');
    s.coins = 1e30;
    buyMachine(s, 'drone', 400);
    s.echoUpgrades['ghosts'] = 40;
    const r = applyOffline(s, 3600);
    expect(r.blocks).toBeLessThanOrEqual(3600 * MACHINE_BREAKS_PER_SECOND);
  });

  it('one fewer a second with Greed', () => {
    const s = newGame(3);
    unlockFeature(s, 'bargains');
    expect(strikeBargain(s, 'greed')).toBe(true);
    expect(strikeBargain(s, 'greed')).toBe(false);
    unlockFeature(s, 'drones');
    s.coins = 1e30;
    buyMachine(s, 'drone', 400);
    s.echoUpgrades['ghosts'] = 40;
    for (let i = 0; i < 100; i++) tick(s, 0.1);
    expect(s.counters.breaks).toBeLessThanOrEqual(10 * (MACHINE_BREAKS_PER_SECOND - 1) + 1);
  });
});

describe('saves from before the expansion', () => {
  it('keep the player on the same mission', () => {
    const s = newGame(4) as unknown as Record<string, unknown>;
    s['version'] = 1;
    s['story'] = { index: 32, base: 7 };
    const back = deserialize(JSON.stringify(s))!;
    expect(back.story.id).toBe(STORY_V1_ORDER[32]);
    expect(activeStory(back)?.id).toBe(STORY_V1_ORDER[32]);
    expect(back.story.base).toBe(7);
    expect(back.flags).toEqual([]);
    expect(back.counters.farmed).toBe(0);
  });

  it('carry on after the old ending', () => {
    const s = newGame(5) as unknown as Record<string, unknown>;
    s['version'] = 1;
    s['story'] = { index: 42, base: 0 };
    const back = deserialize(JSON.stringify(s))!;
    const old = STORY.findIndex((m) => m.id === 'below');
    expect(back.story.id).toBe(STORY[old + 1]!.id);
  });

  it('round-trip once migrated', () => {
    const s = newGame(6);
    expect(deserialize(serialize(s))).toEqual(s);
  });
});

describe('the story', () => {
  it('keeps every original mission, in its original order', () => {
    const ids = STORY.map((m) => m.id);
    const positions = STORY_V1_ORDER.map((id) => ids.indexOf(id));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('counts a visit once the player has stood there', () => {
    const s = newGame(7);
    const visit = STORY.find((m) => m.goal.kind === 'visit')!;
    s.story = { id: visit.id, base: 0 };
    s.maxDepth = s.deepestEver = 120;
    setDepth(s, 100);
    tick(s, 0.1);
    expect(progress(s, visit.goal, s.story.base).done).toBe(false);
    setDepth(s, 1);
    tick(s, 0.1);
    setDepth(s, 100);
    expect(progress(s, visit.goal, s.story.base).done).toBe(true);
  });

  it('counts farming only with the seam held buried', () => {
    const s = newGame(8);
    for (let i = 0; i < 5; i++) damage(s, s.block.hp, { crit: false, auto: false });
    expect(s.counters.farmed).toBe(0);
    s.autoAdvance = false;
    for (let i = 0; i < 5; i++) damage(s, s.block.hp, { crit: false, auto: false });
    expect(s.counters.farmed).toBe(5);
  });

  it('needs a decision to claim a choice, and remembers it', () => {
    const s = newGame(9);
    const choice = STORY.find((m) => m.choice)!;
    s.story = { id: choice.id, base: 0 };
    s.deepestEver = 1000;
    expect(claimStory(s)).toBe(false);
    expect(claimStory(s, 1)).toBe(true);
    expect(s.flags).toContain(choice.choice!.options[1]!.flag);
  });
});

describe('machines deep down', () => {
  it('keep up with the biome jumps in rock HP', () => {
    const shallow = newGame(30);
    shallow.machines = { drone: 50 };
    const deep = newGame(30);
    deep.machines = { drone: 50 };
    deep.depth = deep.maxDepth = deep.deepestEver = 230;
    const share = (s: typeof deep): number => derive(s).tap * BALANCE.machineTapShare;
    const ratio = (derive(deep).autoDps - share(deep)) / (derive(shallow).autoDps - share(shallow));
    expect(ratio).toBeCloseTo(BALANCE.machineBiomeBoost ** 5);
  });

  it('borrow a share of your swing, but only once you own one', () => {
    const s = newGame(31);
    expect(derive(s).autoDps).toBe(0);
    s.machines = { drone: 1 };
    expect(derive(s).autoDps).toBeGreaterThan(derive(s).tap * BALANCE.machineTapShare);
  });
});
