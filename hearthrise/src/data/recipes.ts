import type { ConsumableId, CraftRecipe, FixtureId, RefineRecipe } from './types';

/** Salvage into goods. These run on a timer in the workshops, offline included. */
export const REFINE: readonly RefineRecipe[] = [
  { id: 'r-planks', output: 'planks', inputs: [{ id: 'driftwood', n: 8 }], seconds: 3, requires: { ward: 1 } },
  { id: 'r-bricks', output: 'bricks', inputs: [{ id: 'clay', n: 5 }, { id: 'fieldstone', n: 3 }], seconds: 4, requires: { ward: 1 } },
  { id: 'r-ironwork', output: 'ironwork', inputs: [{ id: 'scrap', n: 6 }, { id: 'driftwood', n: 4 }], seconds: 5, requires: { ward: 3 } },
  { id: 'r-canvas', output: 'canvas', inputs: [{ id: 'sailcloth', n: 4 }, { id: 'timber', n: 4 }], seconds: 6, requires: { ward: 9 } },
  { id: 'r-copperwork', output: 'copperwork', inputs: [{ id: 'wire', n: 6 }, { id: 'cobble', n: 4 }], seconds: 8, requires: { ward: 9 } },
  { id: 'r-tiles', output: 'roof-tiles', inputs: [{ id: 'slate', n: 8 }], seconds: 9, requires: { ward: 17 } },
  { id: 'r-silkwork', output: 'silkwork', inputs: [{ id: 'silk', n: 6 }, { id: 'tin', n: 4 }], seconds: 11, requires: { ward: 17 } },
  { id: 'r-panes', output: 'panes', inputs: [{ id: 'cullet', n: 10 }], seconds: 12, requires: { ward: 25 } },
  { id: 'r-steel', output: 'steel', inputs: [{ id: 'pig-iron', n: 6 }, { id: 'coal', n: 4 }], seconds: 14, requires: { ward: 25 } },
  { id: 'r-marble', output: 'marble-block', inputs: [{ id: 'marble', n: 6 }, { id: 'filigree', n: 4 }], seconds: 16, requires: { ward: 33 } },
  { id: 'r-lumen', output: 'lumen', inputs: [{ id: 'sea-glass', n: 6 }, { id: 'starstone', n: 2 }], seconds: 18, requires: { ward: 33 } },
  { id: 'r-caisson', output: 'caisson-iron', inputs: [{ id: 'verdigris', n: 6 }, { id: 'vessel-stone', n: 4 }], seconds: 20, requires: { ward: 41 } },
  { id: 'r-skysilk', output: 'skysilk', inputs: [{ id: 'sky-canvas', n: 6 }, { id: 'storm-brass', n: 4 }], seconds: 22, requires: { ward: 49 } },
  { id: 'r-shore', output: 'shore-oak', inputs: [{ id: 'shore-pine', n: 8 }, { id: 'net-cord', n: 2 }], seconds: 24, requires: { ward: 57 } },
];

const regalia = (id: string, base: string, coins: number, ward: number, ...inputs: [string, number][]): CraftRecipe => ({
  id,
  output: { kind: 'regalia', base },
  inputs: inputs.map(([i, n]) => ({ id: i, n })),
  coins,
  requires: { ward },
});

const consumable = (id: string, item: ConsumableId, n: number, coins: number, ward: number, ...inputs: [string, number][]): CraftRecipe => ({
  id,
  output: { kind: 'consumable', id: item, n },
  inputs: inputs.map(([i, k]) => ({ id: i, n: k })),
  coins,
  requires: { ward },
});

const fixture = (id: string, item: FixtureId, coins: number, ward: number, ...inputs: [string, number][]): CraftRecipe => ({
  id,
  output: { kind: 'fixture', id: item },
  inputs: inputs.map(([i, n]) => ({ id: i, n })),
  coins,
  requires: { ward },
});

