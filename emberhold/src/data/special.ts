/**
 * Data for the skills that are more than a list of actions: farming plots,
 * the agility course, constellations, the survey map, the settlement,
 * ranch animals, and familiar synergies.
 */
import { DIG_SITES, SAPLING_WOODS } from './items';
import { CROPS, HERBS, WOODS } from './tiers';
import type { Mods, Qty, SkillId } from './types';

// --- Farming -------------------------------------------------------------------

export type PlotKind = 'allotment' | 'herb' | 'tree';

export interface FarmCrop {
  seed: string;
  kind: PlotKind;
  name: string;
  level: number;
  /** Real milliseconds from planting to ripe. */
  grow: number;
  seeds: number;
  xp: number;
  product: string;
  yield: [number, number];
}

export const FARM_CROPS: FarmCrop[] = [
  ...CROPS.map((c, i): FarmCrop => ({
    seed: `seed-${c.id}`, kind: 'allotment', name: c.name, level: c.level, grow: (4 + i * 2) * 60_000, seeds: 3,
    xp: Math.round(8 + c.level * 1.2), product: `crop-${c.id}`, yield: [6 + i, 14 + i * 2],
  })),
  ...HERBS.map((h, i): FarmCrop => ({
    seed: `seed-${h.id}`, kind: 'herb', name: h.name, level: Math.max(1, h.level + 1), grow: (8 + i * 3) * 60_000, seeds: 2,
    xp: Math.round(12 + h.level * 1.6), product: `herb-${h.id}`, yield: [4, 10],
  })),
  ...SAPLING_WOODS.map((w): FarmCrop => {
    const wood = WOODS.find((x) => x.id === w)!;
    return {
      seed: `sapling-${w}`, kind: 'tree', name: wood.tree, level: Math.max(1, wood.level - 5), grow: Math.round((20 + wood.level * 2.5) * 60_000), seeds: 1,
      xp: Math.round(60 + wood.level * 8), product: `log-${w}`, yield: [40 + wood.level, 80 + wood.level * 2],
    };
  }),
];
export const FARM_CROP = new Map(FARM_CROPS.map((c) => [c.seed, c]));

/** Plots you start with, and the most you can buy. */
export const PLOTS: Record<PlotKind, { start: number; max: number; baseCost: number }> = {
  allotment: { start: 3, max: 8, baseCost: 2000 },
  herb: { start: 2, max: 6, baseCost: 5000 },
  tree: { start: 1, max: 4, baseCost: 20000 },
};

// --- Agility -------------------------------------------------------------------

export interface Obstacle {
  id: string;
  slot: number;
  name: string;
  level: number;
  interval: number;
  xp: number;
  gp: number;
  cost: { gp: number; items: Qty[] };
  /** Bonuses (and the odd penalty) while the obstacle is built. */
  mods: Mods;
}

const SLOT_LEVELS = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90];
const OB = (slot: number, k: number, name: string, mods: Mods, items: [string, number][]): Obstacle => ({
  id: `ob-${slot}-${k}`, slot, name, level: SLOT_LEVELS[slot]!, interval: 3000 + slot * 800, xp: Math.round(8 + slot * slot * 4 + slot * 6),
  gp: 5 + slot * 8, cost: { gp: Math.round(1000 * (slot + 1) ** 2.4), items: items.map(([item, qty]) => ({ item, qty })) }, mods,
});

