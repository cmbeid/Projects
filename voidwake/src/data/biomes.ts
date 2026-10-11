import type { BiomeDef, BiomeId, FaunaDef } from './types';

export const BIOMES: readonly BiomeDef[] = [
  {
    id: 'rocky', name: 'Barren rock', desc: 'Airless stone and old craters. Safe, and poor.', hazard: 'none',
    walls: 0.44, hazardShare: 0, liquid: 'none', liquidShare: 0,
    mats: { ore: 6, ice: 2, crystal: 1 }, fauna: ['skitter', 'burrower'],
    pal: ['#6a6058', '#5a5049', '#3a332e', '#857a70', '#2a2522', '#6a6058', '#c8a070'], sky: '#1a1614',
  },
  {
    id: 'ice', name: 'Frozen world', desc: 'Glaciers over a black sea. The cold gets into suits.', hazard: 'cold',
    walls: 0.42, hazardShare: 0.18, liquid: 'water', liquidShare: 0.08,
    mats: { ice: 7, ore: 2, crystal: 1 }, fauna: ['frostmite', 'icewyrm'],
    pal: ['#b8d8e8', '#98bcd0', '#5a7a98', '#e0f0f8', '#2a4a78', '#d8f0ff', '#ffffff'], sky: '#9ab8d0',
  },
  {
    id: 'jungle', name: 'Overgrown world', desc: 'Breathable, nearly. The spores are the problem.', hazard: 'spores',
    walls: 0.47, hazardShare: 0.16, liquid: 'water', liquidShare: 0.06,
    mats: { organics: 7, ore: 2, crystal: 1 }, fauna: ['stalker', 'sporebag'],
    pal: ['#3a6a2a', '#2e5822', '#1a3a14', '#5a8a3a', '#2a5a5a', '#9ac050', '#e0f070'], sky: '#4a7a3a',
  },
  {
    id: 'desert', name: 'Dune world', desc: 'Sand to the horizon, and the heat comes off it in sheets.', hazard: 'heat',
    walls: 0.36, hazardShare: 0.2, liquid: 'none', liquidShare: 0,
    mats: { ore: 4, crystal: 3, relic: 1 }, fauna: ['sandshark', 'skitter'],
    pal: ['#d8b070', '#c89c5c', '#8a6038', '#f0cc88', '#6a4628', '#f0a050', '#fff0c0'], sky: '#e8b878',
  },
  {
    id: 'volcanic', name: 'Volcanic world', desc: 'Rivers of rock. Rich, if you can stand it.', hazard: 'heat',
    walls: 0.45, hazardShare: 0.14, liquid: 'lava', liquidShare: 0.1,
    mats: { ore: 6, crystal: 3, relic: 1 }, fauna: ['magmite', 'cinderbat'],
    pal: ['#4a3430', '#3c2a27', '#201614', '#6a4a40', '#f06020', '#a04030', '#ffc040'], sky: '#3a1a14',
  },
  {
    id: 'toxic', name: 'Toxic world', desc: 'Yellow air that eats seals. Life loves it.', hazard: 'toxin',
    walls: 0.43, hazardShare: 0.22, liquid: 'acid', liquidShare: 0.08,
    mats: { organics: 4, crystal: 3, relic: 1 }, fauna: ['sporebag', 'acidmaw'],
    pal: ['#7a7a30', '#686828', '#3a3a18', '#9a9a48', '#a0d020', '#c0c040', '#e0ff40'], sky: '#8a8a30',
  },
  {
    id: 'ocean', name: 'Ocean world', desc: 'Islands in an endless sea. Deep water is slow going.', hazard: 'none',
    walls: 0.3, hazardShare: 0, liquid: 'water', liquidShare: 0.32,
    mats: { organics: 4, ice: 3, relic: 1 }, fauna: ['shellback', 'icewyrm'],
    pal: ['#c8b888', '#b4a476', '#5a6a48', '#e0d0a0', '#2a6aa8', '#c8b888', '#a0e0ff'], sky: '#5aa0d0',
  },
  {
    id: 'crystal', name: 'Crystal world', desc: 'A planet that grew instead of cooling. It is very slightly radioactive.', hazard: 'radiation',
    walls: 0.46, hazardShare: 0.2, liquid: 'none', liquidShare: 0,
    mats: { crystal: 8, relic: 1, ore: 1 }, fauna: ['shardling', 'resonant'],
    pal: ['#4a3a6a', '#3e305a', '#22183a', '#7a5aa8', '#2a1a4a', '#a070e0', '#f0c0ff'], sky: '#2a1a40',
  },
  {
    id: 'wreck', name: 'Ark wreckage', desc: 'A piece of the Meridian, half-buried. Its security still works.', hazard: 'sparks',
    walls: 0.5, hazardShare: 0.14, liquid: 'none', liquidShare: 0,
    mats: { relic: 4, ore: 3, crystal: 2 }, fauna: ['secdrone', 'skitter'],
    pal: ['#5a6068', '#4a5058', '#2a2e34', '#8a929c', '#1a1e24', '#f0d040', '#5ad0f0'], sky: '#14181e',
  },
];
export const BIOME = new Map(BIOMES.map((b) => [b.id, b]));
export const BIOME_IDS: readonly BiomeId[] = BIOMES.map((b) => b.id);

