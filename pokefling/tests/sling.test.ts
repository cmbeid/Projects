import { describe, expect, it } from 'vitest';
import { clampPull, launchVelocity } from '../src/game/sling';
import { impactDamage } from '../src/game/damage';
import { MAX_PULL, MAX_SPEED, SLING } from '../src/game/world';

describe('clampPull', () => {
  it('passes a short pull through', () => {
    expect(clampPull({ x: SLING.x - 30, y: SLING.y + 40 })).toEqual({ x: -30, y: 40 });
  });
  it('caps a long pull at MAX_PULL in the same direction', () => {
    const pull = clampPull({ x: SLING.x - 300, y: SLING.y + 400 });
    expect(Math.hypot(pull.x, pull.y)).toBeCloseTo(MAX_PULL);
    expect(pull.x / pull.y).toBeCloseTo(-300 / 400);
  });
});

describe('launchVelocity', () => {
  it('fires opposite the pull, at MAX_SPEED when fully drawn', () => {
    const v = launchVelocity({ x: -MAX_PULL, y: 0 });
    expect(v.x).toBeCloseTo(MAX_SPEED);
    expect(v.y).toBeCloseTo(0);
  });
});

describe('impactDamage', () => {
  it('does nothing below the threshold', () => {
    expect(impactDamage(1, 1, 1)).toBe(0);
  });
  it('hurts the lighter body more', () => {
    expect(impactDamage(10, 1, 8)).toBeGreaterThan(impactDamage(10, 8, 1));
  });
  it('treats static bodies as infinitely heavy', () => {
    expect(impactDamage(10, 1, Infinity)).toBeGreaterThan(impactDamage(10, 1, 1000));
  });
});