export const OBSTACLES: Obstacle[] = [
  OB(0, 0, 'Rope Swing', { 'interval:woodcutting': 3 }, [['log-normal', 50]]),
  OB(0, 1, 'Log Balance', { 'skillXP:fishing': 3 }, [['log-normal', 50]]),
  OB(0, 2, 'Stepping Stones', { 'interval:mining': 3 }, [['ore-limestone', 40]]),
  OB(1, 0, 'Cargo Net', { gpGain: 3, 'interval:thieving': -2 }, [['wool', 30]]),
  OB(1, 1, 'Monkey Bars', { meleeAccuracy: 3 }, [['bar-iron', 25]]),
  OB(1, 2, 'Pipe Crawl', { 'skillXP:cooking': 4 }, [['bar-iron', 25]]),
  OB(2, 0, 'Rooftop Leap', { 'success:thieving': 5 }, [['plank-oak', 40]]),
  OB(2, 1, 'Zip Line', { 'interval:fishing': 4, 'interval:woodcutting': -1 }, [['bowstring', 40], ['plank-oak', 20]]),
  OB(2, 2, 'Mud Pit', { farmYield: 6 }, [['compost', 30]]),
  OB(3, 0, 'Wall Climb', { damageReduction: 2, attackInterval: 2 }, [['stone-block', 60]]),
  OB(3, 1, 'Tightrope', { rangedAccuracy: 4 }, [['bowstring', 80]]),
  OB(3, 2, 'Lava Hop', { 'preserve:smithing': 4 }, [['bar-steel', 40]]),
  OB(4, 0, 'Spinning Blades', { meleeMaxHit: 3 }, [['bar-mithril', 40]]),
  OB(4, 1, 'Rune Gate', { runePreserve: 6, 'skillXP:runecrafting': 3 }, [['rune-chaos', 300]]),
  OB(4, 2, 'Herb Garden Run', { 'preserve:herblore': 5 }, [['herb-emberroot', 40]]),
  OB(5, 0, 'Waterfall Leap', { hpRegen: 50 }, [['plank-teak', 60]]),
  OB(5, 1, 'Glass Bridge', { magicAccuracy: 5, magicMaxHit: 2 }, [['gem-sapphire', 20]]),
  OB(5, 2, 'Trap Field', { 'doubleChance:hunting': 5 }, [['hunting-trap', 100]]),
  OB(6, 0, 'Cliff Rappel', { 'interval:archaeology': 5, 'interval:cartography': 4 }, [['bowstring', 200], ['plank-mahogany', 40]]),
  OB(6, 1, 'Pendulum Run', { attackInterval: -3, damageReduction: -1 }, [['bar-adamant', 60]]),
  OB(6, 2, 'Ranch Fences', { ranchProduction: 8 }, [['plank-teak', 120], ['nails', 300]]),
  OB(7, 0, 'Sky Bridge', { 'skillXP:astrology': 5, stardust: 5 }, [['plank-yew', 60], ['gem-emerald', 20]]),
  OB(7, 1, 'Fire Walk', { 'resist:fire': 0.08 }, [['fire-essence', 40]]),
  OB(7, 2, 'Ice Slide', { 'resist:water': 0.08 }, [['frost-shard', 40]]),
  OB(8, 0, 'Dragon Hurdles', { meleeMaxHit: 4, rangedMaxHit: 4, magicMaxHit: 4 }, [['dragon-scale', 30]]),
  OB(8, 1, 'Mirror Maze', { lootDouble: 4, gpGain: 5 }, [['gem-diamond', 15]]),
  OB(8, 2, "Builder's Scaffold", { constructionProduction: 10 }, [['plank-yew', 150], ['stone-block', 200]]),
  OB(9, 0, 'Rift Step', { 'resist:void': 0.06 }, [['void-shard', 30]]),
  OB(9, 1, 'Star Path', { skillXP: 3 }, [['bar-starmetal', 50], ['golden-stardust', 5]]),
  OB(9, 2, 'Champion\'s Gauntlet', { combatXP: 5, slayerCoins: 8 }, [['bar-cobalt', 80]]),
];

export const PILLARS: { id: string; name: string; cost: { gp: number; items: Qty[] }; mods: Mods }[] = [
  { id: 'pillar-skill', name: 'Pillar of Industry', cost: { gp: 5_000_000, items: [{ item: 'stone-block', qty: 500 }] }, mods: { 'interval:all': 4 } },
  { id: 'pillar-war', name: 'Pillar of War', cost: { gp: 5_000_000, items: [{ item: 'stone-block', qty: 500 }] }, mods: { meleeAccuracy: 6, rangedAccuracy: 6, magicAccuracy: 6, damageReduction: 2 } },
  { id: 'pillar-fortune', name: 'Pillar of Fortune', cost: { gp: 5_000_000, items: [{ item: 'stone-block', qty: 500 }] }, mods: { gpGain: 10, lootDouble: 5 } },
];

