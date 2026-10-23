/**
 * The tier ladders most content is generated from. Each row is one rung —
 * a metal, a wood, a fish — with its level and the three shades its icons
 * are painted in (dark, mid, light).
 */

export type Shades = readonly [string, string, string];

export interface Tier {
  id: string;
  name: string;
  level: number;
  shades: Shades;
}

/** Ores, in mining order. `bar` names the bar they smelt into (if any). */
export const ORES = [
  { id: 'copper', name: 'Copper Ore', level: 1, xp: 7, interval: 3000, shades: ['#7a3e1c', '#c0703a', '#f0a868'] },
  { id: 'tin', name: 'Tin Ore', level: 1, xp: 7, interval: 3000, shades: ['#5a5a60', '#9a9aa2', '#d8d8e0'] },
  { id: 'essence', name: 'Rune Essence', level: 1, xp: 5, interval: 2500, shades: ['#6a6a8a', '#a8a8d0', '#e8e8ff'] },
  { id: 'limestone', name: 'Limestone', level: 5, xp: 9, interval: 3000, shades: ['#8a8070', '#c8bca0', '#f4ecd8'] },
  { id: 'iron', name: 'Iron Ore', level: 10, xp: 14, interval: 3500, shades: ['#4a3028', '#8a5a48', '#c8907a'] },
  { id: 'coal', name: 'Coal', level: 15, xp: 18, interval: 3500, shades: ['#121214', '#2e2e34', '#5a5a64'] },
  { id: 'silver', name: 'Silver Ore', level: 20, xp: 22, interval: 4000, shades: ['#6a7078', '#b0b8c4', '#f0f4ff'] },
  { id: 'gold', name: 'Gold Ore', level: 30, xp: 30, interval: 4500, shades: ['#8a6010', '#d8a428', '#ffe888'] },
  { id: 'mithril', name: 'Mithril Ore', level: 30, xp: 32, interval: 4500, shades: ['#28305a', '#4a5aa8', '#90a0f0'] },
  { id: 'adamantite', name: 'Adamantite Ore', level: 40, xp: 45, interval: 5000, shades: ['#1a4a2a', '#2e8a4a', '#7ad890'] },
  { id: 'cobalt', name: 'Cobalt Ore', level: 55, xp: 65, interval: 5500, shades: ['#0e3a5a', '#1a78b0', '#6ac8ff'] },
  { id: 'starstone', name: 'Starstone', level: 70, xp: 90, interval: 6500, shades: ['#5a3a10', '#e0a020', '#fff0a0'] },
  { id: 'voidstone', name: 'Voidstone', level: 85, xp: 125, interval: 7500, shades: ['#1a0a2a', '#5a2a8a', '#c080ff'] },
] as const;

/** Gear metals. `ore` + `coal` coal per bar; `bars` multiplies every recipe. */
export const METALS = [
  { id: 'bronze', name: 'Bronze', level: 1, ores: [['copper', 1], ['tin', 1]], shades: ['#5a3a18', '#a8703a', '#e8b070'] },
  { id: 'iron', name: 'Iron', level: 10, ores: [['iron', 1]], shades: ['#3a3a40', '#70707a', '#b0b0bc'] },
  { id: 'steel', name: 'Steel', level: 20, ores: [['iron', 1], ['coal', 2]], shades: ['#4a5058', '#8c96a4', '#d8e0ea'] },
  { id: 'mithril', name: 'Mithril', level: 30, ores: [['mithril', 1], ['coal', 3]], shades: ['#202a5a', '#3e52b0', '#8ea0ff'] },
  { id: 'adamant', name: 'Adamant', level: 40, ores: [['adamantite', 1], ['coal', 4]], shades: ['#143e22', '#2a8044', '#78d490'] },
  { id: 'cobalt', name: 'Cobalt', level: 55, ores: [['cobalt', 1], ['coal', 5]], shades: ['#0a3050', '#1874b0', '#70ccff'] },
  { id: 'starmetal', name: 'Starmetal', level: 70, ores: [['starstone', 1], ['coal', 6]], shades: ['#6a4008', '#e09a18', '#fff2a8'] },
  { id: 'voidsteel', name: 'Voidsteel', level: 85, ores: [['voidstone', 1], ['coal', 8]], shades: ['#1a0a2a', '#6030a0', '#d090ff'] },
] as const;

