import type { Biome } from './types';

/**
 * The five strata, top to bottom. Each one has its own rock, ore table and
 * hazard, and its own setting for the generative score in `audio/music.ts` —
 * the music gets slower, darker and less resolved the deeper you go.
 */
export const BIOMES: readonly Biome[] = [
  {
    id: 'topsoil',
    name: 'Topsoil Mine',
    from: 1,
    hazard: 'none',
    blurb: 'Old timber props and older lamp soot. Somebody worked this shaft before you.',
    rock: ['#1a120c', '#3f2c1e', '#5e4430', '#806048'],
    sky: ['#1d1610', '#0a0705'],
    glow: '#ffcf7a',
    ores: [
      { id: 'coal', weight: 40 },
      { id: 'copper', weight: 30 },
      { id: 'tin', weight: 20 },
      { id: 'iron', weight: 10 },
    ],
    gems: ['quartz', 'amber'],
    essence: 'loam-heart',
    music: { root: 50, scale: [0, 2, 3, 5, 7, 8, 10], beat: 1.4, filter: 1500, unease: 0.04, droneInterval: 7 },
  },
  {
    id: 'fungal',
    name: 'Fungal Caverns',
    from: 21,
    hazard: 'spore',
    blurb: 'The walls are soft here and faintly warm. Spores choke machines that breathe them.',
    rock: ['#120c18', '#2c2038', '#463454', '#644c74'],
    sky: ['#1a1024', '#06040a'],
    glow: '#b48aff',
    ores: [
      { id: 'silver', weight: 35 },
      { id: 'mycelite', weight: 30 },
      { id: 'cobalt', weight: 22 },
      { id: 'sporestone', weight: 13 },
    ],
    gems: ['jade', 'moonstone'],
    essence: 'spore-heart',
    music: { root: 45, scale: [0, 3, 5, 7, 10], beat: 1.6, filter: 1100, unease: 0.12, droneInterval: 7 },
  },
  {
    id: 'crystal',
    name: 'Crystal Hollows',
    from: 51,
    hazard: 'brittle',
    blurb: 'Everything rings when you strike it. A clean hit shatters a block into twice the ore.',
    rock: ['#0a1620', '#18324a', '#24506c', '#3a7a98'],
    sky: ['#0c1e2c', '#03070c'],
    glow: '#7ae8ff',
    ores: [
      { id: 'gold', weight: 35 },
      { id: 'crystalite', weight: 30 },
      { id: 'platinum', weight: 22 },
      { id: 'prismite', weight: 13 },
    ],
    gems: ['amethyst', 'sapphire'],
    essence: 'prism-heart',
    music: { root: 52, scale: [0, 2, 4, 6, 7, 9, 11], beat: 1.25, filter: 2600, unease: 0.1, droneInterval: 7 },
  },
  {
    id: 'magma',
    name: 'Magma Veins',
    from: 91,
    hazard: 'heat',
    blurb: 'The air shimmers. Without heat-proof armour your arms grow slow; machines need coolant.',
    rock: ['#180806', '#3a1410', '#5a2016', '#86361e'],
    sky: ['#2a0c06', '#080202'],
    glow: '#ff8a3a',
    ores: [
      { id: 'obsidian', weight: 35 },
      { id: 'cinnabar', weight: 30 },
      { id: 'titanium', weight: 22 },
      { id: 'emberstone', weight: 13 },
    ],
    gems: ['ruby', 'sunstone'],
    essence: 'ember-heart',
    music: { root: 40, scale: [0, 1, 3, 5, 7, 8, 10], beat: 1.8, filter: 850, unease: 0.2, droneInterval: 7 },
  },
  {
    id: 'hollow',
    name: 'The Hollow',
    from: 141,
    hazard: 'dark',
    blurb: 'No strata, no seams, just the dark and something in it breathing slowly. Bring a bright lantern.',
    rock: ['#04040a', '#0e0e1c', '#1a1a30', '#2c2c4a'],
    sky: ['#05050c', '#000000'],
    glow: '#9a8aff',
    ores: [
      { id: 'voidglass', weight: 35 },
      { id: 'glyphstone', weight: 30 },
      { id: 'starmetal', weight: 22 },
      { id: 'whisperite', weight: 13 },
    ],
    gems: ['pale-pearl', 'dreamstone'],
    essence: 'hollow-heart',
    music: { root: 43, scale: [0, 1, 3, 5, 6, 8, 10], beat: 2.2, filter: 620, unease: 0.35, droneInterval: 6 },
  },
];

export function biomeAt(depth: number): Biome {
  let found = BIOMES[0]!;
  for (const b of BIOMES) if (depth >= b.from) found = b;
  return found;
}

export function biomeIndex(depth: number): number {
  return BIOMES.indexOf(biomeAt(depth));
}
