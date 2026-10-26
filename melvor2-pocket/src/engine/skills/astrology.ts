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
  SecondaryRequirements: Requirement[] | null;
}

export interface AstrologyNode {
  Id: string;
  DisplayName: string;
  NodeType: string;
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
