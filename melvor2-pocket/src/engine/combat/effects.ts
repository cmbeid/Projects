// Combat effects, after the desktop's CombatEffectsComponent and Active*Effect classes: burns, poisons, bleeds, stuns,
// timed buffs and debuffs, stacking effects, charges and counters. Effects are applied by attacks (pre-hit and on-hit),
// by triggers on gear, passives, area effects and astrology (on attack, when hit, at the start of a fight...), and wear
// off with the affected character's turns, by attack counts, or at the end of the fight.
import { NS, tryGet } from '../content';
import type { Game } from '../game';
import type { Bonus } from './data';

export type Side = 'player' | 'enemy';
export const other = (s: Side): Side => (s === 'player' ? 'enemy' : 'player');

type Kind =
  | 'DamageOverTime'
  | 'Stun'
  | 'TurnCounting'
  | 'EndOfTurnDamage'
  | 'EndOfTurnHealing'
  | 'RandomMagnitude'
  | 'Stacking'
  | 'AttackCharging'
  | 'AttackCounting';

const DATA_TYPE: Record<Kind, string> = {
  DamageOverTime: 'DamageOverTimeEffect',
  Stun: 'StunEffect',
  TurnCounting: 'TurnCountingEffect',
  EndOfTurnDamage: 'EndOfTurnDamageEffect',
  EndOfTurnHealing: 'EndOfTurnHealingEffect',
  RandomMagnitude: 'RandomMagnitudeEffect',
  Stacking: 'StackingEffect',
  AttackCharging: 'AttackChargingEffect',
  AttackCounting: 'AttackCountingEffect',
};

/** An effect as an attack or trigger names it: kind, effect id and optional overrides. */
export interface EffectRef {
  Type: string;
  Data: { Effect: string; Configuration?: { Turns?: number | null; StacksToAdd?: number | null; MinStacks?: number | null; MaxStacks?: number | null; Attacks?: number | null } | null };
}

/** An effect on a character during a fight (saved with the game). */
export interface ActiveEffect {
  id: string;
  kind: Kind;
  source: Side;
  stacks: number;
  turns?: number;
  attacks?: number;
  procs?: number;
  /** Ticks to the next damage-over-time proc, and the damage it will do. */
  procLeft?: number;
  perProc?: number;
  /** Applied during the character's own turn/attack: that turn doesn't count down (AppliedDuringTurn). */
  fresh?: boolean;
}

interface EffectData {
  Id: string;
  DisplayName: string;
  Icon?: string;
  IsPositive: boolean;
  Modifiers?: Bonus[] | null;
  DefaultTurns?: number;
  DefaultStacksToAdd?: number;
  MaxStacks?: number;
  StacksRequired?: number;
  DefaultMinStacks?: number;
  DefaultMaxStacks?: number;
  DefaultAttacks?: number;
  ProcInterval?: number;
  ProcCount?: number;
  DamagePerProc?: EffectDamage;
  DamagePerTurn?: EffectDamage;
  HealingPerTurn?: EffectDamage;
  RemovalEffect?: EffectRef | null;
}

export interface EffectDamage { Character: string; Formula: { Type: string; Data: { Percent?: number; Damage?: number } } }

export const effectKind = (ref: EffectRef) => ref.Type.replace(NS, '') as Kind;
export const effectData = (kind: Kind, id: string) => tryGet<EffectData>(DATA_TYPE[kind], id);

/** What the fight needs to know and do, provided by combat.ts so this module stays free of fight details. */
export interface FightOps {
  hp(side: Side): number;
  maxHp(side: Side): number;
  maxHit(side: Side): number;
  /** Damage from an effect; returns true if it was fatal. */
  damage(side: Side, amount: number, source: Side, effectId: string): boolean;
  /** A side's current Ward: while it's up, harmful effects and effect damage don't get through. */
  ward(side: Side): number;
  /** An effect landed (for guild goals). */
  applied(effectId: string, source: Side, target: Side): void;
  heal(side: Side, amount: number): void;
  /** Character whose turn is being resolved right now, if any. */
  acting: Side | null;
  /** Damage dealt by the attack that applied this effect (for Bleed). */
  lastDamage: number;
  /** Bonus stat totals for a side: AvoidanceChance and EffectLifesteal per effect, PercentDamageTaken for effects. */
  effectStat(side: Side, name: string, effectId: string): number;
  ticks(ms: number): number;
}

