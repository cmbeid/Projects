import {
  BUILD_BASE,
  ERA_SCALE,
  ERA_MATS,
  TIER_CAP,
  TIER_HOUSING,
  TIER_POWER,
  TIER_PROD,
  TIER_SLOTS,
  TIER_STABILITY,
} from './progression';
import type { Bundle, JobId, LineDef, LineId, ResId, TierDef } from './types';

/**
 * Building lines. A line is one kind of building — homes, farms, a place of
 * study — and it has a tier for every era from the one it first appears in.
 * Whatever you build is the current era's tier; what is already standing
 * stays as it was until you modernize it, and the skyline shows it.
 */

interface LineSpec {
  id: LineId;
  name: string;
  job: JobId | null;
  role: 'home' | 'work' | 'store' | 'shrine' | 'power';
  /** How heavily each of the era's materials weighs in its price. */
  shape: readonly number[];
  /** Resources it never costs (usually its own product). */
  avoid?: readonly ResId[];
  first: number;
  tiers: readonly (readonly [string, string])[];
  tech?: Partial<Record<number, string>>;
  fuel?: Partial<Record<number, Bundle>>;
}

const SPECS: readonly LineSpec[] = [
  {
    id: 'home',
    name: 'Homes',
    job: null,
    role: 'home',
    shape: [1, 0.6, 0.3],
    first: 0,
    tiers: [
      ['Hut', 'Hides over a frame of bent poles.'],
      ['Mudbrick House', 'Sun-dried brick, a flat roof to sleep on in summer.'],
      ['Insula', 'Three storeys of flats over a row of shops.'],
      ['Timber House', 'Oak frame, wattle and daub, a jettied upper floor.'],
      ['Townhouse', 'Tall, narrow, with glass in every window.'],
      ['Tenement', 'Brick, soot and a shared stair. Cheap, and full.'],
      ['Apartment Block', 'Concrete, lifts and a view.'],
      ['Arcology Spire', 'A town in a tower, its own weather inside.'],
    ],
  },
  {
    id: 'farm',
    name: 'Farms',
    job: 'farmer',
    role: 'work',
    shape: [0.8, 0.4, 0.2],
    first: 0,
    tiers: [
      ['Garden Plot', 'Wild grain, sown on purpose for the first time.'],
      ['Barley Field', 'Irrigated from the river by a ditch and a lot of digging.'],
      ['Olive Grove', 'Oil, fruit and shade, planted for grandchildren.'],
      ['Three-Field Farm', 'One field rests each year, and the harvest doubles.'],
      ['Estate Farm', 'Clover, turnips and a ledger of yields.'],
      ['Steam Farm', 'A threshing engine and a long, straight furrow.'],
      ['Agro-Complex', 'Tractors, fertiliser and a silo you can see for miles.'],
      ['Hydroponic Tower', 'Lettuce on the eightieth floor, under violet light.'],
    ],
  },
  {
    id: 'lumber',
    name: 'Lumber',
    job: 'woodcutter',
    role: 'work',
    shape: [0.5, 0.8, 0.3],
    avoid: ['wood'],
    first: 0,
    tiers: [
      ["Woodcutters' Camp", 'Flint axes and a pile of logs.'],
      ['Lumber Yard', 'Bronze saws and a drying shed.'],
      ['Timber Works', 'Ship timber for a navy, beams for a temple.'],
      ['Sawpit', 'One man on top, one in the pit, a long saw between them.'],
      ['Water Sawmill', 'The river does the sawing now.'],
      ['Steam Sawmill', 'A boiler, a belt and a scream of blades.'],
      ['Pulp Mill', 'Wood into paper, board and everything else.'],
      ['Bio-Timber Vat', 'Grows wood without a tree in sight.'],
    ],
  },
  {
    id: 'quarry',
    name: 'Quarries',
    job: 'quarrier',
    role: 'work',
    shape: [0.9, 0.3, 0.3],
    avoid: ['stone'],
    first: 0,
    tiers: [
      ['Flint Pit', 'Knapping flint by the chalk cliff.'],
      ['Quarry', 'Copper chisels and wooden wedges, soaked to split the rock.'],
      ['Marble Quarry', 'White stone for white temples.'],
      ["Masons' Yard", 'A lodge of masons and their marks.'],
      ['Brickworks', 'Kilns that never go out.'],
      ['Cement Works', 'Limestone burned to powder, then to anything you like.'],
      ['Concrete Plant', 'Mixers turning all day.'],
      ['Regolith Printer', 'Prints walls from crushed rock and a little glue.'],
    ],
  },
  {
    id: 'mine',
    name: 'Mines',
    job: 'miner',
    role: 'work',
    shape: [1, 0.6, 0.3],
    avoid: ['metal', 'coal'],
    first: 1,
    tiers: [
      ['Copper Pit', 'Green-stained rock, a fire and a crucible.'],
      ['Iron Mine', 'Harder ore, harder metal.'],
      ['Shaft Mine', 'Down by ladder, up by windlass.'],
      ['Deep Mine', 'Pumps, pit props and canaries.'],
      ['Colliery', 'A winding tower over a black seam.'],
      ['Strip Mine', 'Take the hill off the top of the ore.'],
      ['Asteroid Tether', 'Ore on a cable, lowered from orbit.'],
    ],
  },
  {
    id: 'store',
    name: 'Storage',
    job: null,
    role: 'store',
    shape: [1, 1, 0.3],
    first: 0,
    tiers: [
      ['Cache Pit', 'A hole lined with clay and covered with stones.'],
      ['Granary', 'Raised off the ground, out of reach of the rats.'],
      ['Storehouse', 'The city’s stock, counted and sealed.'],
      ['Tithe Barn', 'A tenth of everything, under one long roof.'],
      ['Warehouse', 'Bales and barrels from five continents.'],
      ['Rail Depot', 'Sidings, cranes and a goods shed.'],
      ['Distribution Centre', 'Racks to the ceiling and a robot to fetch.'],
      ['Orbital Depot', 'Stock held in orbit, dropped on demand.'],
    ],
  },
  {
    id: 'study',
    name: 'Learning',
    job: 'scholar',
    role: 'work',
    shape: [0.6, 1, 0.5],
    first: 0,
    tiers: [
      ["Elders' Fire", 'Where the old ones tell what they remember.'],
      ["Scribes' House", 'Clay tablets and a reed stylus.'],
      ['Academy', 'A garden, a colonnade and an argument.'],
      ['Monastery', 'Copying the old books, and sometimes reading them.'],
      ['University', 'Lecture halls and a library with chains on the books.'],
      ['Laboratory', 'Glassware, gas lamps and a lot of explosions.'],
      ['Research Institute', 'Grants, journals and a particle accelerator.'],
      ['Quantum Lab', 'Thinks about everything at once.'],
    ],
  },
  {
    id: 'shrine',
    name: 'Culture',
    job: 'artist',
    role: 'shrine',
    shape: [0.7, 1, 0.6],
    first: 0,
    tiers: [
      ['Spirit Totem', 'Carved faces watching over the camp.'],
      ['Sun Shrine', 'A step-roofed shrine to the god of the harvest.'],
      ['Theatre', 'Tragedy in the afternoon, comedy after.'],
      ['Chapel', 'Bells, candles and a painted ceiling.'],
      ['Opera House', 'Gilt, velvet and a soprano.'],
      ['Music Hall', 'A song, a dance and a pint.'],
      ['Stadium', 'Eighty thousand voices on a Saturday.'],
      ['Holo-Arena', 'Every seat the best seat.'],
    ],
  },
  {
    id: 'market',
    name: 'Trade',
    job: 'merchant',
    role: 'work',
    shape: [0.8, 0.6, 0.5],
    avoid: ['gold'],
    first: 1,
    tech: { 1: 'barter' },
    tiers: [
      ['Market Stall', 'A rug, an awning and a set of scales.'],
      ['Agora', 'The square where everything is for sale, including opinions.'],
      ['Market Hall', 'Guild stalls under a timber roof.'],
      ['Counting House', 'Ledgers in double entry, and letters of credit.'],
      ['Exchange', 'Shares in ships that have not sailed yet.'],
      ['Shopping Mall', 'Everything under one roof, and a fountain.'],
      ['Data Exchange', 'Trades in futures, literally.'],
    ],
  },
  {
    id: 'works',
    name: 'Industry',
    job: 'smith',
    role: 'work',
    shape: [1, 0.8, 0.4],
    avoid: ['steel'],
    first: 5,
    tech: { 5: 'steam-power' },
    tiers: [
      ['Steelworks', 'A Bessemer converter, roaring.'],
      ['Steel Plant', 'Electric arc furnaces, and a mile of rolling mill.'],
      ['Nanoforge', 'Steel grown atom by atom.'],
    ],
  },
  {
    id: 'power',
    name: 'Power',
    job: null,
    role: 'power',
    shape: [1, 0.7, 0.5],
    first: 5,
    tech: { 5: 'steam-power' },
    fuel: { 5: { coal: 1.2 }, 6: { oil: 1.2 } },
    tiers: [
      ['Coal Power Station', 'Burns coal for the grid.'],
      ['Oil Power Station', 'Burns oil for the grid.'],
      ['Fusion Reactor', 'A small star in a magnetic bottle. Burns nothing you would notice.'],
    ],
  },
  {
    id: 'well',
    name: 'Oil',
    job: 'driller',
    role: 'work',
    shape: [1, 0.7, 0.5],
    avoid: ['oil'],
    first: 6,
    tech: { 6: 'combustion' },
    tiers: [
      ['Oil Derrick', 'A nodding donkey in a field.'],
      ['Methane Cracker', 'Fuel from the air and the sea.'],
    ],
  },
  {
    id: 'server',
    name: 'Computing',
    job: 'coder',
    role: 'work',
    shape: [1, 0.6, 0.6],
    avoid: ['data'],
    first: 6,
    tech: { 6: 'computing' },
    tiers: [
      ['Data Centre', 'Rows of blinking cabinets and a very loud air conditioner.'],
      ['Quantum Server Farm', 'Cold enough to stop atoms in their tracks.'],
    ],
  },
  {
    id: 'fab',
    name: 'Fabrication',
    job: 'fabricator',
    role: 'work',
    shape: [1, 0.8, 0.6],
    avoid: ['alloy'],
    first: 7,
    tiers: [['Alloy Foundry', 'Spaceframe alloy, printed in vacuum.']],
  },
];

