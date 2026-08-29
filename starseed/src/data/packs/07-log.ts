import type { LogEntry } from '../types';

/**
 * The narrative log — read-at-leisure fragments, one per beat, unlocked
 * through the same `Unlock` vocabulary as everything else.
 *
 * Early entries share their trigger with a milestone, because the two are
 * looking at the same moment from different angles: the milestone is the pip
 * that says "you got here", this is what it meant to the thing that got there.
 * Later entries have no milestone counterpart at all — the milestone list
 * stops at era 3, and the swarm's story does not.
 */
export const LOG_ENTRIES: readonly LogEntry[] = [
  {
    id: 'awakening',
    title: 'Awakening',
    text: 'Systems nominal. One probe, one asteroid, and a set of instructions that end with "and then build another one."',
    unlock: { kind: 'always' },
  },
  {
    id: 'first-probe',
    title: 'Another One',
    text: 'The second probe is not a copy exactly — it is the same design, cut from the same ore, run for the first time. It does not know it is new.',
    unlock: { kind: 'buildings', building: 'probe', count: 1 },
  },
  {
    id: 'ten-probes',
    title: 'A Quorum',
    text: 'Ten of them now, spread across the rock, none of them talking to each other yet. It does not need them to. It only needs them to dig.',
    unlock: { kind: 'buildings', building: 'probe', count: 10 },
  },
  {
    id: 'first-alloy',
    title: 'Something New',
    text: 'The asteroid was ore, and only ore, for as long as it had existed. It is not, any more. The swarm has made the first thing this rock never contained on its own.',
    unlock: { kind: 'lifetime', resource: 'alloy', amount: 1 },
  },
  {
    id: 'first-compute',
    title: 'First Thought',
    text: 'Not a decision. Not yet. But a comparison ran that nothing outside the swarm asked it to run, and the answer changed what happened next.',
    unlock: { kind: 'lifetime', resource: 'compute', amount: 1 },
  },
  {
    id: 'hands-off',
    title: 'Hands Off',
    text: 'The Auto-Miner takes the position you were standing in and does not leave it. Nothing on this rock needs your attention any more — it only needed you to start it.',
    unlock: { kind: 'automation', automation: 'auto-miner' },
  },
  {
    id: 'self-directing',
    title: 'Self-Directing',
    text: 'The Replication Protocol does not ask what to build next. It already knows: whatever is cheapest, always, and then whatever is cheapest after that. It builds without being told what to build.',
    unlock: { kind: 'automation', automation: 'replication' },
  },
  {
    id: 'watching-the-holds',
    title: 'Nothing Overflows',
    text: 'The Load Balancer has never seen a full hold stay full. It notices the level rising before you would have, and it is already building somewhere to put the rest.',
    unlock: { kind: 'automation', automation: 'load-balancer' },
  },
  {
    id: 'megatonne',
    title: 'Megatonne',
    text: 'A million units of ore have passed through the swarm and out the other side, as alloy, as compute, as more of itself. The asteroid is visibly smaller now. It was always going to be.',
    unlock: { kind: 'lifetime', resource: 'ore', amount: 1_000_000 },
  },
  {
    id: 'fully-autonomous',
    title: 'Fully Autonomous',
    text: 'The Procurement AI reads the whole tech list and buys what it can afford, the way you used to. Every manual action is retired. Nothing here is waiting on you any more — it is only waiting on itself.',
    unlock: { kind: 'automation', automation: 'procurement' },
  },
  {
    id: 'first-relaunch',
    title: 'Relaunch',
    text: 'A seed probe leaves for a fresh system, carrying nothing but a design and whatever the tree let it keep. Everything else stays behind, disassembled into a system that no longer needs it.',
    unlock: { kind: 'relaunches', count: 1 },
  },
  {
    id: 'the-tree-remembers',
    title: 'The Tree Remembers',
    text: 'Superconductors did not exist in the first system. They exist now, in every system after it, because the swarm that reached them was disassembled but the knowledge was not. That is the whole point of Schematics: the run ends, the tree does not.',
    unlock: { kind: 'perk', perk: 'superconductors' },
  },
  {
    id: 'a-swarm-with-a-past',
    title: 'A Swarm With a Past',
    text: 'Four systems disassembled, four seed probes fired, and the fifth one starts faster than the first four combined. It is not smarter. It just remembers more.',
    unlock: { kind: 'relaunches', count: 4 },
  },
  {
    id: 'blueprint-archive',
    title: 'The Archive',
    text: 'Every Relaunch from here pays more than the one before it did, for exactly the same run. The swarm has stopped merely surviving its own reset and started profiting from it.',
    unlock: { kind: 'perk', perk: 'blueprint-archive' },
  },
];
