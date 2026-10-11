/**
 * The shapes of all game content. Everything in `src/data/` is plain typed
 * data checked by `validate.ts`; the simulation in `src/game/` reads it and
 * never the other way round.
 */

export type MatId = 'ore' | 'ice' | 'organics' | 'crystal' | 'relic' | 'alloy' | 'circuits' | 'exotic';
export type Bundle = Partial<Record<MatId, number>>;

/** The five numbers on the HUD. */
export type ResId = 'fuel' | 'food' | 'energy' | 'hull' | 'credits';
export type Res = Record<ResId, number>;

export type StatId = 'grit' | 'wits' | 'reflex' | 'charm';
export type ClassId = 'pilot' | 'engineer' | 'scientist' | 'medic' | 'soldier';
export type FactionId = 'concord' | 'clans' | 'choir';
export type BiomeId = 'rocky' | 'ice' | 'jungle' | 'desert' | 'volcanic' | 'toxic' | 'ocean' | 'crystal' | 'wreck';
export type NodeKind =
  | 'entry'
  | 'system'
  | 'station'
  | 'derelict'
  | 'asteroids'
  | 'nebula'
  | 'anomaly'
  | 'distress'
  | 'patrol'
  | 'gate';
export type SubsysId = 'weapons' | 'shields' | 'engines' | 'sensors' | 'life';
export type GearSlot = 'weapon' | 'suit' | 'tool' | 'module';
export type ConsumableId =
  | 'medkit'
  | 'ration'
  | 'fuelcell'
  | 'powercell'
  | 'o2can'
  | 'repairkit'
  | 'decoy'
  | 'stim'
  | 'scanner'
  | 'shieldcell';

/**
 * Every modifier in the game is one of these keys. Skills, traits, gear,
 * affixes and ship modules all contribute numbers; `derive` sums them.
 * Percentages are fractions (0.1 = 10%).
 */
export type ModKey =
  // ship
  | 'evasion'
  | 'accuracy'
  | 'shieldRegen'
  | 'weaponDmg'
  | 'repair'
  | 'fuelEff'
  | 'foodEff'
  | 'trade'
  | 'xp'
  | 'heal'
  | 'morale'
  // away
  | 'o2'
  | 'suitShield'
  | 'hp'
  | 'speed'
  | 'gather'
  | 'carry'
  | 'awayDmg'
  | 'fireRate'
  | 'range'
  | 'skillCd'
  // checks
  | 'grit'
  | 'wits'
  | 'reflex'
  | 'charm';
export type Mods = Partial<Record<ModKey, number>>;

export interface MaterialDef {
  id: MatId;
  name: string;
  /** Base credit value at a station. */
  value: number;
  weight: number;
  color: string;
  refined: boolean;
  desc: string;
}

export interface ConsumableDef {
  id: ConsumableId;
  name: string;
  desc: string;
  value: number;
  /** Where it can be used. */
  use: ('ship' | 'combat' | 'away')[];
}

export interface ClassDef {
  id: ClassId;
  name: string;
  desc: string;
  /** Starting stats before origin and random spread. */
  stats: Record<StatId, number>;
  /** The ship-combat action this class unlocks. */
  combat: { id: string; name: string; desc: string };
  /** The away-mission skill button. */
  away: { id: string; name: string; desc: string; cooldown: number };
  color: string;
}

export interface SkillDef {
  id: string;
  cls: ClassId;
  name: string;
  desc: string;
  /** Needs this skill first. */
  req?: string;
  /** Minimum crew level. */
  level: number;
  mods: Mods;
}

export interface TraitDef {
  id: string;
  name: string;
  desc: string;
  good: boolean;
  mods: Mods;
  /** Daily food eaten (default 1). */
  eats?: number;
}

export interface OriginDef {
  id: string;
  name: string;
  desc: string;
  cls: ClassId;
  stats: Partial<Record<StatId, number>>;
  res: Partial<Res>;
  mats: Bundle;
  rep: Partial<Record<FactionId, number>>;
}

export interface GearDef {
  id: string;
  slot: GearSlot;
  name: string;
  /** The sector it first turns up in; drives drops and prices. */
  tier: number;
  mods: Mods;
  desc: string;
}

export interface AffixDef {
  id: string;
  name: string;
  slots: GearSlot[];
  key: ModKey;
  /** Per-tier value range. */
  min: number;
  max: number;
}

export type ModuleId =
  | 'laser'
  | 'missile'
  | 'ion'
  | 'shield'
  | 'engine'
  | 'sensor'
  | 'reactor'
  | 'cargo'
  | 'hydro'
  | 'refinery'
  | 'fabricator'
  | 'medbay'
  | 'cabins'
  | 'plating'
  | 'lander';

export interface ModuleTier {
  name: string;
  cost: Bundle;
  credits: number;
  /** Free-form effect numbers, interpreted per module in `derive`. */
  v: number;
  desc: string;
}