export const FAUNA: readonly FaunaDef[] = [
  { id: 'skitter', name: 'Skitter', hp: 14, dmg: 5, speed: 2.6, aggro: 5, ranged: false, cooldown: 0.9, color: '#a08070', desc: 'Six legs, all of them fast.' },
  { id: 'burrower', name: 'Burrower', hp: 30, dmg: 9, speed: 1.6, aggro: 4, ranged: false, cooldown: 1.2, color: '#806050', desc: 'Comes up under you.' },
  { id: 'frostmite', name: 'Frostmite', hp: 16, dmg: 5, speed: 2.4, aggro: 5, ranged: false, cooldown: 0.8, color: '#c0e8ff', desc: 'Swarms toward warmth.' },
  { id: 'icewyrm', name: 'Ice Wyrm', hp: 45, dmg: 11, speed: 1.8, aggro: 6, ranged: false, cooldown: 1.3, color: '#5a90c0', desc: 'A long white shape under the ice.' },
  { id: 'stalker', name: 'Vine Stalker', hp: 28, dmg: 8, speed: 2.5, aggro: 6, ranged: false, cooldown: 1, color: '#5a9a3a', desc: 'Looks like a plant until it doesn\'t.' },
  { id: 'sporebag', name: 'Sporebag', hp: 20, dmg: 6, speed: 1.2, aggro: 6, ranged: true, cooldown: 2, color: '#c0c050', desc: 'Floats, and spits.' },
  { id: 'sandshark', name: 'Sand Shark', hp: 38, dmg: 10, speed: 2.8, aggro: 6, ranged: false, cooldown: 1.2, color: '#c09060', desc: 'A fin in the dunes.' },
  { id: 'magmite', name: 'Magmite', hp: 34, dmg: 10, speed: 1.9, aggro: 5, ranged: false, cooldown: 1.1, color: '#f08040', desc: 'Glows hotter as it gets closer.' },
  { id: 'cinderbat', name: 'Cinderbat', hp: 18, dmg: 7, speed: 3, aggro: 7, ranged: true, cooldown: 1.8, color: '#e05030', desc: 'Drops burning ash.' },
  { id: 'acidmaw', name: 'Acid Maw', hp: 40, dmg: 12, speed: 1.7, aggro: 5, ranged: true, cooldown: 2.2, color: '#a0d030', desc: 'Its spit eats through visors.' },
  { id: 'shellback', name: 'Shellback', hp: 50, dmg: 9, speed: 1.4, aggro: 4, ranged: false, cooldown: 1.4, color: '#7aa0a0', desc: 'A walking boulder with a temper.' },
  { id: 'shardling', name: 'Shardling', hp: 24, dmg: 8, speed: 2.4, aggro: 6, ranged: false, cooldown: 0.9, color: '#c090f0', desc: 'A crystal that learned to walk.' },
  { id: 'resonant', name: 'Resonant', hp: 36, dmg: 11, speed: 1.6, aggro: 7, ranged: true, cooldown: 2, color: '#f0a0ff', desc: 'It sings, and the song cuts.' },
  { id: 'secdrone', name: 'Security Drone', hp: 32, dmg: 9, speed: 2.2, aggro: 7, ranged: true, cooldown: 1.6, color: '#f0d040', desc: 'The ark\'s security. It does not recognise you.' },
];
export const FAUNA_DEF = new Map(FAUNA.map((f) => [f.id, f]));
