import { TRAIT } from '../data/crew';
import { AFFIX, GEAR_DEF, RARITIES } from '../data/gear';
import { MODULE } from '../data/modules';
import { BAL } from '../data/progression';
import { SKILL } from '../data/skills';
import type { ModKey, ModuleId, Mods, StatId } from '../data/types';
import type { Crew, GameState, GearInst } from '../state/types';

export function addMods(into: Mods, from: Mods, scale = 1): Mods {
  for (const [k, v] of Object.entries(from) as [ModKey, number][]) into[k] = (into[k] ?? 0) + v * scale;
  return into;
}

export function gearMods(g: GearInst): Mods {
  const def = GEAR_DEF.get(g.base);
  const out: Mods = {};
  if (!def) return out;
  addMods(out, def.mods, RARITIES[g.rarity]?.mult ?? 1);
  for (const a of g.affixes) {
    const af = AFFIX.get(a.id);
    if (af) out[af.key] = (out[af.key] ?? 0) + a.v;
  }
  return out;
}

export function gearOf(s: GameState, uid: number | undefined): GearInst | null {
  if (uid === undefined) return null;
  return s.gear.find((g) => g.uid === uid) ?? null;
}

/** Everything one crew member brings: skills, traits and equipped gear. */
export function crewMods(s: GameState, c: Crew): Mods {
  const out: Mods = {};
  for (const id of c.skills) {
    const sk = SKILL.get(id);
    if (sk) addMods(out, sk.mods);
  }
  for (const id of c.traits) {
    const t = TRAIT.get(id);
    if (t) addMods(out, t.mods);
  }
  for (const uid of Object.values(c.gear)) {
    const g = gearOf(s, uid);
    if (g) addMods(out, gearMods(g));
  }
  return out;
}

export function conscious(c: Crew): boolean {
  return c.hp > 0;
}

export function maxHp(c: Crew): number {
  return 60 + c.stats.grit * 5 + (c.level - 1) * 4;
}

/** A stat as checks see it: base, plus mods, plus half the level, nudged by morale. */
export function effStat(s: GameState, c: Crew, stat: StatId): number {
  const m = crewMods(s, c);
  const morale = c.morale >= 80 ? 1 : c.morale < 25 ? -1 : 0;
  return Math.round((c.stats[stat] + (m[stat] ?? 0) + Math.floor(c.level / 2) + morale) * 10) / 10;
}

/** Ship-wide mods: the sum over every crew member still on their feet. */
export function shipMods(s: GameState): Mods {
  const out: Mods = {};
  for (const c of s.crew) if (conscious(c)) addMods(out, crewMods(s, c));
  return out;
}

export function tierV(s: GameState, id: ModuleId): number {
  const t = s.modules[id];
  if (!t) return 0;
  return MODULE.get(id)!.tiers[t - 1]!.v;
}

export interface Derived {
  mods: Mods;
  maxHull: number;
  maxFuel: number;
  maxFood: number;
  maxEnergy: number;
  reactor: number;
  upkeep: number;
  grow: number;
  eat: number;
  fuelPerJump: number;
  sensor: number;
  evasion: number;
  accuracy: number;
  shieldMax: number;
  regen: number;
  weapons: { kind: 'laser' | 'missile' | 'ion'; dmg: number; cd: number }[];
  crewCap: number;
  fab: number;
  medbay: number;
  refinery: number;
  trade: number;
}

export function eats(c: Crew): number {
  let e = BAL.eat;
  for (const id of c.traits) {
    const t = TRAIT.get(id);
    if (t?.eats !== undefined) e *= t.eats;
  }
  return e;
}

export function derive(s: GameState): Derived {
  const mods = shipMods(s);
  const cargo = tierV(s, 'cargo') || 1;
  let upkeep = BAL.lifePerCrew * s.crew.length;
  for (const [id, t] of Object.entries(s.modules) as [ModuleId, number][]) if (t > 0) upkeep += MODULE.get(id)!.upkeep;
  const engineT = s.modules.engine;
  const sensorT = s.modules.sensor;
  const shieldT = s.modules.shield;
  const weapons: Derived['weapons'] = [];
  if (s.modules.laser) weapons.push({ kind: 'laser', dmg: tierV(s, 'laser'), cd: 1 });
  if (s.modules.missile) weapons.push({ kind: 'missile', dmg: tierV(s, 'missile'), cd: 3 });
  if (s.modules.ion) weapons.push({ kind: 'ion', dmg: tierV(s, 'ion'), cd: 2 });
  const dmgMult = 1 + (mods.weaponDmg ?? 0);
  for (const w of weapons) w.dmg = Math.round(w.dmg * dmgMult * 10) / 10;
  const eat = s.crew.reduce((a, c) => a + eats(c), 0) * Math.max(0.4, 1 - (mods.foodEff ?? 0));
  return {
    mods,
    maxHull: tierV(s, 'plating'),
    maxFuel: Math.round(14 * cargo),
    maxFood: Math.round(30 * cargo),
    maxEnergy: Math.round(40 * cargo),
    reactor: tierV(s, 'reactor'),
    upkeep,
    grow: tierV(s, 'hydro') + (s.story.flags.includes('seed-vault') ? 1 : 0),
    eat: Math.round(eat * 100) / 100,
    fuelPerJump: Math.max(0.4, Math.round(BAL.jumpFuel * (1 - Math.max(0, engineT - 1) * 0.1 - (mods.fuelEff ?? 0)) * 100) / 100),
    sensor: tierV(s, 'sensor'),
    evasion: Math.min(0.6, tierV(s, 'engine') + (mods.evasion ?? 0)),
    accuracy: Math.max(0, sensorT - 1) * 0.05 + (mods.accuracy ?? 0),
    shieldMax: tierV(s, 'shield'),
    regen: (shieldT ? [1, 2, 3, 4][shieldT - 1]! : 0) + (mods.shieldRegen ?? 0),
    weapons,
    crewCap: tierV(s, 'cabins'),
    fab: tierV(s, 'fabricator'),
    medbay: tierV(s, 'medbay'),
    refinery: tierV(s, 'refinery'),
    trade: Math.min(0.3, mods.trade ?? 0),
  };
}
