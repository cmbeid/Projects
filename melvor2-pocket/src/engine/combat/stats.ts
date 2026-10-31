// Combat stat formulas, following CharacterStats / TargetCharacterStats in the game (see notes/formulas.md).
import { NS } from '../content';
import {
  type AttackStance, type Bonus, type CombatStyle, type StatBlock, stance as stanceData, style as styleData,
} from './data';

export interface Fighter {
  levels: Record<string, number>;
  /** Totals of combat stats (AttackInterval, StabAttackBonus, MeleeStrengthBonus, ...), unprefixed. */
  stats: Record<string, number>;
  power: number;
  protection: number;
  stance: AttackStance;
  style: CombatStyle;
  /** Modifier totals by name (PercentMaxHit, FlatPowerRating, ...). */
  mods: Record<string, number>;
  maxHp: number;
}

const local = (id: string) => id.replace(NS, '');

export function addStats(into: Record<string, number>, block: StatBlock | null | undefined): { power: number; protection: number } {
  let power = 0;
  let protection = 0;
  if (!block) return { power, protection };
  for (const s of block.Stats) into[local(s.Stat)] = (into[local(s.Stat)] ?? 0) + s.Value;
  for (const p of block.PowerRatings) if (local(p.DamageType) === 'Normal') power += p.Value;
  for (const p of block.ProtectionRatings) if (local(p.DamageType) === 'Normal') protection += p.Value;
  return { power, protection };
}

/** Apply character bonuses: FlatCombatStatValue adds to a stat, everything else sums into mods. */
export function applyBonuses(f: Pick<Fighter, 'stats' | 'mods' | 'levels'>, bonuses: Bonus[]): void {
  for (const b of bonuses) {
    if (b.Stat.Name === 'FlatCombatStatValue' && b.LocalContext?.CombatStat) {
      const k = local(b.LocalContext.CombatStat);
      f.stats[k] = (f.stats[k] ?? 0) + b.Value;
    } else if (b.Stat.Name === 'PercentCombatStatValue' && b.LocalContext?.CombatStat) {
      // Applied on top of the flat totals by finishStats, once every source is in.
      const k = `PercentCombatStatValue:${local(b.LocalContext.CombatStat)}`;
      f.mods[k] = (f.mods[k] ?? 0) + b.Value;
    } else if (b.Stat.Name === 'FlatCombatLevel' && b.LocalContext?.CombatLevel) {
      // e.g. the Block, Long-Range and Defensive stances: +3 effective Defence.
      const k = local(b.LocalContext.CombatLevel);
      f.levels[k] = (f.levels[k] ?? 1) + b.Value;
    } else {
      f.mods[b.Stat.Name] = (f.mods[b.Stat.Name] ?? 0) + b.Value;
    }
  }
}

/** Scale combat stats by their PercentCombatStatValue bonuses. Call once all flat stats are added. */
export function finishStats(f: Pick<Fighter, 'stats' | 'mods'>): void {
  for (const [k, v] of Object.entries(f.mods)) {
    if (!k.startsWith('PercentCombatStatValue:')) continue;
    const stat = k.slice('PercentCombatStatValue:'.length);
    f.stats[stat] = Math.floor((f.stats[stat] ?? 0) * (1 + v));
  }
}

const levelOf = (f: Fighter, ratios: { Level: string; Ratio: number }[]) =>
  ratios.reduce((s, r) => s + (f.levels[local(r.Level)] ?? 1) * r.Ratio, 0);

const darknessFactor = (darkness: number) => 1 - 0.05 * Math.max(0, Math.min(20, darkness));

export function accuracyRating(f: Fighter, darkness = 0): number {
  const lvl = levelOf(f, f.style.AccuracyRatingLevels);
  const base = Math.floor((lvl + 9) * ((f.stats[local(f.stance.AccuracyStat)] ?? 0) + 64));
  return Math.max(Math.floor(Math.floor(base * (1 + (f.mods.PercentAccuracyRating ?? 0))) * darknessFactor(darkness)), 1);
}

