import { AFFIXES, REGALIA_BASE, affixMax } from '../data/regalia';
import { BALANCE, EDICTS, PASSIVES, type EdictId } from '../data/progression';
import type { ConsumableId, Slot } from '../data/types';
import type { CoreStat, GameState, RegaliaItem } from '../state/types';
import { addXp, damage, tap, xpAt } from './clearing';
import { derive } from './derive';
import { emit } from './events';
import { hasFeature } from './features';
import { rand } from './rng';

export function passivePointsTotal(s: GameState): number {
  return Math.floor(s.level / BALANCE.passiveEvery);
}

export function passivePointsFree(s: GameState): number {
  const spent = Object.values(s.passives).reduce((a, b) => a + b, 0);
  return passivePointsTotal(s) - spent;
}

export function spendStat(s: GameState, stat: CoreStat, n = 1): boolean {
  if (!hasFeature(s, 'founder')) return false;
  const count = Math.min(n, s.statPoints);
  if (count <= 0) return false;
  s.statPoints -= count;
  s.stats[stat] += count;
  s.counters.statsSpent += count;
  return true;
}

/** A passive can be ranked up when the node above it in its branch has a rank. */
export function canRankPassive(s: GameState, id: string): boolean {
  const def = PASSIVES.find((p) => p.id === id);
  if (!def || !hasFeature(s, 'passives')) return false;
  if ((s.passives[id] ?? 0) >= def.max || passivePointsFree(s) <= 0) return false;
  const branch = PASSIVES.filter((p) => p.branch === def.branch);
  const i = branch.indexOf(def);
  return i === 0 || (s.passives[branch[i - 1]!.id] ?? 0) > 0;
}

export function rankPassive(s: GameState, id: string): boolean {
  if (!canRankPassive(s, id)) return false;
  s.passives[id] = (s.passives[id] ?? 0) + 1;
  return true;
}

export function edictReady(s: GameState, id: EdictId): boolean {
  const def = EDICTS.find((k) => k.id === id);
  return !!def && hasFeature(s, id) && s.cooldowns[id] <= 0 && s.resolve >= def.resolve;
}

export function useEdict(s: GameState, id: EdictId): boolean {
  const def = EDICTS.find((k) => k.id === id);
  if (!def || !edictReady(s, id)) return false;
  s.resolve -= def.resolve;
  s.cooldowns[id] = def.cooldown;
  s.counters.edicts[id] = (s.counters.edicts[id] ?? 0) + 1;
  emit({ type: 'edict', id });
  if (id === 'rush') tap(s, 30);
  else if (id === 'survey') s.buffs.survey = def.duration;
  else s.buffs.festival = def.duration;
  return true;
}

export function useConsumable(s: GameState, id: ConsumableId): boolean {
  if ((s.consumables[id] ?? 0) <= 0) return false;
  const d = derive(s);
  if (id === 'tea' && s.resolve >= d.resolveMax) return false;
  s.consumables[id] -= 1;
  switch (id) {
    case 'charge':
      emit({ type: 'edict', id: 'charge' });
      damage(s, d.tap * 60, { crit: false, auto: false }, d);
      break;
    case 'greatcharge':
      emit({ type: 'edict', id: 'charge' });
      damage(s, d.tap * 400, { crit: false, auto: false }, d);
      break;
    case 'tea':
      s.resolve = d.resolveMax;
      break;
    case 'ink':
      s.buffs.ink = 180;
      break;
    case 'almanac':
      s.buffs.almanac = 300;
      break;
    case 'overtime':
      s.buffs.overtime = 120;
      break;
    case 'wine':
      s.buffs.wine = 300;
      break;
    case 'seeker':
      s.buffs.seek = 180;
      break;
    case 'calm':
      s.buffs.calm = 300;
      break;
    case 'grease':
      s.buffs.grease = 300;
      break;
    case 'kite':
      s.buffs.kite = 180;
      break;
    case 'memoir':
      addXp(s, xpAt(s.ward) * d.xpMult * 500);
      break;
  }
  return true;
}

/**
 * A fresh piece of regalia, with up to two random affixes. Luck makes the
 * second affix likelier.
 */
export function rollRegalia(s: GameState, baseId: string): RegaliaItem {
  const base = REGALIA_BASE.get(baseId);
  if (!base) throw new Error(`Unknown regalia ${baseId}`);
  const luck = derive(s).luck;
  const r = rand(s);
  const count = r < Math.min(0.35, 0.1 + luck * 0.002) ? 2 : r < 0.55 ? 1 : 0;
  const pool = [...AFFIXES[base.slot]];
  const affixes: RegaliaItem['affixes'] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const stat = pool.splice(Math.floor(rand(s) * pool.length), 1)[0]!;
    const value = affixMax(stat, base.tier) * (0.5 + 0.5 * rand(s));
    affixes.push({ stat, value: stat === 'critChance' || stat === 'critMult' ? Math.round(value * 100) / 100 : Math.round(value) });
  }
  return { uid: s.nextUid++, base: baseId, affixes };
}

/** A rough single number for comparing two pieces in a slot. */
export function regaliaScore(item: RegaliaItem): number {
  const base = REGALIA_BASE.get(item.base);
  if (!base) return 0;
  return base.tier * 100 + item.affixes.length * 10 + item.affixes.reduce((a, x) => a + x.value / Math.max(1e-9, affixMax(x.stat, base.tier)), 0);
}

export function equip(s: GameState, uid: number): boolean {
  const item = s.regalia.find((g) => g.uid === uid);
  const base = item && REGALIA_BASE.get(item.base);
  if (!item || !base) return false;
  s.equipped[base.slot] = uid;
  s.resolve = Math.min(s.resolve, derive(s).resolveMax);
  return true;
}

export function unequip(s: GameState, slot: Slot): void {
  s.equipped[slot] = null;
  s.resolve = Math.min(s.resolve, derive(s).resolveMax);
}

/** Melts down regalia not being worn, for a little coin. */
export function melt(s: GameState, uid: number, recipeCoins: number): boolean {
  const i = s.regalia.findIndex((g) => g.uid === uid);
  if (i < 0 || Object.values(s.equipped).includes(uid)) return false;
  s.regalia.splice(i, 1);
  s.coins += Math.floor(recipeCoins * 0.3);
  return true;
}
