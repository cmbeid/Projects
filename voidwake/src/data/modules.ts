import type { ModuleDef, ModuleId } from './types';

/**
 * Ship modules, each upgraded through Mk I–IV. `v` is the module's headline
 * number at that tier; `derive` says what it means for each module.
 */
export const MODULES: readonly ModuleDef[] = [
  {
    id: 'laser', name: 'Laser Battery', desc: 'Damage per shot. Fires every turn.', starts: 1, upkeep: 1,
    tiers: [
      { name: 'Mk I', cost: {}, credits: 0, v: 4, desc: '4 damage, every turn' },
      { name: 'Mk II', cost: { alloy: 3, crystal: 3 }, credits: 60, v: 6, desc: '6 damage, every turn' },
      { name: 'Mk III', cost: { alloy: 6, circuits: 3 }, credits: 140, v: 8, desc: '8 damage, every turn' },
      { name: 'Mk IV', cost: { alloy: 10, circuits: 6, exotic: 2 }, credits: 300, v: 11, desc: '11 damage, every turn' },
    ],
  },
  {
    id: 'missile', name: 'Missile Rack', desc: 'Heavy shots that ignore shields. Slow to reload.', starts: 0, upkeep: 1,
    tiers: [
      { name: 'Mk I', cost: { alloy: 4, ore: 8 }, credits: 80, v: 8, desc: '8 damage, every 3 turns' },
      { name: 'Mk II', cost: { alloy: 6, circuits: 2 }, credits: 160, v: 12, desc: '12 damage, every 3 turns' },
      { name: 'Mk III', cost: { alloy: 10, circuits: 4 }, credits: 280, v: 16, desc: '16 damage, every 3 turns' },
      { name: 'Mk IV', cost: { alloy: 14, circuits: 6, exotic: 3 }, credits: 450, v: 22, desc: '22 damage, every 3 turns' },
    ],
  },
  {
    id: 'ion', name: 'Ion Cannon', desc: 'Strips shields and scrambles systems. No hull damage.', starts: 0, upkeep: 1,
    tiers: [
      { name: 'Mk I', cost: { crystal: 6, circuits: 1 }, credits: 90, v: 6, desc: '6 shield damage, every 2 turns' },
      { name: 'Mk II', cost: { crystal: 8, circuits: 3 }, credits: 170, v: 9, desc: '9 shield damage, every 2 turns' },
      { name: 'Mk III', cost: { circuits: 6, exotic: 1 }, credits: 290, v: 13, desc: '13 shield damage, every 2 turns' },
      { name: 'Mk IV', cost: { circuits: 9, exotic: 3 }, credits: 460, v: 18, desc: '18 shield damage, every 2 turns' },
    ],
  },
  {
    id: 'shield', name: 'Shield Generator', desc: 'Absorbs damage; regenerates each turn.', starts: 1, upkeep: 1,
    tiers: [
      { name: 'Mk I', cost: {}, credits: 0, v: 4, desc: '4 shield, +1 a turn' },
      { name: 'Mk II', cost: { crystal: 4, alloy: 2 }, credits: 70, v: 7, desc: '7 shield, +2 a turn' },
      { name: 'Mk III', cost: { circuits: 4, alloy: 4 }, credits: 170, v: 11, desc: '11 shield, +3 a turn' },
      { name: 'Mk IV', cost: { circuits: 8, exotic: 2 }, credits: 330, v: 16, desc: '16 shield, +4 a turn' },
    ],
  },
  {
    id: 'engine', name: 'Engines', desc: 'Evasion in combat; a better drive burns less fuel.', starts: 1, upkeep: 1,
    tiers: [
      { name: 'Mk I', cost: {}, credits: 0, v: 0.1, desc: '10% evasion' },
      { name: 'Mk II', cost: { alloy: 3, ore: 6 }, credits: 60, v: 0.15, desc: '15% evasion, jumps −10% fuel' },
      { name: 'Mk III', cost: { alloy: 6, circuits: 2 }, credits: 150, v: 0.2, desc: '20% evasion, jumps −20% fuel' },
      { name: 'Mk IV', cost: { alloy: 8, circuits: 4, exotic: 2 }, credits: 300, v: 0.26, desc: '26% evasion, jumps −30% fuel' },
    ],
  },
  {
    id: 'sensor', name: 'Sensor Array', desc: 'How far ahead the map reveals itself; accuracy in combat.', starts: 1, upkeep: 1,
    tiers: [
      { name: 'Mk I', cost: {}, credits: 0, v: 1, desc: 'See 1 jump ahead' },
      { name: 'Mk II', cost: { crystal: 4 }, credits: 50, v: 2, desc: 'See 2 jumps ahead, +5% accuracy' },
      { name: 'Mk III', cost: { crystal: 4, circuits: 2 }, credits: 130, v: 3, desc: 'See 3 jumps ahead, +10% accuracy' },
      { name: 'Mk IV', cost: { circuits: 5, exotic: 1 }, credits: 260, v: 5, desc: 'See 5 jumps ahead, +15% accuracy' },
    ],
  },
  {
    id: 'reactor', name: 'Reactor', desc: 'Energy produced each day.', starts: 1, upkeep: 0,
    tiers: [
      { name: 'Mk I', cost: {}, credits: 0, v: 13, desc: '+13 energy a day' },
      { name: 'Mk II', cost: { alloy: 3, crystal: 3 }, credits: 70, v: 18, desc: '+18 energy a day' },
      { name: 'Mk III', cost: { alloy: 5, circuits: 3 }, credits: 160, v: 24, desc: '+24 energy a day' },
      { name: 'Mk IV', cost: { circuits: 5, exotic: 2 }, credits: 300, v: 32, desc: '+32 energy a day' },
    ],
  },
  {
    id: 'cargo', name: 'Cargo Hold', desc: 'How much fuel, food and energy the ship can hold.', starts: 1, upkeep: 0,
    tiers: [
      { name: 'Mk I', cost: {}, credits: 0, v: 1, desc: 'Fuel 14, food 30, energy 40' },
      { name: 'Mk II', cost: { alloy: 3, ore: 10 }, credits: 50, v: 1.4, desc: 'Fuel 19, food 42, energy 56' },
      { name: 'Mk III', cost: { alloy: 6, ore: 10 }, credits: 120, v: 1.8, desc: 'Fuel 25, food 54, energy 72' },
      { name: 'Mk IV', cost: { alloy: 10, circuits: 2 }, credits: 240, v: 2.4, desc: 'Fuel 33, food 72, energy 96' },
    ],
  },
  {
    id: 'hydro', name: 'Hydroponics', desc: 'Grows food every day.', starts: 1, upkeep: 1,
    tiers: [
      { name: 'Mk I', cost: {}, credits: 0, v: 1.5, desc: '+1.5 food a day' },
      { name: 'Mk II', cost: { organics: 8, alloy: 2 }, credits: 50, v: 2.5, desc: '+2.5 food a day' },
      { name: 'Mk III', cost: { organics: 12, circuits: 2 }, credits: 130, v: 3.5, desc: '+3.5 food a day' },
      { name: 'Mk IV', cost: { organics: 16, circuits: 3, exotic: 1 }, credits: 260, v: 5, desc: '+5 food a day' },
    ],
  },
  {
    id: 'refinery', name: 'Refinery', desc: 'Cracks ice into fuel after every jump.', starts: 0, upkeep: 2,
    tiers: [
      { name: 'Mk I', cost: { alloy: 3, ore: 10 }, credits: 70, v: 0.5, desc: '2 ice → 1 fuel, up to 1 a jump' },
      { name: 'Mk II', cost: { alloy: 5, crystal: 2 }, credits: 130, v: 1, desc: 'Up to 2 fuel a jump' },
      { name: 'Mk III', cost: { alloy: 6, circuits: 3 }, credits: 220, v: 1.5, desc: 'Up to 3 fuel a jump' },
      { name: 'Mk IV', cost: { circuits: 5, exotic: 2 }, credits: 340, v: 2, desc: 'Up to 4 fuel a jump' },
    ],
  },
  {
    id: 'fabricator', name: 'Fabricator', desc: 'Unlocks better recipes.', starts: 1, upkeep: 1,
    tiers: [
      { name: 'Mk I', cost: {}, credits: 0, v: 1, desc: 'Basic recipes' },
      { name: 'Mk II', cost: { alloy: 4, crystal: 4 }, credits: 80, v: 2, desc: 'Sector 2–3 gear' },
      { name: 'Mk III', cost: { alloy: 6, circuits: 4 }, credits: 180, v: 3, desc: 'Sector 4–5 gear' },
      { name: 'Mk IV', cost: { circuits: 8, exotic: 3 }, credits: 340, v: 4, desc: 'Ark-grade gear' },
    ],
  },
  {
    id: 'medbay', name: 'Med-bay', desc: 'Crew heal faster every day.', starts: 0, upkeep: 1,
    tiers: [
      { name: 'Mk I', cost: { alloy: 2, organics: 6 }, credits: 60, v: 4, desc: '+4 health a day' },
      { name: 'Mk II', cost: { alloy: 4, circuits: 1 }, credits: 120, v: 8, desc: '+8 health a day' },
      { name: 'Mk III', cost: { circuits: 3, organics: 10 }, credits: 200, v: 13, desc: '+13 health a day' },
      { name: 'Mk IV', cost: { circuits: 5, exotic: 1 }, credits: 320, v: 20, desc: '+20 health a day' },
    ],
  },
  {
    id: 'cabins', name: 'Crew Cabins', desc: 'How many crew the ship can carry.', starts: 1, upkeep: 0,
    tiers: [
      { name: 'Mk I', cost: {}, credits: 0, v: 3, desc: '3 berths' },
      { name: 'Mk II', cost: { alloy: 4, organics: 4 }, credits: 70, v: 4, desc: '4 berths' },
      { name: 'Mk III', cost: { alloy: 6, organics: 8 }, credits: 150, v: 5, desc: '5 berths' },
      { name: 'Mk IV', cost: { alloy: 9, circuits: 3 }, credits: 260, v: 6, desc: '6 berths' },
    ],
  },
  {
    id: 'plating', name: 'Hull Plating', desc: 'Maximum hull.', starts: 1, upkeep: 0,
    tiers: [
      { name: 'Mk I', cost: {}, credits: 0, v: 40, desc: '40 hull' },
      { name: 'Mk II', cost: { alloy: 5, ore: 10 }, credits: 70, v: 55, desc: '55 hull' },
      { name: 'Mk III', cost: { alloy: 9, ore: 10 }, credits: 160, v: 75, desc: '75 hull' },
      { name: 'Mk IV', cost: { alloy: 14, exotic: 2 }, credits: 320, v: 100, desc: '100 hull' },
    ],
  },
  {
    id: 'lander', name: 'Lander', desc: 'Suit air and carry space for every landing.', starts: 1, upkeep: 0,
    tiers: [
      { name: 'Mk I', cost: {}, credits: 0, v: 0, desc: 'Standard kit' },
      { name: 'Mk II', cost: { alloy: 3, ice: 6 }, credits: 50, v: 1, desc: '+20s air, +6 carry' },
      { name: 'Mk III', cost: { alloy: 5, circuits: 2 }, credits: 130, v: 2, desc: '+40s air, +12 carry' },
      { name: 'Mk IV', cost: { circuits: 4, exotic: 1 }, credits: 240, v: 3, desc: '+60s air, +20 carry' },
    ],
  },
];
export const MODULE = new Map(MODULES.map((m) => [m.id, m]));
export const MODULE_IDS: readonly ModuleId[] = MODULES.map((m) => m.id);
