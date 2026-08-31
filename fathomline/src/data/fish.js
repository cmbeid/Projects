import { REGIONS } from './regions.js';

// Region 1 (Marrow Cove) — hand-tuned for Phase 1, kept exactly as shipped
// (tests reference these ids directly).
const MARROW_COVE_FISH = [
  {
    id: 'silverfin_minnow', name: 'Silverfin Minnow', region: 'marrow_cove', rarity: 'C',
    minKg: 0.05, maxKg: 0.3, avgKg: 0.15, baseValue: 4, weightBias: 1,
    ai: 'steady', conditions: {}, art: { palette: ['#c9d6e8', '#8fa6bd'], bodyShape: 'slim', finShape: 'round', seed: 1 },
  },
  {
    id: 'cove_sardine', name: 'Cove Sardine', region: 'marrow_cove', rarity: 'C',
    minKg: 0.1, maxKg: 0.4, avgKg: 0.22, baseValue: 5, weightBias: 1,
    ai: 'darter', conditions: {}, art: { palette: ['#8fb8c9', '#4c7a8a'], bodyShape: 'slim', finShape: 'round', seed: 2 },
  },
  {
    id: 'mudsnout_carp', name: 'Mudsnout Carp', region: 'marrow_cove', rarity: 'C',
    minKg: 0.4, maxKg: 2.5, avgKg: 1.1, baseValue: 6, weightBias: 1.1,
    ai: 'sulker', conditions: {}, art: { palette: ['#7a6a4c', '#4c3f2b'], bodyShape: 'round', finShape: 'blunt', seed: 3 },
  },
  {
    id: 'bristle_perch', name: 'Bristle Perch', region: 'marrow_cove', rarity: 'C',
    minKg: 0.2, maxKg: 0.9, avgKg: 0.45, baseValue: 6, weightBias: 1,
    ai: 'thrasher', conditions: {}, art: { palette: ['#8a6a3f', '#c9a45c'], bodyShape: 'round', finShape: 'spiny', seed: 4 },
  },
  {
    id: 'pier_goby', name: 'Pier Goby', region: 'marrow_cove', rarity: 'C',
    minKg: 0.03, maxKg: 0.15, avgKg: 0.08, baseValue: 4, weightBias: 1,
    ai: 'steady', conditions: {}, art: { palette: ['#6a7a4c', '#3f4c2b'], bodyShape: 'slim', finShape: 'round', seed: 5 },
  },
  {
    id: 'copperscale_bass', name: 'Copperscale Bass', region: 'marrow_cove', rarity: 'U',
    minKg: 0.6, maxKg: 2.8, avgKg: 1.4, baseValue: 12, weightBias: 1.1,
    ai: 'diver', conditions: {}, art: { palette: ['#c97a3f', '#8a4a1f'], bodyShape: 'round', finShape: 'blunt', seed: 6 },
  },
  {
    id: 'harbor_mackerel', name: 'Harbor Mackerel', region: 'marrow_cove', rarity: 'U',
    minKg: 0.5, maxKg: 1.8, avgKg: 0.9, baseValue: 13, weightBias: 1,
    ai: 'darter', conditions: {}, art: { palette: ['#5c7a9c', '#2b3f5c'], bodyShape: 'slim', finShape: 'sharp', seed: 7 },
  },
  {
    id: 'spotted_flounder', name: 'Spotted Flounder', region: 'marrow_cove', rarity: 'U',
    minKg: 0.4, maxKg: 2.2, avgKg: 1.0, baseValue: 14, weightBias: 1.15,
    ai: 'sulker', conditions: {}, art: { palette: ['#9c8a6a', '#5c4c3a'], bodyShape: 'flat', finShape: 'wide', seed: 8 },
  },
  {
    id: 'moonlit_trout', name: 'Moonlit Trout', region: 'marrow_cove', rarity: 'R',
    minKg: 0.8, maxKg: 3.5, avgKg: 1.8, baseValue: 32, weightBias: 1.1,
    ai: 'darter', conditions: { time: 'night' }, art: { palette: ['#a8c9e8', '#4c6a8a'], bodyShape: 'slim', finShape: 'sharp', seed: 9 },
  },
  {
    id: 'glass_eel', name: 'Glass Eel', region: 'marrow_cove', rarity: 'R',
    minKg: 0.1, maxKg: 0.6, avgKg: 0.3, baseValue: 35, weightBias: 1,
    ai: 'diver', conditions: {}, art: { palette: ['#e8f3f7', '#a8c9d6'], bodyShape: 'eel', finShape: 'none', seed: 10 },
  },
  {
    id: 'kingfisher_salmon', name: 'Kingfisher Salmon', region: 'marrow_cove', rarity: 'E',
    minKg: 2.0, maxKg: 8.0, avgKg: 4.2, baseValue: 80, weightBias: 1.2,
    ai: 'thrasher', conditions: {}, art: { palette: ['#e89c5c', '#a85c2b'], bodyShape: 'round', finShape: 'sharp', seed: 11 },
  },
  {
    id: 'isoldes_perch', name: "Isolde's Perch", region: 'marrow_cove', rarity: 'L',
    minKg: 3.0, maxKg: 12.0, avgKg: 6.5, baseValue: 260, weightBias: 1.25,
    ai: 'thrasher', aiPhase2: 'diver', conditions: {}, story: true,
    art: { palette: ['#f4c542', '#8a5a1f'], bodyShape: 'round', finShape: 'sharp', seed: 12 },
    lore: "A perch scarred like it fought off something bigger. Gran Isolde's ledger circled this one twice.",
  },
];

