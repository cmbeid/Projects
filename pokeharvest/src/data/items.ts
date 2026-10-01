/**
 * Everything that can sit in the bag. Tools are always owned and never
 * counted. Berries, balls, goods and food use PokeAPI's icons; tools,
 * machines and seed packets are drawn (see `ui/icons.ts`).
 */
import { CROPS } from './crops';

export type ItemKind = 'tool' | 'seed' | 'crop' | 'ball' | 'material' | 'product' | 'artisan' | 'food' | 'machine' | 'candy';
export type Tool = 'hoe' | 'can' | 'sickle';
/** Food buffs, which last until you sleep. */
export type Buff = 'swift' | 'lucky' | 'coach' | 'steady';

export interface Item {
  id: string;
  name: string;
  kind: ItemKind;
  /** What the shipping bin pays, before the day's market. 0 for things that can't be sold. */
  sellPrice: number;
  /** What a shop charges, when one stocks it. */
  buyPrice?: number;
  /** For seeds, crops and their juices and jams: the crop. */
  crop?: string;
  /** PokeAPI icon name, when there is one. */
  icon?: string;
  /** Berries: HP restored in battle (as a share of max HP when below 1). */
  heals?: number;
  /** Balls: how much they multiply the catch rate. */
  ball?: number;
  /** Apricorn balls: what makes them work better (see `game/battle.ts`). */
  ballBonus?: 'level' | 'water' | 'fast' | 'heavy';
  /** Food: energy restored, and a buff for the rest of the day. */
  energy?: number;
  buff?: Buff;
  description?: string;
}

export const TOOLS: readonly Tool[] = ['hoe', 'can', 'sickle'];

export const BUFF_TEXT: Record<Buff, string> = {
  swift: 'You walk faster today.',
  lucky: 'More extra berries at harvest today.',
  coach: 'Your Pokémon earn 50% more XP today.',
  steady: 'Tool work costs 1 less energy today.',
};

const HEALS: Record<string, number> = { oran: 20, sitrus: 0.3 };

