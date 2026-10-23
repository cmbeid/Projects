import type { GuildId } from '../data/meta';
import type { PlotKind } from '../data/special';
import type { CombatStyle, GameMode, Mods, Qty, SkillId, Slot } from '../data/types';

export interface Stack {
  item: string;
  qty: number;
}

export type Equipment = Partial<Record<Slot, Stack>>;

export interface Plot {
  seed: string | null;
  plantedAt: number;
  /** 0 none, 1 compost, 2 rich compost. */
  compost: 0 | 1 | 2;
}

export interface Pen {
  animal: string | null;
  count: number;
  progress: number;
}

export type Activity =
  | { kind: 'skill'; action: string; progress: number; stun: number }
  | { kind: 'agility'; index: number; progress: number }
  | { kind: 'survey'; hex: string; progress: number }
  | { kind: 'combat' };

export type MeleeStyle = 'accurate' | 'aggressive' | 'defensive';
export type RangedStyle = 'accurate' | 'rapid' | 'longrange';
export type MagicStyle = 'magic' | 'defensive';

export interface Enemy {
  id: string;
  hp: number;
  maxHp: number;
  timer: number;
}

export interface CombatState {
  area: string;
  /** Position in a dungeon's monster list, or the picked monster in an open area. */
  index: number;
  /** In open areas, which monster to fight. */
  target: string | null;
  enemy: Enemy | null;
  playerTimer: number;
  respawn: number;
  regenTimer: number;
  stun: number;
  /** Damage this kill, for the log. */
  kills: number;
}

export interface RaidState {
  style: CombatStyle;
  wave: number;
  killed: number;
  boons: string[];
  /** Waiting on the player to pick one of these after a wave. */
  choice: string[] | null;
  food: number;
  hp: number;
}

export interface Buff {
  id: string;
  name: string;
  mods: Mods;
  until: number;
}

export interface Notice {
  t: number;
  text: string;
  kind: 'info' | 'level' | 'loot' | 'bad' | 'good';
}

export interface Settings {
  sound: boolean;
  confirmSell: boolean;
  offlineReport: boolean;
}

export interface GameState {
  version: number;
  rng: number;
  mode: GameMode;
  name: string;
  createdAt: number;
  /** The game clock. Advances with play, offline too. */
  time: number;
  savedAt: number;
  dead: boolean;

  gp: number;
  slayerCoins: number;
  raidCoins: number;
  xp: Record<SkillId, number>;
  /** Adventure mode: skills bought so far. Ignored otherwise. */
  unlocked: SkillId[];
  /** Ancient Relics mode: relics found per skill. */
  relics: Partial<Record<SkillId, number>>;

  bank: Record<string, number>;
  /** Bank order, by first time each item went in. */
  bankOrder: string[];
  locked: string[];
  found: Record<string, 1>;

  hp: number;
  prayerPoints: number;
  loadouts: Equipment[];
  loadout: number;
  food: (Stack | null)[];
  foodSlot: number;
  prayers: string[];
  spell: string | null;
  aurora: string | null;
  meleeStyle: MeleeStyle;
  rangedStyle: RangedStyle;
  magicStyle: MagicStyle;
  /** Active potion per skill (or 'combat'), with charges left. */
  potions: Partial<Record<SkillId | 'combat', { item: string; charges: number }>>;

  activity: Activity | null;
  combat: CombatState | null;
  loot: Stack[];
  slayerTask: { monster: string; left: number; total: number; tier: string } | null;
  raid: RaidState | null;
  raidBest: number;

  farm: Record<PlotKind, Plot[]>;
  course: (string | null)[];
  pillar: string | null;
  stars: Record<string, number[]>;
  map: Record<string, number>;
  surveyed: string[];
  surveyTarget: string | null;
  donated: string[];
  settlement: Record<string, number>;
  settleFrac: Record<string, number>;
  ranch: Pen[];

  guilds: Partial<Record<GuildId, { rep: number; claimed: string[] }>>;
  quests: string[];
  pets: string[];
  upgrades: Record<string, number>;
  counters: Record<string, number>;
  buffs: Buff[];
  /** Permanent bonuses earned once (quests, landmarks). */
  earned: Mods[];

  log: Notice[];
  settings: Settings;
}

export type { Qty };
