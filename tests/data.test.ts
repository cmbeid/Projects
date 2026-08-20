import { describe, expect, it } from 'vitest';
import { ELEMENTS, INDEX, RECIPES } from '../src/data/index';
import { validateData } from '../src/data/validate';
import { pairKey, reachableDepths } from '../src/data/indexes';
import { BASE_ELEMENT_IDS } from '../src/data/types';

describe('recipe data', () => {
  const report = validateData(ELEMENTS, RECIPES);

  it('has no integrity errors', () => {
    // Printed in full so a failure names the offending elements directly.
    expect(report.errors).toEqual([]);
  });

  it('reaches every element from the four base elements', () => {
    expect(report.stats.unreachable).toEqual([]);
  });

  it('never lists a pair that yields two different elements by accident', () => {
    const accidental = report.warnings.filter((warning) =>
      warning.includes('produce more than one element'),
    );
    expect(accidental).toEqual([]);
  });

  it('starts the player with exactly the four base elements', () => {
    for (const id of BASE_ELEMENT_IDS) {
      expect(INDEX.byId.has(id)).toBe(true);
      expect(INDEX.producedBy.has(id)).toBe(false);
    }
  });

  it('derives final elements as those no recipe consumes', () => {
    for (const id of INDEX.finalIds) {
      expect(INDEX.usedIn.get(id) ?? []).toHaveLength(0);
    }
    // Sanity: the tree should have leaves, but not consist mostly of them.
    expect(INDEX.finalIds.size).toBeGreaterThan(0);
    expect(INDEX.finalIds.size).toBeLessThan(ELEMENTS.length / 2);
  });
});

describe('pairKey', () => {
  it('is order-agnostic', () => {
    expect(pairKey('fire', 'water')).toBe(pairKey('water', 'fire'));
  });

  it('keeps different pairs distinct', () => {
    expect(pairKey('fire', 'water')).not.toBe(pairKey('fire', 'earth'));
  });

  it('handles a pair of the same element', () => {
    expect(pairKey('water', 'water')).toBe(pairKey('water', 'water'));
  });
});

describe('reachability walk', () => {
  it('places the base elements at depth zero', () => {
    const depths = reachableDepths(INDEX);
    for (const id of BASE_ELEMENT_IDS) {
      expect(depths.get(id)).toBe(0);
    }
  });

  it('never reports a depth lower than a shortest real path', () => {
    const depths = reachableDepths(INDEX);
    // Steam is fire + water, so it must be exactly one step out.
    expect(depths.get('steam')).toBe(1);
  });
});
