/** The three resources of eras 1-3. Energy and Exotic Matter arrive with prestige. */
export type ResourceId = 'ore' | 'alloy' | 'compute';

export const RESOURCE_IDS: readonly ResourceId[] = ['ore', 'alloy', 'compute'];

export type Era = 1 | 2 | 3;

/**
 * A gate on content becoming visible.
 *
 * Evaluated against lifetime totals rather than current stock, so spending a
 * resource never un-reveals something the player has already seen — which reads
 * as a bug every time.
 */
export type Unlock =
  | { kind: 'always' }
  | { kind: 'lifetime'; resource: ResourceId; amount: number }
  | { kind: 'buildings'; building: string; count: number }
  | { kind: 'upgrade'; upgrade: string }
  | { kind: 'automation'; automation: string }
  | { kind: 'all'; of: Unlock[] };

export interface Resource {
  id: ResourceId;
  name: string;
  emoji: string;
  blurb: string;
  /** Storage ceiling before any multiplier. Overflow is discarded. */
  baseCap: number;
  unlock: Unlock;
}

export interface Flow {
  resource: ResourceId;
  /** Units per second, per building owned. */
  rate: number;
}

export interface Building {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  era: Era;
  /** What one unit makes each second. */
  output: Flow;
  /** What one unit eats each second. Empty for miners, which create from rock. */
  inputs: Flow[];
  cost: {
    resource: ResourceId;
    base: number;
    /** Geometric growth per unit owned. 1.07 early, up to 1.15 late. */
    growth: number;
  };
  /** Thermal load per unit, which feeds the soft cap. */
  heat: number;
  /** Storage this adds per unit, for the depot buildings. */
  capacity?: { resource: ResourceId; amount: number };
  unlock: Unlock;
}

/**
 * Where an upgrade lands in the production pipeline. The distinction is the
 * whole reason `rates.ts` has a fixed order of operations: `additive` effects
 * pool inside a building before anything multiplies it.
 */
export type Effect =
  | { kind: 'additive'; building: string; amount: number }
  | { kind: 'multiplier'; building: string; factor: number }
  | { kind: 'global'; resource: ResourceId; factor: number }
  | { kind: 'capacity'; resource: ResourceId; factor: number }
  | { kind: 'cooling'; factor: number }
  | { kind: 'tap'; factor: number };

export interface Upgrade {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  era: Era;
  cost: { resource: ResourceId; amount: number };
  effects: Effect[];
  unlock: Unlock;
}

/**
 * Something the player was doing by hand that the swarm now does for them.
 * Each behaviour is implemented once in `automation.ts` and runs inside
 * `advance`, so it applies identically during offline catch-up.
 */
export type AutomationBehaviour = 'mine' | 'buildings' | 'storage' | 'upgrades';

export interface Automation {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  /** Named in the UI so the reward is legible: "no more tapping". */
  retires: string;
  behaviour: AutomationBehaviour;
  cost: { resource: ResourceId; amount: number };
  unlock: Unlock;
}

export interface Milestone {
  id: string;
  name: string;
  blurb: string;
  condition: Unlock;
}

export interface Content {
  resources: readonly Resource[];
  buildings: readonly Building[];
  upgrades: readonly Upgrade[];
  automation: readonly Automation[];
  milestones: readonly Milestone[];
}
