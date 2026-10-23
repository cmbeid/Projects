/**
 * The shapes every piece of content is written in. Content lives in
 * `src/data`; nothing in here knows how the game runs it.
 */

export const COMBAT_SKILLS = ['attack', 'strength', 'defence', 'hitpoints', 'ranged', 'magic', 'prayer', 'slayer'] as const;
export const NONCOMBAT_SKILLS = [
  'woodcutting', 'fishing', 'mining', 'firemaking', 'cooking', 'smithing', 'fletching', 'crafting',
  'runecrafting', 'herblore', 'thieving', 'farming', 'agility', 'summoning', 'astrology', 'cartography',
  'archaeology', 'construction', 'enchantment', 'ranching', 'hunting', 'beastcrafting',
] as const;
export const SKILLS = [...COMBAT_SKILLS, ...NONCOMBAT_SKILLS] as const;

export type CombatSkillId = (typeof COMBAT_SKILLS)[number];
export type SkillId = (typeof SKILLS)[number];

/** Melee splits three ways; ranged is all piercing; magic is elemental. Pure ignores reduction; void is the Rift's. */
export const DAMAGE_TYPES = ['stab', 'slash', 'crush', 'pierce', 'fire', 'water', 'earth', 'air', 'pure', 'void'] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export type CombatStyle = 'melee' | 'ranged' | 'magic';

export const SLOTS = ['weapon', 'shield', 'helmet', 'body', 'legs', 'boots', 'gloves', 'cape', 'amulet', 'ring', 'ammo', 'summon1', 'summon2'] as const;
export type Slot = (typeof SLOTS)[number];

/**
 * Modifiers are named numbers. A name is either global (`skillXP`) or scoped
 * with a colon (`interval:mining`). Every bonus source in the game — gear,
 * guilds, pets, stars, buildings — produces these, and `game/modifiers.ts`
 * sums them.
 */
export type Mods = Record<string, number>;

export type ItemCategory =
  | 'ore' | 'bar' | 'log' | 'fish' | 'food' | 'gem' | 'rune' | 'essence' | 'herb' | 'seed' | 'potion'
  | 'bone' | 'hide' | 'material' | 'weapon' | 'armour' | 'ammo' | 'jewelry' | 'cape' | 'tablet'
  | 'artefact' | 'chest' | 'animal' | 'misc' | 'currency';

export interface EquipStats {
  slot: Slot;
  /** Required levels to wear it. */
  req?: Partial<Record<SkillId, number>>;
  style?: CombatStyle;
  damageType?: DamageType;
  /** Milliseconds between swings. Weapons only. */
  speed?: number;
  twoHanded?: boolean;
  /** Accuracy bonus for the style the item is used with. */
  accuracy?: number;
  /** Strength bonus for melee or ranged; magic damage % for magic. */
  power?: number;
  /** Evasion bonuses. */
  defMelee?: number;
  defRanged?: number;
  defMagic?: number;
  /** Flat damage reduction %. */
  dr?: number;
  /** Fraction of damage of these types ignored. */
  resist?: Partial<Record<DamageType, number>>;
  /** For ammo: which weapon kind fires it. */
  ammoFor?: 'bow';
  mods?: Mods;
}

export interface Item {
  id: string;
  name: string;
  category: ItemCategory;
  sell: number;
  /** Atlas frame. */
  icon: string;
  desc?: string;
  equip?: EquipStats;
  /** HP restored when eaten (food) — as a flat number of hit points. */
  heal?: number;
  /** Prayer XP and points when buried. */
  bury?: number;
  /** Potions: which skill (or 'combat') they help, the modifiers, and charges. */
  potion?: { skill: SkillId | 'combat'; mods: Mods; charges: number };
  /** Summoning tablets: the familiar's skill, modifiers and charges per tablet. */
  familiar?: { skill: SkillId | 'combat'; mods: Mods; maxHit?: number };
  /** Chests: what they roll when opened. */
  opens?: LootTable;
}

export interface Qty {
  item: string;
  qty: number;
}

export interface LootEntry {
  item: string;
  min: number;
  max: number;
  weight: number;
}

export interface LootTable {
  /** Chance (0..1) that anything drops at all. */
  chance: number;
  entries: LootEntry[];
}

