// The Mastery Guild: per-skill tasks that are all active at once. A finished task adds its category's points
// (Novice 1, Easy 2, …); a skill's rank is the highest whose share of the skill's total task points is reached
// (MasteryGuildComponent: ceil(total × PointPercentRequired)). Ranks unlock MasteryGuildBonus rewards.
import { NS, configList, get, tryGet, type Requirement } from './content';
import type { Game } from './game';

export interface GuildGoal {
  Type: string;
  Data: Record<string, unknown> & { Id?: string; MaxProgress?: number; Conditions?: Requirement[] | null; Component?: { Entity: string } };
}
export interface GuildTask {
  Id: string;
  CustomDescription: string | null;
  Category: string;
  Goal: GuildGoal | null;
  ConditionGoal: GuildGoal | null;
  TriggerGoal: GuildGoal | null;
}
export interface GuildCategory { Id: string; DisplayName: string; BasePoints: number; Requirements: Requirement[] | null }
export interface GuildRank { Id: string; DisplayName: string; PointPercentRequired: number }
export interface GuildBonus {
  Id: string;
  DisplayName: string;
  Requirements: Requirement[] | null;
  CustomDescription: string | null;
  Rewards: { Bonuses: { Global?: unknown[]; Component?: unknown[] } | null };
}

/** What a combat event happened under, for goal conditions like "enemy level 25–49" or "using Crush". */
export interface GoalContext { enemyLevel?: number; style?: string; stance?: string; onSlayerTask?: boolean; prayerCost?: number }

let skillsCache: string[] | null = null;
/** Skills with a guild (those whose config lists tasks). */
export function guildSkills(): string[] {
  return (skillsCache ??= [
    'Woodcutting', 'Fishing', 'Mining', 'Firemaking', 'Cooking', 'Smithing', 'Fletching', 'Crafting', 'Runecrafting', 'Thieving',
    'Farming', 'Ranching', 'Hunting', 'Beastcrafting', 'Attack', 'Strength', 'Defence', 'Hitpoints', 'Ranged', 'Magic', 'Prayer', 'Slayer',
  ].filter((s) => configList(s, 'MasteryGuildTasks').length));
}

const taskCache = new Map<string, GuildTask[]>();
export function tasksFor(skill: string): GuildTask[] {
  let t = taskCache.get(skill);
  if (!t) taskCache.set(skill, (t = configList(skill, 'MasteryGuildTasks').map((id) => get<GuildTask>('MasteryGuildTask', id))));
  return t;
}

let byGoal: Map<string, { skill: string; task: GuildTask }[]> | null = null;
function tasksByGoalType() {
  if (!byGoal) {
    byGoal = new Map();
    for (const skill of guildSkills()) {
      for (const task of tasksFor(skill)) {
        if (!task.Goal) continue;
        const list = byGoal.get(task.Goal.Type) ?? [];
        list.push({ skill, task });
        byGoal.set(task.Goal.Type, list);
      }
    }
  }
  return byGoal;
}

export const category = (id: string) => get<GuildCategory>('MasteryGuildCategory', id);
export const ranksFor = (skill: string) =>
  configList(skill, 'MasteryGuildRanks')
    .map((id) => get<GuildRank>('MasteryGuildRank', id))
    .sort((a, b) => a.PointPercentRequired - b.PointPercentRequired);
export const bonusesFor = (skill: string) => configList(skill, 'MasteryGuildBonuses').map((id) => get<GuildBonus>('MasteryGuildBonus', id));

export const taskKey = (t: GuildTask) => NS + t.Id;
export const isDone = (game: Game, t: GuildTask) => !!game.state.guild.done[taskKey(t)];
export const taskProgress = (game: Game, t: GuildTask) => game.state.guild.progress[taskKey(t)] ?? 0;

export function categoryOpen(game: Game, categoryId: string): boolean {
  const c = category(categoryId);
  return !game.isDemoLocked(c.Requirements) && game.requirementsMet(c.Requirements);
}

/** Every task counts towards the total, including categories the demo locks (as in the game). */
export function totalPoints(skill: string): number {
  return tasksFor(skill).reduce((s, t) => s + category(t.Category).BasePoints, 0);
}

