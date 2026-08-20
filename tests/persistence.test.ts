import { beforeEach, describe, expect, it } from 'vitest';
import { clearSave, createInitialState, loadState, saveState } from '../src/state/persistence';
import type { GameState } from '../src/state/types';

/** Minimal localStorage stand-in; vitest runs these in node. */
class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  /** For tests that need to plant a specific payload. */
  raw(key: string, value: string) {
    this.data.set(key, value);
  }
}

const KEY = 'alchemy-forge:save';
const KNOWN = new Set(['air', 'earth', 'fire', 'water', 'steam', 'mud']);

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
});

describe('a fresh game', () => {
  it('starts with exactly the four base elements and an empty board', () => {
    const state = loadState(KNOWN);
    expect(state.discovered).toEqual(['air', 'earth', 'fire', 'water']);
    expect(state.tokens).toEqual([]);
    expect(state.settings.sound).toBe(true);
  });
});

describe('round trip', () => {
  it('restores discoveries, board and settings', () => {
    const state: GameState = {
      ...createInitialState(),
      discovered: ['air', 'earth', 'fire', 'water', 'steam'],
      tokens: [{ uid: 1, elementId: 'steam', fx: 0.25, fy: 0.75 }],
      settings: { sound: false },
      hintsUsed: 3,
      nextUid: 2,
    };
    saveState(state);

    const loaded = loadState(KNOWN);
    expect(loaded.discovered).toEqual(['air', 'earth', 'fire', 'water', 'steam']);
    expect(loaded.tokens).toEqual([{ uid: 1, elementId: 'steam', fx: 0.25, fy: 0.75 }]);
    expect(loaded.settings.sound).toBe(false);
    expect(loaded.hintsUsed).toBe(3);
  });

  it('preserves normalized coordinates exactly, so a board survives a fold', () => {
    const state: GameState = {
      ...createInitialState(),
      discovered: ['air', 'earth', 'fire', 'water', 'steam'],
      tokens: [{ uid: 1, elementId: 'steam', fx: 0.987654, fy: 0.012345 }],
      nextUid: 2,
    };
    saveState(state);
    const [token] = loadState(KNOWN).tokens;
    expect(token?.fx).toBeCloseTo(0.987654, 6);
    expect(token?.fy).toBeCloseTo(0.012345, 6);
  });
});

describe('hostile save files', () => {
  it('treats unparseable JSON as a new game rather than crashing', () => {
    storage.raw(KEY, '{ not json');
    expect(loadState(KNOWN).discovered).toEqual(['air', 'earth', 'fire', 'water']);
  });

  it('discards a save from a different version', () => {
    storage.raw(
      KEY,
      JSON.stringify({ version: 999, discovered: ['air', 'steam'], tokens: [] }),
    );
    expect(loadState(KNOWN).discovered).toEqual(['air', 'earth', 'fire', 'water']);
  });

  it('drops ids that no longer exist in the content', () => {
    storage.raw(
      KEY,
      JSON.stringify({
        version: 1,
        discovered: ['air', 'earth', 'fire', 'water', 'steam', 'unicycle-of-doom'],
        tokens: [],
        settings: { sound: true },
        hintsUsed: 0,
      }),
    );
    expect(loadState(KNOWN).discovered).toEqual(['air', 'earth', 'fire', 'water', 'steam']);
  });

  it('drops tokens for elements the player has not discovered', () => {
    storage.raw(
      KEY,
      JSON.stringify({
        version: 1,
        discovered: ['air', 'earth', 'fire', 'water'],
        tokens: [{ uid: 1, elementId: 'steam', fx: 0.5, fy: 0.5 }],
        settings: { sound: true },
        hintsUsed: 0,
      }),
    );
    expect(loadState(KNOWN).tokens).toEqual([]);
  });

  it('clamps out-of-range and rejects malformed token coordinates', () => {
    storage.raw(
      KEY,
      JSON.stringify({
        version: 1,
        discovered: ['air', 'earth', 'fire', 'water', 'steam'],
        tokens: [
          { uid: 1, elementId: 'steam', fx: 5, fy: -2 },
          { uid: 2, elementId: 'steam', fx: 'left', fy: 0.5 },
          { uid: 3, elementId: 'steam', fx: Number.NaN, fy: 0.5 },
        ],
        settings: { sound: true },
        hintsUsed: 0,
      }),
    );
    const { tokens } = loadState(KNOWN);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({ fx: 1, fy: 0 });
  });

  it('never loses the base elements, even if the save omits them', () => {
    storage.raw(
      KEY,
      JSON.stringify({ version: 1, discovered: ['steam'], tokens: [], hintsUsed: 0 }),
    );
    const { discovered } = loadState(KNOWN);
    expect(discovered).toEqual(['air', 'earth', 'fire', 'water', 'steam']);
  });
});

describe('reset', () => {
  it('removes the save entirely', () => {
    saveState({ ...createInitialState(), discovered: ['air', 'steam'] });
    clearSave();
    expect(storage.getItem(KEY)).toBeNull();
  });
});

describe('unavailable storage', () => {
  it('falls back to a new game when reading throws', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem() {
          throw new Error('blocked by browser settings');
        },
        setItem() {
          throw new Error('blocked by browser settings');
        },
        removeItem() {
          throw new Error('blocked by browser settings');
        },
      },
      configurable: true,
    });

    expect(() => loadState(KNOWN)).not.toThrow();
    expect(loadState(KNOWN).discovered).toEqual(['air', 'earth', 'fire', 'water']);
    expect(() => saveState(createInitialState())).not.toThrow();
    expect(() => clearSave()).not.toThrow();
  });
});