/** Jewelry metals: smelted but never forged into gear. */
export const PRECIOUS = [
  { id: 'silver', name: 'Silver', level: 20, ores: [['silver', 1]], shades: ['#6a7078', '#b8c0cc', '#f8faff'] },
  { id: 'gold', name: 'Gold', level: 30, ores: [['gold', 1]], shades: ['#8a6010', '#e0ac28', '#fff09a'] },
] as const;

export const WOODS = [
  { id: 'normal', name: 'Logs', tree: 'Tree', level: 1, xp: 10, interval: 3000, shades: ['#4a2e14', '#8a5a2a', '#c8925a'] },
  { id: 'oak', name: 'Oak Logs', tree: 'Oak Tree', level: 10, xp: 15, interval: 4000, shades: ['#5a3a18', '#9a6a30', '#d8a860'] },
  { id: 'willow', name: 'Willow Logs', tree: 'Willow Tree', level: 20, xp: 22, interval: 4500, shades: ['#4a4a1a', '#8a8a38', '#c8c878'] },
  { id: 'teak', name: 'Teak Logs', tree: 'Teak Tree', level: 30, xp: 30, interval: 5000, shades: ['#5a2a10', '#a85a28', '#e8986a'] },
  { id: 'maple', name: 'Maple Logs', tree: 'Maple Tree', level: 40, xp: 42, interval: 5500, shades: ['#6a2a0a', '#c0501a', '#ff9a5a'] },
  { id: 'mahogany', name: 'Mahogany Logs', tree: 'Mahogany Tree', level: 50, xp: 55, interval: 6000, shades: ['#3a1010', '#782424', '#c0584a'] },
  { id: 'yew', name: 'Yew Logs', tree: 'Yew Tree', level: 60, xp: 72, interval: 7000, shades: ['#2a3a1a', '#4a6a2e', '#8aac5a'] },
  { id: 'magic', name: 'Magic Logs', tree: 'Magic Tree', level: 75, xp: 100, interval: 8500, shades: ['#1a3a5a', '#3a8ac0', '#a0e8ff'] },
  { id: 'elder', name: 'Elder Logs', tree: 'Elder Tree', level: 85, xp: 135, interval: 10000, shades: ['#2a1a3a', '#6a3a8a', '#c088e0'] },
] as const;

/** Fish, raw to cooked. `heal` is HP restored by the cooked fish. */
export const FISH = [
  { id: 'shrimp', name: 'Shrimp', level: 1, xp: 10, interval: 3500, heal: 30, sell: 2, shades: ['#8a3a2a', '#e07a5a', '#ffc0a0'] },
  { id: 'sardine', name: 'Sardine', level: 5, xp: 14, interval: 4000, heal: 40, sell: 4, shades: ['#3a4a5a', '#7a90a8', '#c8d8f0'] },
  { id: 'herring', name: 'Herring', level: 10, xp: 18, interval: 4500, heal: 60, sell: 6, shades: ['#3a4a3a', '#7a9a7a', '#c0e0c0'] },
  { id: 'trout', name: 'Trout', level: 20, xp: 26, interval: 5000, heal: 80, sell: 10, shades: ['#5a4a2a', '#a89058', '#e8d8a0'] },
  { id: 'salmon', name: 'Salmon', level: 30, xp: 35, interval: 5500, heal: 100, sell: 15, shades: ['#8a3a3a', '#e06a6a', '#ffb0a0'] },
  { id: 'lobster', name: 'Lobster', level: 40, xp: 48, interval: 6500, heal: 120, sell: 22, shades: ['#6a1010', '#c02a1a', '#ff7a5a'] },
  { id: 'swordfish', name: 'Swordfish', level: 50, xp: 62, interval: 7500, heal: 150, sell: 32, shades: ['#2a3a6a', '#4a6ac0', '#a0c0ff'] },
  { id: 'shark', name: 'Shark', level: 65, xp: 85, interval: 9000, heal: 200, sell: 50, shades: ['#3a4048', '#7a8490', '#c8d0da'] },
  { id: 'manta', name: 'Manta Ray', level: 75, xp: 105, interval: 10000, heal: 260, sell: 70, shades: ['#1a2a4a', '#3a5a8a', '#90b0e0'] },
  { id: 'rifteel', name: 'Rift Eel', level: 88, xp: 140, interval: 12000, heal: 340, sell: 100, shades: ['#2a0a3a', '#6a2a9a', '#d090ff'] },
] as const;

