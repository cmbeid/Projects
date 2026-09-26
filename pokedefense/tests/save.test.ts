import { describe, expect, it } from 'vitest';
import { MAPS, mapDef } from '../src/data/maps';
import { line } from '../src/data/towers';
import { freshProgress, lineUnlocked, loadProgress, mapUnlocked, recordBattle, saveProgress } from '../src/state/save';

function memory(): { getItem(k: string): string | null; setItem(k: string, v: string): void; data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('save', () => {
  it('starts fresh and round-trips', () => {
    const store = memory();
    const p = loadProgress(store);
    expect(p).toEqual(freshProgress());
    p.bp = 123;
    saveProgress(p, store);
    expect(loadProgress(store).bp).toBe(123);
  });

  it('survives garbage', () => {
    const store = memory();
    store.setItem('pokedefense.save.v1', '{"bp":"lots","team":["nope"],"results":{"mt-moon":{"normal":9}}');
    expect(loadProgress(store)).toEqual(freshProgress());
    store.setItem('pokedefense.save.v1', '{"bp":-4,"team":["nope"],"results":{"mt-moon":{"normal":9}}}');
    const p = loadProgress(store);
    expect(p.bp).toBe(0);
    expect(p.team).toEqual(freshProgress().team);
    expect(p.results['mt-moon']!.normal).toBe(3);
  });

  it('unlocks maps in order and towers by badge or catch', () => {
    let p = freshProgress();
    expect(mapUnlocked(p, MAPS[0]!)).toBe(true);
    expect(mapUnlocked(p, MAPS[1]!)).toBe(false);
    expect(lineUnlocked(p, line('pikachu'))).toBe(false);
    const r = recordBattle(p, { mapId: 'viridian-forest', difficulty: 'normal', won: true, stars: 3, cleared: 15, caught: [{ dex: 129, shiny: true }], seen: [10] });
    p = r.progress;
    expect(r.bp).toBeGreaterThan(0);
    expect(mapUnlocked(p, mapDef('mt-moon'))).toBe(true);
    expect(lineUnlocked(p, line('pikachu'))).toBe(true);
    expect(lineUnlocked(p, line('magikarp'))).toBe(true);
    expect(r.newLines.map((l) => l.id).sort()).toEqual(['geodude', 'magikarp', 'pikachu']);
    expect(p.shinies).toEqual([129]);
    expect(mapUnlocked(p, mapDef('cerulean-cave'))).toBe(false);
  });

  it('pays double for a first clear', () => {
    const p = freshProgress();
    const first = recordBattle(p, { mapId: 'viridian-forest', difficulty: 'normal', won: true, stars: 2, cleared: 15, caught: [], seen: [] });
    const again = recordBattle(first.progress, { mapId: 'viridian-forest', difficulty: 'normal', won: true, stars: 2, cleared: 15, caught: [], seen: [] });
    expect(first.bp).toBe(again.bp * 2);
  });
});