// --- Astrology -----------------------------------------------------------------

export interface Constellation {
  id: string;
  name: string;
  level: number;
  skills: [SkillId, SkillId];
  interval: number;
  xp: number;
}

export const CONSTELLATIONS: Constellation[] = [
  { id: 'hearth', name: 'The Hearth', level: 1, skills: ['firemaking', 'cooking'], interval: 3000, xp: 10 },
  { id: 'axe', name: 'The Axe', level: 10, skills: ['woodcutting', 'fletching'], interval: 3500, xp: 18 },
  { id: 'net', name: 'The Net', level: 20, skills: ['fishing', 'ranching'], interval: 4000, xp: 28 },
  { id: 'anvil', name: 'The Anvil', level: 30, skills: ['mining', 'smithing'], interval: 4500, xp: 40 },
  { id: 'loom', name: 'The Loom', level: 40, skills: ['crafting', 'runecrafting'], interval: 5000, xp: 54 },
  { id: 'cauldron', name: 'The Cauldron', level: 50, skills: ['herblore', 'farming'], interval: 5500, xp: 70 },
  { id: 'mask', name: 'The Mask', level: 60, skills: ['thieving', 'agility'], interval: 6000, xp: 88 },
  { id: 'hound', name: 'The Hound', level: 70, skills: ['hunting', 'beastcrafting'], interval: 6500, xp: 108 },
  { id: 'compass', name: 'The Compass', level: 80, skills: ['cartography', 'archaeology'], interval: 7000, xp: 130 },
  { id: 'tower', name: 'The Tower', level: 90, skills: ['construction', 'enchantment'], interval: 8000, xp: 160 },
];
export const CONSTELLATION = new Map(CONSTELLATIONS.map((c) => [c.id, c]));

/** The four stars of every constellation. The last costs golden stardust. */
export const STARS = [
  { id: 'xp-a', name: 'Star of Learning', golden: false, max: 5, per: (c: Constellation): Mods => ({ [`skillXP:${c.skills[0]}`]: 1 }) },
  { id: 'xp-b', name: 'Star of Practice', golden: false, max: 5, per: (c: Constellation): Mods => ({ [`skillXP:${c.skills[1]}`]: 1 }) },
  { id: 'speed', name: 'Star of Haste', golden: false, max: 5, per: (c: Constellation): Mods => ({ [`interval:${c.skills[0]}`]: 1, [`interval:${c.skills[1]}`]: 1 }) },
  { id: 'gold', name: 'Golden Star', golden: true, max: 5, per: (c: Constellation): Mods => ({ [`doubleChance:${c.skills[0]}`]: 1, [`doubleChance:${c.skills[1]}`]: 1 }) },
] as const;

export function starCost(level: number, golden: boolean): number {
  return golden ? 2 + level * 2 : 40 * (level + 1) ** 2;
}

// --- Cartography ---------------------------------------------------------------

export const MAP_RADIUS = 4;

export interface Poi {
  id: string;
  name: string;
  q: number;
  r: number;
  desc: string;
  /** What finding it gives. */
  reward: { items?: Qty[]; mods?: Mods; site?: string };
}

