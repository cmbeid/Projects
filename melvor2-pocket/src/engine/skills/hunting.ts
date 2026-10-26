import { NS, all, configList, get, tryGet, type ItemQuantityChance } from '../content';
import type { Game } from '../game';
import type { HuntState } from '../state';
import { levelForXp } from '../xp';
import type { SkillHandler, SkillRecipe } from './types';
import { bonusReader } from './common';
import { goalMatches, questEvent } from '../quests';

const baseBonus = (game: Game, a: HuntingAnimal) => bonusReader(game, 'HuntingAction', { entity: SKILL, animal: NS + a.Id, location: a.Location });

interface Mod { Stat: { StatsType: string; Name: string }; Value: number }
interface ModBlock { Global?: Mod[]; Component?: Mod[] }
interface JournalBonus { UnlockLevel: number; JournalModifierTemplate: Mod[] }
interface TrapCap { TrapType: string; TrapBonuses: ModBlock | null; FailBonuses: ModBlock | null }

const trapCap = (item: string) => (tryGet<{ Capabilities: Record<string, unknown> | null }>('Item', item)?.Capabilities ?? {})[`${NS}HuntingTrap`] as TrapCap | undefined;
const block = (b: ModBlock | null | undefined) => [...(b?.Global ?? []), ...(b?.Component ?? [])];

/** Bait bonuses apply while the animal's toggle is on and its preferred bait is in the bank. */
export const usingBait = (game: Game, a: HuntingAnimal) => !!huntState(game, NS + a.Id).bait && !!a.PreferredBait && game.count(a.PreferredBait) > 0;

/**
 * The animal's own bonuses on top of the global ones, as on the desktop: journal-level templates, the trap in use (plus
 * its fail bonus once per failed attempt in a row), the bait, and the trap-less bonuses when hunting without a trap.
 */
function bonus(game: Game, a: HuntingAnimal) {
  const base = baseBonus(game, a);
  const id = NS + a.Id;
  const s = huntState(game, id);
  const mods: { m: Mod; times: number }[] = [];
  const level = journalLevel(game, id);
  for (const j of all<JournalBonus>('HuntingJournalBonus')) if (level >= j.UnlockLevel) for (const m of j.JournalModifierTemplate) mods.push({ m, times: 1 });
  if (trapless(game, a)) {
    for (const m of a.TraplessBonuses ?? []) mods.push({ m: { Stat: { StatsType: `${NS}HuntingAction`, Name: m.Stat.Name }, Value: m.Value }, times: 1 });
  } else {
    const trap = trapsFor(game, a)[0];
    const cap = trap ? trapCap(trap) : undefined;
    for (const m of block(cap?.TrapBonuses)) mods.push({ m, times: 1 });
    if (s.trapFails) for (const m of block(cap?.FailBonuses)) mods.push({ m, times: s.trapFails });
  }
  if (usingBait(game, a)) for (const m of a.BaitModifierTemplate ?? []) mods.push({ m, times: 1 });
  return (name: string) => {
    let v = base(name);
    for (const { m, times } of mods) if (m.Stat.Name === name && m.Stat.StatsType === `${NS}HuntingAction`) v += m.Value * times;
    return v;
  };
}

const SKILL = 'Hunting';
/** After two failed surveys the third always finds tracks. */
const MAX_SURVEY_FAILS = 2;

export interface HuntingAnimal extends SkillRecipe {
  Location: string;
  TrapType: string;
  EnableTrapless: boolean;
  TraplessBonuses: { Stat: { Name: string }; Value: number }[] | null;
  AverageSize: number;
  AverageWeight: number;
  BaseJournalTrackingExperience: number;
  BaseJournalTrappingExperience: number;
  BaseMinTrackingSteps: number;
  BaseMaxTrackingSteps: number;
  BaseMinTrackInterval: number;
  BaseMaxTrackInterval: number;
  BaseMinTrapInterval: number;
  BaseMaxTrapInterval: number;
  BaseTrackSuccessChance: number;
  BaseTrapSuccessChance: number;
  Products: ItemQuantityChance[];
  SurveyingProducts: ItemQuantityChance[];
  RareSpecies: { Species: string; Weight: number }[];
  BaseRareSpeciesChance: number;
  PreferredBait?: string | null;
  BaitModifierTemplate?: { Stat: { StatsType: string; Name: string }; Value: number }[] | null;
}

