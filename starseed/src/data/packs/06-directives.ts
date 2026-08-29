import type { Directive } from '../types';

/**
 * The directive pool. Three are picked at each Relaunch.
 *
 * Two rules do all the design work:
 *
 *  - **One per family.** Expansion, Tempo, Logistics and Doctrine each offer a
 *    different answer to the same question, so a loadout is three commitments
 *    rather than three bonuses.
 *  - **Every directive costs something.** A pick that is strictly better than
 *    not picking it is not a choice, and a pool of those collapses into one
 *    correct loadout inside a run or two.
 *
 * Five are open at the first Relaunch, spread across all four families, so the
 * three slots can be filled several different ways from the start. The other
 * four arrive as the player keeps relaunching, so the pool widens exactly as
 * the runs get quick enough to want the variety.
 */
export const DIRECTIVES: readonly Directive[] = [
  // --- Expansion: how hard the swarm is pushed ------------------------------
  {
    id: 'rapid-fission',
    name: 'Rapid Fission',
    emoji: '☢️',
    blurb: 'Probes and drills run at triple rate, eating the feedstock — alloy ×0.55.',
    family: 'Expansion',
    effects: [
      { kind: 'building', building: 'probe', factor: 3 },
      { kind: 'building', building: 'drill', factor: 3 },
      { kind: 'heat', factor: 1.5 },
      { kind: 'global', resource: 'alloy', factor: 0.55 },
    ],
    unlock: { kind: 'always' },
  },
  {
    id: 'strip-mining',
    name: 'Strip Mining',
    emoji: '🪨',
    blurb: 'Ore ×2.2, and nothing is left over to refine or think with.',
    family: 'Expansion',
    effects: [
      { kind: 'global', resource: 'ore', factor: 2.2 },
      { kind: 'global', resource: 'alloy', factor: 0.8 },
      { kind: 'global', resource: 'compute', factor: 0.4 },
    ],
    unlock: { kind: 'always' },
  },
  {
    id: 'exponential-mandate',
    name: 'Exponential Mandate',
    emoji: '📈',
    blurb: 'Everything ×2.5, three times as hot, and nowhere to put any of it — storage ×0.3.',
    family: 'Tempo',
    effects: [
      { kind: 'global', resource: 'ore', factor: 2.5 },
      { kind: 'global', resource: 'alloy', factor: 2.5 },
      { kind: 'global', resource: 'compute', factor: 2.5 },
      { kind: 'heat', factor: 3 },
      // The real cost, and the one an idle game can charge honestly: the
      // fastest swarm is the worst one to walk away from.
      { kind: 'capacity', resource: 'ore', factor: 0.3 },
      { kind: 'capacity', resource: 'alloy', factor: 0.3 },
      { kind: 'capacity', resource: 'compute', factor: 0.3 },
    ],
    unlock: { kind: 'perk', perk: 'superconductors' },
  },

  // --- Tempo: how hard the swarm is run, and what that costs ----------------
  {
    id: 'cold-logic',
    name: 'Cold Logic',
    emoji: '🧊',
    blurb: 'The swarm stops racing and starts thinking: no thermal load, Compute ×4, mining halved.',
    family: 'Tempo',
    effects: [
      { kind: 'heat', factor: 0 },
      { kind: 'building', building: 'probe', factor: 0.5 },
      { kind: 'building', building: 'drill', factor: 0.5 },
      { kind: 'global', resource: 'compute', factor: 4 },
    ],
    unlock: { kind: 'always' },
  },
  {
    id: 'frugal-swarm',
    name: 'Frugal Swarm',
    emoji: '🍃',
    blurb: 'Thermal load ×0.35 and storage ×3, bought with a tenth of the digging.',
    family: 'Tempo',
    effects: [
      { kind: 'heat', factor: 0.35 },
      { kind: 'capacity', resource: 'ore', factor: 3 },
      { kind: 'capacity', resource: 'alloy', factor: 3 },
      { kind: 'capacity', resource: 'compute', factor: 3 },
      { kind: 'global', resource: 'ore', factor: 0.9 },
    ],
    unlock: { kind: 'relaunches', count: 2 },
  },

  // --- Logistics: where the run's throughput goes ---------------------------
  {
    id: 'foundry-priority',
    name: 'Foundry Priority',
    emoji: '⚒️',
    blurb: 'Alloy ×4.5. The miners feeding them are throttled to 70%.',
    family: 'Logistics',
    effects: [
      { kind: 'global', resource: 'alloy', factor: 4.5 },
      { kind: 'global', resource: 'ore', factor: 0.7 },
    ],
    unlock: { kind: 'always' },
  },
  {
    id: 'wide-holds',
    name: 'Wide Holds',
    emoji: '🏗️',
    blurb: 'Storage ×12, so nothing overflows while you are away, and Compute ×1.4. Ore ×0.8.',
    family: 'Logistics',
    effects: [
      { kind: 'capacity', resource: 'ore', factor: 12 },
      { kind: 'capacity', resource: 'alloy', factor: 12 },
      { kind: 'capacity', resource: 'compute', factor: 12 },
      { kind: 'global', resource: 'compute', factor: 1.4 },
      { kind: 'global', resource: 'ore', factor: 0.8 },
    ],
    unlock: { kind: 'relaunches', count: 1 },
  },

  // --- Doctrine: what the swarm carries between systems ---------------------
  {
    id: 'salvage-doctrine',
    name: 'Salvage Doctrine',
    emoji: '♻️',
    blurb: 'The seed probe leaves with a tenth of the alloy this run ends on.',
    family: 'Doctrine',
    effects: [{ kind: 'carry', resource: 'alloy', fraction: 0.1 }],
    unlock: { kind: 'always' },
  },
  {
    id: 'long-memory',
    name: 'Long Memory',
    emoji: '🗿',
    blurb: 'The next Relaunch pays 40% more Schematics. Compute ×0.7 meanwhile.',
    family: 'Doctrine',
    effects: [
      { kind: 'payout', factor: 1.4 },
      { kind: 'global', resource: 'compute', factor: 0.7 },
    ],
    unlock: { kind: 'relaunches', count: 4 },
  },
];
