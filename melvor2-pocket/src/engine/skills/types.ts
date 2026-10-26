import type { Game } from '../game';
import type { Requirement } from '../content';

export interface SkillRecipe {
  Id: string;
  DisplayName: string;
  Category?: string;
  BaseExperience: number;
  Requirements: Requirement[] | null;
  DisplayRequirements: Requirement[] | null;
}

export interface SkillHandler {
  skill: string;
  /** Recipe ids in the game's display order. */
  recipes(): string[];
  recipe(id: string): SkillRecipe;
  /** Interval in ms for the next action on this recipe. */
  interval(game: Game, id: string): number;
  canStart?(game: Game, id: string): string | null;
  /** Perform one action. Returns the next interval in ms, or null to stop. */
  fire(game: Game, id: string): number | null;
}
