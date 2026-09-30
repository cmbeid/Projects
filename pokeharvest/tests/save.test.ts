import { describe, expect, it } from 'vitest';
import { seedId } from '../src/data/items';
import { useAt } from '../src/game/farm';
import { select } from '../src/game/world';
import { loadSettings, loadWorld, parseWorld, saveSettings, saveWorld } from '../src/state/save';
import { world } from './helpers';

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

describe('save', () => {
  it('round-trips a farm', () => {
    const w = world(1);
    select(w, 'hoe');
    useAt(w, 5, 14);
    select(w, seedId('cheri'));
    useAt(w, 5, 14);
    w.bin = { oran: 2 };
    w.day = 9;
    const store = memory();
    saveWorld(w, store);
    const back = loadWorld(store)!;
    expect(back.day).toBe(9);
    expect(back.plots['5,14']?.crop?.id).toBe('cheri');
    expect(back.inventory).toEqual(w.inventory);
    expect(back.bin).toEqual({ oran: 2 });
    expect(back.helpers.map((h) => h.dex)).toEqual([1]);
    expect(back.selected).toBe(seedId('cheri'));
  });

  it('repairs bad fields', () => {
    const w = parseWorld({
      helpers: [{ dex: 7 }, { dex: 99999 }],
      day: 'soon', player: { gold: -5, energy: 1e9, x: 0, y: 0, facing: 'sideways' },
      plots: { '5,14': { crop: { id: 'mystery' } }, '0,0': {}, nonsense: {} },
      inventory: { oran: 3, hoe: 1, fake: 2, pecha: -1 },
      selected: 'pecha-seed',
    })!;
    expect(w.day).toBe(1);
    expect(w.player.gold).toBe(0);
    expect(w.player.energy).toBe(w.player.maxEnergy);
    expect(w.player.facing).toBe('down');
    expect(w.player.x).toBe(4); // (0,0) is a tree: back to the door
    expect(Object.keys(w.plots)).toEqual(['5,14']);
    expect(w.plots['5,14']!.crop).toBeNull();
    expect(w.inventory).toEqual({ oran: 3 });
    expect(w.selected).toBe('hoe');
    expect(w.helpers).toHaveLength(1);
  });

  it('gives up on a save with no Pokémon', () => {
    expect(parseWorld({ helpers: [] })).toBeNull();
    expect(parseWorld('garbage')).toBeNull();
    expect(loadWorld(memory())).toBeNull();
  });

  it('keeps settings', () => {
    const store = memory();
    saveSettings({ sfx: 10, cries: 20, muted: true }, store);
    expect(loadSettings(store)).toEqual({ sfx: 10, cries: 20, muted: true });
  });
});
