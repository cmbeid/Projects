import type { BuildingDef, Tag } from './types';

/**
 * What each kind of building likes to have next door. A building's output is
 * multiplied by 1 + 0.1 × the sum over its neighbours, so a cottage between
 * two gardens houses more people than one beside a workshop.
 */
const LIKES: Record<Tag, Partial<Record<Tag, number>>> = {
  home: { green: 2, civic: 1, trade: 1, crew: -1, industry: -2 },
  crew: { home: 1, industry: 1 },
  trade: { home: 2, civic: 1, trade: -1, industry: -1 },
  industry: { crew: 1, industry: 1, home: -1 },
  green: {},
  civic: { home: 1, green: 1, trade: 1 },
};

type Def = Omit<BuildingDef, 'likes' | 'inputs' | 'w' | 'h'> & Partial<Pick<BuildingDef, 'inputs' | 'w' | 'h'>>;

const b = (d: Def): BuildingDef => ({ w: 1, h: 1, inputs: [], ...d, likes: LIKES[d.tag] });

/**
 * Every building, roughly in the order the city earns them. Every level of a
 * type — a new one placed, or one already standing built up — costs `growth`
 * times the last, so it does not matter to the price whether you build wide
 * or tall; the grid and the neighbours decide which is better.
 */
export const BUILDINGS: readonly BuildingDef[] = [
  // --- The Landing ------------------------------------------------------------
  b({ id: 'tent', name: 'Tent', text: 'Canvas and a cookpot. Houses three.', tag: 'home', pop: 3, baseCost: 12, growth: 1.14, requires: { mission: 'first-light' }, art: { shape: 'tent', roof: '#c8b890', wall: '#8a7a5a' } }),
  b({ id: 'gang', name: 'Salvage Gang', text: 'Picks, a barrow and a lot of opinions. Clears ruins on its own.', tag: 'crew', jobs: 2, dps: 0.6, baseCost: 25, growth: 1.13, requires: { mission: 'roof' }, art: { shape: 'yard', roof: '#c8622a', wall: '#6a4a2a' } }),
  b({ id: 'stall', name: 'Market Stall', text: 'Fish, rope and rumours. Pays taxes while it has people to buy from it.', tag: 'trade', jobs: 2, tax: 0.3, baseCost: 60, growth: 1.15, requires: { mission: 'hands' }, art: { shape: 'stall', roof: '#d04a3a', wall: '#8a6a4a' } }),
  b({ id: 'garden', name: 'Kitchen Garden', text: 'Beans up a string. Homes beside it are happier.', tag: 'green', baseCost: 40, growth: 1.6, maxLevel: 1, inputs: [{ id: 'planks', n: 2 }], requires: { mission: 'planks' }, art: { shape: 'garden', roof: '#4a9a3a', wall: '#6a4a2a' } }),
  b({ id: 'workshop', name: 'Workshop', text: 'A bench, a vice, a kiln out back. Another workshop slot for goods.', tag: 'industry', jobs: 3, slots: 1, baseCost: 150, growth: 2.2, inputs: [{ id: 'planks', n: 4 }], requires: { mission: 'planks' }, art: { shape: 'works', roof: '#6a5a5a', wall: '#a87a5a' } }),
  b({ id: 'well', name: 'Well', text: 'Sweet water under the old square. Each level cheers the whole city a little.', tag: 'civic', cheer: 0.03, baseCost: 300, growth: 1.5, inputs: [{ id: 'bricks', n: 3 }], requires: { ward: 3 }, art: { shape: 'well', roof: '#8a4a2a', wall: '#9a9a9a' } }),

  // --- Old Harbour ------------------------------------------------------------
  b({ id: 'cottage', name: 'Cottage', text: 'Four walls and a door that shuts. Houses twelve.', tag: 'home', pop: 12, baseCost: 600, growth: 1.14, inputs: [{ id: 'planks', n: 3 }, { id: 'bricks', n: 2 }], requires: { ward: 5 }, art: { shape: 'cottage', roof: '#b84a2a', wall: '#e8d8b0' } }),
  b({ id: 'crane', name: 'Harbour Crane', text: 'Timber and chain. Lifts a whole wall away at once.', tag: 'crew', jobs: 6, dps: 14, baseCost: 2500, growth: 1.14, inputs: [{ id: 'ironwork', n: 2 }], requires: { ward: 3 }, art: { shape: 'crane', roof: '#e0a020', wall: '#5a4a3a' } }),
  b({ id: 'fishmarket', name: 'Fish Market', text: 'Slate slabs and gulls. A good trade, near homes.', tag: 'trade', jobs: 6, tax: 6, baseCost: 4000, growth: 1.15, inputs: [{ id: 'planks', n: 4 }], requires: { ward: 9 }, art: { shape: 'hall', roof: '#3a7aa8', wall: '#d8d0b8' } }),
  b({ id: 'quay-garden', name: 'Quay Garden', text: 'Sea-kale and thrift between the bollards.', tag: 'green', baseCost: 5000, growth: 1.6, maxLevel: 1, inputs: [{ id: 'cobble', n: 10 }], requires: { ward: 9 }, art: { shape: 'garden', roof: '#3a8a6a', wall: '#6a727a' } }),
  b({ id: 'lighthouse', name: 'Lighthouse', text: 'A lamp for whoever is still out there.', tag: 'civic', cheer: 0.05, baseCost: 20_000, growth: 1.5, inputs: [{ id: 'bricks', n: 10 }], requires: { ward: 10 }, art: { shape: 'tower', roof: '#d82a2a', wall: '#f0f0e8' } }),
  b({ id: 'boatyard', name: 'Boatyard', text: 'Slipways and sawpits. Another workshop slot.', tag: 'industry', jobs: 10, slots: 1, baseCost: 30_000, growth: 2.2, inputs: [{ id: 'canvas', n: 3 }], requires: { ward: 11 }, art: { shape: 'works', roof: '#4a4a5a', wall: '#8a6040' } }),
  b({ id: 'chapel', name: 'Harbour Chapel', text: 'Votive ships hang from the rafters.', tag: 'civic', cheer: 0.06, baseCost: 50_000, growth: 1.5, inputs: [{ id: 'cobble', n: 30 }], requires: { ward: 12 }, art: { shape: 'chapel', roof: '#5a5a7a', wall: '#d8d0c0' } }),

  // --- Market Ward ------------------------------------------------------------
  b({ id: 'dredger', name: 'Dredger', text: 'A steam barge with a bucket chain. Clears the drowned streets.', tag: 'crew', jobs: 20, dps: 450, baseCost: 600_000, growth: 1.15, inputs: [{ id: 'copperwork', n: 4 }], requires: { ward: 13 }, art: { shape: 'dredger', roof: '#2a2a2a', wall: '#a83a2a' } }),
  b({ id: 'townhouse', name: 'Townhouse', text: 'Three storeys and a fanlight. Houses sixty.', tag: 'home', pop: 60, baseCost: 200_000, growth: 1.14, inputs: [{ id: 'canvas', n: 2 }, { id: 'copperwork', n: 1 }], requires: { ward: 14 }, art: { shape: 'tall', roof: '#4a5a7a', wall: '#d8b890' } }),
  b({ id: 'guildhall', name: 'Guild Hall', text: 'Where the trades argue about prices.', tag: 'trade', w: 2, jobs: 25, tax: 150, baseCost: 1e6, growth: 1.15, inputs: [{ id: 'roof-tiles', n: 4 }], requires: { ward: 17 }, art: { shape: 'longhall', roof: '#7a2a2a', wall: '#e8d0a0' } }),
  b({ id: 'fountain', name: 'Fountain', text: 'A bronze fish spitting at nobody.', tag: 'green', baseCost: 100_000, growth: 1.6, maxLevel: 1, inputs: [{ id: 'slate', n: 20 }], requires: { ward: 17 }, art: { shape: 'fountain', roof: '#5ab0e0', wall: '#a8a8b0' } }),
  b({ id: 'theatre', name: 'Theatre', text: 'Gilt and velvet and dreadful plays.', tag: 'civic', w: 2, cheer: 0.1, baseCost: 5e6, growth: 1.5, inputs: [{ id: 'silkwork', n: 3 }], requires: { ward: 19 }, art: { shape: 'longhall', roof: '#8a2a5a', wall: '#f0e0c0' } }),
  b({ id: 'bank', name: 'Counting House', text: 'Ledgers to the ceiling. Taxes like nothing else.', tag: 'trade', jobs: 40, tax: 1500, baseCost: 2e7, growth: 1.15, inputs: [{ id: 'silkwork', n: 4 }], requires: { ward: 20 }, art: { shape: 'dome', roof: '#3a6a5a', wall: '#e8e0d0' } }),
  b({ id: 'plaza', name: 'Plaza', text: 'A great square with plane trees. Everything around it is happier.', tag: 'green', w: 2, h: 2, baseCost: 3e6, growth: 1.6, maxLevel: 1, inputs: [{ id: 'roof-tiles', n: 6 }], requires: { ward: 21 }, art: { shape: 'plaza', roof: '#3a8a3a', wall: '#b0a890' } }),

  // --- Foundry Quarter --------------------------------------------------------
  b({ id: 'tenement', name: 'Tenement', text: 'Five floors, one stair, a lot of washing. Houses two hundred and fifty.', tag: 'home', pop: 250, baseCost: 4e7, growth: 1.14, inputs: [{ id: 'roof-tiles', n: 3 }, { id: 'silkwork', n: 1 }], requires: { ward: 23 }, art: { shape: 'block', roof: '#3a3a3a', wall: '#a8604a' } }),
  b({ id: 'shovel', name: 'Steam Shovel', text: 'Treads, a boiler, and no patience.', tag: 'crew', jobs: 80, dps: 15_000, baseCost: 3e8, growth: 1.15, inputs: [{ id: 'silkwork', n: 2 }, { id: 'roof-tiles', n: 2 }], requires: { ward: 24 }, art: { shape: 'shovel', roof: '#e8b030', wall: '#3a3a3a' } }),
  b({ id: 'canal-park', name: 'Canal Park', text: 'Willows along the cut.', tag: 'green', w: 2, baseCost: 5e8, growth: 1.6, maxLevel: 1, inputs: [{ id: 'cullet', n: 20 }], requires: { ward: 26 }, art: { shape: 'park', roof: '#3a7a4a', wall: '#3a6a8a' } }),
  b({ id: 'great-foundry', name: 'Great Foundry', text: 'Two furnaces and a chimney you can see from sea. Two workshop slots.', tag: 'industry', w: 2, h: 2, jobs: 100, slots: 2, baseCost: 1e9, growth: 2.2, inputs: [{ id: 'steel', n: 4 }], requires: { ward: 27 }, art: { shape: 'foundry', roof: '#3a3030', wall: '#7a4a3a' } }),
  b({ id: 'exchange', name: 'Exchange', text: 'Brass rails and a trading floor.', tag: 'trade', jobs: 150, tax: 40_000, baseCost: 5e9, growth: 1.15, inputs: [{ id: 'panes', n: 4 }], requires: { ward: 28 }, art: { shape: 'dome', roof: '#7a6a2a', wall: '#d8d0c0' } }),
  b({ id: 'filter-tower', name: 'Filter Tower', text: 'It breathes in the smog and breathes out something better.', tag: 'civic', cheer: 0.12, baseCost: 2e9, growth: 1.5, inputs: [{ id: 'panes', n: 3 }, { id: 'steel', n: 1 }], requires: { ward: 29 }, art: { shape: 'tower', roof: '#3ab08a', wall: '#8a8a8a' } }),

  // --- The Drowned Spire ------------------------------------------------------
  b({ id: 'arcology', name: 'Arcology', text: 'A city in a building, gardens on every floor. Houses two and a half thousand.', tag: 'home', w: 2, h: 2, pop: 2500, baseCost: 2e11, growth: 1.14, inputs: [{ id: 'marble-block', n: 4 }], requires: { ward: 33 }, art: { shape: 'arcology', roof: '#5a8a5a', wall: '#e8e8f0' } }),
  b({ id: 'lumen-garden', name: 'Lumen Garden', text: 'Glass flowers that hold the light all night.', tag: 'green', baseCost: 5e10, growth: 1.6, maxLevel: 1, inputs: [{ id: 'lumen', n: 2 }], requires: { ward: 33 }, art: { shape: 'garden', roof: '#8a8af0', wall: '#c8c8d8' } }),
  b({ id: 'skyhook', name: 'Skyhook', text: 'A crane hung from the Spire itself.', tag: 'crew', jobs: 600, dps: 500_000, baseCost: 1e12, growth: 1.15, inputs: [{ id: 'lumen', n: 2 }], requires: { ward: 34 }, art: { shape: 'crane', roof: '#c8d0ff', wall: '#6a7490' } }),
  b({ id: 'grand-exchange', name: 'Grand Exchange', text: 'Everything is for sale, including the weather.', tag: 'trade', w: 2, jobs: 1000, tax: 2e6, baseCost: 3e13, growth: 1.15, inputs: [{ id: 'marble-block', n: 6 }], requires: { ward: 35 }, art: { shape: 'longhall', roof: '#c8a83a', wall: '#f0f0f8' } }),
  b({ id: 'observatory', name: 'Observatory', text: 'They found the old founders’ star charts. The stars have moved.', tag: 'civic', cheer: 0.15, baseCost: 1e13, growth: 1.5, inputs: [{ id: 'lumen', n: 4 }], requires: { ward: 36 }, art: { shape: 'dome', roof: '#4a4a8a', wall: '#e0e0f0' } }),
  b({ id: 'bell-tower', name: 'Bell Tower', text: 'A bell cast from the Spire’s own metal. It rings by itself.', tag: 'civic', cheer: 0.2, baseCost: 1e14, growth: 1.5, inputs: [{ id: 'spire-key', n: 1 }], requires: { ward: 38 }, art: { shape: 'tower', roof: '#c8c8f0', wall: '#6a7490' } }),
];

export const BUILDING: ReadonlyMap<string, BuildingDef> = new Map(BUILDINGS.map((d) => [d.id, d]));

export const TAG_LABEL: Record<Tag, string> = {
  home: 'Home',
  crew: 'Crew',
  trade: 'Trade',
  green: 'Green',
  civic: 'Civic',
  industry: 'Industry',
};
