import { NS, tryGet, type Requirement } from '../content';
import type { Game } from '../game';
import type { SkillHandler, SkillRecipe } from './types';
import { bonusReader, recipeContext, recipeGetter, recipeList } from './common';
import { goalMatches, questEvent } from '../quests';

const SKILL = 'Thieving';
/** Stun duration after a failed attempt (ThievingActionComponent.BaseStunInterval). */
export const BASE_STUN_INTERVAL = 2000;

interface Drop { Item: string; MinQuantity: number; MaxQuantity: number; Weight: number }

export interface ThievingRecipe extends SkillRecipe {
  RecipeType: string;
  BaseInterval: number;
  Stages: number;
  Damage: number;
  Perception: number;
  BaseCurrencyLootChance: number;
  CurrencyReward: { Currency: string; MinQuantity: number; MaxQuantity: number } | null;
  BaseCommonLootChance: number;
  CommonDropTable: Drop[];
  BaseRareLootChance: number;
  RareDropTable: Drop[];
  CompletionDropTable: Drop[];
  AccessRequirements: Requirement[] | null;
  HeistBonuses?: string[] | null;
}

const recipe = recipeGetter<ThievingRecipe>('ThievingRecipe');
interface Mod { Stat: { StatsType: string; Name: string }; Value: number }
interface Unlockable { Id: string; Bonuses: Mod[]; Requirements: Requirement[] | null }

/**
 * Bonuses for one target: the global ones, plus its location's distractions once bought (they apply to every target
 * there) and the target's own heist bonuses once their requirement (e.g. finding a key) is met, as on the desktop.
 */
function bonus(game: Game, r: ThievingRecipe) {
  const base = bonusReader(game, 'ThievingAction', { ...recipeContext(SKILL, r), recipeType: r.RecipeType });
  const loc = tryGet<{ AvailableDistractions?: string[] }>('ThievingLocation', r.Category ?? '');
  const sources = [
    ...(loc?.AvailableDistractions ?? []).map((d) => tryGet<Unlockable>('ThievingDistraction', d)),
    ...(r.HeistBonuses ?? []).map((h) => tryGet<Unlockable>('ThievingHeistBonus', h)),
  ].filter((u): u is Unlockable => !!u && !game.isDemoLocked(u.Requirements) && game.requirementsMet(u.Requirements));
  return (name: string) => {
    let v = base(name);
    for (const u of sources) for (const m of u.Bonuses) if (m.Stat.Name === name && m.Stat.StatsType === `${NS}ThievingAction`) v += m.Value;
    return v;
  };
}

/** Thieving distractions available at a location, with whether each is active. */
export function distractions(game: Game, locationId: string): { name: string; active: boolean; locked: boolean; bonuses: Mod[] }[] {
  const loc = tryGet<{ AvailableDistractions?: string[] }>('ThievingLocation', locationId);
  return (loc?.AvailableDistractions ?? [])
    .map((d) => tryGet<Unlockable & { DisplayName: string }>('ThievingDistraction', d))
    .filter((u): u is Unlockable & { DisplayName: string } => !!u)
    .map((u) => ({ name: u.DisplayName, locked: game.isDemoLocked(u.Requirements), active: !game.isDemoLocked(u.Requirements) && game.requirementsMet(u.Requirements), bonuses: u.Bonuses }));
}

/** Chance to succeed: (100 + stealth) / (100 + perception), where stealth is your Thieving level. */
export function successChance(game: Game, r: ThievingRecipe): number {
  const b = bonus(game, r);
  const stealth = Math.max(0, Math.floor((game.level(SKILL) + b('FlatStealth')) * (1 + b('PercentStealth'))));
  const perception = Math.max(0, Math.floor((r.Perception + b('FlatPerception')) * (1 + b('PercentPerception'))));
  return Math.min(1, (100 + stealth) / (100 + perception));
}

export const maxStages = (r: ThievingRecipe, game?: Game) => Math.max(1, r.Stages + (game ? bonus(game, r)('FlatStages') : 0));

export function stage(game: Game, id: string): number {
  return game.state.thieving.stage[id] ?? 1;
}

