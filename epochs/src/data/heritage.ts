import type { HeritageNode, TraitDef } from './types';

/**
 * The prestige layer. When the colony ship launches, the city is left
 * behind and the colonists start again on a new world. What they carry is
 * Heritage, spent here on a permanent tree, and the world they land on has
 * traits that bend the rules for that run.
 */

export const HERITAGE: readonly HeritageNode[] = [
  { id: 'seed-vault', name: 'Seed Vault', cost: 5, requires: [], effects: [{ k: 'stash', n: 1 }], blurb: 'Start every world with a store of food, wood and stone.' },
  { id: 'firekeepers', name: 'Firekeepers', cost: 5, requires: [], effects: [{ k: 'startPop', n: 4 }], blurb: 'Start with four more people round the fire.' },
  { id: 'old-songs', name: 'Old Songs', cost: 8, requires: ['firekeepers'], effects: [{ k: 'growth', x: 0.3 }, { k: 'stability', n: 5 }], blurb: '+30% births and +5 stability.' },
  { id: 'ancestral-tools', name: 'Ancestral Tools', cost: 8, requires: ['seed-vault'], effects: [{ k: 'all', x: 0.15 }], blurb: '+15% to every job.' },
  { id: 'star-memory', name: 'Star Memory', cost: 12, requires: ['old-songs'], effects: [{ k: 'startTechs', n: 3 }], blurb: 'Start with the first three Stone Age techs known.' },
  { id: 'surveyors', name: 'Surveyors', cost: 12, requires: ['ancestral-tools'], effects: [{ k: 'plots', n: 4 }], blurb: '+4 land on every world.' },
  { id: 'archive', name: 'The Archive', cost: 20, requires: ['star-memory'], effects: [{ k: 'research', x: 0.2 }], blurb: 'Research costs 20% less.' },
  { id: 'master-builders', name: 'Master Builders', cost: 20, requires: ['surveyors'], effects: [{ k: 'cost', x: 0.15 }, { k: 'wonderSpeed', x: 0.25 }], blurb: 'Buildings cost 15% less; wonders go up 25% faster.' },
  { id: 'long-sleep', name: 'The Long Sleep', cost: 25, requires: ['archive'], effects: [{ k: 'offline', n: 4 }], blurb: '+4 hours of time away count.' },
  { id: 'deep-roots', name: 'Deep Roots', cost: 30, requires: ['master-builders', 'archive'], effects: [{ k: 'all', x: 0.25 }, { k: 'stash', n: 4 }], blurb: '+25% to every job, and a bigger store to start with.' },
  { id: 'chroniclers', name: 'Chroniclers', cost: 35, requires: ['long-sleep'], effects: [{ k: 'eventRate', x: 0.3 }, { k: 'festival', x: 0.5 }], blurb: 'Events come 30% more often; festivals last 50% longer.' },
  { id: 'founders-light', name: "Founders' Light", cost: 60, requires: ['deep-roots', 'chroniclers'], effects: [{ k: 'heritageGain', x: 0.5 }, { k: 'all', x: 0.25 }], blurb: '+50% Heritage from every launch, and +25% to every job.' },
];

export const HERITAGE_NODE = new Map(HERITAGE.map((h) => [h.id, h]));

export const TRAITS: readonly TraitDef[] = [
  { id: 'fertile', name: 'Fertile', blurb: 'Black soil and long summers. Farmers +50%.', effects: [{ k: 'job', job: 'farmer', x: 0.5 }], tint: '#3a8a2a' },
  { id: 'barren', name: 'Barren', blurb: 'Thin soil over good rock. Farmers −30%, quarriers and miners +50%.', effects: [{ k: 'job', job: 'farmer', x: -0.3 }, { k: 'job', job: 'quarrier', x: 0.5 }, { k: 'job', job: 'miner', x: 0.5 }], tint: '#a88a5a' },
  { id: 'ocean', name: 'Ocean World', blurb: 'Islands in a warm sea. −4 land, but people eat 20% less.', effects: [{ k: 'plots', n: -4 }, { k: 'eat', x: 0.2 }], tint: '#2a6aa8' },
  { id: 'low-gravity', name: 'Low Gravity', blurb: 'Everything is lighter. Buildings cost 20% less, and people are restless: −10 stability.', effects: [{ k: 'cost', x: 0.2 }, { k: 'stability', n: -10 }], tint: '#8a7ad8' },
  { id: 'ruins', name: 'Ancient Ruins', blurb: 'Someone was here before. Scholars +40%.', effects: [{ k: 'job', job: 'scholar', x: 0.4 }], tint: '#b0a080' },
  { id: 'volcanic', name: 'Volcanic', blurb: 'Hot springs and ash. Miners +40%; the land is restless and events come more often.', effects: [{ k: 'job', job: 'miner', x: 0.4 }, { k: 'eventRate', x: 0.25 }], tint: '#c8502a' },
  { id: 'thin-air', name: 'Thin Air', blurb: 'High and cold. Births −30%, artists +50%.', effects: [{ k: 'growth', x: -0.3 }, { k: 'job', job: 'artist', x: 0.5 }], tint: '#a8c8e8' },
  { id: 'twin-suns', name: 'Twin Suns', blurb: 'Two suns and long days. Woodcutters and farmers +25%.', effects: [{ k: 'job', job: 'woodcutter', x: 0.25 }, { k: 'job', job: 'farmer', x: 0.25 }], tint: '#f0c048' },
  { id: 'rich-seams', name: 'Rich Seams', blurb: 'Ore at the surface. Miners +60%, buildings take 5% more to build.', effects: [{ k: 'job', job: 'miner', x: 0.6 }, { k: 'cost', x: -0.05 }], tint: '#c07040' },
  { id: 'storms', name: 'Storm Belt', blurb: 'Great storms roll through. −10% to every job, but artists +60%.', effects: [{ k: 'all', x: -0.1 }, { k: 'job', job: 'artist', x: 0.6 }], tint: '#5a5a7a' },
  { id: 'wide-plains', name: 'Wide Plains', blurb: 'Room to grow. +6 land.', effects: [{ k: 'plots', n: 6 }], tint: '#a8b850' },
  { id: 'gentle', name: 'Gentle World', blurb: 'Mild in every way. +10 stability and +20% births.', effects: [{ k: 'stability', n: 10 }, { k: 'growth', x: 0.2 }], tint: '#88c898' },
];

export const TRAIT = new Map(TRAITS.map((t) => [t.id, t]));

/** Names for new worlds. Each launch rolls three to choose from. */
export const WORLD_NAMES = [
  'Kepler Hearth',
  'Tamsin',
  'New Avalon',
  'Oriel',
  'Halcyon',
  'Vesper',
  'Ilios',
  'Marrow',
  'Thessaly',
  'Lumen',
  'Corrin',
  'Arden',
  'Sable',
  'Brightwater',
  'Eos',
  'Calder',
  'Juniper',
  'Ostara',
];