/** Everything made at the Drafting Hall: regalia, supplies and one-off fixtures. */
export const CRAFT: readonly CraftRecipe[] = [
  // Chains
  regalia('c-rope-chain', 'rope-chain', 40, 1, ['planks', 4]),
  regalia('c-brick-chain', 'brick-chain', 300, 2, ['bricks', 8], ['old-coin', 2]),
  regalia('c-iron-chain', 'iron-chain', 2500, 4, ['ironwork', 12], ['hearthstone', 1]),
  regalia('c-copper-chain', 'copper-chain', 60_000, 10, ['copperwork', 12], ['pearl', 2], ['harbour-lamp', 1]),
  regalia('c-gilt-chain', 'gilt-chain', 4e6, 19, ['silkwork', 12], ['gilt-mirror', 3], ['guild-bell', 1]),
  regalia('c-steel-chain', 'steel-chain', 3e8, 26, ['steel', 12], ['pocket-watch', 2], ['foundry-heart', 1]),
  regalia('c-marble-chain', 'marble-chain', 4e10, 34, ['marble-block', 12], ['moonpearl', 2], ['spire-key', 1]),

  // Lanterns
  regalia('c-tin-lantern', 'tin-lantern', 150, 3, ['ironwork', 3], ['old-coin', 1]),
  regalia('c-harbour-lantern', 'harbour-lantern', 20_000, 9, ['copperwork', 6], ['ships-bell', 1]),
  regalia('c-guild-lantern', 'guild-lantern', 2e6, 17, ['silkwork', 8], ['guild-seal', 2]),
  regalia('c-furnace-lantern', 'furnace-lantern', 1.5e8, 26, ['panes', 8], ['ledger', 2]),
  regalia('c-lumen-lantern', 'lumen-lantern', 2e10, 33, ['lumen', 8], ['moonpearl', 2]),

  // Coats
  regalia('c-work-coat', 'work-coat', 60, 1, ['planks', 3], ['bricks', 1]),
  regalia('c-oilskin', 'oilskin', 3000, 5, ['ironwork', 10]),
  regalia('c-reeve-coat', 'reeve-coat', 80_000, 11, ['canvas', 8], ['sailcloth', 60], ['harbour-lamp', 1]),
  regalia('c-silk-robe', 'silk-robe', 5e6, 20, ['silkwork', 10], ['silk', 80]),
  regalia('c-sealed-coat', 'sealed-coat', 2e8, 25, ['steel', 10], ['brass', 30], ['foundry-heart', 1]),
  regalia('c-white-mantle', 'white-mantle', 3e10, 35, ['marble-block', 10], ['spire-key', 1]),

  // Seals
  regalia('c-clay-seal', 'clay-seal', 200, 2, ['brass-key', 3], ['bricks', 2]),
  regalia('c-pearl-seal', 'pearl-seal', 40_000, 10, ['pearl', 3], ['canvas', 3]),
  regalia('c-guild-seal', 'guild-seal-r', 3e6, 19, ['guild-seal', 3], ['roof-tiles', 4]),
  regalia('c-watch-seal', 'watch-seal', 2.5e8, 26, ['pocket-watch', 3], ['steel', 4]),
  regalia('c-moon-seal', 'moon-seal', 3e10, 34, ['moonpearl', 3], ['marble-block', 4]),

  // Sidegrades
  regalia('c-sledge', 'sledge', 50_000, 12, ['copperwork', 10], ['scrap', 300]),
  regalia('c-counting-seal', 'counting-seal', 70_000, 13, ['ships-bell', 3], ['canvas', 6]),
  regalia('c-brass-chain', 'brass-chain', 2.5e8, 28, ['brass', 60], ['steel', 8], ['foundry-heart', 1]),
  regalia('c-ledger-seal', 'ledger-seal', 3e8, 29, ['ledger', 3], ['panes', 6]),
  regalia('c-glass-lantern', 'glass-lantern', 3e10, 36, ['sea-glass', 80], ['lumen', 6]),
  regalia('c-star-coat', 'star-coat', 4e10, 37, ['starstone', 40], ['marble-block', 8], ['spire-key', 1]),
  regalia('c-choir-seal', 'choir-seal', 5e10, 38, ['choir-shard', 3], ['lumen', 6]),

  // The Undercroft
  regalia('c-tide-chain', 'tide-chain', 6e12, 41, ['caisson-iron', 12], ['crown-coin', 2], ['vessel-heart', 1]),
  regalia('c-vessel-lantern', 'vessel-lantern', 3e12, 41, ['caisson-iron', 8], ['vessel-bell', 2]),
  regalia('c-caisson-coat', 'caisson-coat', 5e12, 43, ['caisson-iron', 10], ['sea-silk', 40], ['vessel-heart', 1]),
  regalia('c-crown-seal', 'crown-seal', 4e12, 42, ['crown-coin', 3], ['caisson-iron', 4]),
  regalia('c-verdigris-chain', 'verdigris-chain', 5e12, 44, ['verdigris', 60], ['caisson-iron', 8], ['vessel-heart', 1]),

  // The Cloudline
  regalia('c-storm-chain', 'storm-chain', 8e14, 49, ['skysilk', 12], ['weather-vane', 2], ['sky-heart', 1]),
  regalia('c-sky-lantern', 'sky-lantern', 4e14, 49, ['skysilk', 8], ['kite-charm', 2]),
  regalia('c-skysilk-coat', 'skysilk-coat', 6e14, 51, ['skysilk', 10], ['sky-heart', 1]),
  regalia('c-vane-seal', 'vane-seal', 5e14, 50, ['weather-vane', 3], ['skysilk', 4]),
  regalia('c-gale-seal', 'gale-seal', 7e14, 52, ['kite-charm', 3], ['storm-brass', 40]),

  // The Far Shore
  regalia('c-anchor-chain', 'anchor-chain', 1e17, 58, ['shore-oak', 12], ['shell-crown', 2], ['shore-lantern', 1]),
  regalia('c-chart-lantern', 'chart-lantern', 6e16, 57, ['shore-oak', 8], ['old-chart', 2]),
  regalia('c-oilcloth-mantle', 'oilcloth-mantle', 8e16, 59, ['shore-oak', 10], ['shore-lantern', 1]),
  regalia('c-shell-seal', 'shell-seal', 7e16, 58, ['shell-crown', 3], ['shore-oak', 4]),
  regalia('c-net-coat', 'net-coat', 9e16, 60, ['net-cord', 60], ['shore-oak', 8]),

  // The Founders' set
  regalia('c-founders-chain', 'founders-chain', 2e19, 62, ['shore-oak', 30], ['choir-shard', 4], ['spire-key', 3], ['shore-lantern', 2]),
  regalia('c-founders-lantern', 'founders-lantern', 1.5e19, 62, ['lumen', 30], ['moonpearl', 4], ['sky-heart', 2]),
  regalia('c-founders-coat', 'founders-coat', 1.8e19, 62, ['skysilk', 24], ['starstone', 120], ['vessel-heart', 2]),
  regalia('c-founders-seal', 'founders-seal', 1.8e19, 62, ['caisson-iron', 24], ['old-chart', 4], ['spire-key', 2]),

  // Supplies
  consumable('c-charge', 'charge', 3, 50, 1, ['fieldstone', 30], ['scrap', 3]),
  consumable('c-tea', 'tea', 2, 80, 2, ['old-coin', 1], ['driftwood', 15]),
  consumable('c-ink', 'ink', 1, 400, 3, ['brass-key', 2], ['clay', 20]),
  consumable('c-almanac', 'almanac', 1, 15_000, 10, ['pearl', 1], ['timber', 30]),
  consumable('c-overtime', 'overtime', 1, 40_000, 12, ['canvas', 3], ['cobble', 40]),
  consumable('c-wine', 'wine', 1, 1e6, 18, ['silk', 30], ['guild-seal', 1]),
  consumable('c-greatcharge', 'greatcharge', 2, 2e7, 22, ['roof-tiles', 4], ['porcelain', 30]),
  consumable('c-seeker', 'seeker', 1, 1e8, 26, ['brass', 20], ['pocket-watch', 1]),
  consumable('c-calm', 'calm', 1, 4e8, 30, ['panes', 4], ['ledger', 1]),
  consumable('c-memoir', 'memoir', 1, 1e10, 34, ['sea-glass', 40], ['choir-shard', 1]),
  consumable('c-grease', 'grease', 1, 1e12, 41, ['drowned-oak', 40], ['crown-coin', 1]),
  consumable('c-kite', 'kite', 1, 1e14, 49, ['sky-canvas', 20], ['kite-charm', 1]),

  // Fixtures
  fixture('f-auction', 'auction', 50_000, 8, ['ironwork', 20], ['hearthstone', 2]),
  fixture('f-seawall', 'seawall', 30_000, 9, ['bricks', 40], ['cobble', 80], ['harbour-lamp', 1]),
  fixture('f-surveyor', 'surveyor', 400_000, 14, ['copperwork', 20], ['ships-bell', 2]),
  fixture('f-charter', 'charter', 3e6, 17, ['roof-tiles', 10], ['guild-seal', 2], ['guild-bell', 1]),
  fixture('f-archive', 'archive', 8e6, 21, ['silkwork', 10], ['gilt-mirror', 3]),
  fixture('f-scrubbers', 'scrubbers', 2e8, 25, ['panes', 10], ['brass', 40], ['foundry-heart', 1]),
  fixture('f-beacons', 'beacons', 2e10, 33, ['lumen', 10], ['starstone', 30], ['spire-key', 1]),
  fixture('f-caissons', 'caissons', 1e13, 41, ['caisson-iron', 10], ['vessel-stone', 60], ['vessel-heart', 1]),
  fixture('f-windbreaks', 'windbreaks', 1e15, 49, ['skysilk', 10], ['cloudstone', 60], ['sky-heart', 1]),
  fixture('f-treaty', 'treaty', 1e17, 57, ['shore-oak', 10], ['old-chart', 2], ['shore-lantern', 1]),
];

