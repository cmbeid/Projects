import { describe, expect, it } from 'vitest';
import { Decimal, dec } from '../src/num/decimal';
import { CONTENT, DIRECTIVE_SLOTS, RELAUNCH_MINIMUM, SCHEMATIC_DIVISOR } from '../src/data/index';
import { buildIndex } from '../src/data/indexes';
import { computeRates } from '../src/game/rates';
import {
  buyPerk,
  canRelaunch,
  valueForSchematics,
  prestigeMultipliers,
  relaunch,
  runValue,
  schematicsFor,
  validateLoadout,
} from '../src/game/prestige';
import { availableDirectives, availablePerks } from '../src/game/unlocks';
import { advance } from '../src/game/engine';
import { FIXTURE, FIXTURE_INDEX, world } from './fixture';

const REAL_INDEX = buildIndex(CONTENT);

describe('the currency', () => {
  it('pays the square root of the run, so a long run is not a proportional one', () => {
    const { state, index } = world((s) => {
      s.lifetime.ore = dec(SCHEMATIC_DIVISOR * 100);
    });
    expect(schematicsFor(state, index).toNumber()).toBe(10);

    // Ten times the ore, but only about three times the payout. This is the
    // property that makes a short deliberate run a strategy, not a mistake.
    state.lifetime.ore = dec(SCHEMATIC_DIVISOR * 1_000);
    expect(schematicsFor(state, index).toNumber()).toBe(31);
  });

  it('floors, and pays nothing at all below one whole Schematic', () => {
    const { state, index } = world((s) => {
      s.lifetime.ore = dec(SCHEMATIC_DIVISOR * 2.25);
    });
    expect(schematicsFor(state, index).toNumber()).toBe(1);

    state.lifetime.ore = dec(SCHEMATIC_DIVISOR * 0.5);
    expect(schematicsFor(state, index).isZero).toBe(true);
    state.lifetime.ore = Decimal.ZERO;
    expect(schematicsFor(state, index).isZero).toBe(true);
  });

  it('reads the run, not the all-time total, so production is never paid for twice', () => {
    const { state, index } = world((s) => {
      s.lifetime.ore = dec(SCHEMATIC_DIVISOR * 9);
      s.totals.ore = dec(SCHEMATIC_DIVISOR * 10_000);
    });
    expect(schematicsFor(state, index).toNumber()).toBe(3);
  });

  /**
   * The whole ladder counts, weighted. Measuring ore alone makes two thirds of
   * the economy invisible to prestige and every up-ladder directive strictly
   * bad — the bug this weighting exists to prevent.
   */
  it('counts alloy and compute, each at what it cost to make', () => {
    const { state, index } = world((s) => {
      s.lifetime.alloy = dec(1_000); // fixture weight 10
      s.lifetime.compute = dec(100); // fixture weight 100
    });
    expect(runValue(state, index).toNumber()).toBe(20_000);

    // A run that refined its ore is worth at least as much as one that hoarded
    // it, or refining would be a strictly losing move.
    const hoarded = world((s) => {
      s.lifetime.ore = dec(10_000);
    });
    expect(runValue(state, index).gte(runValue(hoarded.state, hoarded.index))).toBe(true);
  });

  it('applies payout multipliers to what a Relaunch hands over', () => {
    const { state, index } = world((s) => {
      s.lifetime.ore = dec(SCHEMATIC_DIVISOR * 100);
      s.prestige.directives = ['rich']; // payout ×2
    });
    expect(schematicsFor(state, index).toNumber()).toBe(20);
  });

  it('survives a run whose ore is past the double ceiling', () => {
    const { state, index } = world((s) => {
      s.lifetime.ore = dec('1e400');
    });
    // sqrt(1e400 / DIVISOR), derived rather than hardcoded so a divisor change
    // moves this with it instead of failing for the wrong reason.
    expect(schematicsFor(state, index).log10()).toBeCloseTo((400 - Math.log10(SCHEMATIC_DIVISOR)) / 2, 6);
  });

  /** The progress readout inverts the formula; it has to land on the same number. */
  it('inverts cleanly into the ore a target payout needs', () => {
    const { state, index } = world();
    const needed = valueForSchematics(state, index, RELAUNCH_MINIMUM);

    state.lifetime.ore = needed;
    expect(schematicsFor(state, index).toNumber()).toBeGreaterThanOrEqual(RELAUNCH_MINIMUM);
    state.lifetime.ore = needed.mulNumber(0.99);
    expect(schematicsFor(state, index).toNumber()).toBeLessThan(RELAUNCH_MINIMUM);
  });

  it('refuses a Relaunch that would pay less than the floor', () => {
    const { state, index } = world();
    state.lifetime.ore = valueForSchematics(state, index, RELAUNCH_MINIMUM).mulNumber(0.9);
    expect(canRelaunch(state, index)).toBe(false);

    state.lifetime.ore = valueForSchematics(state, index, RELAUNCH_MINIMUM);
    expect(canRelaunch(state, index)).toBe(true);
  });
});

