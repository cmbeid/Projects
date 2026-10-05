import { districtAt } from '../data/districts';
import { BALANCE } from '../data/progression';
import type { GameState } from '../state/types';
import { addXp, crewClearsPerSecond, gain, relicChance, ruinHp, salvageWeights, xpAt, yieldAt } from './clearing';
import { derive } from './derive';
import { tickWorkshops } from './workshops';

export interface OfflineReport {
  seconds: number;
  capped: boolean;
  clears: number;
  items: Record<string, number>;
  taxes: number;
  coinsBefore: number;
  coinsAfter: number;
  levelsGained: number;
}

/**
 * Time away, settled in one go. Crews work the current ward — they never
 * bring a landmark down while you are gone, so you always come back where
 * you left — the city pays its taxes, and the workshops work their queues.
 *
 * Settled by expectation rather than by replaying every ruin, so a week
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
    clears: 0,
    items: {},
    taxes: 0,
    coinsBefore: s.coins,
    coinsAfter: s.coins,
    levelsGained: 0,
  };
  if (t <= 0) return report;
  const levelBefore = s.level;

  // Capped like the crews are online, so a huge crew parked in an early ward
  // does not pay out thousands of ruins a second.
  const clears = Math.min((d.crewDps * t) / ruinHp(s.ward, false), crewClearsPerSecond(s) * t) * d.offlineYield;
  report.clears = Math.floor(clears);
  if (report.clears > 0) {
    const weights = salvageWeights(s.ward, d.luck);
    const total = weights.reduce((a, w) => a + w.w, 0);
    const amount = report.clears * yieldAt(s.ward) * d.salvageMult;
    for (const w of weights) {
      const n = Math.floor((amount * w.w) / total);
      gain(s, w.id, n, d);
      s.counters.salvaged[w.id] = (s.counters.salvaged[w.id] ?? 0) + n;
    }
    const relics = Math.floor(report.clears * relicChance(d.luck));
    const district = districtAt(s.ward);
    gain(s, district.relics[0]!, Math.ceil(relics * 0.75), d);
    gain(s, district.relics[1]!, Math.floor(relics * 0.25), d);
    s.counters.relics += relics;
    s.counters.clears += report.clears;
    addXp(s, report.clears * xpAt(s.ward) * d.xpMult * BALANCE.crewXpShare);
  }

  // Taxes at the rate the city stands at now. The tide averages out over hours.
  report.taxes = d.taxPerSec * t * d.offlineYield;
  s.coins += report.taxes;
  s.counters.earned += report.taxes;

  tickWorkshops(s, t);

  for (const [id, n] of Object.entries(s.inventory)) {
    const diff = n - (before[id] ?? 0);
    if (diff > 0) report.items[id] = diff;
  }
  report.coinsAfter = s.coins;
  report.levelsGained = s.level - levelBefore;
  return report;
}
