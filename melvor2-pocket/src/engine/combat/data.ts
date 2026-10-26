// Typed views of the combat data in content.json.
import { NS, all, get, tryGet, type Requirement } from '../content';

export interface StatValue { Stat: string; Value: number }
export interface StatBlock {
  Stats: StatValue[];
  PowerRatings: { DamageType: string; Value: number }[];
  ProtectionRatings: { DamageType: string; Value: number }[];
}
export interface Bonus {
  Stat: { StatsType: string; Name: string };
  Value: number;
  LocalContext?: { Component?: { Entity: string; Component: string }; CombatStat?: string | null; CombatStyle?: string | null } | null;
}
export interface Bonuses { Global: Bonus[]; Component: Bonus[] }

export interface Drop { Item: string; MinQuantity: number; MaxQuantity: number; Weight?: number }
export interface Drops {
  FixedItems: Drop[];
  ItemTables: { Chance: number; Table: Drop[] }[];
  FixedCurrencies: { Currency: string; MinQuantity: number; MaxQuantity: number }[];
}

export interface Enemy {
  Id: string;
  DisplayName: string;
  Levels: { Key: string; Value: number }[];
  Stats: StatBlock;
  DamageType: string;
  Stances: { Stance: string; Weight: number }[];
  Drops: Drops;
  Attacks: { Attack: string; Chance: number }[];
  Requirements: Requirement[] | null;
}

export interface CombatArea {
  Id: string;
  DisplayName: string;
  Category: string;
  Difficulty: string;
  UnlockRequirements: Requirement[] | null;
  DisplayRequirements: Requirement[] | null;
  Darkness: number;
  Enemies: string[];
}

export interface Dungeon {
  Id: string;
  DisplayName: string;
  Category: string;
  Difficulty: string;
  UnlockRequirements: Requirement[] | null;
  DisplayRequirements: Requirement[] | null;
  Darkness: number;
  Enemies: { Enemies: { Enemy: string; Weight: number }[]; Count: number }[];
  Rewards: Drops;
}

export interface CombatStyle {
  Id: string;
  DisplayName: string;
  MaxHitpointsLevel: string;
  ArmourStat: string;
  AttackIntervalStat: string;
  AccuracyRatingLevels: { Level: string; Ratio: number }[];
  EvasionLevels: { Level: string; Ratio: number }[];
  MaxHitFormula: {
    Type: string;
    Data: { StrengthBonusStat?: string; MaxHitStat?: string; DamageBonusStat?: string; Levels: { Level: string; Ratio: number }[] };
  };
  CombatLevelRatios: { Level: string; Ratio: number }[];
  UsesSpells: boolean;
}

export interface AttackStance {
  Id: string;
  DisplayName: string;
  CombatStyle: string;
  EvasionStat: string;
  AccuracyStat: string;
  ExperienceGain: { Component: { Entity: string }; ExperiencePerDamage: number }[];
}

export interface Attack {
  Id: string;
  DisplayName: string;
  Hits: { Count: number; Damage: { Character: string; Formula: { Type: string; Data: { Percent?: number } } }[]; Interval: number }[];
  IsAvoidable: boolean;
}

export interface EquipmentCap {
  Type: string;
  OccupiesSlots: string[] | null;
  Requirements: Requirement[] | null;
  Stats: StatBlock;
  Bonuses: Bonuses | null;
  CanEquipQuantity: boolean;
  AmmoType: string | null;
}
export interface WeaponCap { Type: string; DamageType: string; RequiredAmmoType: string | null }

export interface EquipmentSlot { Id: string; DisplayName: string; FitsType: string; UnlockRequirements: Requirement[] | null }

export interface MagicSpell {
  Id: string;
  DisplayName: string;
  Book: string;
  Stats: StatBlock;
  RuneCosts: { Item: string; Quantity: number }[];
  UnlockRequirements: Requirement[] | null;
}

export interface Prayer {
  Id: string;
  DisplayName: string;
  FitsInSlot: string;
  Bonuses: Bonuses;
  Cost: { Currency: string; Quantity: number };
  UnlockRequirements: Requirement[] | null;
}

export interface SlayerMaster {
  Id: string;
  DisplayName: string;
  Areas: string[];
  UnlockRequirements: Requirement[] | null;
  BaseTaskLength: number;
  RerollCost: { Currency: string; Quantity: number };
  RewardCurrency: string;
}

export interface TriangleBonus { PlayerStyle: string; EnemyStyle: string; Bonuses: Bonuses }

export const enemy = (id: string) => get<Enemy>('Enemy', id);
export const area = (id: string) => tryGet<CombatArea>('CombatArea', id) ?? get<Dungeon>('Dungeon', id);
export const isDungeon = (id: string) => !!tryGet<Dungeon>('Dungeon', id);
export const style = (id: string) => get<CombatStyle>('CombatStyle', id);
export const stance = (id: string) => get<AttackStance>('AttackStance', id);
export const attack = (id: string) => get<Attack>('Attack', id);
export const spell = (id: string) => get<MagicSpell>('MagicSpell', id);
export const prayer = (id: string) => get<Prayer>('Prayer', id);
export const slayerMaster = (id: string) => get<SlayerMaster>('SlayerMaster', id);
export const equipmentSlots = () => all<EquipmentSlot>('EquipmentSlot');
export const allSpells = () => all<MagicSpell>('MagicSpell');
export const allPrayers = () => all<Prayer>('Prayer');
export const allSlayerMasters = () => all<SlayerMaster>('SlayerMaster');
export const triangleBonuses = () => all<TriangleBonus>('CombatTriangleBonus');

const caps = (itemId: string) => (get<{ Capabilities: Record<string, unknown> | null }>('Item', itemId).Capabilities ?? {});
export const equipmentCap = (itemId: string) => caps(itemId)[`${NS}Equipment`] as EquipmentCap | undefined;
export const weaponCap = (itemId: string) => caps(itemId)[`${NS}Weapon`] as WeaponCap | undefined;
export const buryCap = (itemId: string) =>
  caps(itemId)[`${NS}Bury`] as { CurrencyGain: { Currency: string; Quantity: number } } | undefined;

export const DEFAULT_WEAPON = `${NS}DefaultWeapon`;
export const COMBAT_LEVELS = ['Hitpoints', 'Attack', 'Strength', 'Defence', 'Ranged', 'Magic'];
