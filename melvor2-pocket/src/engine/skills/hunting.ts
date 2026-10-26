import { NS, all, configList, get, type ItemQuantityChance } from '../content';
import type { Game } from '../game';
import type { HuntState } from '../state';
import { levelForXp } from '../xp';
import type { SkillHandler, SkillRecipe } from './types';
import { bonusReader } from './common';

const bonus = (game: Game, a: HuntingAnimal) => bonusReader(game, 'HuntingAction', { entity: SKILL, animal: NS + a.Id, location: a.Location });

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
  let c = a.BaseTrapSuccessChance + bonus(game, a)('FlatTrappingSuccessChance');
  if (trapless(game, a)) {
    for (const b of a.TraplessBonuses ?? []) if (b.Stat.Name === 'FlatTrappingSuccessChance') c += b.Value;
  }
  return Math.min(1, Math.max(0, c));
}

function canHunt(game: Game, a: HuntingAnimal): boolean {
  return a.EnableTrapless || trapsFor(game, a).length > 0;
}

function resetTracking(game: Game, a: HuntingAnimal, s: HuntState): void {
  s.step = 0;
  s.surveyFails = 0;
  s.species = null;
  s.requiredSteps = discovered(s)
    ? game.rng.intInclusive(a.BaseMinTrackingSteps, a.BaseMaxTrackingSteps)
    : a.BaseMaxTrackingSteps * 4; // undiscovered animals are much harder to track
}

function trap(game: Game, id: string, a: HuntingAnimal, s: HuntState): void {
  s.journalXp += a.BaseJournalTrappingExperience;
  s.trapped++;
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
  interval: (_game, id) => location(animal(id).Location).BaseSurveyInterval,
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
        if (a.RareSpecies.length && game.rng.chance(a.BaseRareSpeciesChance)) s.species = game.rng.weighted(a.RareSpecies).Species;
      } else {
        s.surveyFails++;
        return loc.BaseSurveyInterval;
      }
    } else if (s.phase === 'tracking') {
      if (discovered(s)) s.journalXp += a.BaseJournalTrackingExperience;
      s.step += s.requiredSteps - s.step > 1 && game.rng.chance(bonus(game, a)('SkipTrackingStepChance')) ? 2 : 1;
      if (s.step >= s.requiredSteps) s.phase = 'trapping';
    } else {
      const traps = trapsFor(game, a);
      if (!a.EnableTrapless || traps.length) {
        if (!traps.length) {
          game.stop('You ran out of traps.');
          return null;
        }
        if (!game.rng.chance(bonus(game, a)('PreservationChance'))) game.removeItem(traps[0], 1);
      }
      if (game.rng.chance(trapChance(game, a))) {
        trap(game, id, a, s);
        s.phase = 'idle';
        if (!canHunt(game, a)) {
          game.stop('You ran out of traps.');
          return null;
        }
        resetTracking(game, a, s);
        s.phase = 'surveying';
        return loc.BaseSurveyInterval;
      }
      game.failed(SKILL, `${a.DisplayName} escaped`);
      // The animal flees: track it further (reattempt chance is base 0).
      s.requiredSteps += a.BaseMinTrackingSteps;
      s.phase = 'tracking';
    }
    if (s.phase === 'trapping') return game.rng.range(a.BaseMinTrapInterval, a.BaseMaxTrapInterval);
    return game.rng.range(a.BaseMinTrackInterval, a.BaseMaxTrackInterval);
  },
};

export const huntingLocations = () => configList(SKILL, 'Locations');
