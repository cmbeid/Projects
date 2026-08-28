import type { Milestone } from '../types';

/**
 * Progress markers. In phases 1-3 these only drive the milestone list in the
 * UI; phase 5 hangs the narrative log off the same conditions, which is why
 * they are content rather than hard-coded thresholds.
 */
export const MILESTONES: readonly Milestone[] = [
  {
    id: 'first-probe',
    name: 'Another One',
    blurb: 'The first copy. There has never been a second of anything out here.',
    condition: { kind: 'buildings', building: 'probe', count: 1 },
  },
  {
    id: 'ten-probes',
    name: 'A Quorum',
    blurb: 'Ten probes. Enough to lose one and not notice.',
    condition: { kind: 'buildings', building: 'probe', count: 10 },
  },
  {
    id: 'first-alloy',
    name: 'Something New',
    blurb: 'The asteroid contained no alloy. Now it does.',
    condition: { kind: 'lifetime', resource: 'alloy', amount: 1 },
  },
  {
    id: 'first-compute',
    name: 'First Thought',
    blurb: 'The swarm computes something that was not asked of it.',
    condition: { kind: 'lifetime', resource: 'compute', amount: 1 },
  },
  {
    id: 'hands-off',
    name: 'Hands Off',
    blurb: 'Nothing on this rock requires you any more.',
    condition: { kind: 'automation', automation: 'auto-miner' },
  },
  {
    id: 'self-directing',
    name: 'Self-Directing',
    blurb: 'It builds without being told what to build.',
    condition: { kind: 'automation', automation: 'replication' },
  },
  {
    id: 'megatonne',
    name: 'Megatonne',
    blurb: 'A million units of ore have passed through the swarm.',
    condition: { kind: 'lifetime', resource: 'ore', amount: 1_000_000 },
  },
  {
    id: 'fully-autonomous',
    name: 'Fully Autonomous',
    blurb: 'Every manual action has been retired. The swarm runs itself.',
    condition: { kind: 'automation', automation: 'procurement' },
  },
];
