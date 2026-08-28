import { Decimal } from '../num/decimal';
import { BASE_TAP_YIELD, HEAT_EXPONENT, HEAT_THRESHOLD } from '../data/index';
import type { Building, ResourceId } from '../data/types';
import { RESOURCE_IDS } from '../data/types';
import type { ContentIndex } from '../data/indexes';
import type { GameState } from '../state/types';
import { AUTO_TAPS_PER_SECOND } from './automation';

/**
 * Multipliers from prestige layers. Phases 1-3 have no prestige, so this is
 * always the identity — it exists as a typed seam so layers 4 and 7 plug in
 * without `rates.ts` growing an import it cannot have yet.
 */
export interface PrestigeMultipliers {
  byResource: ReadonlyMap<ResourceId, number>;
}

export const NO_PRESTIGE: PrestigeMultipliers = { byResource: new Map() };

/** One building's throughput, before input starvation is accounted for. */
export interface BuildingRate {
  building: Building;
  count: number;
  /**
   * Dimensionless scale at which this stack is running: count, grown by every
   * bonus that applies to it. Output and input are both this times their base
   * rate, which is what keeps a boosted converter honest — running a refinery
   * twice as hard eats twice the ore.
   */
  activity: Decimal;
  output: Decimal;
  inputs: Array<{ resource: ResourceId; rate: Decimal }>;
}

export interface Rates {
  perBuilding: BuildingRate[];
  /** Potential production per second, summed. Not what actually lands — see
   *  the throttle step in `engine.ts`. */
  output: Map<ResourceId, Decimal>;
  /**
   * Production from sources with no building behind them — currently only the
   * Auto-Miner. It has no inputs, so it is never throttled, but it belongs in
   * the displayed rate like everything else.
   */
  flatOutput: Map<ResourceId, Decimal>;
  input: Map<ResourceId, Decimal>;
  caps: Map<ResourceId, Decimal>;
  heat: number;
  heatPenalty: number;
  tapYield: Decimal;
}

/**
 * The production pipeline. One function, one fixed order of operations.
 *
 *   perBuilding = count
 *               * baseRate
 *               * (1 + Σ additive[building])     // upgrade tiers, flat %
 *               * Π multiplicative[building]     // per-building multipliers
 *
 *   rate(res)   = Σ perBuilding over producers of res
 *               * Π globalMultipliers[res]       // tech, milestone rewards
 *               * prestigeMult(layer1)           // Schematics tree
 *               * prestigeMult(layer2)           // Insight tree
 *               * softCapPenalty(state)          // thermal load
 *
 * The order is load-bearing. Additive bonuses pool *within* a building before
 * anything multiplies, so "+25% ore per probe" upgrades stack linearly with
 * each other and multiplicatively with everything else. Reversing this makes
 * late-game additive upgrades worthless, and is the classic way an idle game's
 * balance quietly dies.
 */
