import { biomeAt, biomeIndex } from '../data/biomes';
import { MATERIAL } from '../data/materials';
import { BALANCE } from '../data/progression';
import type { GameState } from '../state/types';
import { derive, type Derived } from './derive';
import { emit } from './events';
import { pickWeighted, rand, roundRandom } from './rng';

/** Ore kept back from the Ore Chute, so the furnace always has something to smelt. */
export const CHUTE_RESERVE = 500;

export function blockHp(depth: number, seam: boolean): number {
  return (
    BALANCE.baseHp *
    BALANCE.hpGrowth ** (depth - 1) *
    BALANCE.biomeHpJump ** biomeIndex(depth) *
    (seam ? BALANCE.seamHpMult : 1)
  );
}

/** Ore per block at `depth`, before any multipliers. */
export function yieldAt(depth: number): number {
  return BALANCE.yieldGrowth ** (depth - 1);
}

export function xpAt(depth: number): number {
  return BALANCE.baseXp * BALANCE.xpGrowth ** (depth - 1);
}

export function xpForLevel(level: number): number {
  return BALANCE.levelXp * BALANCE.levelGrowth ** (level - 1);
}

/**
 * Ore weights at a depth. Luck tilts the table toward the rarer end: each
 * step down the list gets another 2% per point of luck.
 */
export function oreWeights(depth: number, luck: number): { id: string; w: number }[] {
  return biomeAt(depth).ores.map((o, i) => ({ id: o.id, w: o.weight * (1 + 0.02 * luck * i) }));
}

export function gemChance(luck: number): number {
  return Math.min(0.3, BALANCE.gemChance * (1 + 0.03 * luck));
}

/** Expected coin from one normal block at a depth, used to size contracts and rewards. */
export function blockValue(depth: number, d: Derived): number {
  const weights = oreWeights(depth, d.luck);
  const total = weights.reduce((a, w) => a + w.w, 0);
  let value = 0;
  for (const w of weights) value += (w.w / total) * (MATERIAL.get(w.id)?.value ?? 0);
  return value * yieldAt(depth) * d.oreMult * d.sellMult;
}

export function spawnBlock(s: GameState): void {
  const seam = s.autoAdvance && s.blocksHere >= BALANCE.blocksPerDepth;
  const d = derive(s);
  const ore = pickWeighted(s, oreWeights(s.depth, d.luck), (w) => w.w).id;
  const hp = blockHp(s.depth, seam);
  s.block = { ore, hp, maxHp: hp, seam };
}

export function setDepth(s: GameState, depth: number): void {
  const target = Math.max(1, Math.min(s.maxDepth, Math.floor(depth)));
  if (target === s.depth) return;
  const before = biomeIndex(s.depth);
  s.depth = target;
  s.blocksHere = 0;
  spawnBlock(s);
  emit({ type: 'depth', depth: target, biomeChanged: biomeIndex(target) !== before });
}

/** Adds to the inventory. The Ore Chute sells common ore past its reserve on the spot. */
export function gain(s: GameState, id: string, n: number, d?: Derived): void {
  if (n <= 0) return;
  s.inventory[id] = (s.inventory[id] ?? 0) + n;
  const mat = MATERIAL.get(id);
  if (mat?.kind === 'ore' && s.fixtures.includes('chute')) {
    const extra = (s.inventory[id] ?? 0) - CHUTE_RESERVE;
    if (extra > 0) {
      s.inventory[id] = CHUTE_RESERVE;
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

function breakBlock(s: GameState, d: Derived, auto: boolean, crit: boolean): void {
  const { ore, seam } = s.block;
  const depth = s.depth;
  const biome = biomeAt(depth);
  const shatter = crit && biome.hazard === 'brittle';

  const qty = Math.max(1, roundRandom(s, yieldAt(depth) * d.oreMult * (seam ? 3 : 1) * (shatter ? 2 : 1)));
  gain(s, ore, qty, d);
  s.counters.mined[ore] = (s.counters.mined[ore] ?? 0) + qty;
  s.counters.breaks += 1;
  emit({ type: 'break', ore, qty, seam, shatter, auto });

  if (seam || rand(s) < gemChance(d.luck)) {
    // The first gem in each biome's list is three times as common as the second.
    const gem = rand(s) < 0.75 ? biome.gems[0]! : biome.gems[1]!;
    gain(s, gem, 1, d);
    s.counters.gems += 1;
    emit({ type: 'gem', id: gem });
  }

  addXp(s, xpAt(depth) * d.xpMult * (seam ? 4 : 1) * (auto ? BALANCE.autoXpShare : 1));

  if (seam) {
    gain(s, biome.essence, 1, d);
    emit({ type: 'essence', id: biome.essence });
    s.blocksHere = 0;
    s.maxDepth = Math.max(s.maxDepth, depth + 1);
    s.deepestEver = Math.max(s.deepestEver, s.maxDepth);
    setDepth(s, depth + 1);
    if (s.depth === depth) spawnBlock(s);
  } else {
    s.blocksHere += 1;
    if (!s.autoAdvance) s.counters.farmed += 1;
    spawnBlock(s);
  }
}

/**
 * Blocks the machines can clear in a second, however strong they are. The
 * face has to be cleared and the next block exposed; without this, a heavily
 * upgraded rig parked at a shallow depth would clear thousands of blocks a
 * second and the economy would come apart.
 */
export const MACHINE_BREAKS_PER_SECOND = 4;

export function machineBreaksPerSecond(s: GameState): number {
  return MACHINE_BREAKS_PER_SECOND - (s.bargains.includes('greed') ? 1 : 0);
}

/**
 * Hits the current block. Machine overkill spills into the next block, up to
 * the machines' clearing budget; anything past that is lost. A single swing
 * breaks at most one block, or a lucky crit would skip a whole depth.
 */
export function damage(s: GameState, amount: number, opts: { crit: boolean; auto: boolean }, d = derive(s)): void {
  let left = amount;
  for (let guard = 0; left > 0 && guard < 50; guard++) {
    if (opts.auto && s.machineBudget < 1) {
      // Out of budget: the machines keep chipping, but cannot finish a block.
      const dealt = s.block.seam ? left * d.seamMult : left;
      s.block.hp = Math.max(s.block.maxHp * 0.01, s.block.hp - dealt);
      return;
    }
    const dealt = s.block.seam ? left * d.seamMult : left;
    if (dealt < s.block.hp) {
      s.block.hp -= dealt;
      return;
    }
    const used = s.block.seam ? s.block.hp / d.seamMult : s.block.hp;
    left -= used;
    if (opts.auto) s.machineBudget -= 1;
    breakBlock(s, d, opts.auto, opts.crit);
    if (!opts.auto) return;
  }
}

/** One swing of the pick. */
export function tap(s: GameState, power = 1): void {
  const d = derive(s);
  const crit = rand(s) * 100 < d.critChance;
  const amount = d.tap * power * (crit ? d.critMult : 1);
  emit({ type: 'hit', damage: amount, crit, auto: false });
  damage(s, amount, { crit, auto: false }, d);
}