export function effectsOn(game: Game, side: Side): ActiveEffect[] {
  const c = game.state.combat;
  c.effects ??= { player: [], enemy: [] };
  return c.effects[side];
}

export function clearEffects(game: Game): void {
  game.state.combat.effects = { player: [], enemy: [] };
}

/** Roll an effect's damage or healing: a share of max hit, current HP or the last hit, or a fixed amount. */
export function rollEffectDamage(game: Game, d: EffectDamage, source: Side, target: Side, ops: FightOps): number {
  const who = d.Character === 'Source' || d.Character === 'Attacker' ? source : target;
  const pct = d.Formula.Data.Percent ?? 1;
  switch (d.Formula.Type.replace(NS, '')) {
    case 'MaxHit':
      return Math.floor(ops.maxHit(who) * pct);
    case 'CurrentHitpoints':
      return Math.floor(ops.hp(who) * pct);
    case 'DamageDealt':
      return Math.floor(ops.lastDamage * pct);
    case 'Fixed':
      return d.Formula.Data.Damage ?? 0;
    default: {
      const max = ops.maxHit(who);
      return Math.floor(game.rng.intInclusive(1, Math.max(1, max)) * pct);
    }
  }
}

/** Apply an effect to `target` from `source` (CombatEffectsComponent.ApplyEffect). */
export function applyEffect(game: Game, ref: EffectRef, target: Side, source: Side, ops: FightOps, immune = false): void {
  const kind = effectKind(ref);
  const data = effectData(kind, ref.Data.Effect);
  if (!data) return;
  // An immune target (e.g. "immune to Ranged") ignores harmful effects from the attacker it's immune to, and Ward
  // keeps every harmful effect out while it lasts.
  if ((immune || ops.ward(target) > 0) && !data.IsPositive) return;
  const list = effectsOn(game, target);
  const existing = list.find((e) => e.id === data.Id);
  const avoid = ops.effectStat(target, 'AvoidanceChance', NS + data.Id);
  const cfg = ref.Data.Configuration ?? {};
  if (existing) {
    if (game.rng.chance(avoid)) return;
    // Only the stacking kinds take a reapplication: more stacks, up to the cap.
    if (kind === 'DamageOverTime' || kind === 'Stacking' || kind === 'AttackCharging') {
      const cap = kind === 'AttackCharging' ? data.StacksRequired ?? 1 : data.MaxStacks ?? 1;
      if (existing.stacks >= cap) return;
      const add = Math.min(cap - existing.stacks, cfg.StacksToAdd ?? data.DefaultStacksToAdd ?? 1);
      existing.stacks += add;
      if (kind === 'DamageOverTime') existing.perProc = (existing.perProc ?? 0) + Math.max(1, rollEffectDamage(game, data.DamagePerProc!, source, target, ops)) * add;
      if (kind === 'AttackCharging' && existing.stacks >= cap) existing.fresh = ops.acting === target;
    }
    return;
  }
  if (game.rng.chance(avoid)) return;
  const e: ActiveEffect = { id: data.Id, kind, source, stacks: 1, fresh: ops.acting === target };
  switch (kind) {
    case 'DamageOverTime':
      e.stacks = Math.min(cfg.StacksToAdd ?? data.DefaultStacksToAdd ?? 1, data.MaxStacks ?? 1);
      e.procs = 0;
      e.procLeft = ops.ticks(data.ProcInterval ?? 1000);
      e.perProc = Math.max(1, rollEffectDamage(game, data.DamagePerProc!, source, target, ops)) * e.stacks;
      break;
    case 'Stun':
    case 'TurnCounting':
      e.turns = cfg.Turns ?? data.DefaultTurns ?? 1;
      break;
    case 'RandomMagnitude':
      e.turns = cfg.Turns ?? data.DefaultTurns ?? 1;
      e.stacks = game.rng.intInclusive(cfg.MinStacks ?? data.DefaultMinStacks ?? 1, cfg.MaxStacks ?? data.DefaultMaxStacks ?? 1);
      break;
    case 'Stacking':
      e.stacks = Math.min(cfg.StacksToAdd ?? data.DefaultStacksToAdd ?? 1, data.MaxStacks ?? 1);
      break;
    case 'AttackCharging':
      e.stacks = Math.min(cfg.StacksToAdd ?? data.DefaultStacksToAdd ?? 1, data.StacksRequired ?? 1);
      break;
    case 'AttackCounting':
      e.attacks = cfg.Attacks ?? data.DefaultAttacks ?? 1;
      // Counts the opponent's attacks: one being made right now doesn't count.
      e.fresh = ops.acting === other(target);
      break;
  }
  list.push(e);
  ops.applied(NS + data.Id, source, target);
}

