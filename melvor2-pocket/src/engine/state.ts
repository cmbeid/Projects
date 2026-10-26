// Serialisable game state. Everything the simulation needs lives here so saves and offline replay are exact.
export const SAVE_VERSION = 1;

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
}

export interface PlotState {
  recipe: string | null;
  /** Tick the crop finishes growing. */
  readyAt: number;
  regrowsLeft: number;
  watered: boolean;
  compost: string | null;
}

export interface RanchAnimal {
  id: number;
  animal: string;
  enclosure: string;
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
  slayer: { master: string; enemy: string; left: number } | null;
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
  astrology: { knowledge: Record<string, number> };
  /** Shop purchases by id → times bought. */
  purchases: Record<string, number>;
  /** Skill toolbelt slots → equipped item. */
  toolbelt: Record<string, { item: string; qty: number }>;
  /** The Grain Mill's selected recipe and when its current batch finishes. */
  mill: { recipe: string | null; readyAt: number };
  /** Currencies other than gold (slayer coins, prayer points). */
  currencies: Record<string, number>;
  equipment: Record<string, { item: string; qty: number }>;
  combat: CombatState;
  quests: Record<string, { step: number; task: number; progress: Record<string, number>; done: boolean }>;
  /** Every item ever obtained, for the completion log. */
  found: Record<string, boolean>;
  stats: {
    onlineMs: number;
    offlineMs: number;
    actions: Record<string, number>;
    failures: Record<string, number>;
    deaths?: number;
    itemsSold: number;
    goldFromSales: number;
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
    stats: { onlineMs: 0, offlineMs: 0, actions: {}, failures: {}, itemsSold: 0, goldFromSales: 0 },
  };
}
