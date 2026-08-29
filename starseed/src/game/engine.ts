import { Decimal } from '../num/decimal';
import type { ResourceId } from '../data/types';
import { RESOURCE_IDS } from '../data/types';
import type { ContentIndex } from '../data/indexes';
import type { GameState } from '../state/types';
import type { RateCache } from './rates';
import { runAutomation } from './automation';
import { newMilestones } from './unlocks';

/**
 * The simulation runs on a fixed 10 Hz timestep with an accumulator, rather
 * than integrating whatever delta the frame happened to deliver.
 *
 * That choice is what makes `advance(state, 10)` produce *exactly* the same
 * state as a hundred calls to `advance(state, 0.1)` — not merely a close one.
 * Live play and offline catch-up therefore cannot disagree, because they are
 * not two calculations that happen to match; they are the same steps.
 */
export const TICK_SECONDS = 0.1;

/**
 * Ceiling on steps per call, so a long absence cannot lock the tab up. At 10 Hz
 * this is a little over half an hour of simulation in one go; offline catch-up
 * chunks larger gaps and reports what it had to drop.
 */
export const MAX_STEPS_PER_CALL = 20_000;

/** Absorbs the fact that 0.1 has no exact binary representation. */
const TICK_EPSILON = 1e-9;

export interface TickReport {
  /** Credited production per resource — what actually landed, after overflow. */
  produced: Map<ResourceId, Decimal>;
  /** Resources that hit their storage ceiling and lost some of the tick. */
  capped: ResourceId[];
  milestonesCrossed: string[];
  /** Automation ids that bought something. */
  automationActed: string[];
  stepsRun: number;
  secondsSimulated: number;
  /** Time the step ceiling forced the engine to skip. Normally zero. */
  droppedSeconds: number;
}

/**
 * Advances the world by `seconds`.
 *
 * Pure with respect to the clock: `seconds` is a parameter and `Date.now()` is
 * never read here or anywhere below it. That is what lets the whole engine be
 * tested in a node environment with no DOM and no fake timers.
 */
export function advance(
  state: GameState,
  index: ContentIndex,
  cache: RateCache,
  seconds: number,
): TickReport {
  const report: TickReport = {
    produced: new Map(RESOURCE_IDS.map((id) => [id, Decimal.ZERO] as const)),
    capped: [],
    milestonesCrossed: [],
    automationActed: [],
    stepsRun: 0,
    secondsSimulated: 0,
    droppedSeconds: 0,
  };

  // Negative or non-finite deltas mean a clock that moved backwards. Credit
  // nothing and carry on; it is not an error worth surfacing.
  if (!Number.isFinite(seconds) || seconds <= 0) return report;

  state.accumulator += seconds;

  // The step count is derived once and the remainder taken in a single
  // subtraction. Decrementing the accumulator inside the loop instead lets
  // floating-point error accumulate, and after a couple of hundred calls that
  // drift silently swallows a whole tick — which is exactly the disagreement
  // between one long call and many short ones that this design exists to rule
  // out. The epsilon absorbs the representation error in 0.1.
  let steps = Math.floor(state.accumulator / TICK_SECONDS + TICK_EPSILON);

  if (steps > MAX_STEPS_PER_CALL) {
    // Hit the ceiling. Drop the remainder rather than carrying an ever-growing
    // debt that would make the next call slower still.
    report.droppedSeconds = (steps - MAX_STEPS_PER_CALL) * TICK_SECONDS;
    steps = MAX_STEPS_PER_CALL;
    state.accumulator = 0;
  } else {
    state.accumulator = Math.max(0, state.accumulator - steps * TICK_SECONDS);
  }

  const cappedSeen = new Set<ResourceId>();
  for (let i = 0; i < steps; i += 1) {
    step(state, index, cache, report, cappedSeen);
    report.stepsRun += 1;
  }

  report.capped = [...cappedSeen];
  report.secondsSimulated = report.stepsRun * TICK_SECONDS;
  return report;
}