export interface ModuleDef {
  id: ModuleId;
  name: string;
  desc: string;
  /** Tier 0 is "not installed" unless `starts` is set. */
  starts: number;
  tiers: ModuleTier[];
  /** Energy drawn per day while installed. */
  upkeep: number;
}

export interface RecipeDef {
  id: string;
  name: string;
  cost: Bundle;
  /** Fabricator tier needed. */
  fab: number;
  out: { mat: MatId; n: number } | { item: ConsumableId; n: number } | { gear: string };
  /** Hidden until this story flag is set. */
  flag?: string;
}

export interface BiomeDef {
  id: BiomeId;
  name: string;
  desc: string;
  hazard: 'none' | 'cold' | 'spores' | 'heat' | 'toxin' | 'radiation' | 'sparks';
  /** Chance a cell starts as wall in the cave generator. */
  walls: number;
  /** Share of floor that becomes hazard ground or liquid. */
  hazardShare: number;
  liquid: 'none' | 'water' | 'lava' | 'acid';
  liquidShare: number;
  mats: Partial<Record<MatId, number>>;
  fauna: string[];
  /** Palette: floor, floor-dark, wall, wall-light, liquid, hazard, accent. */
  pal: [string, string, string, string, string, string, string];
  sky: string;
}

export interface FaunaDef {
  id: string;
  name: string;
  hp: number;
  dmg: number;
  speed: number;
  /** Tiles. */
  aggro: number;
  ranged: boolean;
  cooldown: number;
  color: string;
  desc: string;
}

export interface EnemyDef {
  id: string;
  name: string;
  faction: FactionId | 'none';
  hull: number;
  shields: number;
  evasion: number;
  weapons: { kind: 'laser' | 'missile' | 'ion'; dmg: number; cd: number }[];
  /** Which of our subsystems it shoots at first. */
  targets: SubsysId[];
  reward: { credits: number; mats: Bundle };
  boss: boolean;
  desc: string;
  sprite: string;
}

export interface Outcome {
  text: string;
  res?: Partial<Res>;
  mats?: Bundle;
  items?: Partial<Record<ConsumableId, number>>;
  xp?: number;
  rep?: Partial<Record<FactionId, number>>;
  /** Health change for every crew member. */
  hpAll?: number;
  /** Health change for the crew member who made the check (or a random one). */
  hpOne?: number;
  morale?: number;
  gear?: boolean;
  recruit?: ClassId | 'any';
  /** An enemy id, or '@sector' for one of the sector's usual enemies. */
  combat?: string;
  flag?: string;
  colonists?: number;
  reveal?: boolean;
  /** Days spent. */
  days?: number;
}

export interface Choice {
  label: string;
  /** Hidden unless all are met. */
  req?: {
    mats?: Bundle;
    res?: Partial<Res>;
    items?: Partial<Record<ConsumableId, number>>;
    cls?: ClassId;
    flag?: string;
    origin?: string;
    rep?: Partial<Record<FactionId, number>>;
  };
  /** The choice spends what `req` names. */
  pay?: boolean;
  check?: { stat: StatId; dc: number; cls?: ClassId };
  ok: Outcome;
  fail?: Outcome;
}

export interface EventDef {
  id: string;
  title: string;
  text: string;
  kinds: NodeKind[];
  minSector?: number;
  maxSector?: number;
  weight?: number;
  /** Only once per campaign. */
  unique?: boolean;
  /** Patrol hails: only for patrols of this faction. */
  faction?: FactionId | 'none';
  choices: Choice[];
}

export type Objective =
  | { k: 'reach' }
  | { k: 'land'; biome: BiomeId }
  | { k: 'defeat'; enemy: string }
  | { k: 'deliver'; mats: Bundle }
  | { k: 'rescue'; colonists: number }
  | { k: 'gate' };

export interface StoryDef {
  id: string;
  sector: number;
  title: string;
  /** What the log says to do. */
  brief: string;
  objective: Objective;
  /** Shown on arrival / completion. A story event's choices if any. */
  text: string;
  choices?: Choice[];
  reward: Outcome;
  /** Sets this flag when done. */
  flag?: string;
}

export interface SectorDef {
  index: number;
  name: string;
  desc: string;
  faction: FactionId | 'none';
  biomes: BiomeId[];
  /** Node kind weights for the procedural map. */
  kinds: Partial<Record<NodeKind, number>>;
  enemies: string[];
  boss: string;
  /** Music: root note, mode. */
  music: { root: number; mode: 'aeolian' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian' | 'ionian'; bpm: number };
  color: string;
}

export interface QuestTpl {
  id: string;
  kind: 'deliver' | 'bounty' | 'survey' | 'rescue' | 'courier';
  title: string;
  text: string;
  minSector: number;
}

export interface LoreDef {
  id: string;
  title: string;
  text: string;
  sector: number;
}

export interface FactionDef {
  id: FactionId;
  name: string;
  desc: string;
  color: string;
}