export function points(game: Game, skill: string): number {
  return tasksFor(skill).reduce((s, t) => s + (isDone(game, t) ? category(t.Category).BasePoints : 0), 0);
}

export const pointsForRank = (skill: string, r: GuildRank) => Math.ceil(totalPoints(skill) * r.PointPercentRequired);

export function rankIndex(game: Game, skill: string): number {
  const ranks = ranksFor(skill);
  const p = points(game, skill);
  let i = 0;
  while (i + 1 < ranks.length && p >= pointsForRank(skill, ranks[i + 1])) i++;
  return i;
}

/** Combat goal conditions. Anything this build doesn't model (ward, armour…) counts as not met. */
function conditionsMet(game: Game, conds: Requirement[] | null | undefined, ctx: GoalContext): boolean {
  for (const c of conds ?? []) {
    const d = c.Data as Record<string, unknown>;
    switch (c.Type.replace(NS, '')) {
      case 'EnemyCombatLevelCondition': {
        const lvl = ctx.enemyLevel ?? -1;
        if (lvl < Number(d.MinCombatLevel ?? 0) || lvl > Number(d.MaxCombatLevel ?? Infinity)) return false;
        break;
      }
      case 'CharacterUsingCombatStyle':
        if (ctx.style !== d.Style) return false;
        break;
      case 'CharacterUsingStance':
        if (ctx.stance !== d.Stance) return false;
        break;
      case 'FightingSlayerTask':
        if (!ctx.onSlayerTask) return false;
        break;
      case 'TotalPrayerCostActive':
        if ((ctx.prayerCost ?? 0) < Number(d.MinBaseTotalCost ?? 1)) return false;
        break;
      default:
        if (!game.requirementMet(c)) return false;
    }
  }
  return true;
}

function finish(game: Game, skill: string, t: GuildTask): void {
  const before = rankIndex(game, skill);
  game.state.guild.done[taskKey(t)] = true;
  game.notice(`Mastery task done: ${describeTask(t)}`);
  const after = rankIndex(game, skill);
  if (after > before) {
    game.notice(`${skill} guild rank: ${ranksFor(skill)[after].DisplayName}!`);
    game.bonusesChanged();
  }
}

/** Whether a task's condition and trigger parts hold right now (its progress goal is checked separately). */
function extrasMet(game: Game, t: GuildTask): boolean {
  if (t.ConditionGoal && !goalStateMet(game, t.ConditionGoal)) return false;
  if (t.TriggerGoal && !goalStateMet(game, t.TriggerGoal)) return false;
  return true;
}

/** Condition and trigger goals, evaluated against the current state. */
function goalStateMet(game: Game, g: GuildGoal): boolean {
  const d = g.Data;
  switch (g.Type.replace(NS, '')) {
    case 'RanchingAnimalStatistic':
      return (game.state.stats.ranchHoursAlive?.[String(d.Animal)] ?? 0) >= Number(d.Value ?? 1);
    case 'HuntingMaxLevelAnimals': {
      const levelNeeded = Number(d.Level ?? 1);
      const animals = Object.values(game.state.hunting).filter((h) => game.levelForJournalXp(h.journalXp) >= levelNeeded).length;
      return animals >= Number(d.Count ?? 1);
    }
    case 'HuntingUniqueRareSpeciesFound':
      return Object.keys(game.state.stats.raresFound ?? {}).length >= Number(d.Count ?? 1);
    case 'RanchingSameAnimalCount': {
      const n = game.state.ranching.animals.filter((a) => a.animal === d.Animal).length;
      return n >= Number(d.MinimumCount ?? 1);
    }
    case 'EquipmentItemEquipped':
      return Object.values(game.state.equipment).some((e) => e.item === d.Item);
    case 'ToolbeltItemEquipped':
      return game.toolbeltHas(String(d.Item), 1);
    default:
      // Level, ItemStatistic, SlayerMasterStatistic… are ordinary requirements.
      return game.requirementMet(g as unknown as Requirement);
  }
}

