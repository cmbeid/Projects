// All 8 regions (Phase 3). `unlock.minBoat` ties region access to the Boat
// gear line (see data/upgrades.js GEAR.boat) — buying the next boat tier is
// what actually opens new water, matching the plan's "Boat rank -> region
// access, crew slots, offline cap" design.
export const REGIONS = {
  marrow_cove: { id: 'marrow_cove', name: 'Marrow Cove', order: 1, unlock: { minBoat: 1 }, baseValue: 8 },
  reedwater_marsh: { id: 'reedwater_marsh', name: 'Reedwater Marsh', order: 2, unlock: { minBoat: 2 }, baseValue: 14 },
  coral_shelf: { id: 'coral_shelf', name: 'Coral Shelf', order: 3, unlock: { minBoat: 2 }, baseValue: 16 },
  kelp_cathedral: { id: 'kelp_cathedral', name: 'Kelp Cathedral', order: 4, unlock: { minBoat: 3 }, baseValue: 22 },
  wreck_of_the_isolde: { id: 'wreck_of_the_isolde', name: 'Wreck of the Isolde', order: 5, unlock: { minBoat: 4 }, baseValue: 30 },
  frostcurrent: { id: 'frostcurrent', name: 'Frostcurrent', order: 6, unlock: { minBoat: 4 }, baseValue: 34 },
  ember_rift: { id: 'ember_rift', name: 'Ember Rift', order: 7, unlock: { minBoat: 5 }, baseValue: 42 },
  fathom_trench: { id: 'fathom_trench', name: 'Fathom Trench', order: 8, unlock: { minBoat: 6 }, baseValue: 55 },
};

export const STARTING_REGION = 'marrow_cove';

export function orderedRegions() {
  return Object.values(REGIONS).sort((a, b) => a.order - b.order);
}

export function isRegionUnlocked(state, regionId) {
  const region = REGIONS[regionId];
  if (!region) return false;
  const boatTier = state.gear.boat ?? 1;
  return boatTier >= region.unlock.minBoat;
}

export function unlockedRegions(state) {
  return orderedRegions().filter((r) => isRegionUnlocked(state, r.id));
}