function rollDrop(game: Game, r: ThievingRecipe, table: Drop[]): void {
  if (!table.length) return;
  const b = bonus(game, r);
  const d = game.rng.weighted(table);
  // Fortune adds a percentage to every drop: floor(q x (1 + fortune / 100)).
  const fortune = b('FlatFortune') + (successChance(game, r) < 1 ? b('FlatFortuneUnderSuccess') : 0);
  const q = Math.floor(game.rng.intInclusive(d.MinQuantity, d.MaxQuantity) * (1 + fortune / 100));
  game.addItem(d.Item, game.rng.chance(b('DoublingChance')) ? q * 2 : q);
}

function loot(game: Game, r: ThievingRecipe): void {
  const b = bonus(game, r);
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  if (r.CurrencyReward && game.rng.chance(clamp(r.BaseCurrencyLootChance * (1 + b('PercentCurrencyLootChance'))))) {
    const scale = (x: number) => Math.max(0, Math.floor((x + b('FlatCurrencyReward')) * (1 + b('PercentCurrencyReward'))));
    game.addCurrency(r.CurrencyReward.Currency, game.rng.intInclusive(scale(r.CurrencyReward.MinQuantity), scale(r.CurrencyReward.MaxQuantity)));
  }
  if (game.rng.chance(clamp(r.BaseCommonLootChance * (1 + b('PercentCommonLootChance'))))) rollDrop(game, r, r.CommonDropTable);
  if (game.rng.chance(clamp(r.BaseRareLootChance * (1 + b('PercentRareLootChance'))))) rollDrop(game, r, r.RareDropTable);
}

export const thieving: SkillHandler = {
  skill: SKILL,
  recipes: () => recipeList(SKILL),
  recipe,
  interval: (game, id) => interval(game, recipe(id)),
  canStart(game, id) {
    const access = recipe(id).AccessRequirements;
    return access?.length && !game.requirementsMet(access) ? 'Equip a lockpick or key in the Thieving toolbelt' : null;
  },
  fire(game, id) {
    const r = recipe(id);
    const t = game.state.thieving;
    // A stun is its own timer: when it ends, nothing else happens this action.
    if (t.stunned) {
      t.stunned = false;
      return interval(game, r);
    }
    const b = bonus(game, r);
    if (!game.rng.chance(successChance(game, r))) {
      game.failed(SKILL, r.DisplayName);
      // Damage is a uniform roll from 1 to the target's Damage, unless a damage avoidance bonus dodges it.
      const died = r.Damage > 0 && !game.rng.chance(b('DamageAvoidanceChance')) && game.damage(game.rng.intInclusive(1, r.Damage));
      if (died) {
        game.stop('You were knocked out while thieving.');
        return null;
      }
      // A stun avoidance bonus lets you carry straight on.
      if (game.rng.chance(b('StunAvoidanceChance'))) return interval(game, r);
      t.stunned = true;
      return Math.max(250, Math.floor((BASE_STUN_INTERVAL + b('FlatStunInterval')) * (1 + b('PercentStunInterval'))));
    }
    loot(game, r);
    // Sometimes you also pickpocket every other target of the same type in the area (each needs its own success).
    if (game.rng.chance(b('SameAreaPickpocketChance'))) {
      for (const other of recipeList(SKILL).map((x) => recipe(x))) {
        if (other.Id === r.Id || other.Category !== r.Category || other.RecipeType !== r.RecipeType) continue;
        if (game.isDemoLocked(other.Requirements) || !game.requirementsMet(other.Requirements)) continue;
        if (game.rng.chance(successChance(game, other))) loot(game, other);
      }
    }
    questEvent(game, 'ThievingPickpocketTargetType', (d) => (goalMatches(d, 'TargetType', r.RecipeType) && goalMatches(d, 'Location', r.Category) ? 1 : 0));
    const s = stage(game, id) + (game.rng.chance(b('SkipStageChance')) ? 2 : 1);
    if (s > maxStages(r, game)) {
      rollDrop(game, r, r.CompletionDropTable);
      game.addXp(SKILL, r.BaseExperience);
      t.stage[id] = 1;
    } else {
      t.stage[id] = s;
    }
    return interval(game, r);
  },
};

export const recipeTypeOf = (r: SkillRecipe) => ((r as ThievingRecipe).RecipeType ?? '').replace(NS, '');

function interval(game: Game, r: ThievingRecipe): number {
  const b = bonus(game, r);
  return Math.max(250, Math.floor((r.BaseInterval + b('FlatInterval')) * (1 + b('PercentInterval'))));
}