export const GEMS = [
  { id: 'topaz', name: 'Topaz', level: 1, sell: 30, shades: ['#8a4a0a', '#e0902a', '#ffd88a'] },
  { id: 'sapphire', name: 'Sapphire', level: 20, sell: 60, shades: ['#0a1a6a', '#2a4ae0', '#9ab0ff'] },
  { id: 'emerald', name: 'Emerald', level: 30, sell: 100, shades: ['#0a4a1a', '#1ab04a', '#8affb0'] },
  { id: 'ruby', name: 'Ruby', level: 45, sell: 180, shades: ['#5a0a14', '#d01a3a', '#ff8aa0'] },
  { id: 'diamond', name: 'Diamond', level: 60, sell: 300, shades: ['#6a8a9a', '#c8e8f8', '#ffffff'] },
  { id: 'onyx', name: 'Onyx', level: 75, sell: 600, shades: ['#0a0a0e', '#2a2a36', '#6a6a80'] },
] as const;

export const RUNES = [
  { id: 'air', name: 'Air Rune', level: 1, xp: 5, shades: ['#6a7a8a', '#c0d0e0', '#ffffff'] },
  { id: 'water', name: 'Water Rune', level: 5, xp: 6, shades: ['#0a2a6a', '#2a6ae0', '#8ac0ff'] },
  { id: 'earth', name: 'Earth Rune', level: 9, xp: 7, shades: ['#3a2a10', '#7a5a28', '#c0a060'] },
  { id: 'fire', name: 'Fire Rune', level: 14, xp: 8, shades: ['#6a1a0a', '#e04a1a', '#ffb05a'] },
  { id: 'mind', name: 'Mind Rune', level: 2, xp: 6, shades: ['#5a3a0a', '#c08a2a', '#ffd88a'] },
  { id: 'chaos', name: 'Chaos Rune', level: 30, xp: 10, shades: ['#5a2a0a', '#d0702a', '#ffc08a'] },
  { id: 'nature', name: 'Nature Rune', level: 40, xp: 12, shades: ['#0a3a0a', '#2a8a2a', '#8ae08a'] },
  { id: 'death', name: 'Death Rune', level: 50, xp: 14, shades: ['#1a1a1a', '#5a5a5a', '#dadada'] },
  { id: 'blood', name: 'Blood Rune', level: 65, xp: 17, shades: ['#3a0a0a', '#9a1a1a', '#ff5a5a'] },
  { id: 'soul', name: 'Soul Rune', level: 75, xp: 20, shades: ['#2a2a4a', '#6a6aa8', '#d0d0ff'] },
  { id: 'void', name: 'Void Rune', level: 85, xp: 26, shades: ['#14082a', '#5a2a9a', '#d090ff'] },
] as const;

export const HERBS = [
  { id: 'brightleaf', name: 'Brightleaf', level: 1, shades: ['#2a5a1a', '#5aa83a', '#b0f08a'] },
  { id: 'sagewort', name: 'Sagewort', level: 10, shades: ['#3a4a3a', '#7a9a7a', '#c0dac0'] },
  { id: 'emberroot', name: 'Emberroot', level: 20, shades: ['#5a1a0a', '#c04a1a', '#ff9a5a'] },
  { id: 'frostmint', name: 'Frostmint', level: 30, shades: ['#1a4a5a', '#3a9ab0', '#a0f0ff'] },
  { id: 'duskbloom', name: 'Duskbloom', level: 40, shades: ['#3a1a4a', '#7a3a9a', '#d09af0'] },
  { id: 'stormvine', name: 'Stormvine', level: 55, shades: ['#2a3a5a', '#5a7ab0', '#c0d8ff'] },
  { id: 'sunpetal', name: 'Sunpetal', level: 65, shades: ['#6a5a0a', '#e0c02a', '#fff4a0'] },
  { id: 'voidthistle', name: 'Voidthistle', level: 80, shades: ['#1a0a2a', '#5a2a8a', '#c088f0'] },
] as const;