describe('the loadout', () => {
  const ready = () =>
    world((s) => {
      s.lifetime.ore = dec(SCHEMATIC_DIVISOR * 1e6);
    });

  it('allows one directive per family and no more', () => {
    const { state, index } = ready();
    // `fast` and `slow` are both Expansion; the second is dropped, not the first.
    expect(validateLoadout(state, index, ['fast', 'slow', 'salvage'])).toEqual(['fast', 'salvage']);
  });

  it('caps the loadout at the slot count', () => {
    const { state, index } = ready();
    const all = FIXTURE.directives.map((d) => d.id);
    expect(validateLoadout(state, index, all).length).toBeLessThanOrEqual(DIRECTIVE_SLOTS);
  });

  it('drops unknown ids, duplicates and directives not yet unlocked', () => {
    const { state, index } = ready();
    expect(validateLoadout(state, index, ['fast', 'fast', 'nope', 'later'])).toEqual(['fast']);

    // `later` needs two Relaunches behind it.
    state.prestige.relaunches = 2;
    expect(validateLoadout(state, index, ['fast', 'later'])).toEqual(['fast', 'later']);
  });

  it('accepts a short loadout — fewer picks than slots is a legal choice', () => {
    const { state, index } = ready();
    expect(validateLoadout(state, index, [])).toEqual([]);
    expect(validateLoadout(state, index, ['salvage'])).toEqual(['salvage']);
  });

  /** A gate that reads prestige state must not be re-locked by the reset. */
  it('keeps unlocked directives unlocked across a Relaunch', () => {
    const { state, index } = ready();
    state.prestige.relaunches = 2;
    const before = availableDirectives(state, index).length;
    relaunch(state, index, []);
    expect(availableDirectives(state, index).length).toBeGreaterThanOrEqual(before);
  });
});

describe('the reset', () => {
  const ended = () =>
    world((s) => {
      s.resources.ore = dec(5_000);
      s.resources.alloy = dec(800);
      s.lifetime.ore = dec(SCHEMATIC_DIVISOR * 100);
      s.lifetime.alloy = dec(9_000);
      s.totals.ore = dec(SCHEMATIC_DIVISOR * 400);
      s.buildings = { miner: 40, mill: 6 };
      s.buildingActive = { mill: false };
      s.upgrades = ['add', 'mult'];
      s.automation = ['auto-miner'];
      s.automationOn = { 'auto-miner': true };
      s.milestones = ['ten-ore'];
      s.accumulator = 0.07;
      s.stats = { playedSeconds: 9_000, runSeconds: 4_000, taps: 61 };
      s.prestige.perks = ['root'];
      s.prestige.schematics = dec(2);
      s.prestige.schematicsEarned = dec(2);
    });

  it('destroys the run and banks the payout', () => {
    const { state, index } = ended();
    const report = relaunch(state, index, []);

    expect(report.schematics.toNumber()).toBe(10);
    expect(state.buildings).toEqual({});
    expect(state.buildingActive).toEqual({});
    expect(state.upgrades).toEqual([]);
    expect(state.automation).toEqual([]);
    expect(state.automationOn).toEqual({});
    expect(state.resources.ore.isZero).toBe(true);
    expect(state.lifetime.ore.isZero).toBe(true);
    expect(state.accumulator).toBe(0);
    expect(state.stats.runSeconds).toBe(0);
  });

  it('keeps the tree, the log, the settings and the all-time record', () => {
    const { state, index } = ended();
    relaunch(state, index, []);

    expect(state.prestige.perks).toEqual(['root']);
    expect(state.prestige.schematics.toNumber()).toBe(12);
    expect(state.prestige.schematicsEarned.toNumber()).toBe(12);
    expect(state.prestige.relaunches).toBe(1);
    expect(state.milestones).toEqual(['ten-ore']);
    expect(state.stats.playedSeconds).toBe(9_000);
    expect(state.stats.taps).toBe(61);
    expect(state.totals.ore.toNumber()).toBe(SCHEMATIC_DIVISOR * 400);
  });

  it('counts earned Schematics even once they are spent', () => {
    const { state, index } = ended();
    relaunch(state, index, []);
    buyPerk(state, index, 'branch');

    expect(state.prestige.schematics.toNumber()).toBe(8);
    expect(state.prestige.schematicsEarned.toNumber()).toBe(12);
  });

  it('grants the new run what its perks and directives promised', () => {
    const { state, index } = ended();
    state.prestige.perks = ['root', 'branch']; // branch: start with 100 ore
    // `salvage` keeps half of what the run ends holding: 5000 ore -> 2500.
    relaunch(state, index, ['salvage']);

    expect(state.resources.ore.toNumber()).toBe(2_600);
    // Granted stock counts as produced this run, or the content it gates on
    // would stay hidden while the player is holding it.
    expect(state.lifetime.ore.toNumber()).toBe(2_600);
    // But it is not produced twice: the all-time record does not move.
    expect(state.totals.ore.toNumber()).toBe(SCHEMATIC_DIVISOR * 400);
  });

  it('reads carry from the run that is ending, not the one beginning', () => {
    const { state, index } = ended();
    relaunch(state, index, ['salvage']);
    const first = state.resources.ore;
    expect(first.toNumber()).toBe(2_500);

    // Second Relaunch from an empty hold carries nothing, even though the same
    // directive is in force.
    state.lifetime.ore = dec(SCHEMATIC_DIVISOR * 100);
    state.resources.ore = Decimal.ZERO;
    relaunch(state, index, ['salvage']);
    expect(state.resources.ore.isZero).toBe(true);
  });

  it('re-gates the new run honestly', () => {
    const { state, index, cache } = ended();
    relaunch(state, index, []);
    cache.invalidate();

    // Nothing produced yet, so nothing is running: the swarm really is gone.
    expect(computeRates(state, index).output.get('ore')?.isZero).toBe(true);
    advance(state, index, cache, 1);
    expect(state.resources.ore.isZero).toBe(true);
  });
});

