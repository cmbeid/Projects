import { biomeAt } from '../data/biomes';
import { BALANCE } from '../data/progression';
import type { GameState } from '../state/types';
import { derive } from './derive';
import { addXp, blockHp, gain, gemChance, oreWeights, xpAt, yieldAt } from './mining';
import { tickFurnace } from './crafting';

export interface OfflineReport {
  seconds: number;
  capped: boolean;
  blocks: number;
  items: Record<string, number>;
  coinsBefore: number;
  coinsAfter: number;
  levelsGained: number;
}

/**
 * Time away, settled in one go. Machines grind the current depth — they
 * never break a seam while you are gone, so you always come back where you
 * left — and the furnaces work through their queues.
 *
 * Settled by expectation rather than by replaying every block, so a week
 * away costs the same as a minute.
 */
export function applyOffline(s: GameState, seconds: number): OfflineReport {
  const d = derive(s);
  const cap = d.offlineHours * 3600;
  const t = Math.max(0, Math.min(seconds, cap));
  const before = { ...s.inventory };
  const report: OfflineReport = {
    seconds: t,
    capped: seconds > cap,
    blocks: 0,
    items: {},
    coinsBefore: s.coins,
    coinsAfter: s.coins,
    levelsGained: 0,
  };
  if (t <= 0) return report;
  const levelBefore = s.level;

  const critBoost = 1 + (d.machineCrit / 100) * (d.critMult - 1);
  const blocks = (d.autoDps * critBoost * t * d.offlineYield) / blockHp(s.depth, false);
  report.blocks = Math.floor(blocks);
  if (report.blocks > 0) {
    const weights = oreWeights(s.depth, d.luck);
    const total = weights.reduce((a, w) => a + w.w, 0);
    const ore = report.blocks * yieldAt(s.depth) * d.oreMult;
    for (const w of weights) {
      const n = Math.floor((ore * w.w) / total);
      gain(s, w.id, n, d);
      s.counters.mined[w.id] = (s.counters.mined[w.id] ?? 0) + n;
    }
    const gems = Math.floor(report.blocks * gemChance(d.luck));
    const biome = biomeAt(s.depth);
    gain(s, biome.gems[0]!, Math.ceil(gems * 0.75), d);
    gain(s, biome.gems[1]!, Math.floor(gems * 0.25), d);
    s.counters.gems += gems;
    s.counters.breaks += report.blocks;
    addXp(s, report.blocks * xpAt(s.depth) * d.xpMult * BALANCE.autoXpShare);
  }

  tickFurnace(s, t);

  for (const [id, n] of Object.entries(s.inventory)) {
    const diff = n - (before[id] ?? 0);
    if (diff > 0) report.items[id] = diff;
  }
  report.coinsAfter = s.coins;
  report.levelsGained = s.level - levelBefore;
  return report;
}
