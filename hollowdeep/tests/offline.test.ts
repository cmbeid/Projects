import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game/engine';
import { applyOffline } from '../src/game/offline';
import { unlockFeature } from '../src/game/features';
import { buyMachine } from '../src/game/economy';
import { queueRefine } from '../src/game/crafting';

describe('offline progress', () => {
  it('lets machines mine and furnaces smelt, at the same depth', () => {
    const s = newGame(1);
    unlockFeature(s, 'drones');
    unlockFeature(s, 'refinery');
    s.coins = 1e5;
    buyMachine(s, 'drone', 30);
    s.inventory = { copper: 80 };
    queueRefine(s, 0, 'r-copper', 10);
    const r = applyOffline(s, 3600);
    expect(r.blocks).toBeGreaterThan(0);
    expect(s.inventory['copper-bar']).toBeGreaterThan(0);
    expect(s.depth).toBe(1);
  });

  it('stops counting at the cap', () => {
    const s = newGame(2);
    const r = applyOffline(s, 1e7);
    expect(r.capped).toBe(true);
    expect(r.seconds).toBe(8 * 3600);
  });

  it('gives nothing with no machines', () => {
    const s = newGame(3);
    const r = applyOffline(s, 3600);
    expect(r.blocks).toBe(0);
  });
});
