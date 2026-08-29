import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/data/index';
import { validateContent } from '../src/data/validate';
import { buildIndex } from '../src/data/indexes';

const report = validateContent(CONTENT);

describe('shipped content', () => {
  /** The same gate `npm run validate` runs, so CI catches it either way. */
  it('has no integrity or reachability errors', () => {
    expect(report.errors).toEqual([]);
  });

  it('has no warnings', () => {
    expect(report.warnings).toEqual([]);
  });

  it('covers all three eras', () => {
    expect([...report.stats.byEra.keys()].sort()).toEqual([1, 2, 3]);
  });

  it('prices every building above zero with a growing curve', () => {
    for (const building of CONTENT.buildings) {
      expect(building.cost.base).toBeGreaterThan(0);
      expect(building.cost.growth).toBeGreaterThan(1);
    }
  });

  /**
   * Every era past the first must consume the one before it, or the resource
   * ladder is three independent games sharing a screen.
   */
  it('chains the eras together through consumption', () => {
    const consumed = new Set(CONTENT.buildings.flatMap((b) => b.inputs.map((i) => i.resource)));
    expect(consumed.has('ore')).toBe(true);
    expect(consumed.has('alloy')).toBe(true);
  });

  it('buys every automator with compute, which is what makes era 3 pay off', () => {
    for (const automation of CONTENT.automation) {
      expect(automation.cost.resource).toBe('compute');
    }
  });

  it('gives every upgrade at least one effect', () => {
    for (const upgrade of CONTENT.upgrades) {
      expect(upgrade.effects.length).toBeGreaterThan(0);
    }
  });
});

describe('the index', () => {
  const index = buildIndex(CONTENT);

  it('maps every id', () => {
    expect(index.buildingById.size).toBe(CONTENT.buildings.length);
    expect(index.upgradeById.size).toBe(CONTENT.upgrades.length);
    expect(index.automationById.size).toBe(CONTENT.automation.length);
  });

  it('files producers, consumers and depots separately', () => {
    expect(index.producersOf.get('ore')?.length).toBeGreaterThan(0);
    expect(index.consumersOf.get('ore')?.length).toBeGreaterThan(0);
    expect(index.depotsOf.get('ore')?.length).toBe(1);
    // A depot produces nothing, so it must not appear as a producer.
    expect(index.producersOf.get('ore')?.some((b) => b.id === 'oredepot')).toBe(false);
  });
});

describe('the prestige content', () => {
  it('opens a Schematics tree whose every branch is rooted', () => {
    expect(CONTENT.perks.length).toBeGreaterThan(0);
    const ids = new Set(CONTENT.perks.map((p) => p.id));
    for (const perk of CONTENT.perks) {
      for (const required of perk.requires) expect(ids.has(required)).toBe(true);
    }
  });

  it('gives every directive a family', () => {
    for (const directive of CONTENT.directives) {
      expect(directive.family.trim()).not.toBe('');
    }
  });

  it('indexes directives by family, which is what makes a loadout exclusive', () => {
    const index = buildIndex(CONTENT);
    const total = [...index.directivesByFamily.values()].reduce((n, list) => n + list.length, 0);
    expect(total).toBe(CONTENT.directives.length);
  });
});

describe('the validator itself', () => {
  it('catches a dangling reference', () => {
    const broken = {
      ...CONTENT,
      upgrades: [
        {
          id: 'bad', name: 'Bad', emoji: '', blurb: '', era: 1 as const,
          cost: { resource: 'ore' as const, amount: 10 },
          effects: [{ kind: 'additive' as const, building: 'nope', amount: 1 }],
          unlock: { kind: 'always' as const },
        },
      ],
    };
    expect(validateContent(broken).errors.some((e) => e.includes('nope'))).toBe(true);
  });

  it('catches a cost curve that does not grow', () => {
    const flat = {
      ...CONTENT,
      buildings: CONTENT.buildings.map((b) =>
        b.id === 'probe' ? { ...b, cost: { ...b.cost, growth: 1 } } : b,
      ),
    };
    expect(validateContent(flat).errors.some((e) => e.includes('not greater than 1'))).toBe(true);
  });

  it('catches a perk whose requirements cycle', () => {
    const cyclic = {
      ...CONTENT,
      perks: [
        {
          id: 'a', name: 'A', emoji: '', blurb: '', cost: 1,
          effects: [{ kind: 'tap' as const, factor: 2 }],
          requires: ['b'],
        },
        {
          id: 'b', name: 'B', emoji: '', blurb: '', cost: 1,
          effects: [{ kind: 'tap' as const, factor: 2 }],
          requires: ['a'],
        },
      ],
    };
    const errors = validateContent(cyclic).errors;
    expect(errors.some((e) => e.includes('requirements cycle'))).toBe(true);
  });

  it('catches a directive naming a building that does not exist', () => {
    const broken = {
      ...CONTENT,
      directives: [
        {
          id: 'bad', name: 'Bad', emoji: '', blurb: '', family: 'Expansion',
          effects: [{ kind: 'building' as const, building: 'nope', factor: 2 }],
          unlock: { kind: 'always' as const },
        },
      ],
    };
    expect(validateContent(broken).errors.some((e) => e.includes('nope'))).toBe(true);
  });

  /**
   * The one content bug in this layer that would strand a player at the
   * prestige screen with no legal way forward.
   */
  it('catches a directive pool that cannot fill a loadout', () => {
    const thin = {
      ...CONTENT,
      directives: CONTENT.directives.filter((d) => d.family === 'Expansion'),
    };
    expect(validateContent(thin).errors.some((e) => e.includes('cannot fill'))).toBe(true);
  });

  it('catches content gated on itself', () => {
    const cyclic = {
      ...CONTENT,
      upgrades: [
        {
          id: 'loop', name: 'Loop', emoji: '', blurb: '', era: 1 as const,
          cost: { resource: 'ore' as const, amount: 10 },
          effects: [{ kind: 'tap' as const, factor: 2 }],
          unlock: { kind: 'upgrade' as const, upgrade: 'loop' },
        },
      ],
    };
    expect(validateContent(cyclic).errors.some((e) => e.includes('never be unlocked'))).toBe(true);
  });
});
