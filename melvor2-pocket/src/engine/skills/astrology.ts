import { configList, get, type Requirement } from '../content';
import type { Game } from '../game';
import type { SkillHandler, SkillRecipe } from './types';
import { mod } from '../bonuses';

const SKILL = 'Astrology';

export interface Constellation extends SkillRecipe {
  BaseInterval: number;
  BaseKnowledge: number;
  MinorNodeUnlockKnowledge: number[];
  MinorNodes: string[];
  MajorNodes: string[];
  MinorNodesPerMajorNode: number;
  SecondaryRequirements: Requirement[] | null;
}

/** Major nodes picked for a constellation. */
export const unlockedMajorNodes = (game: Game, id: string) => game.state.astrology.major?.[id] ?? [];

/** Picks still to make: one for every MinorNodesPerMajorNode minor nodes unlocked (ActiveAstrologyConstellation). */
export function availableMajorPicks(game: Game, id: string): number {
  const c = constellation(id);
  const per = Math.max(1, c.MinorNodesPerMajorNode || 1);
  return Math.max(0, Math.floor(unlockedMinorNodes(game, id).length / per) - unlockedMajorNodes(game, id).length);
}

export function unlockMajorNode(game: Game, id: string, node: string): string | null {
  const c = constellation(id);
  if (!c.MajorNodes.includes(node) || unlockedMajorNodes(game, id).includes(node)) return 'Already unlocked';
  if (availableMajorPicks(game, id) <= 0) return 'Unlock more minor nodes first';
  const n = get<AstrologyNode>('AstrologyNode', node);
  if (!game.requirementsMet(n.UnlockRequirements ?? null)) return 'Locked';
  ((game.state.astrology.major ??= {})[id] ??= []).push(node);
  game.bonusesChanged();
  game.emit();
  return null;
}

export interface AstrologyNode {
  Id: string;
  DisplayName: string;
  NodeType: string;
  Description?: string | null;
  UnlockRequirements?: Requirement[] | null;
  Bonuses: { Global: unknown[]; Component: { Stat: { StatsType: string; Name: string }; Value: number; LocalContext?: unknown }[] };
}

const constellation = (id: string) => get<Constellation>('AstrologyConstellation', id);

export function knowledge(game: Game, id: string): number {
  return game.state.astrology.knowledge[id] ?? 0;
}

/** Minor nodes unlocked so far: one per knowledge threshold reached. */
export function unlockedMinorNodes(game: Game, id: string): string[] {
  const c = constellation(id);
  const k = knowledge(game, id);
  const n = c.MinorNodeUnlockKnowledge.filter((t) => k >= t).length;
  return c.MinorNodes.slice(0, n);
}

export const astrology: SkillHandler = {
  skill: SKILL,
  recipes: () => configList(SKILL, 'Constellations'),
  recipe: constellation,
  interval: (_game, id) => Math.floor(constellation(id).BaseInterval),
  // Each constellation also needs its secondary requirements (e.g. Deedree: Woodcutting 8 or Farming 6) to study it.
  canStart(game, id) {
    const req = constellation(id).SecondaryRequirements;
    return req?.length && !game.requirementsMet(req) ? 'Requirements not met' : null;
  },
  fire(game, id) {
    const c = constellation(id);
    const before = unlockedMinorNodes(game, id).length;
    const gain = c.BaseKnowledge * (1 + mod(game, 'AstrologyAction', 'PercentKnowledge', { entity: SKILL, constellation: id }));
    game.state.astrology.knowledge[id] = knowledge(game, id) + gain;
    game.addXp(SKILL, c.BaseExperience);
    if (unlockedMinorNodes(game, id).length > before) {
      game.notice(`${c.DisplayName}: a new star node is unlocked`);
      game.bonusesChanged();
    }
    return Math.floor(c.BaseInterval);
  },
};
