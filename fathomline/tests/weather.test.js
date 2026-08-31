import { describe, expect, it } from 'vitest';
import { averageModifier, modifierForSlot, slotIndexAt, SLOT_MS } from '../src/systems/weather.js';

describe('weather averageModifier (closed-form time-weighting)', () => {
  const SEED = 777;

  it('equals a single slot modifier when the window sits entirely inside one slot', () => {
    const slot = 40;
    const fromMs = slot * SLOT_MS + 1000;
    const toMs = fromMs + 2000;
    const avg = averageModifier(SEED, fromMs, toMs, 'value');
    expect(avg).toBeCloseTo(modifierForSlot(SEED, slot, 'value'), 10);
  });

  it('matches a manual weighted sum across a multi-slot window', () => {
    const fromMs = 5 * SLOT_MS + SLOT_MS / 2; // half-way into slot 5
    const toMs = fromMs + SLOT_MS * 3.25; // spans slots 5..8
    const kind = 'bite';
    let expectedWeighted = 0;
    const totalMs = toMs - fromMs;
    for (let slot = slotIndexAt(fromMs); slot <= slotIndexAt(toMs - 1); slot++) {
      const slotStart = slot * SLOT_MS;
      const slotEnd = slotStart + SLOT_MS;
      const overlap = Math.min(toMs, slotEnd) - Math.max(fromMs, slotStart);
      expectedWeighted += modifierForSlot(SEED, slot, kind) * overlap;
    }
    const manual = expectedWeighted / totalMs;
    expect(averageModifier(SEED, fromMs, toMs, kind)).toBeCloseTo(manual, 10);
  });

  it('differs across two slots with a different weather mix (not a flat constant)', () => {
    // Find a pair of adjacent slots whose 'bite' modifier actually differs
    // (weather state and day/night phase both feed into it, so this is
    // guaranteed within one day/night cycle) and confirm averaging over each
    // alone reports that difference rather than collapsing to one constant.
    let slotA = null;
    for (let slot = 0; slot < 200; slot++) {
      if (modifierForSlot(SEED, slot, 'bite') !== modifierForSlot(SEED, slot + 1, 'bite')) {
        slotA = slot;
        break;
      }
    }
    expect(slotA).not.toBeNull();
    const windowA = averageModifier(SEED, slotA * SLOT_MS, (slotA + 1) * SLOT_MS, 'bite');
    const windowB = averageModifier(SEED, (slotA + 1) * SLOT_MS, (slotA + 2) * SLOT_MS, 'bite');
    expect(windowA).not.toBeCloseTo(windowB, 6);
  });

  it('resolves a 12-hour window (many slots) in well under 50ms', () => {
    const start = performance.now();
    averageModifier(SEED, 0, 12 * 3600 * 1000, 'bite');
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
});
