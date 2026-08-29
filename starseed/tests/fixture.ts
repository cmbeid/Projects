import type { Content } from '../src/data/types';
import { buildIndex } from '../src/data/indexes';
import type { ContentIndex } from '../src/data/indexes';
import { createInitialState } from '../src/state/persistence';
import type { GameState } from '../src/state/types';
import { RateCache } from '../src/game/rates';

/**
 * A tiny hand-built world, so the engine tests do not depend on the shipped
 * content. Balance numbers move constantly; these assertions must not.
 *
 * `miner` makes ore from nothing. `mill` converts ore into alloy, which is what
 * exercises starvation throttling. `silo` is pure storage, and `reactor` is the
 * only building hot enough to reach the thermal soft cap.
 */
export const FIXTURE: Content = {
  resources: [
    {
      id: 'ore',
      name: 'Ore',
      emoji: '⛏️',
      blurb: '',
      baseCap: 1_000_000,
      prestigeWeight: 1,
      unlock: { kind: 'always' },
    },
    {
      id: 'alloy',
      name: 'Alloy',
      emoji: '🔩',
      blurb: '',
      baseCap: 1_000_000,
      prestigeWeight: 10,
      unlock: { kind: 'lifetime', resource: 'ore', amount: 10 },
    },
    {
      id: 'compute',
      name: 'Compute',
      emoji: '🧠',
      blurb: '',
      baseCap: 1_000_000,
      prestigeWeight: 100,
      unlock: { kind: 'lifetime', resource: 'alloy', amount: 10 },
    },
  ],
  buildings: [
    {
      id: 'miner',
      name: 'Miner',
      emoji: '⛏️',
      blurb: '',
      era: 1,
      output: { resource: 'ore', rate: 1 },
      inputs: [],
      cost: { resource: 'ore', base: 10, growth: 1.1 },
      heat: 0,
      unlock: { kind: 'always' },
    },
    {
      id: 'mill',
      name: 'Mill',
      emoji: '🏭',
      blurb: '',
      era: 2,
      output: { resource: 'alloy', rate: 1 },
      inputs: [{ resource: 'ore', rate: 4 }],
      cost: { resource: 'ore', base: 100, growth: 1.2 },
      heat: 0,
      unlock: { kind: 'lifetime', resource: 'ore', amount: 10 },
    },
    {
      // The only hot thing in the fixture, so a test can push the swarm past the
      // thermal threshold deliberately without every other test feeling it.
      id: 'reactor',
      name: 'Reactor',
      emoji: '☢️',
      blurb: '',
      era: 1,
      output: { resource: 'ore', rate: 10 },
      inputs: [],
      cost: { resource: 'ore', base: 500, growth: 1.15 },
      heat: 400,
      unlock: { kind: 'always' },
    },
    {
      id: 'silo',
      name: 'Silo',
      emoji: '📦',
      blurb: '',
      era: 1,
      output: { resource: 'ore', rate: 0 },
      inputs: [],
      cost: { resource: 'ore', base: 50, growth: 1.1 },
      heat: 0,
      capacity: { resource: 'ore', amount: 500 },
      unlock: { kind: 'always' },
    },
  ],
  upgrades: [
    {
      id: 'add',
      name: 'Additive',
      emoji: '➕',
      blurb: '',
      era: 1,
      cost: { resource: 'ore', amount: 10 },
      effects: [{ kind: 'additive', building: 'miner', amount: 1 }],
      unlock: { kind: 'always' },
    },
    {
      id: 'mult',
      name: 'Multiplier',
      emoji: '✖️',
      blurb: '',
      era: 1,
      cost: { resource: 'ore', amount: 10 },
      effects: [{ kind: 'multiplier', building: 'miner', factor: 3 }],
      unlock: { kind: 'always' },
    },
    {
      id: 'glob',
      name: 'Global',
      emoji: '🌍',
      blurb: '',
      era: 1,
      cost: { resource: 'ore', amount: 10 },
      effects: [{ kind: 'global', resource: 'ore', factor: 5 }],
      unlock: { kind: 'always' },
    },
  ],
  automation: [
    {
      id: 'auto-miner',
      name: 'Auto-Miner',
      emoji: '🤖',
      blurb: '',
      retires: 'tapping',
      behaviour: 'mine',
      cost: { resource: 'compute', amount: 1 },
      unlock: { kind: 'always' },
    },
    {
      id: 'replication',
      name: 'Replication',
      emoji: '🔁',
      blurb: '',
      retires: 'buying',
      behaviour: 'buildings',
      cost: { resource: 'compute', amount: 1 },
      unlock: { kind: 'always' },
    },
  ],
  milestones: [
    {
      id: 'ten-ore',
      name: 'Ten Ore',
      blurb: '',
      condition: { kind: 'lifetime', resource: 'ore', amount: 10 },
    },
  ],
  log: [
    {
      id: 'ten-ore-log',
      title: 'Ten Ore',
      text: '',
      unlock: { kind: 'lifetime', resource: 'ore', amount: 10 },
    },
  ],
  /**
   * Just enough prestige content to exercise composition: one root perk, one
   * behind it, and four directives spread over three families — the minimum
   * that can fill a legal loadout and the minimum that can fail to.
   */
  perks: [
    {
      id: 'root',
      name: 'Root',
      emoji: '',
      blurb: '',
      cost: 1,
      effects: [{ kind: 'global', resource: 'ore', factor: 2 }],
      requires: [],
    },
    {
      id: 'branch',
      name: 'Branch',
      emoji: '',
      blurb: '',
      cost: 4,
      effects: [
        { kind: 'start', resource: 'ore', amount: 100 },
        { kind: 'capacity', resource: 'ore', factor: 2 },
      ],
      requires: ['root'],
    },
  ],
  directives: [
    {
      id: 'fast',
      name: 'Fast',
      emoji: '',
      blurb: '',
      family: 'Expansion',
      effects: [
        { kind: 'building', building: 'miner', factor: 3 },
        { kind: 'heat', factor: 2 },
      ],
      unlock: { kind: 'always' },
    },
    {
      id: 'slow',
      name: 'Slow',
      emoji: '',
      blurb: '',
      family: 'Expansion',
      effects: [{ kind: 'building', building: 'miner', factor: 0.5 }],
      unlock: { kind: 'always' },
    },
    {
      id: 'salvage',
      name: 'Salvage',
      emoji: '',
      blurb: '',
      family: 'Doctrine',
      effects: [{ kind: 'carry', resource: 'ore', fraction: 0.5 }],
      unlock: { kind: 'always' },
    },
    {
      id: 'rich',
      name: 'Rich',
      emoji: '',
      blurb: '',
      family: 'Logistics',
      effects: [{ kind: 'payout', factor: 2 }],
      unlock: { kind: 'always' },
    },
    {
      id: 'later',
      name: 'Later',
      emoji: '',
      blurb: '',
      family: 'Doctrine',
      effects: [{ kind: 'tap', factor: 4 }],
      unlock: { kind: 'relaunches', count: 2 },
    },
  ],
};

export const FIXTURE_INDEX: ContentIndex = buildIndex(FIXTURE);

export interface World {
  state: GameState;
  index: ContentIndex;
  cache: RateCache;
}

export function world(setup: (state: GameState) => void = () => {}): World {
  const state = createInitialState(0);
  state.seed = 1;
  setup(state);
  return { state, index: FIXTURE_INDEX, cache: new RateCache(FIXTURE_INDEX) };
}

/** Deep structural comparison of the parts of state a tick can move. */
export function snapshot(state: GameState): string {
  return JSON.stringify({
    resources: Object.fromEntries(
      Object.entries(state.resources).map(([k, v]) => [k, v.toString()]),
    ),
    lifetime: Object.fromEntries(Object.entries(state.lifetime).map(([k, v]) => [k, v.toString()])),
    buildings: state.buildings,
    upgrades: state.upgrades,
    milestones: state.milestones,
    log: state.log,
    accumulator: state.accumulator,
    played: state.stats.playedSeconds,
  });
}