// -- Phase 3: the remaining 95 species across 7 regions + 4 Wanderers ------
// Rather than hand-author ~95 verbose objects, each is a compact
// [name, rarity, opts] tuple and a formula derives weight range, value, AI
// profile, and procedural-art parameters from (rarity, region order) plus a
// deterministic per-species hash — so numbers scale sensibly with depth and
// rarity without every entry needing to be typed by hand. `opts.time`,
// `opts.weather`, `opts.boss`, and `opts.lore` carry the plan's per-species
// notes (night-only, rain-only, boss/story flags, flavor text).
const RARITY_ORDER = ['C', 'U', 'R', 'E', 'L', 'M'];
const WEIGHT_RANGE_BY_TIER = [
  [0.05, 0.35], [0.15, 1.0], [0.3, 2.5], [0.6, 5], [1.5, 10], [3, 20],
];
const VALUE_TIER_MULT = [1, 2.2, 4.5, 9, 22, 50];
const AI_PROFILES = ['steady', 'darter', 'diver', 'thrasher', 'sulker'];
const PALETTES = [
  ['#c9d6e8', '#8fa6bd'], ['#8fb8c9', '#4c7a8a'], ['#7a6a4c', '#4c3f2b'],
  ['#8a6a3f', '#c9a45c'], ['#c97a3f', '#8a4a1f'], ['#5c7a9c', '#2b3f5c'],
  ['#9c8a6a', '#5c4c3a'], ['#a8c9e8', '#4c6a8a'], ['#e8f3f7', '#a8c9d6'],
  ['#e89c5c', '#a85c2b'], ['#6ac9a8', '#2b8a5c'], ['#c96a8f', '#7a2b4c'],
  ['#8fc9e8', '#2b5c8a'], ['#e8d65c', '#8a7a2b'], ['#b08fe8', '#4c2b8a'],
];
const BODY_SHAPES = ['slim', 'round', 'flat', 'eel'];
const FIN_SHAPES = ['round', 'blunt', 'spiny', 'sharp', 'wide', 'none'];

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function round(n, places) {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}