/** Progress every open task whose goal is `type`; `amount` says how much this event counts for a goal. */
export function guildEvent(game: Game, type: string, amount: (data: GuildGoal['Data']) => number, ctx: GoalContext = {}): void {
  const list = tasksByGoalType().get(NS + type);
  if (!list) return;
  for (const { skill, task } of list) {
    if (isDone(game, task) || !categoryOpen(game, task.Category)) continue;
    const g = task.Goal!;
    if (!conditionsMet(game, g.Data.Conditions, ctx)) continue;
    const n = amount(g.Data);
    if (n <= 0) continue;
    const key = taskKey(task);
    const max = Number(g.Data.MaxProgress ?? 1);
    game.state.guild.progress[key] = Math.min(max, taskProgress(game, task) + n);
    if (game.state.guild.progress[key] >= max && extrasMet(game, task)) finish(game, skill, task);
  }
}

/** Finish tasks whose remaining parts are state checks (levels, items owned, equipped gear…). Cheap enough to call often. */
export function checkGuild(game: Game): void {
  for (const skill of guildSkills()) {
    for (const t of tasksFor(skill)) {
      if (isDone(game, t) || !categoryOpen(game, t.Category)) continue;
      const goalDone = !t.Goal || taskProgress(game, t) >= Number(t.Goal.Data.MaxProgress ?? 1);
      if (goalDone && (t.ConditionGoal || t.TriggerGoal || !t.Goal) && extrasMet(game, t)) finish(game, skill, t);
    }
  }
}

/** Rank bonuses currently earned (fed into the bonus system). */
export function guildBonuses(game: Game): GuildBonus[] {
  return guildSkills().flatMap((s) => bonusesFor(s).filter((b) => game.requirementsMet(b.Requirements)));
}

/** Rank requirement check for MelvorBase:MasteryGuildRank. */
export function hasRank(game: Game, skill: string, rankId: string): boolean {
  const i = ranksFor(skill).findIndex((r) => NS + r.Id === rankId);
  return i >= 0 && rankIndex(game, skill) >= i;
}

// ---- descriptions -----------------------------------------------------------------------------

const name = (type: string, id: unknown) => {
  if (!id) return '';
  const o = tryGet<{ DisplayName?: string | { Singular: string } }>(type, String(id));
  const n = o?.DisplayName;
  return typeof n === 'string' ? n : n?.Singular ?? String(id).replace(NS, '').replace(/([a-z])([A-Z])/g, '$1 $2');
};
const any = (...xs: string[]) => xs.find(Boolean) ?? '';