export function computeRates(
  state: GameState,
  index: ContentIndex,
  prestige: PrestigeMultipliers = NO_PRESTIGE,
): Rates {
  const additive = new Map<string, number>();
  const multiplier = new Map<string, number>();
  const global = new Map<ResourceId, number>();
  const capacity = new Map<ResourceId, number>();
  let cooling = 1;
  let tap = BASE_TAP_YIELD;

  for (const id of state.upgrades) {
    const upgrade = index.upgradeById.get(id);
    if (!upgrade) continue; // A save from a build that had content this one does not.
    for (const effect of upgrade.effects) {
      switch (effect.kind) {
        case 'additive':
          additive.set(effect.building, (additive.get(effect.building) ?? 0) + effect.amount);
          break;
        case 'multiplier':
          multiplier.set(effect.building, (multiplier.get(effect.building) ?? 1) * effect.factor);
          break;
        case 'global':
          global.set(effect.resource, (global.get(effect.resource) ?? 1) * effect.factor);
          break;
        case 'capacity':
          capacity.set(effect.resource, (capacity.get(effect.resource) ?? 1) * effect.factor);
          break;
        case 'cooling':
          cooling *= effect.factor;
          break;
        case 'tap':
          tap *= effect.factor;
          break;
      }
    }
  }

  // --- Thermal load, which scales everything that runs ----------------------
  let heat = 0;
  for (const building of index.content.buildings) {
    const count = state.buildings[building.id] ?? 0;
    if (count > 0) heat += count * building.heat;
  }
  heat *= cooling;
  const heatPenalty = softCapPenalty(heat);

  // --- Per-building throughput ---------------------------------------------
  const perBuilding: BuildingRate[] = [];
  const output = emptyTotals();
  const input = emptyTotals();
  const flatOutput = emptyTotals();

  // The Auto-Miner stands in for the player's finger. Routing it through the
  // rate pipeline rather than adding it inside the tick means it shows up in
  // the ore/s readout and flows through offline catch-up for free.
  if (state.automation.includes('auto-miner') && state.automationOn['auto-miner'] !== false) {
    const mined = Decimal.from(tap * AUTO_TAPS_PER_SECOND);
    flatOutput.set('ore', mined);
    output.set('ore', (output.get('ore') ?? Decimal.ZERO).add(mined));
  }

  for (const building of index.content.buildings) {
    const count = state.buildings[building.id] ?? 0;
    if (count <= 0) continue;
    if (building.output.rate === 0 && building.inputs.length === 0) continue; // pure storage

    const resource = building.output.resource;
    const scale =
      count *
      (1 + (additive.get(building.id) ?? 0)) *
      (multiplier.get(building.id) ?? 1) *
      (global.get(resource) ?? 1) *
      (prestige.byResource.get(resource) ?? 1) *
      heatPenalty;

    const activity = Decimal.from(scale);
    const buildingOutput = activity.mulNumber(building.output.rate);
    const inputs = building.inputs.map((flow) => ({
      resource: flow.resource,
      rate: activity.mulNumber(flow.rate),
    }));

    perBuilding.push({ building, count, activity, output: buildingOutput, inputs });
    output.set(resource, (output.get(resource) ?? Decimal.ZERO).add(buildingOutput));
    for (const flow of inputs) {
      input.set(flow.resource, (input.get(flow.resource) ?? Decimal.ZERO).add(flow.rate));
    }
  }

  // --- Storage --------------------------------------------------------------
  const caps = emptyTotals();
  for (const resource of index.content.resources) {
    let cap = resource.baseCap;
    for (const depot of index.depotsOf.get(resource.id) ?? []) {
      const count = state.buildings[depot.id] ?? 0;
      if (count > 0 && depot.capacity) cap += count * depot.capacity.amount;
    }
    caps.set(resource.id, Decimal.from(cap * (capacity.get(resource.id) ?? 1)));
  }

  return {
    perBuilding,
    output,
    flatOutput,
    input,
    caps,
    heat,
    heatPenalty,
    tapYield: Decimal.from(tap),
  };
}

/**
 * Diminishing returns past the thermal threshold: `(threshold / heat) ^ 0.5`.
 *
 * Deliberately never negative. Overbuilding should be inefficient, not a trap —
 * a player who buys too many probes has made a suboptimal choice, not an
 * unrecoverable one.
 */
export function softCapPenalty(heat: number): number {
  if (heat <= HEAT_THRESHOLD) return 1;
  return (HEAT_THRESHOLD / heat) ** HEAT_EXPONENT;
}

function emptyTotals(): Map<ResourceId, Decimal> {
  return new Map(RESOURCE_IDS.map((id) => [id, Decimal.ZERO] as const));
}

/**
 * Memoises `computeRates`. Rates change on purchase, unlock and prestige — a
 * few times a minute — while the render loop asks for them sixty times a
 * second. Recomputing per frame is the single most wasteful thing this engine
 * could do, so it does not.
 */
export class RateCache {
  private cached: Rates | null = null;

  constructor(
    private readonly index: ContentIndex,
    private prestige: PrestigeMultipliers = NO_PRESTIGE,
  ) {}

  get(state: GameState): Rates {
    if (this.cached === null) this.cached = computeRates(state, this.index, this.prestige);
    return this.cached;
  }

  invalidate(): void {
    this.cached = null;
  }

  setPrestige(prestige: PrestigeMultipliers): void {
    this.prestige = prestige;
    this.invalidate();
  }
}
