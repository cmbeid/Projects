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
  /** Relaunches completed. Survives a reset, so it gates content permanently. */
  | { kind: 'relaunches'; count: number }
  | { kind: 'perk'; perk: string }
  | { kind: 'all'; of: Unlock[] };

export interface Resource {
  id: ResourceId;
  name: string;
  emoji: string;
  blurb: string;
  /** Storage ceiling before any multiplier. Overflow is discarded. */
  baseCap: number;
  /**
   * What one unit of this is worth in ore, following the conversion ladder.
   *
   * The Relaunch payout is measured through these, so a run that made less ore
   * but turned it into something is worth what it actually achieved. Weighting
   * only ore — the obvious first move — quietly makes two thirds of the economy
   * invisible to prestige, and with it every directive that trades ore away.
   */
  prestigeWeight: number;
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

/**
 * A narrative fragment, unlocked the same way everything else gates: through
 * `Unlock`. Kept as its own array rather than folded into `Milestone` because
 * the two answer different questions — a milestone is "you reached this",
 * shown once as a short pip, while a log entry is "here is what that meant",
 * read at leisure in the Log panel and never re-shown as a toast.
 *
 * Triggers deliberately reuse milestone conditions where a beat already has
 * one, and reach past them to cover the Relaunch arc, which the milestone
 * list stops short of.
 */
export interface LogEntry {
  id: string;
  title: string;
  text: string;
  unlock: Unlock;
}

/**
 * What a Relaunch cannot take away.
 *
 * Perks and directives share one vocabulary deliberately: they are composed by
 * the same function and applied at the same point in the pipeline, so a
 * directive can never do something a perk could not, and neither can reach
 * around the order of operations in `rates.ts`.
 *
 * `start` and `carry` are the exceptions — they are read once, by the reset
 * itself, rather than every time rates are computed.
 */
export type PrestigeEffect =
  /** Multiplies everything that produces a resource. */
  | { kind: 'global'; resource: ResourceId; factor: number }
  | { kind: 'building'; building: string; factor: number }
  /** Scales total thermal load. Below 1 is cooling; above 1 is a real cost. */
  | { kind: 'heat'; factor: number }
  | { kind: 'tap'; factor: number }
  | { kind: 'capacity'; resource: ResourceId; factor: number }
  /** Ore in the hold the moment the new run begins. */
  | { kind: 'start'; resource: ResourceId; amount: number }
  /** A fraction of what the *previous* run was holding, kept through the reset. */
  | { kind: 'carry'; resource: ResourceId; fraction: number }
  /** Multiplies the Schematics a Relaunch pays out. */
  | { kind: 'payout'; factor: number };

/**
 * A node in the Schematics tree: bought once, kept forever.
 *
 * `requires` is what makes it a tree rather than a shopping list — an early
 * cheap node has to be worth buying on its own *and* as the gate to the
 * expensive one behind it.
 */
export interface Perk {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  /** Schematics. */
  cost: number;
  effects: PrestigeEffect[];
  requires: string[];
}

/**
 * One pick in a Relaunch loadout.
 *
 * Directives are strong and mutually exclusive **by family**, so a loadout is a
 * commitment rather than a checklist: taking Rapid Fission means not taking the
 * other Expansion directive, this run. That is where "each prestige plays
 * differently" actually lives — the trees are the ratchet, these are the
 * variety.
 */
export interface Directive {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  /** Only one directive per family may be in a loadout. */
  family: string;
  effects: PrestigeEffect[];
  unlock: Unlock;
}

export interface Content {
  resources: readonly Resource[];
  buildings: readonly Building[];
  upgrades: readonly Upgrade[];
  automation: readonly Automation[];
  milestones: readonly Milestone[];
  perks: readonly Perk[];
  directives: readonly Directive[];
  log: readonly LogEntry[];
}