function buildSpecies(name, rarity, regionId, regionOrder, opts = {}) {
  const seed = hashSeed(`${regionId}:${name}`);
  const jitter = 0.85 + ((seed % 1000) / 1000) * 0.3; // 0.85 - 1.15, deterministic
  const tier = RARITY_ORDER.indexOf(rarity);
  const regionMult = 1 + (regionOrder - 1) * 0.32;
  const [baseMin, baseMax] = WEIGHT_RANGE_BY_TIER[tier];
  const minKg = round(baseMin * regionMult * jitter, 2);
  const maxKg = round(baseMax * regionMult * jitter, 2);
  const avgKg = round(minKg + (maxKg - minKg) * 0.32, 2); // weightBias below skews rolls low, so avg sits nearer the low end
  const regionValueMult = 3 + (regionOrder - 1) * 3.2;
  const baseValue = round(regionValueMult * VALUE_TIER_MULT[tier] * (0.9 + jitter * 0.2), 1);
  const weightBias = round((tier >= 3 ? 1.15 : 1.0) + tier * 0.03, 2);
  const ai = AI_PROFILES[seed % AI_PROFILES.length];
  const conditions = {};
  if (opts.time) conditions.time = opts.time;
  if (opts.weather) conditions.weather = opts.weather;

  const entry = {
    id: slugify(name),
    name,
    region: regionId,
    rarity,
    minKg, maxKg, avgKg, baseValue, weightBias,
    ai,
    conditions,
    art: {
      palette: PALETTES[seed % PALETTES.length],
      bodyShape: BODY_SHAPES[seed % BODY_SHAPES.length],
      finShape: FIN_SHAPES[(seed >> 3) % FIN_SHAPES.length],
      seed: 100 + seed % 900,
    },
  };
  if (opts.boss) entry.boss = true;
  if (opts.story) entry.story = true;
  if (opts.lore) entry.lore = opts.lore;
  return entry;
}

