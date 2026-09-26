import { describe, expect, it } from 'vitest';
import { EMPTY_PROGRESS, isUnlocked, loadProgress, recordWin, saveProgress, totalStars } from '../src/state/save';

function memoryStore(): Pick<Storage, 'getItem' | 'setItem'> & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('progress', () => {
  it('round-trips through storage', () => {
    const store = memoryStore();
    const progress = recordWin({ ...EMPTY_PROGRESS, muted: true }, 1, 25_000, 2);
    saveProgress(progress, store);
    expect(loadProgress(store)).toEqual(progress);
  });

  it('starts fresh from garbage, a missing store, or a throwing one', () => {
    const store = memoryStore();
    store.data.set('pokefling:progress', '{not json');
    expect(loadProgress(store)).toEqual(EMPTY_PROGRESS);
    expect(loadProgress(null)).toEqual(EMPTY_PROGRESS);
    const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(loadProgress(throwing)).toEqual(EMPTY_PROGRESS);
    expect(() => saveProgress(EMPTY_PROGRESS, throwing)).not.toThrow();
  });

  it('keeps the best score and the best stars, even from different runs', () => {
    let p = recordWin(EMPTY_PROGRESS, 3, 40_000, 2);
    p = recordWin(p, 3, 30_000, 3);
    expect(p.best[3]).toEqual({ score: 40_000, stars: 3 });
    expect(totalStars(p)).toBe(3);
  });

  it('unlocks levels one at a time', () => {
    const p = recordWin(EMPTY_PROGRESS, 1, 1, 1);
    expect(isUnlocked(p, 1)).toBe(true);
    expect(isUnlocked(p, 2)).toBe(true);
    expect(isUnlocked(p, 3)).toBe(false);
  });
});
