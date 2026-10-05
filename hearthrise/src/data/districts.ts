import type { District } from './types';

/** Every district is a grid this wide and this tall; each row is one ward. */
export const GRID_W = 6;
export const GRID_H = 8;
export const WARDS_PER_DISTRICT = GRID_H;

/**
 * The five districts of the drowned city, from the landing stage on the
 * shore to the Spire in the middle of the bay. Each has its own rubble,
 * salvage table and hazard, and its own setting for the generative score in
 * `audio/music.ts`: the camp is warm and simple, the town busy, the foundry
 * mechanical, and the Spire very quiet.
 */
export const DISTRICTS: readonly District[] = [
  {
    id: 'landing',
    name: 'The Landing',
    era: 'Camp',
    from: 1,
    hazard: 'none',
    blurb: 'A shingle beach, a broken jetty, and the first dry ground in the old city. The tide has been kind here.',
    ruin: ['#1a1410', '#4a3a2c', '#6e5842', '#94785a'],
    ground: ['#5a6a3a', '#647444'],
    sky: ['#f0b878', '#6a7aa8'],
    glow: '#ffd07a',
    salvage: [
      { id: 'driftwood', weight: 40 },
      { id: 'fieldstone', weight: 30 },
      { id: 'clay', weight: 20 },
      { id: 'scrap', weight: 10 },
    ],
    relics: ['old-coin', 'brass-key'],
    heart: 'hearthstone',
    music: { root: 55, scale: [0, 2, 4, 7, 9], beat: 0.9, filter: 2400, unease: 0.02, droneInterval: 7, bustle: 0.15 },
  },
  {
    id: 'harbour',
    name: 'Old Harbour',
    era: 'Village',
    from: 9,
    hazard: 'tide',
    blurb: 'Quays and boathouses, all under a hand of water at high tide. The sea comes in on a cycle and stops your crews where it reaches.',
    ruin: ['#0e1418', '#2a3a44', '#3e5462', '#5a7684'],
    ground: ['#6a6450', '#746e58'],
    sky: ['#a8c8d8', '#3a5a7a'],
    glow: '#8ae0ff',
    salvage: [
      { id: 'timber', weight: 35 },
      { id: 'cobble', weight: 30 },
      { id: 'wire', weight: 22 },
      { id: 'sailcloth', weight: 13 },
    ],
    relics: ['pearl', 'ships-bell'],
    heart: 'harbour-lamp',
    music: { root: 50, scale: [0, 2, 4, 5, 7, 9, 10], beat: 0.85, filter: 2000, unease: 0.05, droneInterval: 7, bustle: 0.3 },
  },
  {
    id: 'market',
    name: 'Market Ward',
    era: 'Town',
    from: 17,
    hazard: 'crowd',
    blurb: 'Arcades and counting-houses packed shoulder to shoulder. Crowds slow your crews, and a bad neighbour hurts twice as much here.',
    ruin: ['#1a100c', '#4a2a22', '#6e4032', '#965a44'],
    ground: ['#7a6a5a', '#847464'],
    sky: ['#f4d8a8', '#a86a5a'],
    glow: '#ffb84a',
    salvage: [
      { id: 'slate', weight: 35 },
      { id: 'tin', weight: 30 },
      { id: 'silk', weight: 22 },
      { id: 'porcelain', weight: 13 },
    ],
    relics: ['guild-seal', 'gilt-mirror'],
    heart: 'guild-bell',
    music: { root: 57, scale: [0, 2, 4, 5, 7, 9, 11], beat: 0.7, filter: 2800, unease: 0.04, droneInterval: 7, bustle: 0.55 },
  },
  {
    id: 'foundry',
    name: 'Foundry Quarter',
    era: 'City',
    from: 25,
    hazard: 'smog',
    blurb: 'Chimneys, kilns and a canal the colour of tea. The old smog still hangs: you need a sealed coat to work, and your crews need scrubbers.',
    ruin: ['#100c0c', '#2e2624', '#463a36', '#64544c'],
    ground: ['#585450', '#625e5a'],
    sky: ['#c8a088', '#4a3a3a'],
    glow: '#ff8a4a',
    salvage: [
      { id: 'coal', weight: 35 },
      { id: 'pig-iron', weight: 30 },
      { id: 'cullet', weight: 22 },
      { id: 'brass', weight: 13 },
    ],
    relics: ['pocket-watch', 'ledger'],
    heart: 'foundry-heart',
    music: { root: 52, scale: [0, 2, 3, 5, 7, 8, 10], beat: 0.62, filter: 1700, unease: 0.1, droneInterval: 7, bustle: 0.8 },
  },
  {
    id: 'spire',
    name: 'The Drowned Spire',
    era: 'Arcology',
    from: 33,
    hazard: 'silence',
    blurb: 'White stone and still water, and a tower that goes on above the clouds. A fog lies on everything; without light you work blind. It hums.',
    ruin: ['#0c0e14', '#2a2e3e', '#424a5e', '#6a7490'],
    ground: ['#8a8a96', '#94949e'],
    sky: ['#d8d8e8', '#4a4a6a'],
    glow: '#c8d0ff',
    salvage: [
      { id: 'marble', weight: 35 },
      { id: 'sea-glass', weight: 30 },
      { id: 'filigree', weight: 22 },
      { id: 'starstone', weight: 13 },
    ],
    relics: ['moonpearl', 'choir-shard'],
    heart: 'spire-key',
    music: { root: 53, scale: [0, 2, 4, 6, 7, 9, 11], beat: 1.4, filter: 1300, unease: 0.18, droneInterval: 6, bustle: 0.05, toll: true },
  },
];

export const DISTRICT: ReadonlyMap<string, District> = new Map(DISTRICTS.map((d) => [d.id, d]));

/** Index into `DISTRICTS` for a ward. */
export function districtIndex(ward: number): number {
  let i = 0;
  for (let k = 0; k < DISTRICTS.length; k++) if (ward >= DISTRICTS[k]!.from) i = k;
  return i;
}

export function districtAt(ward: number): District {
  return DISTRICTS[districtIndex(ward)]!;
}

/**
 * The grid row a ward's land lies on in its district, or -1 past the Spire's
 * eighth row: the tower goes on, but there is no more ground to build on.
 */
export function rowOfWard(ward: number): number {
  const d = districtIndex(ward);
  const row = ward - DISTRICTS[d]!.from;
  return row < GRID_H ? row : -1;
}

/** The ward whose land is this row of this district. */
export function wardOfRow(district: number, row: number): number {
  return DISTRICTS[district]!.from + row;
}