interface HuntingLocation { Id: string; BaseSurveyInterval: number; BaseSurveyingExperience: number }
interface Species { Id: string; DisplayName: string; ExtraProducts: (ItemQuantityChance & { IsCollectable?: boolean })[] }
interface TrapCapability { TrapType: string }

const animal = (id: string) => get<HuntingAnimal>('HuntingAnimal', id);
const location = (id: string) => get<HuntingLocation>('HuntingLocation', id);

/** Journal level per animal uses the standard XP table (a discovered animal has been trapped once). */
export function journalLevel(game: Game, id: string): number {
  return levelForXp(game.state.hunting[id]?.journalXp ?? 0, 99);
}

export function huntState(game: Game, id: string): HuntState {
  return (game.state.hunting[id] ??= {
    phase: 'idle', surveyFails: 0, step: 0, requiredSteps: 0, species: null, journalXp: 0, trapped: 0,
  });
}

const discovered = (s: HuntState) => s.trapped > 0;

/** Trap items in the bank that fit this animal, cheapest first in data order. */
export function trapsFor(game: Game, a: HuntingAnimal): string[] {
  return all<{ Id: string; Capabilities: Record<string, unknown> | null }>('Item')
    .filter((i) => (i.Capabilities?.[`${NS}HuntingTrap`] as TrapCapability | undefined)?.TrapType === a.TrapType)
    .map((i) => NS + i.Id)
    .filter((id) => game.count(id) > 0);
}

function trapless(game: Game, a: HuntingAnimal): boolean {
  return a.EnableTrapless && trapsFor(game, a).length === 0;
}

export function trapChance(game: Game, a: HuntingAnimal): number {
  return Math.min(1, Math.max(0, a.BaseTrapSuccessChance + bonus(game, a)('FlatTrappingSuccessChance')));
}

/** Tracking and trapping intervals with their Flat/Percent bonuses. */
function trackInterval(game: Game, a: HuntingAnimal): number {
  const b = bonus(game, a);
  const both = b('PercentTrackingInterval');
  const min = Math.max(250, a.BaseMinTrackInterval * (1 + b('PercentMinTrackingInterval') + both));
  const max = Math.max(min, (a.BaseMaxTrackInterval + b('FlatMaxTrackingInterval')) * (1 + b('PercentMaxTrackingInterval') + both));
  return game.rng.range(min, max);
}

function trapInterval(game: Game, a: HuntingAnimal): number {
  return Math.max(250, game.rng.range(a.BaseMinTrapInterval, a.BaseMaxTrapInterval) * (1 + bonus(game, a)('PercentTrappingInterval')));
}

const surveyInterval = (game: Game, a: HuntingAnimal) =>
  Math.max(250, location(a.Location).BaseSurveyInterval * (1 + bonus(game, a)('PercentSurveyInterval')));

function canHunt(game: Game, a: HuntingAnimal): boolean {
  return a.EnableTrapless || trapsFor(game, a).length > 0;
}

function resetTracking(game: Game, a: HuntingAnimal, s: HuntState): void {
  s.step = 0;
  s.failedThisHunt = false;
  s.surveyFails = 0;
  s.species = null;
  // Undiscovered animals are much harder to track.
  const steps = discovered(s) ? game.rng.intInclusive(a.BaseMinTrackingSteps, a.BaseMaxTrackingSteps) : a.BaseMaxTrackingSteps * 4;
  s.requiredSteps = Math.max(1, steps + bonus(game, a)('FlatTrackingSteps'));
}

