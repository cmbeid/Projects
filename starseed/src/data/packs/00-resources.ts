import type { Resource } from '../types';

/**
 * Three resources, each gating the next. Ore is dug out of rock; Alloy is
 * refined from Ore; Compute is grown from Alloy and buys the automation that
 * retires the manual play.
 *
 * Caps are deliberately reachable. Overflow is discarded, and a resource
 * sitting full is the pressure that makes depots worth buying and gives a
 * reason to come back.
 */
export const RESOURCES: readonly Resource[] = [
  {
    id: 'ore',
    name: 'Ore',
    emoji: '⛏️',
    blurb: 'Crushed regolith. Everything the swarm builds starts here.',
    baseCap: 5_000,
    unlock: { kind: 'always' },
  },
  {
    id: 'alloy',
    name: 'Alloy',
    emoji: '🔩',
    blurb: 'Ore cooked into something a probe can be built out of.',
    baseCap: 1_000,
    unlock: { kind: 'lifetime', resource: 'ore', amount: 8_000 },
  },
  {
    id: 'compute',
    name: 'Compute',
    emoji: '🧠',
    blurb: 'Thinking, measured. The swarm buys its own autonomy with this.',
    baseCap: 300,
    unlock: { kind: 'lifetime', resource: 'alloy', amount: 800 },
  },
];

/** Ore per manual tap, before any `tap` upgrade multiplies it. */
export const BASE_TAP_YIELD = 1;

/**
 * Thermal load the swarm sheds for free. Past this, `softCapPenalty` applies
 * `(threshold / heat) ^ 0.5` — diminishing, never negative, so overbuilding is
 * inefficient rather than a trap.
 *
 * The threshold is set high enough that heat is a late-game consideration
 * rather than a constant drag. Set too low, it does something worse than slow
 * the player down: because the penalty is global, adding converters taxes the
 * miners feeding them, and total output *falls* while the player is still
 * building. A swarm that visibly shrinks as you grow it reads as a bug.
 */
export const HEAT_THRESHOLD = 2_000;
export const HEAT_EXPONENT = 0.5;