/** Axial hex coordinates; the centre (0,0) is home. */
export const POIS: Poi[] = [
  ...DIG_SITES.map((s, i): Poi => {
    const spots: [number, number][] = [[1, -1], [-2, 1], [2, 0], [-1, -2], [3, -2], [-3, 3], [0, 4], [-4, 0]];
    const [q, r] = spots[i]!;
    return { id: `site-${s.id}`, name: s.name, q, r, desc: `A dig site for Archaeology (level ${s.level}).`, reward: { site: s.id } };
  }),
  { id: 'poi-spring', name: 'Healing Spring', q: -1, r: 1, desc: 'Drinking here leaves you hardier.', reward: { mods: { maxHP: 3 } } },
  { id: 'poi-cairn', name: 'Old Cairn', q: 2, r: -2, desc: 'Someone buried a stash under it.', reward: { items: [{ item: 'bar-steel', qty: 25 }, { item: 'gem-sapphire', qty: 3 }] } },
  { id: 'poi-grove', name: 'Elder Grove', q: -3, r: 1, desc: 'The trees here teach patience.', reward: { mods: { 'skillXP:woodcutting': 5, 'skillXP:farming': 5 } } },
  { id: 'poi-falls', name: 'Silverfalls', q: 1, r: 2, desc: 'The fish practically jump into the net.', reward: { mods: { 'doubleChance:fishing': 4 } } },
  { id: 'poi-quarry', name: 'Forgotten Quarry', q: 3, r: 0, desc: 'Abandoned tools, still sharp.', reward: { mods: { 'interval:mining': 4 }, items: [{ item: 'stone-block', qty: 50 }] } },
  { id: 'poi-shrine', name: 'Wayside Shrine', q: -2, r: -1, desc: 'A prayer here is heard.', reward: { mods: { prayerCost: -10 } } },
  { id: 'poi-tower', name: 'Ruined Watchtower', q: 0, r: -3, desc: 'From the top you can see for miles.', reward: { mods: { 'interval:cartography': 8 } } },
  { id: 'poi-camp', name: 'Bandit Camp', q: 4, r: -1, desc: 'Empty, but they left their loot.', reward: { items: [{ item: 'gem-ruby', qty: 3 }, { item: 'rune-death', qty: 100 }] } },
  { id: 'poi-observatory', name: 'Hill Observatory', q: -4, r: 2, desc: 'An old telescope still points at the stars.', reward: { mods: { stardust: 10, 'skillXP:astrology': 5 } } },
  { id: 'poi-battlefield', name: 'Old Battlefield', q: 2, r: 2, desc: 'Generations of soldiers fell here.', reward: { mods: { combatXP: 3 } } },
  { id: 'poi-rift', name: 'The Scar', q: 4, r: -4, desc: 'The ground is torn open, and something hums below.', reward: { items: [{ item: 'void-shard', qty: 3 }] } },
  { id: 'poi-market', name: 'Crossroads Market', q: -2, r: 4, desc: 'Traders pay well for news of the road.', reward: { mods: { gpGain: 5 } } },
];
export const POI = new Map(POIS.map((p) => [p.id, p]));

/** Every hex on the map. */
export function mapHexes(): [number, number][] {
  const out: [number, number][] = [];
  for (let q = -MAP_RADIUS; q <= MAP_RADIUS; q++) {
    for (let r = Math.max(-MAP_RADIUS, -q - MAP_RADIUS); r <= Math.min(MAP_RADIUS, -q + MAP_RADIUS); r++) out.push([q, r]);
  }
  return out;
}

export function hexDist(q: number, r: number): number {
  return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
}

/** Survey points a hex needs, and the cartography level to start it. */
export function hexCost(q: number, r: number): { points: number; level: number } {
  const d = hexDist(q, r);
  return { points: 6 + d * d * 6, level: Math.max(1, (d - 1) * 20) };
}

export const HEX_KEY = (q: number, r: number): string => `${q},${r}`;

// --- Construction ---------------------------------------------------------------

export interface Building {
  id: string;
  name: string;
  level: number;
  max: number;
  desc: string;
  /** Workers needed per level (0 for housing). */
  workers: number;
  /** Population housed per level. */
  housing?: number;
  /** Cost of level n+1 is base × growth^n. */
  cost: Qty[];
  gp: number;
  growth: number;
  xp: number;
  /** Production per level per hour, scaled by staffing. */
  produces?: Qty[];
  gpPerHour?: number;
  /** Bonuses per level. */
  mods?: Mods;
  icon: string;
}

