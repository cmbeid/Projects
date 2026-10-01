/**
 * The farmer's own progress: tool tiers the blacksmith makes, skills that
 * level up with use, and the perks picked at skill levels 5 and 10.
 */
export type UpgradableTool = 'hoe' | 'can';

export const TOOL_TIERS = ['Basic', 'Copper', 'Steel', 'Gold'] as const;

export interface UpgradeCost {
  gold: number;
  items: Record<string, number>;
}

/** What it costs to reach each tier from the one before. */
export const UPGRADE_COSTS: readonly (UpgradeCost | null)[] = [
  null,
  { gold: 500, items: { 'hard-stone': 5 } },
  { gold: 1500, items: { 'metal-coat': 5, 'iron-bar': 1 } },
  { gold: 4000, items: { nugget: 3, 'gold-bar': 1 } },
];

/** Watering can capacity at each tier. */
export const CAN_CAPACITY = [20, 30, 40, 60] as const;

export const TOOL_TEXT: Record<UpgradableTool, readonly string[]> = {
  hoe: ['Tills one tile.', 'Tills three tiles in a row.', 'Tills a 3 × 3 square.', 'Tills a 3 × 3 square for less energy.'],
  can: ['Waters one tile; holds 20.', 'Waters three tiles in a row; holds 30.', 'Waters a 3 × 3 square; holds 40.', 'Waters a 3 × 3 square for less energy; holds 60.'],
};

export type Skill = 'farming' | 'battling' | 'crafting';
export const SKILLS: readonly Skill[] = ['farming', 'battling', 'crafting'];

/** Total XP to reach each level, from level 1. */
export const SKILL_XP = [0, 0, 60, 150, 280, 450, 680, 980, 1360, 1830, 2400] as const;
export const MAX_SKILL = 10;

export function skillLevel(xp: number): number {
  let level = 1;
  while (level < MAX_SKILL && xp >= SKILL_XP[level + 1]!) level += 1;
  return level;
}

export interface Perk {
  id: string;
  name: string;
  text: string;
}

/** The two perks offered at each skill's level 5 and level 10. */
export const PERKS: Record<Skill, Record<5 | 10, readonly [Perk, Perk]>> = {
  farming: {
    5: [
      { id: 'green-thumb', name: 'Green Thumb', text: 'Twice the chance of an extra berry at harvest.' },
      { id: 'hardy', name: 'Hardy', text: 'Tool work costs 1 less energy.' },
    ],
    10: [
      { id: 'berry-master', name: 'Berry Master', text: 'Berries sell for 20% more.' },
      { id: 'deep-can', name: 'Deep Can', text: 'Your watering can holds twice as much.' },
    ],
  },
  crafting: {
    5: [
      { id: 'artisan', name: 'Artisan', text: 'Juice, jam, cheese and cloth sell for 25% more.' },
      { id: 'tinkerer', name: 'Tinkerer', text: 'Your machines work 25% faster.' },
    ],
    10: [
      { id: 'master-chef', name: 'Master Chef', text: 'Dishes restore twice the energy.' },
      { id: 'bulk', name: 'Bulk', text: 'Machines sometimes make two instead of one.' },
    ],
  },
  battling: {
    5: [
      { id: 'trainer', name: 'Trainer', text: 'Your Pokémon earn 25% more XP.' },
      { id: 'catcher', name: 'Catcher', text: 'Balls are half again as likely to work.' },
    ],
    10: [
      { id: 'ace', name: 'Ace', text: 'Your Pokémon deal 15% more damage.' },
      { id: 'tamer', name: 'Tamer', text: 'Berries you offer wild Pokémon count double.' },
    ],
  },
};

export const SKILL_TEXT: Record<Skill, string> = {
  farming: 'Grows as you till, water and harvest. Each level adds 3 to your max energy.',
  battling: 'Grows as your Pokémon win battles and you befriend wild ones.',
  crafting: 'Grows as you craft, cook and collect from machines. Higher levels unlock new recipes.',
};