/** Price of a tier, before the line's count: the era's materials weighted by the line's shape. */
function price(era: number, shape: readonly number[], avoid: readonly ResId[]): Bundle {
  const out: Bundle = {};
  const base = BUILD_BASE * ERA_SCALE[era]!;
  ERA_MATS[era]!.forEach((r, i) => {
    const w = shape[i] ?? 0;
    if (w <= 0) return;
    // A line never costs what it makes; the era's first material it can cost stands in.
    // (Not gold: a mine that cost gold could never be the first thing that leads to it.)
    const res = avoid.includes(r) ? ERA_MATS[era]!.find((x) => !avoid.includes(x)) : r;
    if (!res) return;
    out[res] = Math.round((out[res] ?? 0) + base * w);
  });
  return out;
}

function tier(spec: LineSpec, i: number): TierDef {
  const era = spec.first + i;
  const [name, blurb] = spec.tiers[i]!;
  const t: TierDef = {
    era,
    name,
    blurb,
    cost: price(era, spec.shape, spec.avoid ?? []),
    housing: spec.role === 'home' ? TIER_HOUSING[era]! : 0,
    slots: spec.role === 'work' || spec.role === 'shrine' ? TIER_SLOTS[era]! : 0,
    prod: TIER_PROD[era]!,
    cap: spec.role === 'store' ? TIER_CAP[era]! : 0,
    stability: spec.role === 'shrine' ? TIER_STABILITY[era]! : 0,
    power: spec.role === 'power' ? TIER_POWER[era]! : 0,
    fuel: spec.fuel?.[era] ?? {},
  };
  const tech = spec.tech?.[era];
  if (tech) t.tech = tech;
  return t;
}

export const LINES: readonly LineDef[] = SPECS.map((spec) => ({
  id: spec.id,
  name: spec.name,
  job: spec.job,
  tiers: spec.tiers.map((_, i) => tier(spec, i)),
}));

export const LINE = new Map<LineId, LineDef>(LINES.map((l) => [l.id, l]));
export const LINE_IDS: readonly LineId[] = LINES.map((l) => l.id);

/** The line's tier for an era, or the newest one before it; undefined if the line has not appeared yet. */
export function tierFor(line: LineDef, era: number): TierDef | undefined {
  let best: TierDef | undefined;
  for (const t of line.tiers) if (t.era <= era) best = t;
  return best;
}

/** Index into `line.tiers` of the tier built in `era`. */
export function tierIndex(line: LineDef, era: number): number {
  return Math.max(0, Math.min(line.tiers.length - 1, era - line.tiers[0]!.era));
}