export const REFINE_BY_ID: ReadonlyMap<string, RefineRecipe> = new Map(REFINE.map((r) => [r.id, r]));
export const CRAFT_BY_ID: ReadonlyMap<string, CraftRecipe> = new Map(CRAFT.map((r) => [r.id, r]));

export interface ConsumableDef {
  id: ConsumableId;
  name: string;
  text: string;
}

export const CONSUMABLES: readonly ConsumableDef[] = [
  { id: 'charge', name: 'Blasting Charge', text: 'One blast for 60× tap power.' },
  { id: 'tea', name: 'Strong Tea', text: 'Restores all resolve.' },
  { id: 'ink', name: 'Surveyor’s Ink', text: 'For 3 minutes: +40 luck.' },
  { id: 'almanac', name: 'Almanac', text: 'For 5 minutes: double XP.' },
  { id: 'overtime', name: 'Overtime Chit', text: 'For 2 minutes: crews ×3.' },
  { id: 'wine', name: 'Festival Wine', text: 'For 5 minutes: taxes and sell value ×2.' },
  { id: 'greatcharge', name: 'Great Charge', text: 'One blast for 400× tap power.' },
  { id: 'seeker', name: 'Dowsing Glass', text: 'For 3 minutes: salvage ×3.' },
  { id: 'calm', name: 'Still Air', text: 'For 5 minutes: no district hazard touches you.' },
  { id: 'memoir', name: 'Founder’s Memoir', text: 'A great deal of XP at once.' },
  { id: 'grease', name: 'Pump Grease', text: 'For 5 minutes: the Undercroft’s sea stays out of the breaches.' },
  { id: 'kite', name: 'Kite Line', text: 'For 3 minutes: the Cloudline’s gusts do not slow your hands.' },
];

