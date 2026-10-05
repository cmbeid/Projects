import { describe, expect, it } from 'vitest';
import { place } from '../src/game/economy';
import { newGame } from '../src/game/engine';
import { applyOffline } from '../src/game/offline';

describe('time away', () => {
  it('pays crews and taxes, never brings a landmark down, and is capped', () => {
    const s = newGame(2);
    s.features.push('build', 'crews');
    s.story.id = null;
    s.coins = 1e6;
    place(s, 'tent', 0, 0, 0);
    place(s, 'gang', 0, 1, 0);
    place(s, 'stall', 0, 2, 0);
    const coins = s.coins;
    const r = applyOffline(s, 3600 * 100);
    expect(r.capped).toBe(true);
    expect(r.seconds).toBe(8 * 3600);
    expect(r.clears).toBeGreaterThan(0);
    expect(r.taxes).toBeGreaterThan(0);
    expect(s.coins).toBeGreaterThan(coins);
    expect(s.maxWard).toBe(1);
  });
});