/** Evasion against an attack made with `attackerStance`. */
export function evasionRating(defender: Fighter, attackerStance: AttackStance, darkness = 0): number {
  const st = styleData(attackerStance.CombatStyle);
  const lvl = levelOf(defender, st.EvasionLevels);
  const base = Math.floor((lvl + 9) * ((defender.stats[local(attackerStance.EvasionStat)] ?? 0) + 64));
  const mod = Math.floor(base * (1 + (defender.mods.PercentEvasionRating ?? 0)) + (defender.mods.FlatEvasionRating ?? 0));
  return Math.max(Math.floor(mod * darknessFactor(darkness)), 1);
}

export function hitChance(acc: number, eva: number, flat = 0): number {
  const c = acc >= eva ? 1 - eva / 2 / acc : acc / 2 / eva;
  return Math.max(0, Math.min(1, c + flat));
}

export function maxHit(f: Fighter, triangle = 0): number {
  const formula = f.style.MaxHitFormula;
  const lvl = levelOf(f, formula.Data.Levels);
  let base: number;
  if (local(formula.Type) === 'DamageBonus') {
    const spellMax = f.stats[local(formula.Data.MaxHitStat!)] ?? 0;
    const dmgBonus = f.stats[local(formula.Data.DamageBonusStat!)] ?? 0;
    base = Math.floor(spellMax * (1 + dmgBonus) * (1 + (lvl + 1) / 200));
  } else {
    const bonus = f.stats[local(formula.Data.StrengthBonusStat!)] ?? 0;
    base = Math.floor(22 + lvl + ((lvl + 17) * bonus) / 64);
  }
  return Math.max(Math.floor((base * (1 + (f.mods.PercentMaxHit ?? 0)) + (f.mods.FlatMaxHit ?? 0)) * (1 + triangle)), 1);
}

export function minHit(f: Fighter, max: number): number {
  return Math.max(1, Math.min(max, Math.floor(1 + (f.mods.FlatMinHit ?? 0) + max * (f.mods.MinHitBasedOnMaxHit ?? 0))));
}

export function attackInterval(f: Fighter): number {
  const base = f.stats[local(f.style.AttackIntervalStat)] ?? 4000;
  return Math.max(Math.floor(base * (1 + (f.mods.PercentAttackInterval ?? 0)) + (f.mods.FlatAttackInterval ?? 0)), 250);
}

export function armour(f: Fighter): number {
  return Math.max(Math.floor(f.stats[local(f.style.ArmourStat)] ?? 0), 0);
}

export function powerRating(f: Fighter): number {
  return Math.max(Math.floor((f.power + (f.mods.FlatPowerRating ?? 0)) * (1 + (f.mods.PercentPowerRating ?? 0))), 1);
}

export function protectionRating(f: Fighter): number {
  return Math.max(Math.floor((f.protection + (f.mods.FlatProtectionRating ?? 0)) * (1 + (f.mods.PercentProtectionRating ?? 0))), 0);
}

/**
 * Share of damage resisted (ResistanceStats.ComputeResistance): clamp((prot / (power + prot) + flat) × (1 + percent),
 * 0, 0.7), then the combat triangle.
 */
export function resistance(attacker: Fighter, defender: Fighter, triangle = 0, flat = 0, percent = 0): number {
  const power = powerRating(attacker);
  const prot = protectionRating(defender);
  const r = Math.max(0, Math.min(0.7, (prot / (power + prot) + flat) * (1 + percent)));
  return Math.max(0, Math.min(1, r * (1 + triangle)));
}

/** Damage after resistance and armour, at least 1. */
export function reduceDamage(raw: number, attacker: Fighter, defender: Fighter, triangle = 0): number {
  const dealt = raw * (1 + (attacker.mods.PercentDamageDealt ?? 0)) * (1 + (defender.mods.PercentDamageTaken ?? 0));
  return Math.max(Math.floor(dealt * (1 - resistance(attacker, defender, triangle)) - armour(defender)), 1);
}

/** Combat level: floor of the style's weighted levels (CombatStyle.ComputeCombatLevel), at least 1. */
export function combatLevel(f: Pick<Fighter, 'levels'>, st: CombatStyle): number {
  return Math.max(1, Math.floor(st.CombatLevelRatios.reduce((s, r) => s + (f.levels[local(r.Level)] ?? 1) * r.Ratio, 0)));
}

export const stanceOf = (id: string) => stanceData(id);
export const styleOfStance = (id: string) => styleData(stanceData(id).CombatStyle);
