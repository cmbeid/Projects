import { AFFIXES, GEAR_BASE, affixMax } from '../data/gear';
import { BALANCE, PASSIVES, SKILLS, type SkillId } from '../data/progression';
import type { ConsumableId, Slot } from '../data/types';
import type { CoreStat, GameState, GearItem } from '../state/types';
import { derive } from './derive';
import { emit } from './events';
import { hasFeature } from './features';
import { damage, tap } from './mining';
import { rand } from './rng';

export function passivePointsTotal(s: GameState): number {
  return Math.floor(s.level / BALANCE.passiveEvery);
}

export function passivePointsFree(s: GameState): number {
  const spent = Object.values(s.passives).reduce((a, b) => a + b, 0);
  return passivePointsTotal(s) - spent;
}

export function spendStat(s: GameState, stat: CoreStat, n = 1): boolean {
  if (!hasFeature(s, 'miner')) return false;
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

export function skillReady(s: GameState, id: SkillId): boolean {
  const def = SKILLS.find((k) => k.id === id);
  return !!def && hasFeature(s, id) && s.cooldowns[id] <= 0 && s.stamina >= def.stamina;
}

export function useSkill(s: GameState, id: SkillId): boolean {
  const def = SKILLS.find((k) => k.id === id);
  if (!def || !skillReady(s, id)) return false;
  s.stamina -= def.stamina;
  s.cooldowns[id] = def.cooldown;
  s.counters.skills[id] = (s.counters.skills[id] ?? 0) + 1;
  emit({ type: 'skill', id });
  if (id === 'power') tap(s, 30);
  else if (id === 'dowse') s.buffs.dowse = def.duration;
  else s.buffs.frenzy = def.duration;
  return true;
}

export function useConsumable(s: GameState, id: ConsumableId): boolean {
  if ((s.consumables[id] ?? 0) <= 0) return false;
  const d = derive(s);
  if (id === 'tonic' && s.stamina >= d.staminaMax) return false;
  s.consumables[id] -= 1;
  switch (id) {
    case 'dynamite':
      emit({ type: 'skill', id: 'dynamite' });
      damage(s, d.tap * 60, { crit: false, auto: false }, d);
      break;
    case 'tonic':
      s.stamina = d.staminaMax;
      break;
    case 'luckbrew':
      s.buffs.luck = 180;
      break;
    case 'sagebrew':
      s.buffs.sage = 300;
      break;
  }
  return true;
}

/**
 * A fresh piece of gear, with up to two random affixes. Luck makes the
 * second affix likelier.
 */
export function rollGear(s: GameState, baseId: string): GearItem {
  const base = GEAR_BASE.get(baseId);
  if (!base) throw new Error(`Unknown gear ${baseId}`);
  const luck = derive(s).luck;
  const r = rand(s);
  const count = r < Math.min(0.35, 0.1 + luck * 0.002) ? 2 : r < 0.55 ? 1 : 0;
  const pool = [...AFFIXES[base.slot]];
  const affixes: GearItem['affixes'] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const stat = pool.splice(Math.floor(rand(s) * pool.length), 1)[0]!;
    const value = affixMax(stat, base.tier) * (0.5 + 0.5 * rand(s));
    affixes.push({ stat, value: stat === 'critChance' || stat === 'critMult' ? Math.round(value * 100) / 100 : Math.round(value) });
  }
  return { uid: s.nextUid++, base: baseId, affixes };
}

/** A rough single number for comparing two pieces in a slot. */
export function gearScore(item: GearItem): number {
  const base = GEAR_BASE.get(item.base);
  if (!base) return 0;
  return base.tier * 100 + item.affixes.length * 10 + item.affixes.reduce((a, x) => a + x.value / affixMax(x.stat, base.tier), 0);
}

export function equip(s: GameState, uid: number): boolean {
  const item = s.gear.find((g) => g.uid === uid);
  const base = item && GEAR_BASE.get(item.base);
  if (!item || !base) return false;
  s.equipped[base.slot] = uid;
  const d = derive(s);
  s.stamina = Math.min(s.stamina, d.staminaMax);
  return true;
}

export function unequip(s: GameState, slot: Slot): void {
  s.equipped[slot] = null;
  s.stamina = Math.min(s.stamina, derive(s).staminaMax);
}

/** Melts down unequipped gear for a little coin. */
export function salvage(s: GameState, uid: number, recipeCoins: number): boolean {
  const i = s.gear.findIndex((g) => g.uid === uid);
  if (i < 0 || Object.values(s.equipped).includes(uid)) return false;
  s.gear.splice(i, 1);
  s.coins += Math.floor(recipeCoins * 0.3);
  return true;
}
