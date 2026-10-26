// Typed access to the game's content package. It isn't bundled: the app loads content.json (built from your own
// install by tools/build-data.mjs) at startup and hands it to loadContent().

export const NS = 'MelvorBase:';

export interface Requirement {
  Type: string;
  Data: { Component?: { Entity: string; Component: string }; Level?: number; IsOr?: boolean };
}

export interface ItemQuantity { Item: string; Quantity: number }
export interface ItemQuantityChance extends ItemQuantity { Chance: number }

export interface Item {
  Id: string;
  DisplayName: { Singular: string; Plural: string };
  Description: string | null;
  SellsFor: { Currency: string; Quantity: number } | null;
  Capabilities: Record<string, unknown> | null;
}

interface BaseRecipe {
  Id: string;
  DisplayName: string;
  Category?: string;
  BaseExperience: number;
  Requirements: Requirement[] | null;
  DisplayRequirements: Requirement[] | null;
}

export interface WoodcuttingRecipe extends BaseRecipe {
  BaseInterval: number;
  BaseMaxHealth: number;
  Product: ItemQuantity;
  RandomProductsPerHit: ItemQuantityChance[];
  RandomProductsPerCut: ItemQuantityChance[];
}

export interface MiningRecipe extends BaseRecipe {
  BaseInterval: number;
  BaseProductChance: number;
  Product: ItemQuantity;
  RandomProductsPerHit: ItemQuantityChance[];
}

export interface FishingProduct { Item: string; MinQuantity: number; MaxQuantity: number; Weight: number }

export interface FishingRecipe extends BaseRecipe {
  Location: string;
  BaseMinInterval: number;
  BaseMaxInterval: number;
  FishChance: number;
  JunkItem: string;
  RandomProducts: FishingProduct[];
  SpecialProducts: ItemQuantityChance[];
}

export interface Ingredients { Items: ItemQuantity[]; Currencies: { Currency: string; Quantity: number }[] }

export interface FiremakingRecipe extends BaseRecipe {
  BaseInterval: number;
  Products: ItemQuantityChance[];
  Ingredients: Ingredients;
  CurrencyReward: { Currency: string; Quantity: number } | null;
}

/** Smithing, Fletching, Crafting and Runecrafting recipes. */
export interface ArtisanRecipe extends BaseRecipe {
  BaseInterval: number;
  Steps: number;
  Subcategory: string | null;
  Ingredients: Ingredients;
  Products: ItemQuantityChance[];
}

export interface CookingRecipe extends BaseRecipe {
  BaseInterval: number;
  Difficulty: number;
  Subcategory: string | null;
  Ingredients: Ingredients;
  Products: ItemQuantityChance[];
}

export interface HerbloreRecipe extends BaseRecipe {
  BasePreparingInterval: number;
  BaseHeatingInterval: number;
  BaseStirringInterval: number;
  BaseBottlingInterval: number;
  Ingredients: Ingredients;
  Products: ItemQuantityChance[];
}

export interface Named { Id: string; DisplayName: string | { Singular: string } }

type Objects = Record<string, { Id: string }[]>;
type EntityConfig = Record<string, Record<string, { Priority: number; Id: string }[]>>;

export interface ContentPackage { Namespace: string; Objects: Objects; EntityConfig: EntityConfig }

let pkg: ContentPackage = { Namespace: 'MelvorBase', Objects: {}, EntityConfig: {} };
const byType = new Map<string, Map<string, unknown>>();

/** Throws if the file isn't a MelvorBase content package. */
export function validateContent(data: unknown): ContentPackage {
  const p = data as Partial<ContentPackage>;
  if (!p || p.Namespace !== 'MelvorBase' || !p.Objects?.Item?.length || !p.EntityConfig) {
    throw new Error("That isn't a Melvor Idle 2 content.json. Build it with `npm run data` on your PC.");
  }
  return p as ContentPackage;
}

export function loadContent(data: unknown): void {
  pkg = validateContent(data);
  byType.clear();
  for (const [type, list] of Object.entries(pkg.Objects)) byType.set(type, new Map(list.map((o) => [NS + o.Id, o])));
}

export const contentLoaded = () => byType.size > 0;

export function get<T>(type: string, id: string): T {
  const o = byType.get(type)?.get(id);
  if (!o) throw new Error(`Unknown ${type} ${id}`);
  return o as T;
}

export function tryGet<T>(type: string, id: string): T | undefined {
  return byType.get(type)?.get(id) as T | undefined;
}

export function all<T>(type: string): T[] {
  return [...(byType.get(type)?.values() ?? [])] as T[];
}

/** Entity config list (e.g. Woodcutting "Recipes") as full ids, sorted by priority like the game. */
export function configList(entity: string, key: string): string[] {
  const list = pkg.EntityConfig[NS + entity]?.[key] ?? [];
  return [...list].sort((a, b) => a.Priority - b.Priority).map((e) => e.Id);
}

export function item(id: string): Item {
  return get<Item>('Item', id);
}

export function itemName(id: string, quantity = 1): string {
  const it = tryGet<Item>('Item', id);
  if (!it) return id.replace(NS, '');
  return quantity === 1 ? it.DisplayName.Singular : it.DisplayName.Plural;
}

export function displayName(type: string, id: string): string {
  const o = tryGet<Named>(type, id);
  if (!o) return id.replace(NS, '');
  return typeof o.DisplayName === 'string' ? o.DisplayName : o.DisplayName.Singular;
}

export const GOLD = `${NS}GoldPieces`;