/**
 * One thing a skill can do on repeat: chop a tree, smelt a bar, pick a
 * pocket. Most non-combat skills are lists of these and nothing else.
 */
export interface SkillAction {
  id: string;
  skill: SkillId;
  name: string;
  level: number;
  /** Base milliseconds per action. */
  interval: number;
  xp: number;
  inputs: Qty[];
  outputs: Qty[];
  /** Rolled on every success, on top of `outputs`. */
  loot?: LootTable;
  gp?: [number, number];
  icon: string;
  /** One extra of the first output for every this-many levels above the requirement (runecrafting). */
  bonusPerLevels?: number;
  /** Thieving and cooking: base chance to succeed at the required level. */
  success?: number;
  /** Something else that must be true first, checked by `game/requirements.ts`. */
  unlock?: Requirement;
  /** Grouping in the UI (e.g. the metal for smithing). */
  group?: string;
}

export type Requirement =
  | { kind: 'level'; skill: SkillId; level: number }
  | { kind: 'quest'; quest: string }
  | { kind: 'poi'; poi: string }
  | { kind: 'dungeon'; dungeon: string }
  | { kind: 'item'; item: string };

export interface Monster {
  id: string;
  name: string;
  icon: string;
  combatLevel: number;
  hp: number;
  style: CombatStyle;
  damageType: DamageType;
  speed: number;
  maxHit: number;
  accuracy: number;
  evasion: { melee: number; ranged: number; magic: number };
  /** Fraction of incoming damage of each type it shrugs off (negative = weakness). */
  resist: Partial<Record<DamageType, number>>;
  dr: number;
  loot: LootTable;
  gp: [number, number];
  bones?: string;
  slayerLevel?: number;
  /** Chance per attack to land a special: a harder hit with a name. */
  special?: { name: string; chance: number; mult: number; stun?: boolean; heal?: number };
  boss?: boolean;
}

export type AreaKind = 'combat' | 'slayer' | 'dungeon' | 'stronghold' | 'abyss';

export interface Area {
  id: string;
  name: string;
  kind: AreaKind;
  icon: string;
  monsters: string[];
  req?: Requirement[];
  /** Slayer areas: an item that must be worn, or the area deals extra damage. */
  needsWorn?: string;
  /** Effect while fighting here. */
  hazard?: { desc: string; mods: Mods };
  /** Dungeons and strongholds: the reward for clearing the list in order. */
  reward?: Qty[];
  pet?: string;
  desc: string;
}

export interface Spell {
  id: string;
  name: string;
  level: number;
  maxHit: number;
  element: DamageType;
  runes: Qty[];
  icon: string;
}

export interface Aurora {
  id: string;
  name: string;
  level: number;
  runes: Qty[];
  mods: Mods;
}

export interface Prayer {
  id: string;
  name: string;
  level: number;
  /** Prayer points per attack while active. */
  cost: number;
  mods: Mods;
  icon: string;
}

export interface Pet {
  id: string;
  name: string;
  icon: string;
  /** Where it comes from: a skill (per action) or an area clear. */
  source: { skill: SkillId } | { area: string };
  /** 1 in N per action, scaled by action time; per clear for areas. */
  odds: number;
  mods: Mods;
  desc: string;
}

export interface QuestStep {
  kind: 'level' | 'item' | 'kill' | 'clear' | 'action';
  /** Skill for level/action, item, monster or area id. */
  target: string;
  qty: number;
}

export interface Quest {
  id: string;
  name: string;
  giver: string;
  story: string;
  steps: QuestStep[];
  req?: Requirement[];
  rewards: { gp?: number; items?: Qty[]; xp?: Partial<Record<SkillId, number>>; mods?: Mods; unlocks?: string };
}

export interface ShopEntry {
  id: string;
  name: string;
  icon: string;
  desc: string;
  cost: { gp?: number; slayerCoins?: number; raidCoins?: number; items?: Qty[] };
  /** What it gives: an item, an upgrade id (one-off), or a repeatable upgrade. */
  gives: { item: string; qty: number } | { upgrade: string; max?: number };
  req?: Requirement[];
  tab: 'general' | 'skilling' | 'gear' | 'slayer' | 'raid' | 'capes';
  /** Repeatable upgrades get more expensive each time: cost × growth^owned. */
  growth?: number;
}

export type GameMode = 'standard' | 'hardcore' | 'adventure' | 'relics';
