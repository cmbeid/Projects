import { DISTRICTS, districtAt, districtIndex } from '../data/districts';
import { MATERIAL } from '../data/materials';
import { BALANCE } from '../data/progression';
import type { GameState } from '../state/types';
import { derive, type Derived } from './derive';
import { emit } from './events';
import { pickWeighted, rand, roundRandom } from './rng';

/** Salvage kept back from the Auction House, so the workshops always have something to work. */
export const AUCTION_RESERVE = 500;

export function ruinHp(ward: number, landmark: boolean): number {
  return (
    BALANCE.baseHp *
    BALANCE.hpGrowth ** (ward - 1) *
    BALANCE.districtHpJump ** districtIndex(ward) *
    (landmark ? BALANCE.landmarkHpMult : 1)
  );
}

/** Salvage per ruin at `ward`, before any multipliers. */
export function yieldAt(ward: number): number {
  return BALANCE.yieldGrowth ** (ward - 1);
}

export function xpAt(ward: number): number {
  return BALANCE.baseXp * BALANCE.xpGrowth ** (ward - 1);
}

export function xpForLevel(level: number): number {
  return BALANCE.levelXp * BALANCE.levelGrowth ** (level - 1);
}

/**
 * Salvage weights at a ward. Luck tilts the table toward the rarer end: each
 * step down the list gets another 2% per point of luck.
 */
export function salvageWeights(ward: number, luck: number): { id: string; w: number }[] {
  return districtAt(ward).salvage.map((o, i) => ({ id: o.id, w: o.weight * (1 + 0.02 * luck * i) }));
}

export function relicChance(luck: number): number {
  return Math.min(0.3, BALANCE.relicChance * (1 + 0.03 * luck));
}

/** Expected coin from one ordinary ruin at a ward, used to size petitions. */
export function ruinValue(ward: number, d: Derived): number {
  const weights = salvageWeights(ward, d.luck);
  const total = weights.reduce((a, w) => a + w.w, 0);
  let value = 0;
  for (const w of weights) value += (w.w / total) * (MATERIAL.get(w.id)?.value ?? 0);
  return value * yieldAt(ward) * d.salvageMult * d.sellMult;
}

export function spawnRuin(s: GameState): void {
  const landmark = s.autoAdvance && s.ruinsHere >= BALANCE.ruinsPerWard;
  const d = derive(s);
  const salvage = pickWeighted(s, salvageWeights(s.ward, d.luck), (w) => w.w).id;
  const hp = ruinHp(s.ward, landmark);
  s.ruin = { salvage, hp, maxHp: hp, landmark };
}

export function setWard(s: GameState, ward: number, opened = false): void {
  const target = Math.max(1, Math.min(s.maxWard, Math.floor(ward)));
  if (target === s.ward) return;
  const before = districtIndex(s.ward);
  s.ward = target;
  s.ruinsHere = 0;
  spawnRuin(s);
  emit({ type: 'ward', ward: target, districtChanged: districtIndex(target) !== before, opened });
}

/** Adds to the inventory. The Auction House sells salvage past its reserve on the spot. */
export function gain(s: GameState, id: string, n: number, d?: Derived): void {
  if (n <= 0) return;
  s.inventory[id] = (s.inventory[id] ?? 0) + n;
  const mat = MATERIAL.get(id);
  if (mat?.kind === 'salvage' && s.fixtures.includes('auction')) {
    const extra = (s.inventory[id] ?? 0) - AUCTION_RESERVE;
    if (extra > 0) {
      s.inventory[id] = AUCTION_RESERVE;
      const coins = extra * mat.value * (d ?? derive(s)).sellMult;
      s.coins += coins;
      s.counters.earned += coins;
    }
  }
}

export function addXp(s: GameState, amount: number): void {
  s.xp += amount;
  let need = xpForLevel(s.level);
  while (s.xp >= need) {
    s.xp -= need;
    s.level += 1;
    s.statPoints += BALANCE.statPointsPerLevel;
    emit({ type: 'level', level: s.level });
    need = xpForLevel(s.level);
  }
}

function clearRuin(s: GameState, d: Derived, auto: boolean): void {
  const { salvage, landmark } = s.ruin;
  const ward = s.ward;
  const district = districtAt(ward);

  const qty = Math.max(1, roundRandom(s, yieldAt(ward) * d.salvageMult * (landmark ? 3 : 1)));
  gain(s, salvage, qty, d);
  s.counters.salvaged[salvage] = (s.counters.salvaged[salvage] ?? 0) + qty;
  s.counters.clears += 1;
  emit({ type: 'clear', salvage, qty, landmark, auto });

  if (landmark || rand(s) < relicChance(d.luck)) {
    // The first relic in each district's list is three times as common as the second.
    const relic = rand(s) < 0.75 ? district.relics[0]! : district.relics[1]!;
    gain(s, relic, 1, d);
    s.counters.relics += 1;
    emit({ type: 'relic', id: relic });
  }

  addXp(s, xpAt(ward) * d.xpMult * (landmark ? 4 : 1) * (auto ? BALANCE.crewXpShare : 1));

  if (landmark) {
    gain(s, district.heart, 1, d);
    emit({ type: 'heart', id: district.heart });
    s.ruinsHere = 0;
    const opened = ward + 1 > s.maxWard;
    s.maxWard = Math.max(s.maxWard, ward + 1);
    s.furthestEver = Math.max(s.furthestEver, s.maxWard);
    setWard(s, ward + 1, opened);
    if (s.ward === ward) spawnRuin(s);
  } else {
    s.ruinsHere += 1;
    if (!s.autoAdvance) s.counters.farmed += 1;
    spawnRuin(s);
  }
}

/**
 * Ruins the crews can clear in a second, however strong they are. Rubble
 * has to be carted away before the next wall can come down; without this, a
 * huge crew parked in an early ward would clear thousands a second and the
 * economy would come apart.
 */
export function crewClearsPerSecond(s: GameState): number {
  return 4 + (s.fixtures.includes('surveyor') ? 1 : 0);
}

/**
 * Hits the current ruin. Crew overkill spills into the next ruin, up to the
 * crews' clearing budget; anything past that is lost. A single blow clears
 * at most one ruin, or a lucky crit would skip a whole ward.
 */
export function damage(s: GameState, amount: number, opts: { crit: boolean; auto: boolean }, d = derive(s)): void {
  let left = amount;
  for (let guard = 0; left > 0 && guard < 50; guard++) {
    const mult = s.ruin.landmark ? d.landmarkMult : 1;
    if (opts.auto && s.crewBudget < 1) {
      // Out of budget: the crews keep chipping, but cannot finish a ruin.
      s.ruin.hp = Math.max(s.ruin.maxHp * 0.01, s.ruin.hp - left * mult);
      return;
    }
    const dealt = left * mult;
    if (dealt < s.ruin.hp) {
      s.ruin.hp -= dealt;
      return;
    }
    left -= s.ruin.hp / mult;
    if (opts.auto) s.crewBudget -= 1;
    clearRuin(s, d, opts.auto);
    if (!opts.auto) return;
  }
}

/** One swing of the hammer. */
export function tap(s: GameState, power = 1): void {
  const d = derive(s);
  const crit = rand(s) * 100 < d.critChance;
  const amount = d.tap * power * (crit ? d.critMult : 1);
  emit({ type: 'hit', damage: amount, crit, auto: false });
  damage(s, amount, { crit, auto: false }, d);
}

/** Wards past the last district's grid still open, but have no row of their own. */
export function lastGridWard(): number {
  return DISTRICTS[DISTRICTS.length - 1]!.from + 7;
}
