import type { Material } from './types';

/**
 * Every material: ores mined from the rock face, gems that drop alongside
 * them, bars smelted in the refinery and the essence each biome's seams give
 * up. Values jump roughly fifteenfold from one biome to the next, which is
 * what pays for the steeper rock below.
 */
export const MATERIALS: readonly Material[] = [
  // --- Topsoil Mine ---------------------------------------------------------
  { id: 'coal', name: 'Coal', kind: 'ore', value: 1, shades: ['#15151a', '#2c2c35', '#55556a'], vein: 'speckle' },
  { id: 'copper', name: 'Copper Ore', kind: 'ore', value: 2, shades: ['#7a3416', '#c8622a', '#f2a65a'], vein: 'streak' },
  { id: 'tin', name: 'Tin Ore', kind: 'ore', value: 3, shades: ['#5d6a72', '#9aa9b2', '#dfe7ea'], vein: 'speckle' },
  { id: 'iron', name: 'Iron Ore', kind: 'ore', value: 6, shades: ['#5a2a24', '#9a5244', '#d79a84'], vein: 'cluster' },
  { id: 'quartz', name: 'Quartz', kind: 'gem', value: 40, shades: ['#a7a3b8', '#e6e2f2', '#ffffff'] },
  { id: 'amber', name: 'Amber', kind: 'gem', value: 70, shades: ['#8a4a06', '#e0901a', '#ffd36b'] },
  { id: 'loam-heart', name: 'Loam Heart', kind: 'essence', value: 150, shades: ['#5a3a1a', '#a8743a', '#f0c47a'] },

  // --- Fungal Caverns -------------------------------------------------------
  { id: 'silver', name: 'Silver Ore', kind: 'ore', value: 30, shades: ['#6c7487', '#b8c2d6', '#f4f8ff'], vein: 'streak' },
  { id: 'mycelite', name: 'Mycelite', kind: 'ore', value: 45, shades: ['#4a2a5a', '#9a5ab8', '#e6a8ff'], vein: 'cluster' },
  { id: 'cobalt', name: 'Cobalt Ore', kind: 'ore', value: 80, shades: ['#12286a', '#2c58c8', '#7aa8ff'], vein: 'speckle' },
  { id: 'sporestone', name: 'Sporestone', kind: 'ore', value: 140, shades: ['#2a5a2a', '#5ab85a', '#c8ffa8'], vein: 'cluster' },
  { id: 'jade', name: 'Jade', kind: 'gem', value: 600, shades: ['#0f5a3a', '#2fae74', '#a8f0c8'] },
  { id: 'moonstone', name: 'Moonstone', kind: 'gem', value: 1000, shades: ['#5a6a8a', '#b4c4e6', '#f4f8ff'] },
  { id: 'spore-heart', name: 'Spore Heart', kind: 'essence', value: 2400, shades: ['#3a1a5a', '#8a4ac8', '#e6b4ff'] },

  // --- Crystal Hollows ------------------------------------------------------
  { id: 'gold', name: 'Gold Ore', kind: 'ore', value: 400, shades: ['#7a5206', '#d8a21a', '#fff07a'], vein: 'streak' },
  { id: 'crystalite', name: 'Crystalite', kind: 'ore', value: 650, shades: ['#1a6a7a', '#3ac8e0', '#c8fbff'], vein: 'cluster' },
  { id: 'platinum', name: 'Platinum Ore', kind: 'ore', value: 1100, shades: ['#6a7a7a', '#c4d6d4', '#ffffff'], vein: 'speckle' },
  { id: 'prismite', name: 'Prismite', kind: 'ore', value: 2000, shades: ['#8a2a7a', '#e05ac8', '#ffc8f4'], vein: 'cluster' },
  { id: 'amethyst', name: 'Amethyst', kind: 'gem', value: 9000, shades: ['#3a1a6a', '#8a4ae0', '#d8b4ff'] },
  { id: 'sapphire', name: 'Sapphire', kind: 'gem', value: 15000, shades: ['#0a1a6a', '#2a5ae6', '#a8c8ff'] },
  { id: 'prism-heart', name: 'Prism Heart', kind: 'essence', value: 36000, shades: ['#2a6a8a', '#5ae0f0', '#f4ffff'] },

  // --- Magma Veins ----------------------------------------------------------
  { id: 'obsidian', name: 'Obsidian', kind: 'ore', value: 6000, shades: ['#0a0612', '#2a1a3a', '#6a5a8a'], vein: 'streak' },
  { id: 'cinnabar', name: 'Cinnabar', kind: 'ore', value: 10000, shades: ['#6a0a0a', '#c82a1a', '#ff8a6a'], vein: 'speckle' },
  { id: 'titanium', name: 'Titanium Ore', kind: 'ore', value: 17000, shades: ['#3a4a5a', '#7a96aa', '#d4e6f0'], vein: 'streak' },
  { id: 'emberstone', name: 'Emberstone', kind: 'ore', value: 30000, shades: ['#7a2a00', '#f06a0a', '#ffd04a'], vein: 'cluster' },
  { id: 'ruby', name: 'Ruby', kind: 'gem', value: 140000, shades: ['#5a0018', '#d0103a', '#ff8aa8'] },
  { id: 'sunstone', name: 'Sunstone', kind: 'gem', value: 230000, shades: ['#8a3a00', '#ff9a1a', '#fff0a8'] },
  { id: 'ember-heart', name: 'Ember Heart', kind: 'essence', value: 540000, shades: ['#6a1000', '#f0400a', '#ffd88a'] },

  // --- The Hollow -----------------------------------------------------------
  { id: 'voidglass', name: 'Voidglass', kind: 'ore', value: 90000, shades: ['#06060e', '#1e1a3a', '#4a4a8a'], vein: 'cluster' },
  { id: 'glyphstone', name: 'Glyphstone', kind: 'ore', value: 150000, shades: ['#1a3a3a', '#3a8a7a', '#9affd8'], vein: 'streak' },
  { id: 'starmetal', name: 'Starmetal', kind: 'ore', value: 260000, shades: ['#2a2a4a', '#8a8ac8', '#ffffff'], vein: 'speckle' },
  { id: 'whisperite', name: 'Whisperite', kind: 'ore', value: 480000, shades: ['#3a0a3a', '#8a2a8a', '#ff9aff'], vein: 'cluster' },
  { id: 'pale-pearl', name: 'Pale Pearl', kind: 'gem', value: 2.2e6, shades: ['#6a6a7a', '#d6d6e6', '#ffffff'] },
  { id: 'dreamstone', name: 'Dreamstone', kind: 'gem', value: 3.6e6, shades: ['#1a0a4a', '#5a3ad8', '#c8b4ff'] },
  { id: 'hollow-heart', name: 'Hollow Heart', kind: 'essence', value: 8e6, shades: ['#000000', '#2a1a4a', '#9a8aff'] },

  // --- Bars -----------------------------------------------------------------
  { id: 'copper-bar', name: 'Copper Bar', kind: 'bar', value: 22, shades: ['#7a3416', '#d0702e', '#ffbe7a'] },
  { id: 'bronze-bar', name: 'Bronze Bar', kind: 'bar', value: 34, shades: ['#6a4a12', '#b8862a', '#f0d07a'] },
  { id: 'iron-bar', name: 'Iron Bar', kind: 'bar', value: 55, shades: ['#3a3a44', '#7a7a8a', '#c8c8d8'] },
  { id: 'silver-bar', name: 'Silver Bar', kind: 'bar', value: 330, shades: ['#6c7487', '#c4ccdf', '#ffffff'] },
  { id: 'cobalt-bar', name: 'Cobalt Bar', kind: 'bar', value: 900, shades: ['#12286a', '#3a6ae0', '#a8c8ff'] },
  { id: 'gold-bar', name: 'Gold Bar', kind: 'bar', value: 4400, shades: ['#7a5206', '#e8b42a', '#fff4a8'] },
  { id: 'platinum-bar', name: 'Platinum Bar', kind: 'bar', value: 12000, shades: ['#6a7a7a', '#d4e4e2', '#ffffff'] },
  { id: 'obsidian-plate', name: 'Obsidian Plate', kind: 'bar', value: 66000, shades: ['#0a0612', '#3a2a4a', '#8a7aa8'] },
  { id: 'titanium-bar', name: 'Titanium Bar', kind: 'bar', value: 190000, shades: ['#3a4a5a', '#8aa6ba', '#e4f4ff'] },
  { id: 'starmetal-bar', name: 'Starmetal Bar', kind: 'bar', value: 2.9e6, shades: ['#2a2a5a', '#9a9ae0', '#ffffff'] },
  { id: 'voidsteel-bar', name: 'Voidsteel Bar', kind: 'bar', value: 1.6e6, shades: ['#06060e', '#2e2a5a', '#7a6ad8'] },
];

export const MATERIAL: ReadonlyMap<string, Material> = new Map(MATERIALS.map((m) => [m.id, m]));

export function material(id: string): Material {
  const m = MATERIAL.get(id);
  if (!m) throw new Error(`Unknown material ${id}`);
  return m;
}
