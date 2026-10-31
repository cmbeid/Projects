// Serialisable game state. Everything the simulation needs lives here so saves and offline replay are exact.
/** 2: progression gating. Older saves get every page unlocked (see Game constructor). */
export const SAVE_VERSION = 2;

export interface ActiveAction {
  skill: string;
  recipe: string;
  waitTicks: number;
  ticksLeft: number;
}

export interface HuntState {
  phase: 'idle' | 'surveying' | 'tracking' | 'trapping';
  surveyFails: number;
  step: number;
  requiredSteps: number;
  /** Rare species rolled for this hunt, if any. */
  species: string | null;
  journalXp: number;
  trapped: number;
  failedThisHunt?: boolean;
  /** Use the animal's preferred bait while hunting it (the desktop's per-animal bait toggle). */
  bait?: boolean;
  /** Failed trap attempts in a row: each adds the trap's fail bonus again until a catch. */
  trapFails?: number;
}

export interface PlotState {
  recipe: string | null;
  /** Tick the crop finishes growing. */
  readyAt: number;
  regrowsLeft: number;
  watered: boolean;
  compost: string | null;
  /** Flowers: once grown they give their bonus until this tick, then the plot clears. */
  providingUntil?: number;
  /** Automation (unlocked by Farmhand purchases): each automated step costs the recipe's automation cost. */
  auto?: { harvest?: boolean; replant?: string | null; water?: boolean; compost?: string | null };
  /** Tick automation last looked at this plot, so an unaffordable step isn't retried in a loop. */
  autoCheckedAt?: number;
}

export interface RanchAnimal {
  id: number;
  animal: string;
  /** The enclosure type it lives in (kept for display), and the land plot that enclosure stands on. */
  enclosure: string;
  land?: string;
  variant: string;
  bornAt: number;
  grownAt: number;
  diesAt: number;
  nextProductAt: number;
  hunger: number;
  /** Tick when the animal next wants petting. */
  petDueAt: number;
}

export interface RanchingState {
  /** Purchased land plots, each with the enclosure built on it (if any). */
  land: { land: string; enclosure: string | null }[];
  animals: RanchAnimal[];
  nextId: number;
  /** Fractional products waiting to round up into whole items. */
  carry: Record<string, number>;
  /** Enclosure upkeep by land plot: 1 = fully maintained, losing 1% an hour while animals live there; when it next drops. */
  maintenance?: Record<string, { value: number; nextAt: number }>;
}

export interface CombatState {
  area: string | null;
  selectedEnemy: string | null;
  enemy: string | null;
  enemyHp: number;
  phase: 'spawning' | 'fighting';
  /** Ticks left on each timer, and the ticks the last scheduled wait covered. */
  spawnLeft: number;
  playerLeft: number;
  enemyLeft: number;
  pending: number;
  stance: string;
  spell: string | null;
  prayers: string[];
  dungeonStage: number;
  dungeonCount: number;
  kills: Record<string, number>;
  dungeonsDone: Record<string, number>;
  slayer: { master: string; enemy: string; left: number; extended?: boolean } | null;
  /** Enemies blocked from slayer tasks, by block slot id (each master has its own slots). */
  slayerBlocks?: Record<string, string>;
  /** Pause Fight: timers stand still until resumed. */
  paused?: boolean;
  /** The enemy's Ward (it spawns full; each landed hit wears 1 off) and whether its armour has been broken. */
  enemyWard?: number;
  enemyArmourBroken?: boolean;
  /** Loot History for the current combat session (since you last started fighting). */
  loot?: {
    items: Record<string, number>;
    currencies: Record<string, number>;
    kills: number;
    since: number;
    /** Kills by enemy, and XP gained by skill, since `since`. */
    enemies?: Record<string, number>;
    xp?: Record<string, number>;
  };
  /** Combat effects on each side during the current fight. */
  effects?: { player: import('./combat/effects').ActiveEffect[]; enemy: import('./combat/effects').ActiveEffect[] };
  slayerTasksDone: Record<string, number>;
  damageDealt: number;
  damageTaken: number;
}

