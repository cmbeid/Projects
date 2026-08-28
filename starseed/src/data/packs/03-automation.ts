import type { Automation } from '../types';

/**
 * The automation ladder: four things the player was doing by hand, each handed
 * over to the swarm. They are bought with Compute, which is what makes the
 * whole Ore -> Alloy -> Compute chain pay off rather than being a third number.
 *
 * Each behaviour is implemented once in `game/automation.ts` and runs inside
 * `advance`, so it will apply identically during offline catch-up.
 */
export const AUTOMATION: readonly Automation[] = [
  {
    id: 'auto-miner',
    name: 'Auto-Miner',
    emoji: '🤖',
    blurb: 'A probe stands where you were standing and does what you were doing.',
    retires: 'tapping to mine',
    behaviour: 'mine',
    cost: { resource: 'compute', amount: 15 },
    unlock: { kind: 'lifetime', resource: 'compute', amount: 10 },
  },
  {
    id: 'replication',
    name: 'Replication Protocol',
    emoji: '🔁',
    blurb: 'Spare capacity goes straight back into building. Always the cheapest first.',
    retires: 'buying producers by hand',
    behaviour: 'buildings',
    cost: { resource: 'compute', amount: 250 },
    unlock: { kind: 'lifetime', resource: 'compute', amount: 150 },
  },
  {
    id: 'load-balancer',
    name: 'Load Balancer',
    emoji: '⚖️',
    blurb: 'Watches for a resource about to overflow and builds somewhere to put it.',
    retires: 'watching for full storage',
    behaviour: 'storage',
    cost: { resource: 'compute', amount: 900 },
    unlock: { kind: 'lifetime', resource: 'compute', amount: 800 },
  },
  {
    id: 'procurement',
    name: 'Procurement AI',
    emoji: '🧾',
    blurb: 'Reads the whole tech list, and buys what it can afford.',
    retires: 'checking the Tech panel',
    behaviour: 'upgrades',
    cost: { resource: 'compute', amount: 3_500 },
    unlock: { kind: 'lifetime', resource: 'compute', amount: 2_500 },
  },
];