const OTHER: Item[] = [
  { id: 'hoe', name: 'Hoe', kind: 'tool', sellPrice: 0 },
  { id: 'can', name: 'Watering Can', kind: 'tool', sellPrice: 0 },
  { id: 'sickle', name: 'Sickle', kind: 'tool', sellPrice: 0 },
  { id: 'poke-ball', name: 'Poké Ball', kind: 'ball', sellPrice: 50, buyPrice: 100, icon: 'poke-ball', ball: 1, description: 'Throw it at a weakened wild Pokémon to befriend it.' },
  { id: 'great-ball', name: 'Great Ball', kind: 'ball', sellPrice: 150, buyPrice: 300, icon: 'great-ball', ball: 1.5, description: 'A better ball: half again as likely to work.' },
  { id: 'hard-stone', name: 'Hard Stone', kind: 'material', sellPrice: 40, icon: 'hard-stone', description: 'Wild Pokémon drop it. For copper tools, machines and barns.' },
  { id: 'metal-coat', name: 'Metal Coat', kind: 'material', sellPrice: 120, icon: 'metal-coat', description: 'An uncommon drop. For steel tools, machines and barns.' },
  { id: 'nugget', name: 'Nugget', kind: 'material', sellPrice: 300, icon: 'nugget', description: 'A rare drop. For gold tools and the biggest barn.' },
  { id: 'level-ball', name: 'Level Ball', kind: 'ball', sellPrice: 150, icon: 'level-ball', ball: 1, ballBonus: 'level', description: 'Made from a Red Apricorn. Four times as good against a Pokémon well below your own level.' },
  { id: 'lure-ball', name: 'Lure Ball', kind: 'ball', sellPrice: 150, icon: 'lure-ball', ball: 1, ballBonus: 'water', description: 'Made from a Blue Apricorn. Three times as good against Water types.' },
  { id: 'fast-ball', name: 'Fast Ball', kind: 'ball', sellPrice: 150, icon: 'fast-ball', ball: 1, ballBonus: 'fast', description: 'Made from a Yellow Apricorn. Four times as good against fast Pokémon.' },
  { id: 'friend-ball', name: 'Friend Ball', kind: 'ball', sellPrice: 150, icon: 'friend-ball', ball: 1.5, description: 'Made from a Green Apricorn. Half again as good, and the Pokémon starts out fond of you.' },
  { id: 'heavy-ball', name: 'Heavy Ball', kind: 'ball', sellPrice: 150, icon: 'heavy-ball', ball: 1, ballBonus: 'heavy', description: 'Made from a Black Apricorn. Three times as good against Rock and Steel types.' },
  { id: 'wood', name: 'Wood', kind: 'material', sellPrice: 10, buyPrice: 25, icon: 'stick', description: 'From fallen logs in Whisperwood, or the town workshop. Fuel for the Furnace, and building stuff.' },
  { id: 'copper-ore', name: 'Copper Ore', kind: 'material', sellPrice: 25, icon: 'heat-rock', description: 'Mined in Granite Pass. The Furnace smelts five into a Copper Bar.' },
  { id: 'iron-ore', name: 'Iron Ore', kind: 'material', sellPrice: 45, icon: 'iron-ball', description: 'Mined deeper in Granite Pass. The Furnace smelts five into an Iron Bar.' },
  { id: 'copper-bar', name: 'Copper Bar', kind: 'material', sellPrice: 180, icon: 'flame-plate', description: 'For machines.' },
  { id: 'iron-bar', name: 'Iron Bar', kind: 'material', sellPrice: 320, icon: 'iron-plate', description: 'For steel tools and bigger barns.' },
  { id: 'gold-bar', name: 'Gold Bar', kind: 'material', sellPrice: 900, icon: 'zap-plate', description: 'Smelted from two Nuggets. For gold tools and the grandest barn.' },
  ...(['red', 'blue', 'yellow', 'green', 'black'] as const).map((c): Item => ({
    id: `${c}-apricorn`, name: `${c[0]!.toUpperCase()}${c.slice(1)} Apricorn`, kind: 'material', sellPrice: 30, icon: `${c}-apricorn`,
    description: "Picked in Whisperwood. The Apricorn Workshop makes a ball from it.",
  })),
  { id: 'rare-candy', name: 'Rare Candy', kind: 'candy', sellPrice: 200, icon: 'rare-candy', description: 'Give it to a Pokémon to raise its level by one.' },
  // Livestock goods.
  { id: 'moomoo-milk', name: 'Moomoo Milk', kind: 'product', sellPrice: 120, icon: 'moomoo-milk', description: "Miltank's milk. The Cheese Press turns it into cheese." },
  { id: 'wool', name: 'Fluffy Wool', kind: 'product', sellPrice: 110, icon: 'fluffy-tail', description: 'Shorn from Mareep and Wooloo. The Loom weaves it into cloth.' },
  { id: 'honey', name: 'Honey', kind: 'product', sellPrice: 90, icon: 'honey', description: 'Gathered by Combee. Lovely in cooking.' },
  { id: 'lucky-egg', name: 'Lucky Egg', kind: 'product', sellPrice: 300, icon: 'lucky-egg', description: 'Chansey lays one now and then. Prized by cooks.' },
  { id: 'slowpoke-tail', name: 'Slowpoke Tail', kind: 'product', sellPrice: 250, icon: 'slowpoke-tail', description: 'It grows right back. A delicacy, apparently.' },
  // Goods from machines.
  { id: 'moomoo-cheese', name: 'Moomoo Cheese', kind: 'artisan', sellPrice: 350, icon: 'lumiose-galette', description: 'Pressed from Moomoo Milk.' },
  { id: 'silk-cloth', name: 'Silk Cloth', kind: 'artisan', sellPrice: 400, icon: 'silk-scarf', description: 'Woven from Fluffy Wool.' },
  // Food: cooked in the Craft tab, eaten from the bag.
  { id: 'berry-cookie', name: 'Berry Cookie', kind: 'food', sellPrice: 90, icon: 'lava-cookie', energy: 35 },
  { id: 'pecha-gateau', name: 'Pecha Gateau', kind: 'food', sellPrice: 260, icon: 'old-gateau', energy: 60, buff: 'swift' },
  { id: 'honey-cone', name: 'Honey Cone', kind: 'food', sellPrice: 320, icon: 'casteliacone', energy: 80, buff: 'lucky' },
  { id: 'cheese-sable', name: 'Cheese Sablé', kind: 'food', sellPrice: 480, icon: 'shalour-sable', energy: 100, buff: 'steady' },
  { id: 'big-malasada', name: 'Big Malasada', kind: 'food', sellPrice: 900, icon: 'big-malasada', energy: 999, buff: 'coach' },
  // Machines: crafted, then placed on the farm.
  { id: 'berry-press', name: 'Berry Press', kind: 'machine', sellPrice: 100, description: 'Presses a berry into juice in 6 hours.' },
  { id: 'preserves-jar', name: 'Preserves Jar', kind: 'machine', sellPrice: 150, description: 'Turns a berry into jam overnight.' },
  { id: 'cheese-press', name: 'Cheese Press', kind: 'machine', sellPrice: 250, description: 'Turns Moomoo Milk into cheese in 4 hours.' },
  { id: 'loom', name: 'Loom', kind: 'machine', sellPrice: 300, description: 'Weaves Fluffy Wool into Silk Cloth overnight.' },
  { id: 'workbench', name: 'Workbench', kind: 'machine', sellPrice: 200, buyPrice: 800, description: 'Machines and stations can only be crafted while one stands on your farm.' },
  { id: 'furnace', name: 'Furnace', kind: 'machine', sellPrice: 250, description: 'Smelts five ore (or two Nuggets) into a bar in 4 hours. Burns a piece of Wood each time, unless a Fire Pokémon is working on the farm.' },
  { id: 'apricorn-workshop', name: 'Apricorn Workshop', kind: 'machine', sellPrice: 250, description: 'Turns an Apricorn into a special ball in 2 hours.' },
];