function step(
  state: GameState,
  index: ContentIndex,
  cache: RateCache,
  report: TickReport,
  cappedSeen: Set<ResourceId>,
): void {
  const dt = TICK_SECONDS;
  const rates = cache.get(state);

  // --- What everything wants to consume this step --------------------------
  const demand = new Map<ResourceId, Decimal>();
  for (const entry of rates.perBuilding) {
    for (const flow of entry.inputs) {
      demand.set(flow.resource, (demand.get(flow.resource) ?? Decimal.ZERO).add(flow.rate));
    }
  }

  /**
   * Starvation throttling. When a resource cannot meet demand, every consumer
   * of it runs at the same reduced fraction — output and input alike, so a
   * half-fed refinery makes half the alloy rather than stalling outright or
   * driving a stock negative.
   */
  const supplyFactor = new Map<ResourceId, number>();
  for (const [resource, perSecond] of demand) {
    const wanted = perSecond.mulNumber(dt);
    if (!wanted.isPositive) continue;
    const stock = state.resources[resource];
    supplyFactor.set(resource, stock.gte(wanted) ? 1 : stock.div(wanted).toNumber());
  }

  // --- Deltas, all computed from start-of-step stocks -----------------------
  const produced = new Map<ResourceId, Decimal>();
  const consumed = new Map<ResourceId, Decimal>();

  for (const entry of rates.perBuilding) {
    let factor = 1;
    for (const flow of entry.inputs) {
      factor = Math.min(factor, supplyFactor.get(flow.resource) ?? 1);
    }
    if (factor <= 0) continue;

    if (entry.output.isPositive) {
      const resource = entry.building.output.resource;
      const gain = entry.output.mulNumber(dt * factor);
      produced.set(resource, (produced.get(resource) ?? Decimal.ZERO).add(gain));
    }
    for (const flow of entry.inputs) {
      const loss = flow.rate.mulNumber(dt * factor);
      consumed.set(flow.resource, (consumed.get(flow.resource) ?? Decimal.ZERO).add(loss));
    }
  }

  for (const [resource, perSecond] of rates.flatOutput) {
    if (!perSecond.isPositive) continue;
    produced.set(resource, (produced.get(resource) ?? Decimal.ZERO).add(perSecond.mulNumber(dt)));
  }

  // --- Apply, clamping to storage ------------------------------------------
  for (const resource of RESOURCE_IDS) {
    const gain = produced.get(resource) ?? Decimal.ZERO;
    const loss = consumed.get(resource) ?? Decimal.ZERO;
    if (gain.isZero && loss.isZero) continue;

    let next = state.resources[resource].add(gain).sub(loss);
    let credited = gain;

    const cap = rates.caps.get(resource);
    if (cap && next.gt(cap)) {
      // Overflow is discarded, and does not count towards lifetime totals —
      // ore that fell on the floor never existed as far as progress goes.
      credited = credited.sub(next.sub(cap)).max(Decimal.ZERO);
      next = cap;
      cappedSeen.add(resource);
    }
    if (!next.isPositive) next = Decimal.ZERO;

    state.resources[resource] = next;
    if (credited.isPositive) {
      state.lifetime[resource] = state.lifetime[resource].add(credited);
      state.totals[resource] = state.totals[resource].add(credited);
      report.produced.set(resource, (report.produced.get(resource) ?? Decimal.ZERO).add(credited));
    }
  }

  state.stats.playedSeconds += dt;
  state.stats.runSeconds += dt;

  // --- Automation, then anything it just unlocked ---------------------------
  for (const id of runAutomation(state, index, cache)) {
    if (!report.automationActed.includes(id)) report.automationActed.push(id);
  }

  for (const id of newMilestones(state, index)) {
    state.milestones.push(id);
    report.milestonesCrossed.push(id);
  }
}

/** Applies a manual tap. Returns the ore credited, after storage. */
export function tap(state: GameState, cache: RateCache): Decimal {
  const rates = cache.get(state);
  const cap = rates.caps.get('ore');
  const before = state.resources.ore;

  let next = before.add(rates.tapYield);
  if (cap && next.gt(cap)) next = cap;

  const credited = next.sub(before);
  state.resources.ore = next;
  state.stats.taps += 1;
  if (credited.isPositive) {
    state.lifetime.ore = state.lifetime.ore.add(credited);
    state.totals.ore = state.totals.ore.add(credited);
  }
  return credited;
}
