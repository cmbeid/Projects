import { describe, expect, it } from 'vitest';
import { evaluateCondition } from '../src/engine/conditions';
import type { PlayState } from '../src/engine/types';

function state(vars: PlayState['vars'], visited: string[] = []): Pick<PlayState, 'vars' | 'visited'> {
  return { vars, visited };
}

describe('evaluateCondition — variable comparisons', () => {
  it('eq: boolean, number, string', () => {
    expect(evaluateCondition({ var: 'x', eq: true }, state({ x: true }))).toBe(true);
    expect(evaluateCondition({ var: 'x', eq: false }, state({ x: true }))).toBe(false);
    expect(evaluateCondition({ var: 'x', eq: 3 }, state({ x: 3 }))).toBe(true);
    expect(evaluateCondition({ var: 'x', eq: 'a' }, state({ x: 'b' }))).toBe(false);
  });

  it('eq: list, by element', () => {
    expect(evaluateCondition({ var: 'x', eq: ['a', 'b'] }, state({ x: ['a', 'b'] }))).toBe(true);
    expect(evaluateCondition({ var: 'x', eq: ['a', 'b'] }, state({ x: ['a', 'c'] }))).toBe(false);
    expect(evaluateCondition({ var: 'x', eq: ['a'] }, state({ x: ['a', 'b'] }))).toBe(false);
  });

  it('ne is the exact negation of eq', () => {
    expect(evaluateCondition({ var: 'x', ne: 3 }, state({ x: 3 }))).toBe(false);
    expect(evaluateCondition({ var: 'x', ne: 3 }, state({ x: 4 }))).toBe(true);
  });

  it('gt / gte / lt / lte', () => {
    expect(evaluateCondition({ var: 'x', gt: 3 }, state({ x: 4 }))).toBe(true);
    expect(evaluateCondition({ var: 'x', gt: 3 }, state({ x: 3 }))).toBe(false);
    expect(evaluateCondition({ var: 'x', gte: 3 }, state({ x: 3 }))).toBe(true);
    expect(evaluateCondition({ var: 'x', lt: 3 }, state({ x: 2 }))).toBe(true);
    expect(evaluateCondition({ var: 'x', lte: 3 }, state({ x: 3 }))).toBe(true);
    expect(evaluateCondition({ var: 'x', lte: 3 }, state({ x: 4 }))).toBe(false);
  });

  it('has: list membership', () => {
    expect(evaluateCondition({ var: 'x', has: 'key' }, state({ x: ['key', 'coin'] }))).toBe(true);
    expect(evaluateCondition({ var: 'x', has: 'key' }, state({ x: ['coin'] }))).toBe(false);
  });

  it('an undeclared variable evaluates false rather than throwing', () => {
    expect(evaluateCondition({ var: 'ghost', eq: true }, state({}))).toBe(false);
    expect(evaluateCondition({ var: 'ghost', gt: 0 }, state({}))).toBe(false);
  });

  it('a numeric comparison against a non-number variable evaluates false', () => {
    expect(evaluateCondition({ var: 'x', gt: 0 }, state({ x: 'not a number' }))).toBe(false);
  });

  it('has against a non-list variable evaluates false', () => {
    expect(evaluateCondition({ var: 'x', has: 'a' }, state({ x: 'a' }))).toBe(false);
  });
});

describe('evaluateCondition — visited', () => {
  it('true only once the node has been entered', () => {
    expect(evaluateCondition({ visited: 'door' }, state({}, []))).toBe(false);
    expect(evaluateCondition({ visited: 'door' }, state({}, ['arrival', 'door']))).toBe(true);
  });
});

describe('evaluateCondition — combinators', () => {
  it('all: every branch must hold', () => {
    const cond = { all: [{ var: 'x', gte: 1 }, { var: 'y', eq: true }] };
    expect(evaluateCondition(cond, state({ x: 1, y: true }))).toBe(true);
    expect(evaluateCondition(cond, state({ x: 0, y: true }))).toBe(false);
  });

  it('any: at least one branch must hold', () => {
    const cond = { any: [{ var: 'x', eq: 1 }, { var: 'x', eq: 2 }] };
    expect(evaluateCondition(cond, state({ x: 2 }))).toBe(true);
    expect(evaluateCondition(cond, state({ x: 3 }))).toBe(false);
  });

  it('not: inverts its one child', () => {
    expect(evaluateCondition({ not: { var: 'x', eq: true } }, state({ x: true }))).toBe(false);
    expect(evaluateCondition({ not: { var: 'x', eq: true } }, state({ x: false }))).toBe(true);
  });

  it('nests arbitrarily deep, per the format.md §6 truth table', () => {
    // { all: [A, { any: [B, C] }] } with A=true, B=false, C=true -> true
    const cond = {
      all: [
        { var: 'a', eq: true },
        { any: [{ var: 'b', eq: true }, { var: 'c', eq: true }] },
      ],
    };
    expect(evaluateCondition(cond, state({ a: true, b: false, c: true }))).toBe(true);
    expect(evaluateCondition(cond, state({ a: true, b: false, c: false }))).toBe(false);
  });
});
