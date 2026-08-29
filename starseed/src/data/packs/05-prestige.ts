import type { Perk } from '../types';

/**
 * The Schematics tree — layer 1's permanent ratchet.
 *
 * Everything here survives a Relaunch, so the tree is the reason a second run
 * is faster than the first rather than merely a repeat of it. Three shapes,
 * deliberately:
 *
 *  - **Throughput** lines (ore, alloy, compute) that make the old wall move.
 *  - **Head start** nodes, which are worth more than their raw numbers suggest
 *    because the opening minutes of a run are the slowest part of it.
 *  - **Structural** nodes — cooling, storage, payout — that change what the
 *    directives in `06-directives.ts` are good at rather than just how big the
 *    numbers get.
 *
 * Costs climb roughly geometrically against a payout that grows as the square
 * root of the run, so the tree stays a few runs ahead of the player throughout
 * phase 4 instead of being cleared in two.
 */
export const PERKS: readonly Perk[] = [
  // --- The root -------------------------------------------------------------
  {
    id: 'seed-cache',
    name: 'Seed Cache',
    emoji: '📦',
    blurb: 'The seed probe carries ore with it. The first minute stops being empty.',
    cost: 1,
    effects: [{ kind: 'start', resource: 'ore', amount: 2_000 }],
    requires: [],
  },

  // --- Ore ------------------------------------------------------------------
  {
    id: 'hardened-bits',
    name: 'Hardened Bits',
    emoji: '⛏️',
    blurb: 'Every digging thing you have ever built, +50% ore.',
    cost: 2,
    effects: [{ kind: 'global', resource: 'ore', factor: 1.5 }],
    requires: ['seed-cache'],
  },
  {
    id: 'deep-veins',
    name: 'Deep Veins',
    emoji: '🕳️',
    blurb: 'You know where to dig now. Ore ×2.5.',
    cost: 8,
    effects: [{ kind: 'global', resource: 'ore', factor: 2.5 }],
    requires: ['hardened-bits'],
  },
  {
    id: 'core-tap',
    name: 'Core Tap',
    emoji: '🌋',
    blurb: 'Straight down, all the way. Ore ×4.',
    cost: 30,
    effects: [{ kind: 'global', resource: 'ore', factor: 4 }],
    requires: ['deep-veins'],
  },

  // --- Alloy ----------------------------------------------------------------
  {
    id: 'clean-melt',
    name: 'Clean Melt',
    emoji: '🔥',
    blurb: 'Nothing is lost to slag any more. Alloy ×2.',
    cost: 3,
    effects: [{ kind: 'global', resource: 'alloy', factor: 2 }],
    requires: ['seed-cache'],
  },
  {
    id: 'cold-forge',
    name: 'Cold Forge',
    emoji: '❄️',
    blurb: 'Alloy ×3, and the forges stop fighting their own waste heat.',
    cost: 12,
    effects: [
      { kind: 'global', resource: 'alloy', factor: 3 },
      { kind: 'heat', factor: 0.85 },
    ],
    requires: ['clean-melt'],
  },

  // --- Compute --------------------------------------------------------------
  {
    id: 'parallel-thought',
    name: 'Parallel Thought',
    emoji: '🧠',
    blurb: 'The lattice stops waiting on itself. Compute ×2.',
    cost: 5,
    effects: [{ kind: 'global', resource: 'compute', factor: 2 }],
    requires: ['seed-cache'],
  },
  {
    id: 'distributed-mind',
    name: 'Distributed Mind',
    emoji: '🕸️',
    blurb: 'Thinking spread across the whole swarm. Compute ×3.',
    cost: 18,
    effects: [{ kind: 'global', resource: 'compute', factor: 3 }],
    requires: ['parallel-thought'],
  },

  // --- Structural -----------------------------------------------------------
  {
    id: 'radiator-fins',
    name: 'Radiator Fins',
    emoji: '🌡️',
    blurb: 'Thermal load ×0.7. The swarm can be bigger before it cooks.',
    cost: 6,
    effects: [{ kind: 'heat', factor: 0.7 }],
    requires: ['seed-cache'],
  },
  {
    id: 'superconductors',
    name: 'Superconductors',
    emoji: '⚡',
    blurb: 'Thermal load ×0.5, on top of everything else.',
    cost: 22,
    effects: [{ kind: 'heat', factor: 0.5 }],
    requires: ['radiator-fins'],
  },
  {
    id: 'packed-holds',
    name: 'Packed Holds',
    emoji: '🗃️',
    blurb: 'Every depot holds three times as much, of everything.',
    cost: 4,
    effects: [
      { kind: 'capacity', resource: 'ore', factor: 3 },
      { kind: 'capacity', resource: 'alloy', factor: 3 },
      { kind: 'capacity', resource: 'compute', factor: 3 },
    ],
    requires: ['seed-cache'],
  },
  {
    id: 'folded-space',
    name: 'Folded Space',
    emoji: '🌀',
    blurb: 'Storage ×5 again. Coming back to a full hold stops costing you.',
    cost: 16,
    effects: [
      { kind: 'capacity', resource: 'ore', factor: 5 },
      { kind: 'capacity', resource: 'alloy', factor: 5 },
      { kind: 'capacity', resource: 'compute', factor: 5 },
    ],
    requires: ['packed-holds'],
  },
  {
    id: 'kinetic-memory',
    name: 'Kinetic Memory',
    emoji: '👊',
    blurb: 'Your hands remember the work. Manual mining ×20.',
    cost: 3,
    effects: [{ kind: 'tap', factor: 20 }],
    requires: ['seed-cache'],
  },
  {
    id: 'salvage-hold',
    name: 'Salvage Hold',
    emoji: '🚚',
    blurb: 'The seed probe leaves with a full hold: 250K ore and 20K alloy.',
    cost: 14,
    effects: [
      { kind: 'start', resource: 'ore', amount: 250_000 },
      { kind: 'start', resource: 'alloy', amount: 20_000 },
    ],
    requires: ['kinetic-memory'],
  },
  {
    id: 'blueprint-archive',
    name: 'Blueprint Archive',
    emoji: '📐',
    blurb: 'Every Relaunch pays 50% more Schematics. The tree pays for itself.',
    cost: 40,
    effects: [{ kind: 'payout', factor: 1.5 }],
    requires: ['deep-veins', 'distributed-mind'],
  },
];

/**
 * `schematics = floor( (runValue / DIVISOR) ^ EXPONENT )`, where `runValue` is
 * everything the run produced weighted by `prestigeWeight` (see
 * `00-resources.ts`).
 *
 * The square root is the important half: it stops a run ten times as long being
 * ten times as rewarding, which is what makes a short deliberate run a viable
 * strategy rather than a mistake.
 *
 * The divisor is set from measurement, not from taste. A greedy simulated
 * player reaches a run value of ~3e7 at 2h, ~2e8 at 3h and ~6e8 at 5h, so 1e7
 * puts the first Relaunch at about 2h45m — the middle of §5's 2h-5h window —
 * and pays 6 Schematics at 4h and 8 at 5h to anyone who waits. Waiting is
 * rewarded; it is never required.
 */
export const SCHEMATIC_DIVISOR = 1e7;
export const SCHEMATIC_EXPONENT = 0.5;

/**
 * Relaunching for one or two Schematics would be a trap: the reset costs more
 * than the payout buys. The floor makes the button honest — it is not offered
 * until it is worth pressing.
 */
export const RELAUNCH_MINIMUM = 3;

/** Directives a loadout holds. Families make the pick exclusive; this makes it scarce. */
export const DIRECTIVE_SLOTS = 3;