export function seedId(cropId: string): string {
  return `${cropId}-seed`;
}
export function juiceId(cropId: string): string {
  return `${cropId}-juice`;
}
export function jamId(cropId: string): string {
  return `${cropId}-jam`;
}

export const ITEMS: ReadonlyMap<string, Item> = new Map(
  [
    ...OTHER,
    ...CROPS.map((c): Item => ({ id: seedId(c.id), name: `${c.name.replace(' Berry', '')} Seeds`, kind: 'seed', sellPrice: Math.floor(c.seedPrice / 2), buyPrice: c.seedPrice, crop: c.id, icon: c.icon })),
    ...CROPS.map((c): Item => ({ id: c.id, name: c.name, kind: 'crop', sellPrice: c.sellPrice, crop: c.id, icon: c.icon, ...(HEALS[c.id] ? { heals: HEALS[c.id] } : {}) })),
    ...CROPS.map((c): Item => ({ id: juiceId(c.id), name: `${c.name.replace(' Berry', '')} Juice`, kind: 'artisan', sellPrice: c.sellPrice * 2 + 20, crop: c.id, icon: 'berry-juice', description: 'Pressed in a Berry Press.' })),
    ...CROPS.map((c): Item => ({ id: jamId(c.id), name: `${c.name.replace(' Berry', '')} Jam`, kind: 'artisan', sellPrice: Math.floor(c.sellPrice * 2.5) + 40, crop: c.id, icon: 'sweet-heart', description: 'Made in a Preserves Jar.' })),
  ].map((i) => [i.id, i]),
);

export function item(id: string): Item {
  const i = ITEMS.get(id);
  if (!i) throw new Error(`unknown item ${id}`);
  return i;
}

/** Every PokeAPI item icon the game draws. */
export const ITEM_ICONS: readonly string[] = [...new Set([...ITEMS.values()].flatMap((i) => (i.icon ? [i.icon] : [])))];

export function itemIconUrl(icon: string): string {
  return `items/${icon}.png`;
}

/** What the Poké Mart stocks, in shelf order. */
export const MART_STOCK: readonly string[] = [...CROPS.map((c) => seedId(c.id)), 'poke-ball', 'great-ball'];

/** The Mart buys things on the spot, but for less than the shipping bin pays overnight. */
export const MART_SELL_RATE = 0.6;

/** Things the bin and the Mart will take. */
export function sellable(id: string): boolean {
  const kind = ITEMS.get(id)?.kind;
  return kind === 'crop' || kind === 'material' || kind === 'product' || kind === 'artisan' || kind === 'food';
}

/** Things whose price swings with the market. */
export function marketItem(id: string): boolean {
  const kind = ITEMS.get(id)?.kind;
  return kind === 'crop' || kind === 'product' || kind === 'artisan';
}
