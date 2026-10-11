import { GEAR } from './gear';
import type { Bundle, GearDef, RecipeDef } from './types';

const BASE: readonly RecipeDef[] = [
  // Refining
  { id: 'r-alloy', name: 'Smelt alloy', cost: { ore: 4 }, fab: 1, out: { mat: 'alloy', n: 1 } },
  { id: 'r-alloy-bulk', name: 'Smelt alloy ×5', cost: { ore: 18 }, fab: 2, out: { mat: 'alloy', n: 5 } },
  { id: 'r-circuits', name: 'Grow circuits', cost: { crystal: 3, ore: 1 }, fab: 1, out: { mat: 'circuits', n: 1 } },
  { id: 'r-circuits-relic', name: 'Reverse-engineer circuits', cost: { relic: 1, crystal: 1 }, fab: 2, out: { mat: 'circuits', n: 2 } },
  { id: 'r-exotic', name: 'Condense exotic matter', cost: { relic: 3, crystal: 4, circuits: 2 }, fab: 3, out: { mat: 'exotic', n: 1 } },
  { id: 'r-exotic-choir', name: 'Tune exotic matter', cost: { crystal: 6, circuits: 2 }, fab: 3, out: { mat: 'exotic', n: 1 }, flag: 'choir-chord' },
  { id: 'r-organics', name: 'Culture organics', cost: { ice: 2, ore: 1 }, fab: 1, out: { mat: 'organics', n: 2 } },
  // Consumables
  { id: 'r-medkit', name: 'Medkit', cost: { organics: 3, crystal: 1 }, fab: 1, out: { item: 'medkit', n: 1 } },
  { id: 'r-ration', name: 'Ration crate', cost: { organics: 4 }, fab: 1, out: { item: 'ration', n: 1 } },
  { id: 'r-fuelcell', name: 'Fuel cell', cost: { ice: 5, crystal: 1 }, fab: 1, out: { item: 'fuelcell', n: 1 } },
  { id: 'r-powercell', name: 'Power cell', cost: { crystal: 2, ore: 2 }, fab: 1, out: { item: 'powercell', n: 1 } },
  { id: 'r-o2can', name: 'O₂ canister', cost: { ice: 3 }, fab: 1, out: { item: 'o2can', n: 1 } },
  { id: 'r-repairkit', name: 'Repair kit', cost: { alloy: 1, ore: 4 }, fab: 1, out: { item: 'repairkit', n: 1 } },
  { id: 'r-decoy', name: 'Decoy drone', cost: { alloy: 1, circuits: 1 }, fab: 2, out: { item: 'decoy', n: 1 } },
  { id: 'r-stim', name: 'Stim', cost: { organics: 3, crystal: 2 }, fab: 2, out: { item: 'stim', n: 1 } },
  { id: 'r-scanner', name: 'Deep scanner', cost: { circuits: 1, crystal: 2 }, fab: 2, out: { item: 'scanner', n: 1 } },
  { id: 'r-shieldcell', name: 'Shield cell', cost: { crystal: 3, circuits: 1 }, fab: 2, out: { item: 'shieldcell', n: 1 } },
];

function gearFab(g: GearDef): number {
  return g.tier <= 1 ? 1 : g.tier <= 3 ? 2 : g.tier <= 5 ? 3 : 4;
}

function gearCost(g: GearDef): Bundle {
  const t = g.tier;
  const main: Bundle =
    g.slot === 'weapon' ? { alloy: 1 + t, crystal: t } : g.slot === 'suit' ? { alloy: t, organics: 2 + t * 2 } : g.slot === 'tool' ? { alloy: 1 + t, ore: 3 * t } : { crystal: 1 + t, circuits: Math.ceil(t / 2) };
  if (t >= 3) main.circuits = (main.circuits ?? 0) + t - 2;
  if (t >= 4) main.relic = t - 3;
  if (t >= 5) main.exotic = t - 4;
  return main;
}

/** Starting kit is never crafted; everything else is. */
const STARTER = new Set(['w-cutter', 's-basic', 't-pick']);

export const RECIPES: readonly RecipeDef[] = [
  ...BASE,
  ...GEAR.filter((g) => !STARTER.has(g.id)).map(
    (g): RecipeDef => ({
      id: `r-${g.id}`,
      name: g.name,
      cost: gearCost(g),
      fab: gearFab(g),
      out: { gear: g.id },
      ...(g.tier >= 6 ? { flag: 'haven-signal' } : {}),
    }),
  ),
];
export const RECIPE = new Map(RECIPES.map((r) => [r.id, r]));