export const BUILDINGS: Building[] = [
  { id: 'cottage', name: 'Cottage', level: 1, max: 20, desc: 'Houses 4 settlers per level.', workers: 0, housing: 4, cost: [{ item: 'plank-normal', qty: 20 }, { item: 'nails', qty: 20 }], gp: 500, growth: 1.35, xp: 40, icon: 'house.brown' },
  { id: 'lumberyard', name: 'Lumber Yard', level: 5, max: 10, desc: 'Cuts logs while you are away.', workers: 2, cost: [{ item: 'plank-normal', qty: 30 }, { item: 'stone-block', qty: 10 }], gp: 1000, growth: 1.45, xp: 60, produces: [{ item: 'log-oak', qty: 30 }], icon: 'house.green' },
  { id: 'quarry', name: 'Quarry', level: 10, max: 10, desc: 'Digs limestone and coal.', workers: 3, cost: [{ item: 'plank-oak', qty: 30 }, { item: 'bar-iron', qty: 15 }], gp: 2500, growth: 1.45, xp: 80, produces: [{ item: 'ore-limestone', qty: 25 }, { item: 'ore-coal', qty: 15 }], icon: 'house.grey' },
  { id: 'market', name: 'Market', level: 15, max: 10, desc: 'Trade brings in gold every hour.', workers: 3, cost: [{ item: 'plank-oak', qty: 50 }, { item: 'stone-block', qty: 40 }], gp: 5000, growth: 1.5, xp: 100, gpPerHour: 1500, icon: 'house.gold' },
  { id: 'farmstead', name: 'Farmstead', level: 20, max: 10, desc: 'Better harvests on every plot.', workers: 2, cost: [{ item: 'plank-oak', qty: 60 }, { item: 'compost', qty: 30 }], gp: 8000, growth: 1.5, xp: 120, mods: { farmYield: 4 }, icon: 'house.slime' },
  { id: 'smithy', name: 'Smithy', level: 25, max: 10, desc: 'Settlers sharpen your tools.', workers: 3, cost: [{ item: 'plank-teak', qty: 40 }, { item: 'bar-steel', qty: 40 }], gp: 12000, growth: 1.5, xp: 150, mods: { 'preserve:smithing': 2, 'interval:mining': 1 }, icon: 'house.red' },
  { id: 'tavern', name: 'Tavern', level: 30, max: 10, desc: 'Stories by the fire: more XP in every skill.', workers: 3, cost: [{ item: 'plank-teak', qty: 60 }, { item: 'stone-block', qty: 80 }], gp: 20000, growth: 1.55, xp: 180, mods: { skillXP: 1 }, icon: 'house.amber' },
  { id: 'barracks', name: 'Barracks', level: 40, max: 10, desc: 'Drill with the settlement guard.', workers: 4, cost: [{ item: 'plank-mahogany', qty: 50 }, { item: 'bar-mithril', qty: 40 }], gp: 40000, growth: 1.55, xp: 240, mods: { meleeAccuracy: 2, rangedAccuracy: 2, magicAccuracy: 2 }, icon: 'house.blue' },
  { id: 'shrine', name: 'Shrine', level: 45, max: 10, desc: 'Prayers cost less.', workers: 2, cost: [{ item: 'stone-block', qty: 150 }, { item: 'gem-emerald', qty: 5 }], gp: 50000, growth: 1.55, xp: 260, mods: { prayerCost: -3 }, icon: 'house.white' },
  { id: 'granary', name: 'Granary', level: 50, max: 10, desc: 'Feed lasts longer; animals produce more.', workers: 3, cost: [{ item: 'plank-mahogany', qty: 80 }, { item: 'crop-wheat', qty: 200 }], gp: 60000, growth: 1.55, xp: 300, mods: { ranchProduction: 5 }, icon: 'house.egg' },
  { id: 'library', name: 'Library', level: 60, max: 10, desc: 'Guild studies go faster.', workers: 4, cost: [{ item: 'plank-yew', qty: 80 }, { item: 'stone-block', qty: 200 }], gp: 100000, growth: 1.6, xp: 380, mods: { guildXP: 4 }, icon: 'house.purple' },
  { id: 'mint', name: 'Mint', level: 70, max: 10, desc: 'Strikes coins from gold.', workers: 4, cost: [{ item: 'plank-yew', qty: 100 }, { item: 'bar-gold', qty: 100 }], gp: 200000, growth: 1.6, xp: 450, gpPerHour: 6000, icon: 'house.gold' },
  { id: 'observatory', name: 'Observatory', level: 80, max: 10, desc: 'Watches the sky for stardust.', workers: 4, cost: [{ item: 'plank-yew', qty: 150 }, { item: 'bar-starmetal', qty: 40 }], gp: 400000, growth: 1.65, xp: 550, produces: [{ item: 'stardust', qty: 20 }], icon: 'house.cyan' },
];
export const BUILDING = new Map(BUILDINGS.map((b) => [b.id, b]));

