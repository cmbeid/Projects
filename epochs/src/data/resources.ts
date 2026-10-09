import type { JobDef, JobId, ResId, ResourceDef } from './types';

export const RESOURCES: readonly ResourceDef[] = [
  { id: 'food', name: 'Food', era: 0, capped: true, shades: ['#7a3a1a', '#d8743a', '#ffd08a'] },
  { id: 'wood', name: 'Wood', era: 0, capped: true, shades: ['#4a2a14', '#8a5a2a', '#c89a5a'] },
  { id: 'stone', name: 'Stone', era: 0, capped: true, shades: ['#3a3a44', '#7a7a88', '#c4c4cc'] },
  { id: 'knowledge', name: 'Knowledge', era: 0, capped: false, shades: ['#1a3a6a', '#3a7ad8', '#a8d8ff'] },
  { id: 'culture', name: 'Culture', era: 0, capped: false, shades: ['#5a1a5a', '#b04ab0', '#f0a8f0'] },
  { id: 'metal', name: 'Metal', era: 1, capped: true, shades: ['#5a2a10', '#c06a2a', '#f4b47a'] },
  { id: 'gold', name: 'Gold', era: 1, capped: false, shades: ['#6a4a00', '#d8a820', '#fff08a'] },
  { id: 'coal', name: 'Coal', era: 5, capped: true, shades: ['#0e0e12', '#2e2e36', '#5e5e6a'] },
  { id: 'steel', name: 'Steel', era: 5, capped: true, shades: ['#2a3a4a', '#6a8aa4', '#c8dcec'] },
  { id: 'oil', name: 'Oil', era: 6, capped: true, shades: ['#0a0a10', '#2a2a4a', '#6a5aa8'] },
  { id: 'data', name: 'Data', era: 6, capped: false, shades: ['#0a3a2a', '#1ab07a', '#9affd0'] },
  { id: 'alloy', name: 'Alloy', era: 7, capped: true, shades: ['#2a1a5a', '#7a5ad8', '#e0d0ff'] },
];

export const RESOURCE = new Map<ResId, ResourceDef>(RESOURCES.map((r) => [r.id, r]));
export const RES_IDS: readonly ResId[] = RESOURCES.map((r) => r.id);

export const JOBS: readonly JobDef[] = [
  {
    id: 'forager',
    name: 'Forager',
    plural: 'Foragers',
    era: 0,
    line: null,
    makes: { food: 0.45, wood: 0.08, stone: 0.05 },
    uses: {},
    power: 0,
    blurb: 'Walks the riverbank for roots, fish and fallen wood. Needs no building, and never gets any better at it.',
  },
  { id: 'farmer', name: 'Farmer', plural: 'Farmers', era: 0, line: 'farm', makes: { food: 1 }, uses: {}, power: 0, blurb: 'Works the fields. The city eats what they grow.' },
  { id: 'woodcutter', name: 'Woodcutter', plural: 'Woodcutters', era: 0, line: 'lumber', makes: { wood: 0.5 }, uses: {}, power: 0, blurb: 'Fells and splits timber.' },
  { id: 'quarrier', name: 'Quarrier', plural: 'Quarriers', era: 0, line: 'quarry', makes: { stone: 0.4 }, uses: {}, power: 0, blurb: 'Cuts stone, and later brick and concrete.' },
  {
    id: 'miner',
    name: 'Miner',
    plural: 'Miners',
    era: 1,
    line: 'mine',
    makes: { metal: 0.3, coal: 0.35 },
    uses: {},
    power: 0,
    blurb: 'Digs ore. Once the city has furnaces to feed, they bring up coal as well.',
  },
  { id: 'scholar', name: 'Scholar', plural: 'Scholars', era: 0, line: 'study', makes: { knowledge: 0.3 }, uses: {}, power: 0, blurb: 'Remembers, writes down, works out. Knowledge pays for research.' },
  { id: 'artist', name: 'Artist', plural: 'Artists', era: 0, line: 'shrine', makes: { culture: 0.25 }, uses: {}, power: 0, blurb: 'Sings, carves, preaches and performs. Culture pays for festivals, and every artist steadies the city.' },
  { id: 'merchant', name: 'Merchant', plural: 'Merchants', era: 1, line: 'market', makes: { gold: 0.35 }, uses: {}, power: 0, blurb: 'Buys low, sells high, and keeps a tenth.' },
  { id: 'smith', name: 'Steelworker', plural: 'Steelworkers', era: 5, line: 'works', makes: { steel: 0.25 }, uses: { coal: 0.2, metal: 0.2 }, power: 1, blurb: 'Turns coal and iron into steel.' },
  { id: 'driller', name: 'Driller', plural: 'Drillers', era: 6, line: 'well', makes: { oil: 0.3 }, uses: {}, power: 1, blurb: 'Pumps oil.' },
  { id: 'coder', name: 'Coder', plural: 'Coders', era: 6, line: 'server', makes: { data: 0.15 }, uses: {}, power: 2, blurb: 'Writes the programs that turn the city into data.' },
  {
    id: 'fabricator',
    name: 'Fabricator',
    plural: 'Fabricators',
    era: 7,
    line: 'fab',
    makes: { alloy: 0.1 },
    uses: { steel: 0.25, data: 0.1 },
    power: 3,
    blurb: 'Prints spaceframe alloy from steel and design data.',
  },
];

export const JOB = new Map<JobId, JobDef>(JOBS.map((j) => [j.id, j]));
export const JOB_IDS: readonly JobId[] = JOBS.map((j) => j.id);