function trap(game: Game, id: string, a: HuntingAnimal, s: HuntState, baited: boolean): void {
  s.journalXp += a.BaseJournalTrappingExperience;
  s.trapped++;
  s.trapFails = 0;
  questEvent(game, 'HuntingTrapAnimal', (d) =>
    goalMatches(d, 'Animal', NS + a.Id) &&
    goalMatches(d, 'Species', s.species ?? undefined) &&
    (!d.UsingBait || baited) &&
    !(d.WithoutFail && s.failedThisHunt)
      ? 1
      : 0,
  );
  questEvent(game, 'HuntingTrapAnimalLocation', (d) => (goalMatches(d, 'Location', a.Location) ? 1 : 0));
  if (s.species) (game.state.stats.raresFound ??= {})[s.species] = true;
  // Size/weight roll: each is uniform in [0.5, 1.3] + journal level / 100; rewards scale with their average.
  const j = journalLevel(game, id) / 100;
  const mult = (game.rng.range(0.5 + j, 1.3 + j) + game.rng.range(0.5 + j, 1.3 + j)) / 2;
  for (const p of a.Products) {
    if (!game.rng.chance(p.Chance)) continue;
    let q = Math.max(1, p.Quantity * mult);
    if (game.rng.chance(bonus(game, a)('DoublingChance'))) q *= 2;
    if (s.species) q *= 2;
    game.addItem(p.Item, Math.max(1, Math.floor(q)));
  }
  if (s.species) {
    const sp = get<Species>('HuntingAnimalSpecies', s.species);
    game.notice(`Rare species: ${sp.DisplayName}!`);
    for (const p of sp.ExtraProducts) if (game.rng.chance(p.Chance)) game.addItem(p.Item, p.Quantity);
  }
  game.addXp(SKILL, a.BaseExperience * mult);
}

export const hunting: SkillHandler = {
  skill: SKILL,
  recipes: () => configList(SKILL, 'Animals'),
  recipe: (id) => animal(id),
  interval: (game, id) => surveyInterval(game, animal(id)),
  canStart: (game, id) => (canHunt(game, animal(id)) ? null : 'Needs a trap'),
  fire(game, id) {
    const a = animal(id);
    const s = huntState(game, id);
    const loc = location(a.Location);
    if (s.phase === 'idle') {
      resetTracking(game, a, s);
      s.phase = 'surveying';
    }
    if (s.phase === 'surveying') {
      game.addXp(SKILL, loc.BaseSurveyingExperience);
      for (const p of a.SurveyingProducts) if (game.rng.chance(p.Chance)) game.addItem(p.Item, p.Quantity);
      if (s.surveyFails >= MAX_SURVEY_FAILS || game.rng.chance(a.BaseTrackSuccessChance)) {
        s.phase = 'tracking';
        if (a.RareSpecies.length && game.rng.chance(a.BaseRareSpeciesChance + bonus(game, a)('IncreasedRareSpeciesChance'))) {
          s.species = game.rng.weighted(a.RareSpecies).Species;
        }
      } else {
        s.surveyFails++;
        return surveyInterval(game, a);
      }
    } else if (s.phase === 'tracking') {
      if (discovered(s)) s.journalXp += a.BaseJournalTrackingExperience;
      s.step += s.requiredSteps - s.step > 1 && game.rng.chance(bonus(game, a)('SkipTrackingStepChance')) ? 2 : 1;
      if (s.step >= s.requiredSteps) s.phase = 'trapping';
    } else {
      const traps = trapsFor(game, a);
      // Roll with this attempt's bonuses (trap, bait, fail streak) before anything is used up.
      const chance = trapChance(game, a);
      const keepTrap = bonus(game, a)('PreservationChance');
      if (!a.EnableTrapless || traps.length) {
        if (!traps.length) {
          game.stop('You ran out of traps.');
          return null;
        }
        if (!game.rng.chance(keepTrap)) game.removeItem(traps[0], 1);
      }
      const baited = usingBait(game, a);
      if (baited) game.removeItem(a.PreferredBait!, 1);
      if (game.rng.chance(chance)) {
        trap(game, id, a, s, baited);
        s.phase = 'idle';
        if (!canHunt(game, a)) {
          game.stop('You ran out of traps.');
          return null;
        }
        resetTracking(game, a, s);
        s.phase = 'surveying';
        return surveyInterval(game, a);
      }
      game.failed(SKILL, `${a.DisplayName} escaped`);
      s.failedThisHunt = true;
      s.trapFails = (s.trapFails ?? 0) + 1;
      // Usually the animal flees and must be tracked further; a reattempt bonus lets you try the trap again at once.
      if (!game.rng.chance(bonus(game, a)('TrappingReattemptChance'))) {
        s.requiredSteps += a.BaseMinTrackingSteps;
        s.phase = 'tracking';
      }
    }
    if (s.phase === 'trapping') return trapInterval(game, a);
    return trackInterval(game, a);
  },
};

export const huntingLocations = () => configList(SKILL, 'Locations');
