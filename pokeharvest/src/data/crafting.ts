/** Recipes for machines and dishes, and what each machine makes from what. */
import { CROPS } from './crops';
import { jamId, juiceId } from './items';

export interface Recipe {
  /** The item made. */
  id: string;
  inputs: Record<string, number>;
  /** Crafting level needed. */
  level: number;
  /** Dishes are cooked in the farmhouse kitchen; everything else needs a Workbench on the farm. */
  kitchen?: boolean;
}

export const RECIPES: readonly Recipe[] = [
  { id: 'berry-press', inputs: { 'hard-stone': 4, oran: 3 }, level: 1 },
  { id: 'preserves-jar', inputs: { 'hard-stone': 3, 'metal-coat': 1, cheri: 2 }, level: 2 },
  { id: 'cheese-press', inputs: { 'hard-stone': 4, 'metal-coat': 2, 'copper-bar': 1 }, level: 3 },
  { id: 'loom', inputs: { 'hard-stone': 5, 'metal-coat': 3, 'copper-bar': 1 }, level: 4 },
  { id: 'furnace', inputs: { 'hard-stone': 8, wood: 5 }, level: 1 },
  // The story asks for one in Chapter 3, so no Crafting level stands in the way.
  { id: 'apricorn-workshop', inputs: { wood: 10, 'hard-stone': 4, 'red-apricorn': 1 }, level: 1 },
  { id: 'berry-cookie', inputs: { cheri: 2, oran: 1 }, level: 1, kitchen: true },
  { id: 'pecha-gateau', inputs: { pecha: 2, 'moomoo-milk': 1 }, level: 2, kitchen: true },
  { id: 'honey-cone', inputs: { honey: 1, 'moomoo-milk': 1, leppa: 1 }, level: 3, kitchen: true },
  { id: 'cheese-sable', inputs: { 'moomoo-cheese': 1, oran: 2 }, level: 4, kitchen: true },
  { id: 'big-malasada', inputs: { 'lucky-egg': 1, honey: 1, sitrus: 2 }, level: 5, kitchen: true },
];

export interface MachineDef {
  /** In-game minutes per batch, before power. */
  minutes: number;
  /** What it makes from an input, or null if it won't take it. */
  output(input: string): string | null;
  /** How many of the input one batch uses (default 1). */
  uses?(input: string): number;
  /** The type of Pokémon on the farm that doubles its speed. */
  poweredBy: 'electric' | 'fire' | null;
  /** Burns this each batch, unless its power type is working on the farm. */
  fuel?: string;
}

const BERRIES = new Set(CROPS.map((c) => c.id));

const SMELT: Record<string, [bar: string, uses: number]> = { 'copper-ore': ['copper-bar', 5], 'iron-ore': ['iron-bar', 5], nugget: ['gold-bar', 2] };
const APRICORN_BALLS: Record<string, string> = {
  'red-apricorn': 'level-ball', 'blue-apricorn': 'lure-ball', 'yellow-apricorn': 'fast-ball', 'green-apricorn': 'friend-ball', 'black-apricorn': 'heavy-ball',
};

export const MACHINES: Record<string, MachineDef> = {
  'berry-press': { minutes: 6 * 60, poweredBy: 'electric', output: (i) => (BERRIES.has(i) ? juiceId(i) : null) },
  'preserves-jar': { minutes: 20 * 60, poweredBy: 'electric', output: (i) => (BERRIES.has(i) ? jamId(i) : null) },
  'cheese-press': { minutes: 4 * 60, poweredBy: 'electric', output: (i) => (i === 'moomoo-milk' ? 'moomoo-cheese' : null) },
  loom: { minutes: 20 * 60, poweredBy: 'electric', output: (i) => (i === 'wool' ? 'silk-cloth' : null) },
  workbench: { minutes: 0, poweredBy: null, output: () => null },
  furnace: { minutes: 4 * 60, poweredBy: 'fire', fuel: 'wood', output: (i) => SMELT[i]?.[0] ?? null, uses: (i) => SMELT[i]?.[1] ?? 1 },
  'apricorn-workshop': { minutes: 2 * 60, poweredBy: 'electric', output: (i) => APRICORN_BALLS[i] ?? null },
};