function remove(game: Game, side: Side, e: ActiveEffect, ops: FightOps): void {
  const list = effectsOn(game, side);
  const i = list.indexOf(e);
  if (i >= 0) list.splice(i, 1);
  // Some effects leave another behind when they end (a stun leaves you Staggered).
  const data = effectData(e.kind, NS + e.id);
  if ((e.kind === 'Stun' || e.kind === 'TurnCounting') && data?.RemovalEffect) applyEffect(game, data.RemovalEffect, side, side, ops);
}

export const isStunned = (game: Game, side: Side) => effectsOn(game, side).some((e) => e.kind === 'Stun');

/** End of a character's turn: turn counters tick down, end-of-turn damage and healing happen. Returns true if it died. */
export function endTurn(game: Game, side: Side, ops: FightOps): boolean {
  for (const e of [...effectsOn(game, side)]) {
    const data = effectData(e.kind, NS + e.id);
    if (!data) continue;
    if (e.kind === 'EndOfTurnDamage' && data.DamagePerTurn) {
      if (ops.damage(side, rollEffectDamage(game, data.DamagePerTurn, e.source, side, ops), e.source, NS + e.id)) return true;
    } else if (e.kind === 'EndOfTurnHealing' && data.HealingPerTurn) {
      ops.heal(side, rollEffectDamage(game, data.HealingPerTurn, e.source, side, ops));
    } else if (e.kind === 'Stun' || e.kind === 'TurnCounting' || e.kind === 'RandomMagnitude') {
      if (e.fresh) {
        e.fresh = false;
        continue;
      }
      e.turns = (e.turns ?? 1) - 1;
      if (e.turns <= 0) remove(game, side, e, ops);
    }
  }
  return false;
}

/** After a character attacks: a full charge is spent (unless it filled during this very attack). */
export function afterAttack(game: Game, side: Side, ops: FightOps): void {
  for (const e of [...effectsOn(game, side)]) {
    if (e.kind !== 'AttackCharging') continue;
    const data = effectData(e.kind, NS + e.id);
    if (e.stacks < (data?.StacksRequired ?? 1)) continue;
    if (e.fresh) e.fresh = false;
    else remove(game, side, e, ops);
  }
}

/** After a character is attacked: attack counters tick down. */
export function afterDefended(game: Game, side: Side, ops: FightOps): void {
  for (const e of [...effectsOn(game, side)]) {
    if (e.kind !== 'AttackCounting') continue;
    if (e.fresh) {
      e.fresh = false;
      continue;
    }
    e.attacks = (e.attacks ?? 1) - 1;
    if (e.attacks <= 0) remove(game, side, e, ops);
  }
}

