import { describe, expect, it } from 'vitest';
import { dec } from '../src/num/decimal';
import { createInitialState, hydrate, serialise } from '../src/state/persistence';
import { buildIndex } from '../src/data/indexes';
import { CONTENT } from '../src/data/index';
import { FIXTURE_INDEX } from './fixture';

const REAL_INDEX = buildIndex(CONTENT);

describe('round trip', () => {
  it('preserves everything a save is supposed to carry', () => {
    const state = createInitialState(1_700_000_000_000);
    state.resources.ore = dec('1.25e40');
    state.lifetime.ore = dec('9.5e41');
    state.buildings['probe'] = 137;
    state.upgrades = ['kinetic-hammer'];
    state.automation = ['auto-miner'];
    state.automationOn = { 'auto-miner': false };
    state.milestones = ['first-probe'];
    state.settings.buyMode = 'max';
    state.stats = { playedSeconds: 4_321, taps: 88 };

    const restored = hydrate(serialise(state), REAL_INDEX);

    expect(restored.resources.ore.toString()).toBe(state.resources.ore.toString());
    expect(restored.lifetime.ore.toString()).toBe(state.lifetime.ore.toString());
    expect(restored.buildings['probe']).toBe(137);
    expect(restored.upgrades).toEqual(['kinetic-hammer']);
    expect(restored.automation).toEqual(['auto-miner']);
    expect(restored.automationOn['auto-miner']).toBe(false);
    expect(restored.milestones).toEqual(['first-probe']);
    expect(restored.settings.buyMode).toBe('max');
    expect(restored.stats).toEqual({ playedSeconds: 4_321, taps: 88 });
    expect(restored.lastSeen).toBe(1_700_000_000_000);
  });

  it('survives values far past the double ceiling', () => {
    const state = createInitialState();
    state.resources.compute = dec('4.5e900');
    state.lifetime.compute = dec('4.5e900');
    const restored = hydrate(serialise(state), REAL_INDEX);
    expect(restored.resources.compute.e).toBe(900);
  });
});

describe('defensive loading', () => {
  it('treats an unknown save version as a new game', () => {
    expect(hydrate({ version: 99, buildings: { probe: 5 } }, REAL_INDEX).buildings).toEqual({});
    expect(hydrate({}, REAL_INDEX).buildings).toEqual({});
  });

  /**
   * Content moves between releases. Ids are filtered against the current tables
   * rather than trusted, so a save from a build with more content loads instead
   * of producing buildings the game cannot render.
   */
  it('drops ids the current content no longer knows', () => {
    const save = {
      ...serialise(createInitialState()),
      buildings: { probe: 3, 'dyson-swarm': 99 },
      upgrades: ['kinetic-hammer', 'from-a-later-build'],
      automation: ['auto-miner', 'nonexistent'],
      milestones: ['first-probe', 'unknown-milestone'],
    };
    const restored = hydrate(save, REAL_INDEX);

    expect(restored.buildings).toEqual({ probe: 3 });
    expect(restored.upgrades).toEqual(['kinetic-hammer']);
    expect(restored.automation).toEqual(['auto-miner']);
    expect(restored.milestones).toEqual(['first-probe']);
  });

  it('rejects malformed numbers rather than storing NaN', () => {
    const save = {
      ...serialise(createInitialState()),
      buildings: { probe: NaN, drill: -4, sifter: 2.7 },
      stats: { playedSeconds: -1, taps: Number.POSITIVE_INFINITY },
    };
    const restored = hydrate(save, REAL_INDEX);

    expect(restored.buildings['probe']).toBeUndefined();
    expect(restored.buildings['drill']).toBeUndefined();
    expect(restored.buildings['sifter']).toBe(2); // floored, not rejected
    expect(restored.stats.playedSeconds).toBe(0);
    expect(restored.stats.taps).toBe(0);
  });

  it('discards duplicate ids', () => {
    const save = {
      ...serialise(createInitialState()),
      upgrades: ['kinetic-hammer', 'kinetic-hammer'],
    };
    expect(hydrate(save, REAL_INDEX).upgrades).toEqual(['kinetic-hammer']);
  });

  it('reads a negative or unparseable resource as zero', () => {
    const save = {
      ...serialise(createInitialState()),
      resources: { ore: '-5e3', alloy: 'nonsense', compute: '' },
    };
    const restored = hydrate(save, REAL_INDEX);
    expect(restored.resources.ore.isZero).toBe(true);
    expect(restored.resources.alloy.isZero).toBe(true);
    expect(restored.resources.compute.isZero).toBe(true);
  });

  /** A stock above its own lifetime total cannot have happened honestly. */
  it('repairs a stock that exceeds its lifetime total', () => {
    const save = {
      ...serialise(createInitialState()),
      resources: { ore: '1e9', alloy: '0e0', compute: '0e0' },
      lifetime: { ore: '1e3', alloy: '0e0', compute: '0e0' },
    };
    const restored = hydrate(save, REAL_INDEX);
    expect(restored.lifetime.ore.gte(restored.resources.ore)).toBe(true);
  });

  it('ignores an automation toggle for automation that is not owned', () => {
    const save = {
      ...serialise(createInitialState()),
      automation: [],
      automationOn: { 'auto-miner': true },
    };
    expect(hydrate(save, REAL_INDEX).automationOn).toEqual({});
  });

  it('falls back to a valid buy mode', () => {
    const save = { ...serialise(createInitialState()), settings: { buyMode: 7 as never } };
    expect(hydrate(save, REAL_INDEX).settings.buyMode).toBe(1);
  });

  it('validates against whichever content it is handed', () => {
    const save = { ...serialise(createInitialState()), buildings: { miner: 4, probe: 9 } };
    // The fixture has `miner` and no `probe`; the shipped content is the reverse.
    expect(hydrate(save, FIXTURE_INDEX).buildings).toEqual({ miner: 4 });
  });
});