// --- Ranching ------------------------------------------------------------------

export interface Animal {
  id: string;
  name: string;
  level: number;
  /** Bought from the shop for this. */
  price: number;
  feed: string | null;
  /** Milliseconds per production cycle, per animal. */
  interval: number;
  produce: Qty[];
  xp: number;
  pal: string;
}

export const ANIMALS: Animal[] = [
  { id: 'worms', name: 'Worm Bed', level: 1, price: 50, feed: null, interval: 40_000, produce: [{ item: 'worm', qty: 3 }], xp: 6, pal: 'worm' },
  { id: 'chicken', name: 'Chicken', level: 5, price: 200, feed: 'crop-wheat', interval: 60_000, produce: [{ item: 'egg', qty: 1 }, { item: 'feather', qty: 4 }], xp: 12, pal: 'white' },
  { id: 'cow', name: 'Cow', level: 10, price: 800, feed: 'crop-cabbage', interval: 90_000, produce: [{ item: 'milk', qty: 1 }, { item: 'cowhide', qty: 1 }], xp: 20, pal: 'brown' },
  { id: 'sheep', name: 'Sheep', level: 20, price: 1500, feed: 'crop-cabbage', interval: 90_000, produce: [{ item: 'wool', qty: 3 }], xp: 28, pal: 'wool' },
  { id: 'pig', name: 'Pig', level: 30, price: 3000, feed: 'crop-potato', interval: 120_000, produce: [{ item: 'raw-pork', qty: 2 }], xp: 40, pal: 'pink' },
  { id: 'elk', name: 'Elk', level: 55, price: 25000, feed: 'crop-strawberry', interval: 240_000, produce: [{ item: 'elk-antler', qty: 1 }, { item: 'raw-venison', qty: 2 }], xp: 95, pal: 'fox' },
  { id: 'drake', name: 'Drake Hatchling', level: 75, price: 150000, feed: 'raw-meat', interval: 360_000, produce: [{ item: 'green-drakehide', qty: 1 }, { item: 'dragon-scale', qty: 1 }], xp: 180, pal: 'green' },
];
export const ANIMAL = new Map(ANIMALS.map((a) => [a.id, a]));

export const PENS = { start: 2, max: 8, baseCost: 3000, capacity: 5, capacityMax: 20 };

// --- Summoning synergies -------------------------------------------------------

export const SYNERGIES: { a: string; b: string; name: string; mods: Mods }[] = [
  { a: 'beaver', b: 'ent', name: 'Forest Kin', mods: { 'interval:woodcutting': 5, farmYield: 10 } },
  { a: 'otter', b: 'salamander', name: 'Catch and Cook', mods: { 'preserve:cooking': 8, 'doubleChance:fishing': 4 } },
  { a: 'mole', b: 'golem', name: 'Bedrock', mods: { damageReduction: 3, gemChance: 1 } },
  { a: 'wolf', b: 'magpie', name: 'Pack and Plunder', mods: { lootDouble: 5, gpGain: 5 } },
  { a: 'phoenix', b: 'imp', name: 'Hellfire', mods: { magicMaxHit: 6, hpRegen: 50 } },
  { a: 'wyrmling', b: 'golem', name: 'Scaled Fortress', mods: { damageReduction: 5, meleeMaxHit: 4 } },
  { a: 'owl', b: 'beaver', name: 'Night Shift', mods: { 'skillXP:astrology': 6, 'skillXP:woodcutting': 6 } },
];

// --- Museum --------------------------------------------------------------------

/** Donating every artefact of a dig site to the museum gives this. */
export const MUSEUM_REWARDS: Record<string, Mods> = Object.fromEntries(
  DIG_SITES.map((s, i): [string, Mods] => [s.id, i % 2 === 0 ? { 'skillXP:archaeology': 3, gpGain: 2 } : { 'interval:archaeology': 3, lootDouble: 1 }]),
);
