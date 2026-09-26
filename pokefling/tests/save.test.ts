import { describe, expect, it } from 'vitest';
import {
  addItem, EMPTY_PROGRESS, isUnlocked, loadProgress, markFound, recordWin, saveProgress, STARTING_BAG, takeItem, totalStars,
} from '../src/state/save';

function memoryStore(): Pick<Storage, 'getItem' | 'setItem'> & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('progress', () => {
  it('round-trips through storage', () => {
    const store = memoryStore();
    let progress = recordWin({ ...EMPTY_PROGRESS, muted: true }, 'mt-moon-1', 25_000, 2);
    progress = markFound(addItem(progress, 'x-speed', 2), 'mt-moon-1');
    progress = { ...progress, volumes: { sfx: 10, cries: 20, music: 30 } };
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

  it('keeps only the mute switch from a version 1 save, whose levels no longer exist', () => {
    const store = memoryStore();
    store.data.set('pokefling:progress', JSON.stringify({ version: 1, best: { 1: { score: 5, stars: 3 } }, muted: true }));
    expect(loadProgress(store)).toEqual({ ...EMPTY_PROGRESS, muted: true });
  });

  it('clamps volumes and bag counts, and fills in anything missing', () => {
    const store = memoryStore();
    store.data.set('pokefling:progress', JSON.stringify({
      version: 2, best: {}, bag: { 'x-attack': -3, 'x-speed': 2.7 }, found: ['a', 7], volumes: { sfx: 250, music: -1 },
    }));
    const p = loadProgress(store);
    expect(p.volumes).toEqual({ sfx: 100, cries: 70, music: 0 });
    expect(p.bag['x-attack']).toBe(0);
    expect(p.bag['x-speed']).toBe(2);
    expect(p.bag['max-revive']).toBe(STARTING_BAG['max-revive']);
    expect(p.found).toEqual(['a']);
  });

  it('keeps the best score and the best stars, even from different runs', () => {
    let p = recordWin(EMPTY_PROGRESS, 'a', 40_000, 2);
    p = recordWin(p, 'a', 30_000, 3);
    expect(p.best['a']).toEqual({ score: 40_000, stars: 3 });
    expect(totalStars(p)).toBe(3);
    expect(totalStars(p, ['b'])).toBe(0);
  });

  it('never takes the bag below zero', () => {
    const p = takeItem(takeItem(EMPTY_PROGRESS, 'tm-ground'), 'tm-ground');
    expect(p.bag['tm-ground']).toBe(0);
  });

  it('unlocks levels one at a time, in order', () => {
    const order = ['a', 'b', 'c'];
    const p = recordWin(EMPTY_PROGRESS, 'a', 1, 1);
    expect(isUnlocked(p, order, 'a')).toBe(true);
    expect(isUnlocked(p, order, 'b')).toBe(true);
    expect(isUnlocked(p, order, 'c')).toBe(false);
    expect(isUnlocked(p, order, 'nope')).toBe(false);
  });
});
