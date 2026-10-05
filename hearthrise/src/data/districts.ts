import type { District } from './types';

/** Every district is a grid this wide and this tall; each row is one ward. */
export const GRID_W = 6;
export const GRID_H = 8;
export const WARDS_PER_DISTRICT = GRID_H;

/**
 * The districts of the drowned city, from the landing stage on the shore to
 * the Spire in the middle of the bay — and then under it, up it, and across
 * the bay to the town the boats came from. Each has its own rubble,
 * salvage table and hazard, and its own tune for the chip score in
 * `audio/music.ts`: a waltz on the beach, a jig in the harbour, a march in
 * the market, a machine in the foundry, and something slow in the Spire.
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
    music: { bpm: 104, meter: 3, key: 67, scale: [0, 2, 4, 5, 7, 9, 11], progression: [0, 3, 4, 0, 5, 3, 4, 0], duty: 0.5, arp: 'stabs', arpRate: 1, drums: 'waltz', motif: [0, 2, 4, 2, 0, -1, 0] },
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
    music: { bpm: 320, meter: 6, key: 62, scale: [0, 2, 4, 5, 7, 9, 10], progression: [0, 6, 0, 4, 0, 6, 3, 0], duty: 0.25, arp: 'broken', arpRate: 1, drums: 'jig', motif: [0, 1, 2, 4, 2, 1] },
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
    music: { bpm: 120, meter: 4, key: 65, scale: [0, 2, 4, 5, 7, 9, 11], progression: [0, 0, 3, 4, 0, 5, 1, 4], duty: 0.5, arp: 'up', arpRate: 2, drums: 'march', motif: [0, 0, 2, 4, 4, 2, 0] },
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
    music: { bpm: 112, meter: 4, key: 57, scale: [0, 2, 3, 5, 7, 8, 10], progression: [0, 0, 5, 4, 0, 0, 5, 6], duty: 0.25, arp: 'updown', arpRate: 4, drums: 'machine', motif: [0, -1, 0, 2, 0, -2] },
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
    music: { bpm: 72, meter: 3, key: 65, scale: [0, 2, 4, 6, 7, 9, 11], progression: [0, 1, 0, 1, 4, 5, 1, 0], duty: 0.125, arp: 'up', arpRate: 2, drums: 'none', motif: [4, 2, 0, 1, 0] },
  },

  // --- Beyond the Spire: the expansion --------------------------------------------
  {
    id: 'undercroft',
    name: 'The Undercroft',
    era: 'Undercity',
    from: 41,
    hazard: 'seep',
    blurb: 'Old Vessel itself, under the bay: streets of green stone in a hall of held-back water. The sea seeps into every breach you make.',
    ruin: ['#081410', '#1a3a30', '#2a5446', '#40766a'],
    ground: ['#4a5a50', '#52625a'],
    sky: ['#2a5a6a', '#0a1a22'],
    glow: '#6affd0',
    salvage: [
      { id: 'drowned-oak', weight: 35 },
      { id: 'vessel-stone', weight: 30 },
      { id: 'verdigris', weight: 22 },
      { id: 'sea-silk', weight: 13 },
    ],
    relics: ['crown-coin', 'vessel-bell'],
    heart: 'vessel-heart',
    music: { bpm: 88, meter: 4, key: 62, scale: [0, 2, 3, 5, 7, 9, 10], progression: [0, 3, 0, 3, 2, 3, 4, 0], duty: 0.5, arp: 'broken', arpRate: 2, drums: 'shuffle', motif: [0, 2, 3, 2, 0, -2], muffle: 0.7 },
  },
  {
    id: 'cloudline',
    name: 'The Cloudline',
    era: 'Skyline',
    from: 49,
    hazard: 'gale',
    blurb: 'Terraces up the Spire, above the weather, where the old founders kept their gardens. Gusts come round on a cycle and blow everything flat.',
    ruin: ['#1a1c2a', '#4a5070', '#6a7298', '#9aa2c8'],
    ground: ['#8aa07a', '#94aa84'],
    sky: ['#9ad0ff', '#3a6ad0'],
    glow: '#fff0a0',
    salvage: [
      { id: 'sky-cedar', weight: 35 },
      { id: 'cloudstone', weight: 30 },
      { id: 'storm-brass', weight: 22 },
      { id: 'sky-canvas', weight: 13 },
    ],
    relics: ['weather-vane', 'kite-charm'],
    heart: 'sky-heart',
    music: { bpm: 138, meter: 4, key: 69, scale: [0, 2, 4, 6, 7, 9, 11], progression: [0, 1, 4, 0, 5, 1, 4, 4], duty: 0.125, arp: 'up', arpRate: 4, drums: 'drive', motif: [0, 4, 3, 4, 6, 4, 2] },
  },
  {
    id: 'shore',
    name: 'The Far Shore',
    era: 'Republic',
    from: 57,
    hazard: 'rivalry',
    blurb: 'Across the bay, the fishing town the boats came from — older than Vessel and proud of it. They undercut every price you set while you build on their side.',
    ruin: ['#1a1410', '#5a4430', '#7e6446', '#a8885e'],
    ground: ['#b0a070', '#baa87a'],
    sky: ['#ffc898', '#7a8ac8'],
    glow: '#ffb070',
    salvage: [
      { id: 'shore-pine', weight: 35 },
      { id: 'sandstone', weight: 30 },
      { id: 'anchor-iron', weight: 22 },
      { id: 'net-cord', weight: 13 },
    ],
    relics: ['shell-crown', 'old-chart'],
    heart: 'shore-lantern',
    music: { bpm: 132, meter: 2, key: 70, scale: [0, 2, 4, 5, 7, 9, 11], progression: [0, 4, 4, 0, 3, 0, 4, 0], duty: 0.5, arp: 'stabs', arpRate: 1, drums: 'polka', motif: [0, 1, 2, 4, 2, 0] },
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
 * The grid row a ward's land lies on in its district, or -1 past the last
 * district's eighth row: the wards go on, but there is no more ground to build on.
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
