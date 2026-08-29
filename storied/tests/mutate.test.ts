import { describe, expect, it } from 'vitest';
import { applyMutations } from '../src/engine/mutate';
import type { VariableTable } from '../src/content/types';

const BASE: VariableTable = { flag: false, count: 5, name: 'x', bag: ['a', 'b'] };

describe('applyMutations — each op', () => {
  it('set replaces the value outright, for any variable type', () => {
    expect(applyMutations([{ var: 'count', op: 'set', value: 42 }], BASE)['count']).toBe(42);
    expect(applyMutations([{ var: 'flag', op: 'set', value: true }], BASE)['flag']).toBe(true);
    expect(applyMutations([{ var: 'bag', op: 'set', value: ['z'] }], BASE)['bag']).toEqual(['z']);
  });

  it('add and sub adjust a number', () => {
    expect(applyMutations([{ var: 'count', op: 'add', value: 3 }], BASE)['count']).toBe(8);
    expect(applyMutations([{ var: 'count', op: 'sub', value: 2 }], BASE)['count']).toBe(3);
  });

  it('toggle flips a boolean', () => {
    expect(applyMutations([{ var: 'flag', op: 'toggle' }], BASE)['flag']).toBe(true);
    const twice = applyMutations([{ var: 'flag', op: 'toggle' }, { var: 'flag', op: 'toggle' }], BASE);
    expect(twice['flag']).toBe(false);
  });

  it('push appends to a list, in order', () => {
    expect(applyMutations([{ var: 'bag', op: 'push', value: 'c' }], BASE)['bag']).toEqual(['a', 'b', 'c']);
  });

  it('push is a no-op if the value is already present — a list holds each string at most once (format.md §7)', () => {
    expect(applyMutations([{ var: 'bag', op: 'push', value: 'a' }], BASE)['bag']).toEqual(['a', 'b']);
  });

  it('remove drops a value if present', () => {
    expect(applyMutations([{ var: 'bag', op: 'remove', value: 'a' }], BASE)['bag']).toEqual(['b']);
  });

  it('remove is a no-op if the value is absent', () => {
    const bag = applyMutations([{ var: 'bag', op: 'remove', value: 'ghost' }], BASE)['bag'];
    expect(bag).toEqual(['a', 'b']);
  });
});

describe('applyMutations — ordering and immutability', () => {
  it('runs an array in order', () => {
    const vars = applyMutations(
      [
        { var: 'count', op: 'set', value: 10 },
        { var: 'count', op: 'add', value: 1 },
        { var: 'count', op: 'sub', value: 5 },
      ],
      BASE,
    );
    expect(vars['count']).toBe(6);
  });

  it('never mutates the table it was given', () => {
    const before = JSON.stringify(BASE);
    applyMutations([{ var: 'count', op: 'add', value: 1 }, { var: 'bag', op: 'push', value: 'z' }], BASE);
    expect(JSON.stringify(BASE)).toBe(before);
  });

  it('leaves an untouched variable alone', () => {
    const vars = applyMutations([{ var: 'count', op: 'add', value: 1 }], BASE);
    expect(vars['name']).toBe('x');
    expect(vars['flag']).toBe(false);
  });
});

describe('applyMutations — defensive against a variable of the wrong type', () => {
  // validate.ts (§7) is what's supposed to catch these before content ships;
  // the engine still shouldn't throw if it somehow sees one at runtime.
  it('add/sub against a non-number treats the current value as 0', () => {
    expect(applyMutations([{ var: 'flag', op: 'add', value: 5 } as never], BASE)['flag']).toBe(5);
  });

  it('toggle against a non-boolean treats the current value as false', () => {
    expect(applyMutations([{ var: 'count', op: 'toggle' } as never], BASE)['count']).toBe(true);
  });

  it('push/remove against a non-list treats the current value as an empty list', () => {
    expect(applyMutations([{ var: 'name', op: 'push', value: 'y' } as never], BASE)['name']).toEqual(['y']);
  });
});
