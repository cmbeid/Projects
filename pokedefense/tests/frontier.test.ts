import { describe, expect, it } from 'vitest';
import { NO_TRAINER } from '../src/data/items';
import { COLS, mapBosses, mapDef, ROWS } from '../src/data/maps';
import { REGION_IDS, REGIONS } from '../src/data/regions';
import { SPECIES } from '../src/data/species';
import { MAX_LEVEL } from '../src/data/towers';
import { TYPES } from '../src/data/types';
import { canPlace, newGame, placeTower, type Tower } from '../src/game/game';
import {
  CUP_BATTLES, cupMaps, drawPool, endBattle, FACTORY_LEVEL, frontierOpen, gauntletMap, gauntletOpen, nextBattle, rentals, ROUND, RUN_LIVES, startRun,
} from '../src/state/frontier';
import { freshProgress, loadProgress, type Progress, regionMaps, saveProgress } from '../src/state/save';

function champion(p: Progress, ...regions: (typeof REGION_IDS)[number][]): Progress {
  for (const r of regions) for (const m of regionMaps(r)) if (!m.endless) p.results[m.id] = { normal: 1, hard: 0, best: 0 };
  return p;
}

describe('the Battle Frontier', () => {
  it('opens with a first Champion title, and the Gauntlet with all nine', () => {
    const p = freshProgress();
    expect(frontierOpen(p)).toBe(false);
    champion(p, 'kanto');
    expect(frontierOpen(p)).toBe(true);
    expect(gauntletOpen(p)).toBe(false);
    champion(p, ...REGION_IDS.filter((id) => !REGIONS[id].after));
    expect(gauntletOpen(p)).toBe(true);
  });

  it('draws the Battle Tower’s maps from open regions, the same way every time for a run', () => {
    const p = startRun(champion(freshProgress(), 'kanto'), 'tower', 1234);
    const run = p.frontier.run!;
    const a = nextBattle(p, run);
    expect(nextBattle(p, run).map.id).toBe(a.map.id);
    expect(drawPool(p).every((m) => m.regionId === 'kanto' || m.regionId === 'johto' || m.regionId === 'orange')).toBe(true);
    expect(a.rules.lives).toBe(RUN_LIVES);
    expect(a.difficulty).toBe('normal');
    // The fourth battle is Hard; the seventh, a Champion's ace.
    expect(nextBattle(p, { ...run, streak: 3 }).difficulty).toBe('hard');
    const tycoon = nextBattle(p, { ...run, streak: ROUND - 1 });
    expect(tycoon.rules.boss).toBeDefined();
    expect(SPECIES.has(tycoon.rules.boss!.dex)).toBe(true);
  });

  it('carries lives and the streak between battles, and keeps the best when a run ends', () => {
    let p = startRun(champion(freshProgress(), 'kanto'), 'tower', 1);
    for (let i = 0; i < 3; i += 1) p = endBattle(p, 'tower', { won: true, lives: 15 - i, cleared: 20 }).progress;
    expect([p.frontier.run!.streak, p.frontier.run!.lives]).toEqual([3, 13]);
    const lost = endBattle(p, 'tower', { won: false, lives: 0, cleared: 5 });
    expect(lost.over).toBe(true);
    expect([lost.progress.frontier.run, lost.progress.frontier.towerBest]).toEqual([null, 3]);
    expect(lost.progress.bp).toBeGreaterThan(p.bp);
  });

  it('gives the Battle Factory eight rentals, grown to level 3 when placed', () => {
    const p = startRun(champion(freshProgress(), 'kanto'), 'factory', 99);
    const b = nextBattle(p, p.frontier.run!);
    expect(b.roster).toHaveLength(8);
    expect(rentals(99).map((l) => l.id)).toEqual(b.roster!.map((l) => l.id));
    const team = b.roster!.slice(0, 4).map((l) => l.id);
    const g = newGame({ map: b.map, difficulty: b.difficulty, team, items: {}, balls: {}, held: {}, trainer: NO_TRAINER, seed: 1, rules: b.rules });
    g.money = 1e6;
    let t: Tower | undefined;
    for (let y = 0; y < ROWS && !t; y += 1) for (let x = 0; x < COLS && !t; x += 1) {
      const id = team.find((l) => canPlace(g, l, x, y) === null);
      if (id) t = placeTower(g, id, x, y) as Tower;
    }
    expect(t!.level).toBe(FACTORY_LEVEL);
    expect(t!.level).toBeLessThan(MAX_LEVEL);
  });

  it('holds a Mono-type Cup to its type, and gives the trophy after three wins', () => {
    for (const type of TYPES) expect(cupMaps(type)).toHaveLength(CUP_BATTLES);
    let p = startRun(champion(freshProgress(), 'kanto'), 'mono', 5, 'fire');
    const b = nextBattle(p, p.frontier.run!);
    expect(b.rules.types).toEqual(['fire']);
    const g = newGame({ map: b.map, difficulty: 'normal', team: ['charmander', 'squirtle'], items: {}, balls: {}, held: {}, trainer: NO_TRAINER, seed: 1, rules: b.rules });
    g.money = 1e6;
    const errs = new Set<string | null>();
    for (let y = 0; y < ROWS; y += 1) for (let x = 0; x < COLS; x += 1) errs.add(canPlace(g, 'squirtle', x, y));
    expect(errs.has(null)).toBe(false);
    expect(errs.has('rule')).toBe(true);
    let last = endBattle(p, 'mono', { won: true, lives: 20, cleared: 20 });
    for (let i = 1; i < CUP_BATTLES; i += 1) last = endBattle(last.progress, 'mono', { won: true, lives: 20, cleared: 20 });
    p = last.progress;
    expect(last.trophy).toBe('fire');
    expect(p.frontier.monoTrophies).toEqual(['fire']);
    expect(p.frontier.run).toBeNull();
  });

  it('sends every Champion’s ace, in order, down the Gauntlet', () => {
    const g = gauntletMap();
    expect(mapDef(g.id)).toBe(g);
    const bosses = mapBosses(g);
    expect(bosses.length).toBeGreaterThanOrEqual(12);
    for (const b of bosses) expect(SPECIES.has(b.dex)).toBe(true);
    expect(g.extraBosses!.map((b) => b.wave)).toEqual([3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33]);
    expect(g.boss.phases?.length).toBe(2);
  });

  it('keeps the Frontier’s records through a save', () => {
    const store = new Map<string, string>();
    const s = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    let p = startRun(champion(freshProgress(), 'kanto'), 'mono', 7, 'water');
    p = endBattle(p, 'mono', { won: true, lives: 17, cleared: 20 }).progress;
    p = { ...p, frontier: { ...p.frontier, towerBest: 9, monoTrophies: ['fire'], gauntletBest: 12 } };
    saveProgress(p, s);
    const back = loadProgress(s);
    expect(back.frontier).toEqual(p.frontier);
  });
});
