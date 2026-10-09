import { describe, expect, it } from 'vitest';
import { LINES } from '../src/data/buildings';
import { EVENTS } from '../src/data/chronicle';
import { ERAS } from '../src/data/eras';
import { TECHS } from '../src/data/techs';
import { validate } from '../src/data/validate';
import { WONDERS } from '../src/data/wonders';

describe('content', () => {
  it('is sound: every price payable in time, every requirement real', () => {
    expect(validate()).toEqual([]);
  });

  it('has the promised size', () => {
    expect(ERAS).toHaveLength(8);
    expect(LINES.reduce((n, l) => n + l.tiers.length, 0)).toBe(81);
    expect(TECHS).toHaveLength(80);
    expect(WONDERS).toHaveLength(15);
    expect(EVENTS.length).toBeGreaterThanOrEqual(40);
  });

  it('gives every era Chronicle events of its own', () => {
    for (const e of ERAS) expect(EVENTS.filter((x) => x.eras[0] <= e.index && e.index <= x.eras[1]).length).toBeGreaterThanOrEqual(10);
  });

  it('makes every tier of a line better than the last', () => {
    for (const l of LINES) {
      for (let i = 1; i < l.tiers.length; i++) {
        const [a, b] = [l.tiers[i - 1]!, l.tiers[i]!];
        expect(b.prod).toBeGreaterThan(a.prod);
        expect(b.housing + b.slots + b.cap + b.stability + b.power).toBeGreaterThanOrEqual(a.housing + a.slots + a.cap + a.stability + a.power);
      }
    }
  });
});