export interface GameState {
  version: number;
  rng: number;
  /** Simulation clock in ticks since the character was created. */
  tick: number;
  /** Leftover ms smaller than one tick, carried into the next advance. */
  msCarry: number;
  /** Wall-clock ms when the simulation was last advanced. */
  lastUpdate: number;
  createdAt: number;
  gold: number;
  bank: Record<string, number>;
  xp: Record<string, number>;
  active: ActiveAction | null;
  treeHp: Record<string, number>;
  rockProgress: Record<string, number>;
  /** Steps left on each artisan recipe's current item. */
  recipeSteps: Record<string, number>;
  /** Current HP; null means full. */
  hp: number | null;
  /** Food eaten automatically at 25% HP. */
  selectedFood: string | null;
  thieving: { stunned: boolean; stage: Record<string, number> };
  hunting: Record<string, HuntState>;
  farming: { plots: Record<string, PlotState> };
  ranching: RanchingState;
  astrology: { knowledge: Record<string, number>; /** Major nodes chosen, by constellation. */ major?: Record<string, string[]> };
  /** Shop purchases by id → times bought. */
  purchases: Record<string, number>;
  /** Skill toolbelt slots → equipped item. */
  toolbelt: Record<string, { item: string; qty: number }>;
  /** The Grain Mill's selected recipe and when its current batch finishes. */
  mill: { recipe: string | null; readyAt: number; storage?: Record<string, number> };
  /** Currencies other than gold (slayer coins, prayer points). */
  currencies: Record<string, number>;
  equipment: Record<string, { item: string; qty: number }>;
  combat: CombatState;
  quests: Record<string, { step: number; task: number; progress: Record<string, number>; done: boolean }>;
  /** Mastery Guild task progress and completed tasks. */
  guild: { progress: Record<string, number>; done: Record<string, boolean> };
  /** Every item ever obtained, for the completion log. */
  found: Record<string, boolean>;
  /** Names the quest dialogue uses for you and your companion. */
  names: { player: string; companion: string };
  /** Pages unlocked by progression (skill pages, Combat, Bank, Shop, Quests). */
  unlocked: Record<string, boolean>;
  /** Set on saves from before progression gating; the game then unlocks everything once. */
  legacyUnlockAll?: boolean;
  /** Skills the player chose to play although the demo locks them (their data is complete in the demo's files). */
  optIn?: { Astrology?: boolean };
  /** Fishing bait in use: consumed one per catch, its bonuses apply while any is in the bank. */
  fishingBait?: string | null;
  /**
   * Bank options, as on the desktop: locked items can't be sold; a placeholder keeps an item's slot (at 0) when the last
   * one goes; auto placeholders do that for every item; and actions stop when a new item won't fit (on unless turned off).
   */
  bankOptions?: { locked?: Record<string, boolean>; placeholders?: Record<string, boolean>; autoPlaceholders?: boolean; keepGoingWhenFull?: boolean };
  /** Bank tabs you've made, each with the items you've put in it. */
  bankTabs?: { name: string; items: string[] }[];
  /** Woodcutting overgrowth stacks per tree (bushes): each gives +1 items until used up, one per full cut. */
  overgrowth?: Record<string, number>;
  /** Event log: notable moments (level-ups, unlocks, completions), newest first, by game tick. */
  eventLog?: { tick: number; text: string }[];
  /** Equipment loadouts: the slot in use and what each other slot holds. */
  loadouts?: { current: string; saved: Record<string, import('./combat/loadouts').SavedLoadout> };
  stats: {
    onlineMs: number;
    offlineMs: number;
    actions: Record<string, number>;
    failures: Record<string, number>;
    deaths?: number;
    /** Items gained per skill (WoodcuttingItemGained...) and found overall (BankItemFound). */
    itemGained: Record<string, Record<string, number>>;
    itemsFound: Record<string, number>;
    /** Hours each ranching animal type has spent alive, and rare hunting species found (guild tasks). */
    ranchHoursAlive?: Record<string, number>;
    raresFound?: Record<string, boolean>;
    /** Rare species trapped, by species. */
    speciesTrapped?: Record<string, number>;
    itemsSold: number;
    goldFromSales: number;
    /** Desktop-style statistics by id (WoodcuttingFells, MiningRocksShattered...), and time per skill in ms. */
    values?: Record<string, number>;
  };
}

export function newState(now = Date.now(), seed = (now ^ 0x9e3779b9) >>> 0): GameState {
  return {
    version: SAVE_VERSION,
    rng: seed,
    tick: 0,
    msCarry: 0,
    lastUpdate: now,
    createdAt: now,
    gold: 0,
    bank: {},
    xp: {},
    active: null,
    treeHp: {},
    rockProgress: {},
    recipeSteps: {},
    hp: null,
    selectedFood: null,
    thieving: { stunned: false, stage: {} },
    hunting: {},
    farming: { plots: {} },
    ranching: { land: [], animals: [], nextId: 1, carry: {} },
    astrology: { knowledge: {} },
    purchases: {},
    toolbelt: {},
    mill: { recipe: null, readyAt: 0 },
    currencies: {},
    equipment: {},
    combat: {
      area: null, selectedEnemy: null, enemy: null, enemyHp: 0, phase: 'spawning', spawnLeft: 0, playerLeft: 0, enemyLeft: 0,
      pending: 0, stance: 'MelvorBase:Stab', spell: null, prayers: [], dungeonStage: 0, dungeonCount: 0, kills: {},
      dungeonsDone: {}, slayer: null, slayerTasksDone: {}, damageDealt: 0, damageTaken: 0,
    },
    quests: {},
    found: {},
    guild: { progress: {}, done: {} },
    unlocked: {},
    names: { player: 'Adventurer', companion: 'Rowan' },
    stats: { onlineMs: 0, offlineMs: 0, actions: {}, failures: {}, itemsSold: 0, goldFromSales: 0, itemGained: {}, itemsFound: {} },
  };
}