/** Allotment crops. `heal` is what one is worth eaten raw (0 = not food). */
export const CROPS = [
  { id: 'potato', name: 'Potato', level: 1, heal: 15, shades: ['#5a3a1a', '#a87a4a', '#e0c090'] },
  { id: 'wheat', name: 'Wheat', level: 5, heal: 0, shades: ['#6a5010', '#c8a030', '#fff0a0'] },
  { id: 'onion', name: 'Onion', level: 10, heal: 15, shades: ['#6a4a2a', '#c09060', '#f8e0b8'] },
  { id: 'cabbage', name: 'Cabbage', level: 15, heal: 20, shades: ['#1a5a1a', '#4aa84a', '#b0f0a0'] },
  { id: 'tomato', name: 'Tomato', level: 25, heal: 25, shades: ['#6a0a0a', '#d02a1a', '#ff8a7a'] },
  { id: 'sweetcorn', name: 'Sweetcorn', level: 35, heal: 30, shades: ['#6a5a0a', '#e0c82a', '#fff8a0'] },
  { id: 'strawberry', name: 'Strawberry', level: 45, heal: 40, shades: ['#6a0a1a', '#e02a4a', '#ff9aa8'] },
  { id: 'watermelon', name: 'Watermelon', level: 55, heal: 60, shades: ['#0a4a1a', '#2a9a3a', '#ff6a7a'] },
  { id: 'starfruit', name: 'Starfruit', level: 70, heal: 90, shades: ['#6a5a0a', '#f0d02a', '#fffad0'] },
] as const;

/** Hides for crafting's ranged armour, and where each comes from. */
export const HIDES = [
  { id: 'leather', name: 'Leather', hide: 'cowhide', level: 1, shades: ['#4a2a10', '#8a5a2a', '#c8925a'] },
  { id: 'hardleather', name: 'Hardleather', hide: 'boar-hide', level: 15, shades: ['#3a2a18', '#6a4a2a', '#a87a4a'] },
  { id: 'wolfskin', name: 'Wolfskin', hide: 'wolf-pelt', level: 35, shades: ['#3a3a40', '#70707c', '#b8b8c8'] },
  { id: 'bearskin', name: 'Bearskin', hide: 'bear-pelt', level: 50, shades: ['#2a1a0a', '#5a3a1a', '#8a6a4a'] },
  { id: 'drakehide', name: 'Drakehide', hide: 'green-drakehide', level: 65, shades: ['#0a3a1a', '#2a7a3a', '#7ad08a'] },
  { id: 'elderhide', name: 'Elder Drakehide', hide: 'black-drakehide', level: 80, shades: ['#0a0a10', '#2a2a3a', '#7a6a9a'] },
] as const;

/** Magic robe tiers, woven from wool in runecrafting. */
export const ROBES = [
  { id: 'apprentice', name: 'Apprentice', level: 1, rune: 'air', shades: ['#1a2a5a', '#3a5ab0', '#8aa8ff'] },
  { id: 'adept', name: 'Adept', level: 20, rune: 'mind', shades: ['#3a1a4a', '#7a3a9a', '#c88af0'] },
  { id: 'wizard', name: 'Wizard', level: 40, rune: 'chaos', shades: ['#4a0a0a', '#a02020', '#f07a6a'] },
  { id: 'archmage', name: 'Archmage', level: 60, rune: 'death', shades: ['#0a2a2a', '#1a7a7a', '#7ae0d8'] },
  { id: 'riftweave', name: 'Riftweave', level: 85, rune: 'void', shades: ['#14082a', '#5a2a9a', '#e0a0ff'] },
] as const;

/** Index → multiplier used for gear stats across every ladder. */
export const POWER = [1, 1.6, 2.4, 3.4, 4.6, 6.2, 8.2, 10.8, 13.5] as const;

export function power(i: number): number {
  return POWER[Math.min(i, POWER.length - 1)]!;
}
