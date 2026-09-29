/**
 * A tower's working numbers: its line's base stats grown by level, evolution
 * (or Eevee's chosen branch), its signature move, its held item and the
 * ledge it stands on. Buffs that come and go — X items and auras — are
 * applied when it attacks, not here.
 */
import { HELD_BY_KEY } from '../data/items';
import { type AttackKind, type Effects, MAX_LEVEL, MEGAS, type TowerLine } from '../data/towers';
import type { PokeType } from '../data/types';

export const NO_EFFECTS: Effects = {
  splash: 0, chain: 0, burn: 0, poison: 0, slow: 0, sleep: 0, paralyse: 0, confuse: 0, flinch: 0,
  crit: 0, knockback: 0, pierceArmour: 0, weaken: 0, ohko: 0, payDay: 0, antiAir: 0,
  auraDamage: 0, auraRate: 0, income: 0, wish: 0, rewind: 0, hex: 0, random: 0,
  lifeEvery: 0, accelerate: 0, chip: 0, adapt: 0, judgment: 0, smackDown: 0, bossBonus: 0,
};

export interface TowerStats {
  dex: number;
  /** Index into `line.stages` (or `stages.length` for an Eevee branch). */
  stage: number;
  type: PokeType;
  attack: AttackKind;
  damage: number;
  range: number;
  rate: number;
  effects: Effects;
  detect: boolean;
  groundOnly: boolean;
  /** Extra ₽ per knockout, as a fraction. */
  bounty: number;
}

export interface TowerSetup {
  level: number;
  branch: number | null;
  move: number | null;
  held: string | null;
  ledge: boolean;
  /** Mega Evolved (Kalos): stronger, and in its mega form. */
  mega?: boolean;
  /** Dynamaxed (Galar): Max Moves that burst over whole groups. */
  dynamax?: boolean;
  /** Terastallized (Paldea) into this type. */
  tera?: PokeType | null;
  /** Fog on the map: every tower's reach shrinks, but a Flying type's or a Wide Lens holder's. */
  fog?: boolean;
}

/** Range left to a tower in fog. */
export const FOG_RANGE = 0.75;

function addEffects(into: Effects, more: Partial<Effects> | undefined): void {
  if (!more) return;
  for (const [k, v] of Object.entries(more) as [keyof Effects, number][]) into[k] += v;
}

export function stageIndex(line: TowerLine, level: number): number {
  let idx = 0;
  line.stages.forEach((s, i) => {
    if (level >= s.level) idx = i;
  });
  return idx;
}

export function towerStats(line: TowerLine, setup: TowerSetup): TowerStats {
  const { level } = setup;
  const stage = stageIndex(line, level);
  let dex = line.stages[stage]!.dex;
  let type = line.type;
  let attack = line.attack;
  let power = 1;
  for (let i = 1; i <= stage; i += 1) power *= line.stages[i]!.power ?? 1.15;

  let damage = line.base.damage;
  let range = line.base.range;
  let rate = line.base.rate;
  const effects: Effects = { ...NO_EFFECTS };
  addEffects(effects, line.effects);
  let branchIdx = stage;

  const branch = line.branches && setup.branch !== null && level >= line.branches.level ? line.branches.options[setup.branch] : undefined;
  if (branch) {
    dex = branch.dex;
    type = branch.type;
    attack = branch.attack;
    power *= 1.15;
    damage *= branch.damage ?? 1;
    rate *= branch.rate ?? 1;
    range += branch.range ?? 0;
    addEffects(effects, branch.effects);
    branchIdx = line.stages.length;
  }

  let groundOnly = Boolean(line.groundOnly) && !line.stages.slice(0, stage + 1).some((s) => s.airborne);
  const move = level >= MAX_LEVEL && setup.move !== null ? line.moves[setup.move] : undefined;
  if (move) {
    type = move.type ?? type;
    attack = move.attack ?? attack;
    damage *= move.damage ?? 1;
    rate *= move.rate ?? 1;
    range += move.range ?? 0;
    addEffects(effects, move.effects);
    if (move.airborne) groundOnly = false;
  }

  const mega = setup.mega ? MEGAS.get(dex) : undefined;
  if (mega) {
    dex = mega.form;
    type = mega.type ?? type;
    damage *= 1.5;
    rate *= 1.1;
    range += 0.3;
  }

  if (setup.tera) {
    type = setup.tera;
    damage *= 1.2;
  }
  if (setup.dynamax && attack !== 'aura') {
    attack = 'splash';
    effects.splash = Math.max(effects.splash, 1.2);
    damage *= 1.3;
    range += 0.5;
  }

  damage *= power * 1.4 ** (level - 1);
  rate *= 1.08 ** (level - 1);
  range += 0.12 * (level - 1) + (setup.ledge ? 0.5 : 0);
  effects.income *= level;
  effects.auraDamage *= 1 + 0.2 * (level - 1);
  effects.auraRate *= 1 + 0.2 * (level - 1);

  let bounty = 0;
  const held = setup.held ? HELD_BY_KEY.get(setup.held) : undefined;
  if (held) {
    if (!held.boostType || held.boostType === type) damage *= 1 + (held.damage ?? 0);
    rate *= 1 + (held.rate ?? 0);
    range += held.range ?? 0;
    addEffects(effects, held.effects);
    bounty += held.bounty ?? 0;
  }

  if (setup.fog && type !== 'flying' && held?.key !== 'wide-lens') range *= FOG_RANGE;

  return { dex, stage: branchIdx, type, attack, damage, range, rate, effects, detect: Boolean(line.detect), groundOnly, bounty };
}
