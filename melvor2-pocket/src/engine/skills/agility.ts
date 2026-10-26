import type { SkillHandler } from './types';

/** The demo ships no Agility courses or obstacles, so the skill exists but has nothing to train. */
export const agility: SkillHandler = {
  skill: 'Agility',
  recipes: () => [],
  recipe: () => {
    throw new Error('Agility has no content in the demo');
  },
  interval: () => 1000,
  canStart: () => 'Not in demo',
  fire: () => null,
};
