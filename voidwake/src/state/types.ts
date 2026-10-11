import type {
  BiomeId,
  Bundle,
  ClassId,
  ConsumableId,
  FactionId,
  GearSlot,
  MatId,
  ModuleId,
  NodeKind,
  Res,
  StatId,
  SubsysId,
} from '../data/types';

export interface GearInst {
  uid: number;
  base: string;
  rarity: number;
  affixes: { id: string; v: number }[];
}

export interface Crew {
  id: number;
  name: string;
  cls: ClassId;
  stats: Record<StatId, number>;
  hp: number;
  morale: number;
  xp: number;
  level: number;
  skillPts: number;
  statPts: number;
  skills: string[];
  traits: string[];
  /** Gear uids from `GameState.gear`. */
  gear: Partial<Record<GearSlot, number>>;
  /** Indices into the portrait part lists. */
  portrait: number[];
  captain: boolean;
}

export interface Planet {
  name: string;
  biome: BiomeId;
  size: number;
  seed: number;
  scanned: boolean;
  landings: number;
  pods: number;
  ruin: boolean;
  /** A story mission whose objective lies on this planet. */
  objective?: string;
}

export interface QuestInst {
  uid: number;
  tpl: string;
  sector: number;
  /** Node of the station that gave it. */
  from: number;
  /** Node where it is completed. */
  target: number;
  need?: Bundle;
  enemy?: string;
  reward: { credits: number; xp: number; rep: FactionId | null };
  done: boolean;
}

export interface StationState {
  name: string;
  faction: FactionId | 'none';
  restockAt: number;
  stock: Partial<Record<MatId, number>>;
  items: Partial<Record<ConsumableId, number>>;
  gear: GearInst[];
  recruits: Crew[];
  quest: QuestInst | null;
}

export interface MapNode {
  id: number;
  row: number;
  x: number;
  y: number;
  kind: NodeKind;
  name: string;
  links: number[];
  visited: boolean;
  revealed: boolean;
  cleared: boolean;
  faction: FactionId | 'none';
  planets: Planet[];
  station: StationState | null;
  story?: string;
  /** Mined the belt on this visit already. */
  mined: boolean;
}

export interface Sector {
  index: number;
  seed: number;
  nodes: MapNode[];
}

export interface Fighter {
  name: string;
  hull: number;
  maxHull: number;
  shield: number;
  maxShield: number;
  regen: number;
  evasion: number;
  subs: Record<SubsysId, { hp: number; max: number }>;
  weapons: { kind: 'laser' | 'missile' | 'ion'; dmg: number; cd: number; charge: number }[];
}

export interface CombatState {
  enemyId: string;
  enemy: Fighter;
  /** Our side; hull lives in `res.hull`. */
  player: Omit<Fighter, 'hull' | 'maxHull' | 'name'>;
  target: SubsysId;
  turn: number;
  evadeTurns: number;
  scanned: boolean;
  braced: boolean;
  jump: number;
  log: string[];
  result: null | 'win' | 'lose' | 'fled';
  loot: { credits: number; mats: Bundle; gear: GearInst | null } | null;
  storyId?: string;
  questUid?: number;
  /** For the renderer: what happened this turn. */
  fx: { from: 'player' | 'enemy'; kind: 'laser' | 'missile' | 'ion'; hit: boolean; sub: SubsysId }[];
}

export type EntKind = 'node' | 'cache' | 'terminal' | 'pod' | 'fauna' | 'objective' | 'turret';

export interface AwayEnt {
  id: number;
  k: EntKind;
  x: number;
  y: number;
  /** Resource nodes: what and how much is left. */
  mat?: MatId;
  amt?: number;
  /** Fauna and turrets. */
  fauna?: string;
  hp?: number;
  maxHp?: number;
  cd?: number;
  state?: 'idle' | 'chase';
  vx?: number;
  vy?: number;
  /** Wander target. */
  tx?: number;
  ty?: number;
  alpha?: boolean;
  /** Turret lifetime. */
  life?: number;
  marked?: boolean;
  hurt?: number;
}

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  dmg: number;
  from: 'player' | 'fauna';
}

export interface AwayStats {
  speed: number;
  dmg: number;
  fireCd: number;
  range: number;
  gather: number;
  cls: ClassId;
}

export interface AwayState {
  seed: number;
  rng: number;
  stats: AwayStats;
  biome: BiomeId;
  planet: string;
  node: number;
  planetIdx: number;
  crewId: number;
  w: number;
  h: number;
  /** One char a tile: '#' wall, '.' floor, ',' hazard ground, '~' liquid. */
  tiles: string;
  x: number;
  y: number;
  fx: number;
  fy: number;
  o2: number;
  o2Max: number;
  shield: number;
  shieldMax: number;
  hp: number;
  hpMax: number;
  carry: number;
  carryMax: number;
  haul: Bundle;
  items: Partial<Record<ConsumableId, number>>;
  colonists: number;
  /** Terminals read; turned into log entries when the haul is banked. */
  terminals: number;
  gotObjective: boolean;
  objective: string | null;
  ents: AwayEnt[];
  shots: Shot[];
  lander: { x: number; y: number };
  t: number;
  fireCd: number;
  gatherCd: number;
  skillCd: number;
  skillMax: number;
  dash: number;
  status: 'play' | 'done' | 'down';
  /** Short-lived text pops for the renderer. */
  pops: { x: number; y: number; text: string; t: number; color: string }[];
  nextEnt: number;
  kills: number;
  /** Things the renderer should flash or sound. */
  events: string[];
}

export interface EventState {
  id: string;
  source: 'event' | 'story';
  /** The result text after a choice, with the changes it caused. */
  result: string | null;
  changes: string[];
  then: { combat?: string } | null;
  /** The crew member who made the last check. */
  checker: number | null;
}

export type Screen = 'create' | 'map' | 'event' | 'combat' | 'away' | 'lost' | 'ending';

export interface LogEntry {
  day: number;
  text: string;
  kind: 'story' | 'event' | 'combat' | 'away' | 'ship' | 'warn';
}

export interface GameState {
  version: number;
  savedAt: number;
  rng: number;
  seed: number;
  screen: Screen;
  origin: string;
  day: number;
  res: Res;
  mats: Record<MatId, number>;
  items: Record<ConsumableId, number>;
  modules: Record<ModuleId, number>;
  crew: Crew[];
  gear: GearInst[];
  nextId: number;
  sector: Sector;
  at: number;
  story: { idx: number; done: string[]; flags: string[] };
  colonists: number;
  rep: Record<FactionId, number>;
  quests: QuestInst[];
  event: EventState | null;
  combat: CombatState | null;
  away: AwayState | null;
  lore: string[];
  codex: { biomes: BiomeId[]; fauna: string[]; enemies: string[] };
  log: LogEntry[];
  checkpoint: string | null;
  lost: { days: number } | null;
  /** A summary to show over whatever screen is up: a landing's haul, a fight's spoils. */
  report: { title: string; lines: string[] } | null;
  ending: string | null;
  stats: {
    jumps: number;
    fights: number;
    wins: number;
    landings: number;
    gathered: number;
    kills: number;
    reloads: number;
    crafted: number;
    seen: string[];
  };
  settings: { sfx: number; music: number; muted: boolean };
}