describe('the tree', () => {
  it('sells only what the prerequisites have opened', () => {
    const { state, index } = world((s) => {
      s.prestige.schematics = dec(100);
    });
    expect(availablePerks(state, index).map((p) => p.id)).toEqual(['root']);

    expect(buyPerk(state, index, 'branch')).toBe(false);
    expect(buyPerk(state, index, 'root')).toBe(true);
    expect(buyPerk(state, index, 'branch')).toBe(true);
    expect(state.prestige.schematics.toNumber()).toBe(95);
  });

  it('refuses a perk twice, and refuses one it cannot pay for', () => {
    const { state, index } = world((s) => {
      s.prestige.schematics = dec(1);
    });
    expect(buyPerk(state, index, 'root')).toBe(true);
    expect(buyPerk(state, index, 'root')).toBe(false);
    expect(buyPerk(state, index, 'branch')).toBe(false);
    expect(state.prestige.schematics.isZero).toBe(true);
  });
});

describe('the multipliers', () => {
  it('composes perks and directives multiplicatively, penalties included', () => {
    const { state, index } = world((s) => {
      s.prestige.perks = ['root']; // ore ×2
      s.prestige.directives = ['fast', 'salvage']; // miner ×3, heat ×2
    });
    const mult = prestigeMultipliers(state, index);

    expect(mult.byResource.get('ore')).toBe(2);
    expect(mult.byBuilding.get('miner')).toBe(3);
    expect(mult.heat).toBe(2);
  });

  it('reaches the pipeline at the two points the order of operations allows', () => {
    const { state } = world((s) => {
      s.buildings = { miner: 10 };
    });
    const plain = computeRates(state, FIXTURE_INDEX).output.get('ore')!;

    state.prestige.perks = ['root']; // global ore ×2
    state.prestige.directives = ['fast']; // miner ×3
    const boosted = computeRates(state, FIXTURE_INDEX).output.get('ore')!;

    expect(boosted.div(plain).toNumber()).toBeCloseTo(6, 9);
  });

  it('lets a directive cancel a perk exactly', () => {
    const { state } = world((s) => {
      s.buildings = { miner: 10 };
    });
    const plain = computeRates(state, FIXTURE_INDEX).output.get('ore')!;

    // `fast` is ×3 and `slow` is ×0.5, but they are the same family — only one
    // can be in force, which is precisely the point of the family rule.
    state.prestige.directives = ['slow'];
    const halved = computeRates(state, FIXTURE_INDEX).output.get('ore')!;
    expect(halved.div(plain).toNumber()).toBeCloseTo(0.5, 9);
  });

  it('multiplies storage and manual mining too', () => {
    const { state } = world((s) => {
      s.prestige.perks = ['root', 'branch']; // capacity ore ×2
    });
    const caps = computeRates(state, FIXTURE_INDEX).caps.get('ore')!;
    expect(caps.toNumber()).toBe(2_000_000);
  });

  it('the cache picks prestige up without being told about it', () => {
    const { state, index, cache } = world((s) => {
      s.buildings = { miner: 10 };
    });
    const before = cache.get(state).output.get('ore')!;

    state.prestige.perks = ['root'];
    cache.invalidate();
    expect(cache.get(state).output.get('ore')!.div(before).toNumber()).toBeCloseTo(2, 9);
    expect(index).toBe(FIXTURE_INDEX);
  });
});