export interface FixtureDef {
  id: FixtureId;
  name: string;
  text: string;
}

export const FIXTURES: readonly FixtureDef[] = [
  { id: 'auction', name: 'Auction House', text: 'Sells salvage past 500 of each kind the moment it comes in.' },
  { id: 'seawall', name: 'Sea Wall', text: 'Keeps the tide off the Harbour: crews work there at full strength, and its low rows stay dry.' },
  { id: 'surveyor', name: 'Surveyor’s Office', text: 'Crews may clear one more ruin a second.' },
  { id: 'charter', name: 'Town Charter', text: 'Clears the crowds from your crews’ way in the Market Ward.' },
  { id: 'archive', name: 'City Archive', text: '+15% Memories from every Tide.' },
  { id: 'scrubbers', name: 'Smog Scrubbers', text: 'Your crews breathe easy in the Foundry Quarter.' },
  { id: 'beacons', name: 'Beacon Line', text: 'Lights a path through the fog for your crews in the Spire.' },
  { id: 'caissons', name: 'Caisson Pumps', text: 'Keeps the sea out of the Undercroft: ruins stay broken, and crews work at full strength.' },
  { id: 'windbreaks', name: 'Windbreaks', text: 'Shelters the Cloudline’s terraces from the gusts. Airship docks need them.' },
  { id: 'treaty', name: 'Treaty of the Bay', text: 'Peace with the Far Shore: taxes are paid in full while you work there. The Assembly Hall needs it.' },
];
