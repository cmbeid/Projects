/** Recipes for machines and dishes, and what each machine makes from what. */
import { CROPS } from './crops';
import { jamId, juiceId } from './items';

export interface Recipe {
  /** The item made. */
  id: string;
  inputs: Record<string, number>;
  /** Crafting level needed. */
  level: number;
  /** Dishes are cooked in the farmhouse kitchen, so only on the farm. */
  kitchen?: boolean;
}

export const RECIPES: readonly Recipe[] = [
  { id: 'berry-press', inputs: { 'hard-stone': 4, oran: 3 }, level: 1 },
  { id: 'preserves-jar', inputs: { 'hard-stone': 3, 'metal-coat': 1, cheri: 2 }, level: 2 },
  { id: 'cheese-press', inputs: { 'hard-stone': 4, 'metal-coat': 2 }, level: 3 },
  { id: 'loom', inputs: { 'hard-stone': 5, 'metal-coat': 3 }, level: 4 },
  { id: 'berry-cookie', inputs: { cheri: 2, oran: 1 }, level: 1, kitchen: true },
  { id: 'pecha-gateau', inputs: { pecha: 2, 'moomoo-milk': 1 }, level: 2, kitchen: true },
  { id: 'honey-cone', inputs: { honey: 1, 'moomoo-milk': 1, leppa: 1 }, level: 3, kitchen: true },
  { id: 'cheese-sable', inputs: { 'moomoo-cheese': 1, oran: 2 }, level: 4, kitchen: true },
  { id: 'big-malasada', inputs: { 'lucky-egg': 1, honey: 1, sitrus: 2 }, level: 5, kitchen: true },
];

export interface MachineDef {
  /** In-game minutes per batch, before Electric power. */
  minutes: number;
  /** What it makes from an input, or null if it won't take it. */
  output(input: string): string | null;
}

const BERRIES = new Set(CROPS.map((c) => c.id));

export const MACHINES: Record<string, MachineDef> = {
  'berry-press': { minutes: 6 * 60, output: (i) => (BERRIES.has(i) ? juiceId(i) : null) },
  'preserves-jar': { minutes: 20 * 60, output: (i) => (BERRIES.has(i) ? jamId(i) : null) },
  'cheese-press': { minutes: 4 * 60, output: (i) => (i === 'moomoo-milk' ? 'moomoo-cheese' : null) },
  loom: { minutes: 20 * 60, output: (i) => (i === 'wool' ? 'silk-cloth' : null) },
};