describe('the shipped tree', () => {
  it('opens enough directive families to fill a loadout at the first Relaunch', () => {
    const first = CONTENT.directives.filter((d) => d.unlock.kind === 'always');
    expect(new Set(first.map((d) => d.family)).size).toBeGreaterThanOrEqual(DIRECTIVE_SLOTS);
  });

  /**
   * A directive with no downside collapses the pool into one correct loadout,
   * which is the failure mode the whole family system exists to prevent.
   */
  it('gives every directive a real cost', () => {
    for (const directive of CONTENT.directives) {
      const helps = directive.effects.some(
        (e) =>
          (e.kind === 'global' && e.factor > 1) ||
          (e.kind === 'building' && e.factor > 1) ||
          (e.kind === 'capacity' && e.factor > 1) ||
          (e.kind === 'payout' && e.factor > 1) ||
          e.kind === 'carry' ||
          (e.kind === 'heat' && e.factor < 1),
      );
      const costs = directive.effects.some(
        (e) =>
          (e.kind === 'global' && e.factor < 1) ||
          (e.kind === 'building' && e.factor < 1) ||
          (e.kind === 'capacity' && e.factor < 1) ||
          (e.kind === 'heat' && e.factor > 1),
      );
      // Salvage Doctrine is the one exception: its cost is the slot itself,
      // since carrying stock forward has no in-run downside to price it with.
      const exempt = directive.id === 'salvage-doctrine';
      expect(helps, `${directive.id} does nothing good`).toBe(true);
      expect(costs || exempt, `${directive.id} has no downside`).toBe(true);
    }
  });

  it('roots every perk in the tree and prices it in whole Schematics', () => {
    const ids = new Set(CONTENT.perks.map((p) => p.id));
    for (const perk of CONTENT.perks) {
      expect(Number.isInteger(perk.cost)).toBe(true);
      for (const id of perk.requires) expect(ids.has(id)).toBe(true);
    }
  });

  /**
   * The first Relaunch has to land inside §5's 2h-5h window. A greedy simulated
   * player reaches a run value of ~3.3e7 at 2h and ~6.4e8 at 5h, so the floor
   * belongs between them. This is the assertion that catches an edit to the
   * divisor, the exponent or a resource weight quietly moving the whole phase
   * table — all four feed it.
   */
  it('puts the first Relaunch inside the phase window it was tuned for', () => {
    const { state } = world();
    const needed = valueForSchematics(state, REAL_INDEX, RELAUNCH_MINIMUM).toNumber();
    expect(needed).toBeGreaterThan(3.3e7);
    expect(needed).toBeLessThan(6.4e8);
  });

  /**
   * Weighting each resource at its conversion cost makes refining exactly
   * value-neutral, and every directive that trades ore for alloy or compute
   * strictly bad with it. The premium is what keeps those picks alive, so it is
   * worth pinning rather than leaving to be re-derived later.
   */
  it('pays a premium for depth, not merely the conversion cost', () => {
    const weight = (id: string): number =>
      CONTENT.resources.find((r) => r.id === id)!.prestigeWeight;

    expect(weight('ore')).toBe(1);
    // ~30 ore per alloy and ~700 per compute along the shipped building ladder.
    expect(weight('alloy')).toBeGreaterThan(30 * 2);
    expect(weight('compute')).toBeGreaterThan(700 * 2);
    // Each rung must be worth strictly more than the one below it.
    expect(weight('compute')).toBeGreaterThan(weight('alloy'));
  });
});
