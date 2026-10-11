import type { NodeKind, SectorDef } from './types';

export const SECTORS: readonly SectorDef[] = [
  {
    index: 0, name: 'The Shatterbelt', desc: 'Where the ark broke. A field of wreckage and frightened scavengers.', faction: 'none',
    biomes: ['rocky', 'ice', 'wreck'], kinds: { system: 5, derelict: 3, asteroids: 3, distress: 2, station: 2, anomaly: 1, patrol: 1 },
    enemies: ['skiff', 'skiff', 'raider', 'secbot'], boss: 'boss-warden', music: { root: 50, mode: 'aeolian', bpm: 70 }, color: '#6a7a98',
  },
  {
    index: 1, name: 'Verdant Reach', desc: 'Living worlds, and the Drift Clans who farm them.', faction: 'clans',
    biomes: ['jungle', 'ocean', 'rocky', 'wreck'], kinds: { system: 6, derelict: 2, asteroids: 2, distress: 2, station: 2, anomaly: 1, patrol: 2, nebula: 1 },
    enemies: ['raider', 'skiff', 'harpoon', 'wrecker'], boss: 'boss-matriarch', music: { root: 52, mode: 'dorian', bpm: 74 }, color: '#5a9a5a',
  },
  {
    index: 2, name: 'Ashen Expanse', desc: 'Burned worlds and the Concord fleet that claims them.', faction: 'concord',
    biomes: ['desert', 'volcanic', 'rocky', 'wreck'], kinds: { system: 6, derelict: 2, asteroids: 2, distress: 1, station: 2, anomaly: 1, patrol: 3, nebula: 1 },
    enemies: ['interceptor', 'raider', 'frigate', 'wrecker'], boss: 'boss-admiral', music: { root: 48, mode: 'phrygian', bpm: 66 }, color: '#c07040',
  },
  {
    index: 3, name: 'Clanhold', desc: 'The Drift Clans\' home waters. Everything here is salvage, including you.', faction: 'clans',
    biomes: ['toxic', 'ocean', 'volcanic', 'wreck'], kinds: { system: 5, derelict: 3, asteroids: 2, distress: 1, station: 3, anomaly: 1, patrol: 3, nebula: 1 },
    enemies: ['harpoon', 'raider', 'wrecker', 'reaver'], boss: 'boss-dreadnought', music: { root: 46, mode: 'mixolydian', bpm: 72 }, color: '#d0a040',
  },
  {
    index: 4, name: 'Choir Nebula', desc: 'A nebula that sings back. The Choir lives here.', faction: 'choir',
    biomes: ['crystal', 'ice', 'toxic', 'wreck'], kinds: { system: 5, derelict: 2, asteroids: 1, distress: 1, station: 2, anomaly: 3, patrol: 2, nebula: 3 },
    enemies: ['drone', 'cantor', 'drone', 'reaver'], boss: 'boss-chorus', music: { root: 49, mode: 'lydian', bpm: 60 }, color: '#a070e0',
  },
  {
    index: 5, name: 'Haven Approach', desc: 'The last stretch. Haven\'s star is in the window.', faction: 'none',
    biomes: ['jungle', 'crystal', 'ocean', 'wreck', 'desert'], kinds: { system: 5, derelict: 2, asteroids: 1, distress: 2, station: 2, anomaly: 2, patrol: 3, nebula: 1 },
    enemies: ['reaver', 'cantor', 'frigate', 'secbot'], boss: 'boss-echo', music: { root: 45, mode: 'ionian', bpm: 68 }, color: '#f0d070',
  },
];

export const NODE_KINDS: readonly { id: NodeKind; name: string; desc: string }[] = [
  { id: 'entry', name: 'Jump point', desc: 'Where you came in.' },
  { id: 'system', name: 'Star system', desc: 'Planets to scan and land on.' },
  { id: 'station', name: 'Station', desc: 'Trade, repairs, crew and work.' },
  { id: 'derelict', name: 'Derelict', desc: 'A dead ship. Salvage, or trouble.' },
  { id: 'asteroids', name: 'Asteroid field', desc: 'Ore and ice, if you dodge the rocks.' },
  { id: 'nebula', name: 'Nebula', desc: 'Sensors go blind. Things hide here.' },
  { id: 'anomaly', name: 'Anomaly', desc: 'Something that shouldn\'t be.' },
  { id: 'distress', name: 'Distress call', desc: 'Someone is calling for help.' },
  { id: 'patrol', name: 'Patrol', desc: 'An armed ship holds this point.' },
  { id: 'gate', name: 'Sector gate', desc: 'The way onward, once the ark section is found.' },
];
export const NODE_KIND = new Map(NODE_KINDS.map((k) => [k.id, k]));
