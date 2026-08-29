import { Decimal } from '../num/decimal';
import { BASE_TAP_YIELD, HEAT_EXPONENT, HEAT_THRESHOLD } from '../data/index';
import type { Building, ResourceId } from '../data/types';
import { RESOURCE_IDS } from '../data/types';
import type { ContentIndex } from '../data/indexes';
import type { GameState } from '../state/types';
import { AUTO_TAPS_PER_SECOND } from './automation';
import { capacityContribution } from './purchase';
import { prestigeMultipliers } from './prestige';

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
 *               * Π prestigeBuilding[building]   // directives naming a building
 *
 *   rate(res)   = Σ perBuilding over producers of res
 *               * Π globalMultipliers[res]       // tech, milestone rewards
 *               * prestigeMult(layer1)           // Schematics tree + directives
 *               * softCapPenalty(state)          // thermal load
 *
 * The order is load-bearing. Additive bonuses pool *within* a building before
 * anything multiplies, so "+25% ore per probe" upgrades stack linearly with
 * each other and multiplicatively with everything else. Reversing this makes
 * late-game additive upgrades worthless, and is the classic way an idle game's
 * balance quietly dies.
 *
 * Prestige enters as plain multipliers at two of those points and nowhere else,
 * which is what keeps a directive from being able to reach around the order and
 * do something no upgrade could. Layer 2 (phase 7) folds into the same bundle.
 *
 * A paused building (`buildingActive[id] === false`) is excluded before any of
 * this runs: it contributes zero to `scale`, so its output, its input draw and
 * its heat all read as zero everywhere downstream, without a second code path
 * that could disagree with the one above.
 */
export function computeRates(state: GameState, index: ContentIndex): Rates {
  // Derived here rather than passed in. An earlier shape took the bundle as a
  // parameter and had the cache hold onto it, which invites exactly one bug:
  // a purchase updates the tree and forgets to tell the cache. There is nothing
  // to forget if there is nothing to hold.
  const prestige = prestigeMultipliers(state, index);

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

  tap *= prestige.tap;

  // --- Thermal load, which scales everything that runs ----------------------
  let heat = 0;
  for (const building of index.content.buildings) {
    const count = state.buildings[building.id] ?? 0;
    if (count > 0 && state.buildingActive[building.id] !== false) heat += count * building.heat;
  }
  heat *= cooling * prestige.heat;
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
    const active = state.buildingActive[building.id] !== false ? 1 : 0;
    const scale =
      count *
      active *
      (1 + (additive.get(building.id) ?? 0)) *
      (multiplier.get(building.id) ?? 1) *
      (prestige.byBuilding.get(building.id) ?? 1) *
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
    let cap = Decimal.from(resource.baseCap);
    for (const depot of index.depotsOf.get(resource.id) ?? []) {
      const count = state.buildings[depot.id] ?? 0;
      if (count > 0) cap = cap.add(capacityContribution(depot, count));
    }
    caps.set(
      resource.id,
      cap
        .mulNumber(capacity.get(resource.id) ?? 1)
        .mulNumber(prestige.capacity.get(resource.id) ?? 1),
    );
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

/** What one more purchase of a building would actually add, per second. */
export interface Marginal {
  /**
   * The change in each resource's **net** rate — extra production minus extra
   * consumption, after the purchase's thermal load is charged to the whole
   * swarm. This is the number worth showing: a converter bought into a hot
   * swarm can lower the net rate of a resource it never touches, and reporting
   * only its own output would hide that.
   */
  net: Map<ResourceId, Decimal>;
  /** Extra potential output. Not what lands — the engine still throttles converters. */
  output: Map<ResourceId, Decimal>;
  input: Map<ResourceId, Decimal>;
  caps: Map<ResourceId, Decimal>;
  heat: number;
  /** Units this covers, so the UI can say what it priced. */
  count: number;
}

/**
 * What buying `count` more of a building is worth, as a difference in the
 * world's total rates.
 *
 * Deliberately *not* "the building's own rate times count". A purchase is not
 * local: every building adds thermal load, and past the threshold that load
 * taxes the entire swarm, so the honest answer to "what does one more give me"
 * is smaller than what the new unit itself produces. Making the player do that
 * subtraction in their head is exactly how a soft cap turns into a feel-bad
 * surprise rather than a decision.
 *
 * Running the whole pipeline twice also means this cannot drift from §4's order
 * of operations — there is no second formula here to keep in agreement.
 */
export function marginalRates(
  state: GameState,
  index: ContentIndex,
  buildingId: string,
  count: number,
  before: Rates = computeRates(state, index),
): Marginal {
  const owned = state.buildings[buildingId] ?? 0;
  // A shallow clone is enough: `computeRates` reads state and never writes it.
  const after = computeRates(
    { ...state, buildings: { ...state.buildings, [buildingId]: owned + count } },
    index,
  );

  const output = difference(after.output, before.output);
  const input = difference(after.input, before.input);
  const net = new Map<ResourceId, Decimal>();
  for (const id of RESOURCE_IDS) {
    net.set(id, (output.get(id) ?? Decimal.ZERO).sub(input.get(id) ?? Decimal.ZERO));
  }

  return {
    net,
    output,
    input,
    caps: difference(after.caps, before.caps),
    heat: after.heat - before.heat,
    count,
  };
}

function difference(
  after: Map<ResourceId, Decimal>,
  before: Map<ResourceId, Decimal>,
): Map<ResourceId, Decimal> {
  const out = new Map<ResourceId, Decimal>();
  for (const id of RESOURCE_IDS) {
    out.set(id, (after.get(id) ?? Decimal.ZERO).sub(before.get(id) ?? Decimal.ZERO));
  }
  return out;
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
  private marginals = new Map<string, Marginal>();

  constructor(private readonly index: ContentIndex) {}

  get(state: GameState): Rates {
    if (this.cached === null) this.cached = computeRates(state, this.index);
    return this.cached;
  }

  /**
   * Memoised per building and quantity, because the Swarm panel asks for one of
   * these per card on every frame while the answer changes only when something
   * is bought or the buy mode moves. Without the cache this would run the whole
   * pipeline thirteen times a frame to render text that almost never changes.
   */
  marginal(state: GameState, buildingId: string, count: number): Marginal {
    const key = `${buildingId}:${count}`;
    let found = this.marginals.get(key);
    if (found === undefined) {
      found = marginalRates(state, this.index, buildingId, count, this.get(state));
      this.marginals.set(key, found);
    }
    return found;
  }

  invalidate(): void {
    this.cached = null;
    this.marginals.clear();
  }
}
