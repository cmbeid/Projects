// Two starter hires for the Phase 2 idle engine (the remaining 6 of the
// full 8-hire roster arrive with Phase 3's regions). `perk` is intentionally
// left as a documented no-op hook for now — Phase 5+ passives/perks read it.
export const CREW = [
  {
    id: 'deckhand_pell',
    name: 'Deckhand Pell',
    hireCost: 150,
    regionAffinity: 'marrow_cove',
    baseIntervalMs: 25_000,
    rarityBias: { bite: 1.0, rarity: 0.9 },
    maxLevel: 5,
    levelIntervalMult: (level) => 1 - 0.08 * (level - 1), // faster per level
    levelYieldMult: (level) => 1 + 0.05 * (level - 1),
  },
  {
    id: 'netter_maura',
    name: 'Netter Maura',
    hireCost: 400,
    regionAffinity: 'marrow_cove',
    baseIntervalMs: 40_000,
    rarityBias: { bite: 0.85, rarity: 1.25 },
    maxLevel: 5,
    levelIntervalMult: (level) => 1 - 0.06 * (level - 1),
    levelYieldMult: (level) => 1 + 0.08 * (level - 1),
  },
];

export function crewById(id) {
  return CREW.find((c) => c.id === id);
}
