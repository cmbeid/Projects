// Region 1 (Marrow Cove) — the 12 species that make Phase 1's vertical
// slice. Regions 2-8 (95 more species) are added in Phase 3; every system
// reads this table generically so growing it is a data edit, not new code.
export const FISH = [
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

export function fishById(id) {
  return FISH.find((f) => f.id === id);
}

export function fishForRegion(regionId) {
  return FISH.filter((f) => f.region === regionId);
}