// [name, rarity, opts?] per region, transcribed from PLAN.md's Fish Catalog table.
const REGION_SPECIES = {
  reedwater_marsh: [
    ['Reed Roach', 'C'], ['Marsh Bream', 'C'], ['Blackmouth Catfish', 'C'], ['Peat Tench', 'C'],
    ['Bulrush Pike', 'U'], ['Amber Loach', 'U'], ['Fen Sturgeon', 'U'],
    ['Bog Lamprey', 'R'], ["Heron's Bane Pike", 'R'],
    ['Mirror Carp', 'E'], ['Sunken Bell Koi', 'E', { weather: ['rain', 'storm'] }],
    ['The Reedmother', 'L', { boss: true, lore: 'Something in the reeds has been growing for a very long time.' }],
  ],
  coral_shelf: [
    ['Clown Wrasse', 'C'], ['Banded Damsel', 'C'], ['Parrotscale', 'C'], ['Sand Goby', 'C'],
    ['Coral Butterflyfish', 'U'], ['Firetail Snapper', 'U'], ['Lionfish', 'U'],
    ['Emperor Angelfish', 'R'], ['Ribbon Eel', 'R'],
    ['Napoleon Wrasse', 'E'], ['Sunburst Grouper', 'E'], ['Titan Triggerfish', 'E'],
    ['Prismscale Manta', 'L', { lore: 'Its wings scatter light like a stained-glass window underwater.' }],
  ],
  kelp_cathedral: [
    ['Kelp Perch', 'C'], ['Señorita Fish', 'C'], ['Green Rockfish', 'C'],
    ['Kelp Greenling', 'U'], ['Leafy Seadragon', 'U'], ['Garibaldi', 'U'], ['Cabezon', 'U'],
    ['Wolf Eel', 'R'], ['Giant Sea Bass', 'R'], ['Sixgill Pup', 'R'],
    ['Vermilion Rockfish', 'E'], ['Canary Rockfish', 'E'],
    ['The Green Warden', 'L', { boss: true, lore: 'Kelp forests this old grow something to watch over them.' }],
  ],
  wreck_of_the_isolde: [
    ['Wreck Blenny', 'C'], ['Rust Crab', 'C'], ['Porthole Scorpionfish', 'C'],
    ['Cargo Conger', 'U'], ['Bone Snapper', 'U'], ['Drowned Cod', 'U'],
    ['Ghostfin Ray', 'R'], ['Anchor Lingcod', 'R'], ['Chainmail Sturgeon', 'R'],
    ['Lantern Grouper', 'E'], ['Coffin Catfish', 'E'], ['Pale Marlin', 'E'],
    ['The Bosun', 'L', { boss: true, story: true, lore: "Whatever kept the Isolde's watch is still keeping it." }],
  ],
  frostcurrent: [
    ['Icefin Smelt', 'C'], ['Arctic Cod', 'C'], ['Snow Char', 'C'], ['Ribbon Capelin', 'C'],
    ['Glacier Halibut', 'U'], ['Frostjaw Pike', 'U'], ['Wolffish', 'U'],
    ['Blue Ling', 'R'], ['Greenland Shark', 'R'], ['Narwhal Eel', 'R'],
    ['Crystal Sturgeon', 'E'], ['Aurora Salmon', 'E'],
    ['The Winterwake', 'L', { boss: true, lore: 'The ice here never fully sets. Something underneath keeps it moving.' }],
  ],
  ember_rift: [
    ['Vent Shrimp', 'C'], ['Cinder Goby', 'C'], ['Sulphur Blenny', 'C'], ['Basalt Crab', 'C'],
    ['Magma Eel', 'U'], ['Obsidian Snapper', 'U'], ['Yeti Crab', 'U'],
    ['Tubeworm Tangler', 'R'], ['Emberfin Tuna', 'R'], ['Smokestack Ray', 'R'],
    ['Pyre Coelacanth', 'E'], ['Molten Anglerfish', 'E'],
    ['The Forgewyrm', 'L', { boss: true, lore: 'The vents here breathe in time with something enormous.' }],
  ],
  fathom_trench: [
    ['Lanternfish', 'C'], ['Bristlemouth', 'C'], ['Hatchetfish', 'C'],
    ['Viperfish', 'U'], ['Barreleye', 'U'], ['Dumbo Octopus', 'U'],
    ['Goblin Shark', 'R'], ['Frilled Shark', 'R'], ['Giant Isopod', 'R'], ['Vampire Squid', 'R'],
    ['Colossal Squid', 'E'], ['Bone Angler', 'E'], ['Gulper Leviathan', 'E'],
    ['Tideheart Leviathan', 'M', { boss: true, story: true, lore: 'The thing Gran Isolde went down to find.' }],
  ],
};

const GENERATED_FISH = Object.entries(REGION_SPECIES).flatMap(([regionId, list]) =>
  list.map(([name, rarity, opts]) => buildSpecies(name, rarity, regionId, REGIONS[regionId].order, opts))
);

// Wanderers: ultra-rare Mythics that can surface in *any* unlocked region
// (region: 'any' — see fishForRegion below), matching the plan's "any
// region, ultra-rare" note.
const WANDERER_FISH = [
  buildSpecies('Silver Wanderer', 'M', 'any', 8),
  buildSpecies('The Drowned Lantern', 'M', 'any', 8),
  buildSpecies('Chronofin', 'M', 'any', 8),
  buildSpecies("Gran Isolde's Ghostfish", 'M', 'any', 8, {
    story: true,
    lore: "Isolde's own hand is in the margins of every log page it appears near.",
  }),
];

export const FISH = [...MARROW_COVE_FISH, ...GENERATED_FISH, ...WANDERER_FISH];

export function fishById(id) {
  return FISH.find((f) => f.id === id);
}

// Region-specific species plus any Wanderer (region: 'any').
export function fishForRegion(regionId) {
  return FISH.filter((f) => f.region === regionId || f.region === 'any');
}