/** Plain-language task text from its goal data (the demo's CustomDescription is a placeholder). */
export function describeTask(t: GuildTask): string {
  const g = t.Goal ?? t.ConditionGoal ?? t.TriggerGoal;
  if (!g) return t.Id;
  const d = g.Data;
  const n = Number(d.MaxProgress ?? d.Value ?? d.Level ?? 1).toLocaleString();
  const recipeName = (type: string) => any(name(type, d.Recipe), name('RecipeCategory', d.Category), name('RecipeSubcategory', d.Subcategory));
  switch (g.Type.replace(NS, '')) {
    case 'WoodcuttingCutTree': return `Cut ${n} ${any(name('WoodcuttingRecipe', d.Recipe), 'trees')}`;
    case 'WoodcuttingDamageTree': return `Deal ${n} damage to ${any(name('WoodcuttingRecipe', d.Recipe), 'trees')}`;
    case 'WoodcuttingInstantCut': return `Instantly cut ${n} trees`;
    case 'MiningMineRock': return `Mine ${n} ${any(name('MiningRecipe', d.Recipe), name('MiningRecipeCategory', d.Category), 'rocks')}`;
    case 'MiningEarlyBreak': return `Break ${n} rocks early`;
    case 'FishingFishRecipe': return `Fish ${n} times at ${any(name('FishingRecipe', d.Recipe), 'any spot')}`;
    case 'FiremakingBurnRecipe': return `Burn ${n} ${any(name('FiremakingRecipe', d.Recipe), 'logs')}`;
    case 'CookRecipe': return `Cook ${n} ${any(recipeName('CookingRecipe'), 'food')}`;
    case 'PreserveCookingItem': return `Preserve ${n} cooking ingredients`;
    case 'ArtisanCreateRecipe': return `Make ${n} ${any(recipeName('ArtisanRecipe'), 'items')}`;
    case 'ArtisanCreateRecipeGoalCategory': return `Make ${n} ${name('RecipeGoalCategory', d.GoalCategory)}`;
    case 'ArtisanCompleteStep': return `Complete ${n} crafting steps on ${any(recipeName('ArtisanRecipe'), 'anything')}`;
    case 'ArtisanSkipStep': return `Skip ${n} crafting steps`;
    case 'ArtisanPreserveItem': return `Preserve ${n} ${any(name('Item', d.Item), 'ingredients')}`;
    case 'FarmingHarvestRecipe': return `Harvest ${n} ${any(recipeName('FarmingRecipe'), 'crops')}`;
    case 'ThievingPickpocketTargetType': return `Steal from ${n} ${name('ThievingRecipeType', d.TargetType)}${d.Location ? ` in ${name('ThievingLocation', d.Location)}` : ''}`;
    case 'ActionGainItem': return `Get ${n} ${name('Item', d.Item)}`;
    case 'ActionGainItemValue': return `Gather items worth ${n} gold`;
    case 'HuntingTrapAnimal': return `Trap ${n} ${any(name('HuntingAnimal', d.Animal), 'animals')}${d.UsingBait ? ' using bait' : ''}`;
    case 'HuntingTrapAnimalLocation': return `Trap ${n} animals in ${name('HuntingLocation', d.Location)}`;
    case 'RanchingPetAnimal': return `Pet animals ${n} times`;
    case 'CombatKillEnemy': return `Defeat ${n} ${any(name('Enemy', d.Enemy), 'enemies')}`;
    case 'CombatDamageEnemy': return `Deal ${n} damage`;
    case 'CombatEvadeAttacks': return `Evade ${n} attacks`;
    case 'CombatSingleHitDamage': return `Hit ${n} times for ${d.MinDamage}+ damage`;
    case 'CombatHealFromAutoEat': return `Heal ${n} HP from auto-eating`;
    case 'SpendPrayerCurrency': return `Spend ${n} prayer points`;
    case 'Level': return `Reach ${name('SkillNavigationOption', d.Component && (d.Component as { Entity: string }).Entity)} level ${d.Level}`;
    case 'ItemStatistic': return `Get ${n} ${name('Item', d.Item)}`;
    case 'SlayerMasterStatistic': return `Complete ${n} tasks for ${name('SlayerMaster', d.Master)}`;
    case 'RanchingAnimalStatistic': return `Keep ${name('RanchingAnimal', d.Animal)} alive for ${n} hours`;
    case 'RanchingSameAnimalCount': return `Own ${d.MinimumCount} ${name('RanchingAnimal', d.Animal)}`;
    case 'EquipmentItemEquipped': return `Equip ${name('Item', d.Item)}`;
    case 'ToolbeltItemEquipped': return `Put ${name('Item', d.Item)} in the toolbelt`;
    case 'HuntingMaxLevelAnimals': return `Get ${d.Count} journal entr${Number(d.Count) === 1 ? 'y' : 'ies'} to level ${d.Level}`;
    case 'HuntingUniqueRareSpeciesFound': return `Find ${d.Count} rare species`;
    default: return g.Type.replace(NS, '').replace(/([a-z])([A-Z])/g, '$1 $2');
  }
}

/** Goal types this build can't progress (it doesn't model status effects, ward or lifesteal). */
export const UNSUPPORTED_GOALS = new Set(['CombatApplyEffect', 'CombatStealHitpoints', 'CombatDamageDealtByEffect', 'CombatDamageNegatedByWard'].map((t) => NS + t));
const UNSUPPORTED_CONDITIONS = new Set(['CharacterHasArmour', 'CharacterHasWard'].map((t) => NS + t));
/** False for tasks needing systems this build doesn't have: combat effects, ward/armour checks, or hunting bait. */
export const isSupported = (t: GuildTask) =>
  !t.Goal ||
  (!UNSUPPORTED_GOALS.has(t.Goal.Type) && !t.Goal.Data.UsingBait && !(t.Goal.Data.Conditions ?? []).some((c) => UNSUPPORTED_CONDITIONS.has(c.Type)));
