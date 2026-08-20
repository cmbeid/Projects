import { describe, expect, it } from 'vitest';
import { buildIndex } from '../src/data/indexes';
import { INDEX } from '../src/data/index';
import { combine, pickHint, progress, routesTo } from '../src/game/engine';
import type { Element, Recipe } from '../src/data/types';

/** A tiny hand-built graph, so these tests do not depend on the shipped content. */
function fixture() {
  const elements: Element[] = (
    ['air', 'earth', 'fire', 'water', 'steam', 'mud', 'cloud', 'rain'] as const
  ).map((id) => ({
    id,
    name: id,
    emoji: '🔹',
    category: 'base' as const,
    blurb: 'test',
  }));

  const recipes: Recipe[] = [
    { a: 'fire', b: 'water', out: 'steam' },
    { a: 'earth', b: 'water', out: 'mud' },
    // One pair, two outputs — the multi-output path.
    { a: 'air', b: 'steam', out: 'cloud' },
    { a: 'air', b: 'steam', out: 'rain' },
  ];

  return buildIndex(elements, recipes);
}

describe('combine', () => {
  const index = fixture();
  const base = new Set(['air', 'earth', 'fire', 'water']);

  it('produces the same result regardless of argument order', () => {
    const forward = combine(index, base, 'fire', 'water');
    const reverse = combine(index, base, 'water', 'fire');
    expect(forward).toEqual(reverse);
  });

  it('reports a new discovery the first time', () => {
    const result = combine(index, base, 'fire', 'water');
    expect(result).toEqual({ kind: 'combined', outputs: ['steam'], discoveries: ['steam'] });
  });

  it('still combines once the output is already known, but claims no discovery', () => {
    const known = new Set([...base, 'steam']);
    const result = combine(index, known, 'fire', 'water');
    expect(result.kind).toBe('combined');
    if (result.kind !== 'combined') return;
    expect(result.outputs).toEqual(['steam']);
    expect(result.discoveries).toEqual([]);
  });

  it('returns every output for a pair that makes several things', () => {
    const known = new Set([...base, 'steam']);
    const result = combine(index, known, 'air', 'steam');
    expect(result.kind).toBe('combined');
    if (result.kind !== 'combined') return;
    expect(result.outputs).toEqual(['cloud', 'rain']);
    expect(result.discoveries).toEqual(['cloud', 'rain']);
  });

  it('returns none for a pair with no recipe', () => {
    expect(combine(index, base, 'air', 'earth')).toEqual({ kind: 'none' });
  });

  it('returns none for an element combined with itself when no such recipe exists', () => {
    expect(combine(index, base, 'fire', 'fire')).toEqual({ kind: 'none' });
  });
});

describe('pickHint', () => {
  const index = fixture();

  it('suggests a pair the player can actually make', () => {
    const hint = pickHint(index, ['air', 'earth', 'fire', 'water']);
    expect(hint).not.toBeNull();
    if (!hint) return;
    expect(hint.inputs.every((id) => ['air', 'earth', 'fire', 'water'].includes(id))).toBe(true);
    expect(hint.newCount).toBeGreaterThan(0);
  });

  it('never suggests something already discovered', () => {
    const discovered = ['air', 'earth', 'fire', 'water', 'steam', 'mud'];
    const hint = pickHint(index, discovered);
    expect(hint).not.toBeNull();
    if (!hint) return;
    // The only remaining recipe is air + steam.
    expect([...hint.inputs].sort()).toEqual(['air', 'steam']);
  });

  it('returns null once everything reachable has been found', () => {
    const everything = index.all.map((element) => element.id);
    expect(pickHint(index, everything)).toBeNull();
  });

  it('produces a workable hint against the real content tree', () => {
    const hint = pickHint(INDEX, ['air', 'earth', 'fire', 'water']);
    expect(hint).not.toBeNull();
    if (!hint) return;
    const outputs = INDEX.recipeMap.get(
      hint.inputs[0] < hint.inputs[1]
        ? `${hint.inputs[0]}+${hint.inputs[1]}`
        : `${hint.inputs[1]}+${hint.inputs[0]}`,
    );
    expect(outputs?.length).toBeGreaterThan(0);
  });
});

describe('progress', () => {
  const index = fixture();

  it('counts discoveries against the full element table', () => {
    const stats = progress(index, new Set(['air', 'earth', 'fire', 'water']));
    expect(stats.found).toBe(4);
    expect(stats.total).toBe(8);
    expect(stats.percent).toBe(50);
  });
});

describe('routesTo', () => {
  const index = fixture();

  it('hides routes whose inputs the player has not discovered', () => {
    const routes = routesTo(index, new Set(['air', 'earth', 'fire', 'water']), 'cloud');
    // air + steam makes cloud, but steam is not discovered yet.
    expect(routes.known).toEqual([]);
    expect(routes.hiddenCount).toBe(1);
  });

  it('reveals a route once both inputs are known', () => {
    const routes = routesTo(index, new Set(['air', 'fire', 'water', 'steam']), 'cloud');
    expect(routes.known).toEqual([['air', 'steam']]);
    expect(routes.hiddenCount).toBe(0);
  });
});
