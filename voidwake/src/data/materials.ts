import type { ConsumableDef, ConsumableId, MaterialDef, MatId } from './types';

export const MATERIALS: readonly MaterialDef[] = [
  { id: 'ore', name: 'Ore', value: 4, weight: 1, color: '#b08a64', refined: false, desc: 'Iron and nickel. Hull plate, alloy, everything.' },
  { id: 'ice', name: 'Ice', value: 3, weight: 1, color: '#9adcf0', refined: false, desc: 'Water to drink, hydrogen to burn. A refinery turns it into fuel.' },
  { id: 'organics', name: 'Organics', value: 5, weight: 1, color: '#7ac85a', refined: false, desc: 'Biomass. Feeds the hydroponics and, in a pinch, the crew.' },
  { id: 'crystal', name: 'Crystal', value: 9, weight: 1, color: '#c890f0', refined: false, desc: 'Lattice crystal. Grows circuits and focuses lasers.' },
  { id: 'relic', name: 'Relic', value: 22, weight: 2, color: '#f0c860', refined: false, desc: 'Pieces of the ark, or of someone older.' },
  { id: 'alloy', name: 'Alloy', value: 16, weight: 1, color: '#c8d0dc', refined: true, desc: 'Refined plate. Ship upgrades eat it by the tonne.' },
  { id: 'circuits', name: 'Circuits', value: 30, weight: 1, color: '#5ae0b0', refined: true, desc: 'Grown boards. Shields, sensors, anything that thinks.' },
  { id: 'exotic', name: 'Exotic matter', value: 70, weight: 1, color: '#f070b0', refined: true, desc: 'It weighs less the more you have. Drives and the best gear.' },
];
export const MAT = new Map(MATERIALS.map((m) => [m.id, m]));
export const MAT_IDS: readonly MatId[] = MATERIALS.map((m) => m.id);
export const RAW_MATS: readonly MatId[] = MATERIALS.filter((m) => !m.refined).map((m) => m.id);

export const CONSUMABLES: readonly ConsumableDef[] = [
  { id: 'medkit', name: 'Medkit', desc: 'Heals one crew member by 40.', value: 30, use: ['ship', 'combat', 'away'] },
  { id: 'ration', name: 'Ration crate', desc: '+6 food.', value: 18, use: ['ship'] },
  { id: 'fuelcell', name: 'Fuel cell', desc: '+3 fuel.', value: 30, use: ['ship'] },
  { id: 'powercell', name: 'Power cell', desc: '+15 energy.', value: 20, use: ['ship', 'combat'] },
  { id: 'o2can', name: 'O₂ canister', desc: 'Refills 60 seconds of suit air on a landing.', value: 16, use: ['away'] },
  { id: 'repairkit', name: 'Repair kit', desc: '+12 hull.', value: 35, use: ['ship', 'combat'] },
  { id: 'decoy', name: 'Decoy drone', desc: 'In a fight: finishes charging the jump drive at once.', value: 45, use: ['combat'] },
  { id: 'stim', name: 'Stim', desc: 'Restores 25 morale to the whole crew.', value: 25, use: ['ship'] },
  { id: 'scanner', name: 'Deep scanner', desc: 'Reveals the whole sector map.', value: 40, use: ['ship'] },
  { id: 'shieldcell', name: 'Shield cell', desc: 'In a fight: fully recharges the shields.', value: 30, use: ['combat'] },
];
export const CONSUMABLE = new Map(CONSUMABLES.map((c) => [c.id, c]));
export const CONSUMABLE_IDS: readonly ConsumableId[] = CONSUMABLES.map((c) => c.id);