/** Advance damage-over-time timers by `elapsed` ticks. Returns the side that died, if one did. */
export function tickDamageOverTime(game: Game, elapsed: number, ops: FightOps): Side | null {
  for (const side of ['player', 'enemy'] as Side[]) {
    for (const e of [...effectsOn(game, side)]) {
      if (e.kind !== 'DamageOverTime') continue;
      const data = effectData(e.kind, NS + e.id)!;
      e.procLeft = (e.procLeft ?? 0) - elapsed;
      while (e.procLeft <= 0 && effectsOn(game, side).includes(e)) {
        if (ops.damage(side, e.perProc ?? 1, e.source, NS + e.id)) return side;
        e.procs = (e.procs ?? 0) + 1;
        if (e.procs >= (data.ProcCount ?? 1)) remove(game, side, e, ops);
        else e.procLeft += ops.ticks(data.ProcInterval ?? 1000);
      }
    }
  }
  return null;
}

/** Ticks until the next damage-over-time proc on either side, if any. */
export function nextProc(game: Game): number | null {
  let next: number | null = null;
  for (const side of ['player', 'enemy'] as Side[]) {
    for (const e of effectsOn(game, side)) if (e.kind === 'DamageOverTime' && (next == null || (e.procLeft ?? 0) < next)) next = e.procLeft ?? 0;
  }
  return next;
}

/** The stat modifiers active effects put on a character, scaled by their stacks (a charge only once full). */
export function effectModifiers(game: Game, side: Side): Bonus[] {
  const out: Bonus[] = [];
  for (const e of effectsOn(game, side)) {
    const data = effectData(e.kind, NS + e.id);
    if (!data?.Modifiers) continue;
    let times = 1;
    if (e.kind === 'Stacking' || e.kind === 'RandomMagnitude' || e.kind === 'DamageOverTime') times = e.stacks;
    if (e.kind === 'AttackCharging' && e.stacks < (data.StacksRequired ?? 1)) continue;
    for (const m of data.Modifiers) out.push({ ...m, Value: m.Value * times });
  }
  return out;
}

// ---- triggers ------------------------------------------------------------------------------------------------------

/** A triggered effect from a bonus block's CombatEffect list (gear, passives, area effects, astrology, guild...). */
export interface TriggeredEffect {
  Character: { Entity: string; Component: string };
  Modifier: { Effect: EffectRef; Trigger: { Type: string; Data: { Type?: string; IsAutoEat?: boolean } }; AppliesTo: 'Self' | 'Target' };
  Chance: number;
  Condition?: unknown;
  Scaling?: unknown;
}

export type TriggerKind =
  | 'AtStartOfFight'
  | 'OnAttack'
  | 'OnFirstAttack'
  | 'OnHit'
  | 'OnFirstHit'
  | 'OnMiss'
  | 'OnFirstMiss'
  | 'OnFirstAttackHit'
  | 'OnFirstAttackMiss'
  | 'WhenAttacked'
  | 'WhenFirstAttacked'
  | 'WhenHit'
  | 'WhenFirstHit'
  | 'WhenAttackEvaded'
  | 'WhenFirstAttackEvaded'
  | 'OnDeath'
  | 'FoodEaten';

/** Which named trigger a TriggeredEffect fires on ("OnAttack" with Data.Type "OnHit" → "OnHit"). */
export const triggerKind = (t: TriggeredEffect): TriggerKind =>
  (t.Modifier.Trigger.Data.Type ?? t.Modifier.Trigger.Type.replace(NS, '')) as TriggerKind;

/** Fire every triggered effect of `owner` for one trigger. */
export function fireTriggers(game: Game, list: TriggeredEffect[], owner: Side, kind: TriggerKind, ops: FightOps, immuneTarget = false): void {
  for (const t of list) {
    if (triggerKind(t) !== kind || !game.rng.chance(t.Chance)) continue;
    const target = t.Modifier.AppliesTo === 'Self' ? owner : other(owner);
    applyEffect(game, t.Modifier.Effect, target, owner, ops, target !== owner && immuneTarget);
  }
}

/** The side a TriggeredEffect or bonus belongs to, from its Character/Component marker ("Player"/"Enemy"). */
export const sideOf = (component: string | undefined): Side | null =>
  component === 'Enemy' ? 'enemy' : component === 'Player' ? 'player' : null;
