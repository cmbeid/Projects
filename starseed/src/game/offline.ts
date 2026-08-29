import { Decimal } from '../num/decimal';
import type { ResourceId } from '../data/types';
import { RESOURCE_IDS } from '../data/types';
import type { ContentIndex } from '../data/indexes';
import type { GameState } from '../state/types';
import type { RateCache } from './rates';
import { advance, MAX_STEPS_PER_CALL, TICK_SECONDS } from './engine';

/**
 * Time credited while the tab was away, capped so a week-long absence cannot
 * lock the page up computing it. Raised by an Insight perk once layer 2
 * exists; until then this is the only ceiling.
 */
export const OFFLINE_CAP_SECONDS = 8 * 3600;

/** Below this, a reload or a quick tab-switch must not raise a modal. */
const SKIP_THRESHOLD_SECONDS = 2;

/** Largest slice handed to `advance` at once, matching its own step ceiling. */
const MAX_CHUNK_SECONDS = MAX_STEPS_PER_CALL * TICK_SECONDS;

/** Safety valve on the loop below; real runs need a handful of chunks. */
const MAX_CHUNKS = Math.ceil(OFFLINE_CAP_SECONDS / MAX_CHUNK_SECONDS) + 1;

export interface OfflineSummary {
  /** Real time since the last save, uncapped. */
  awaySeconds: number;
  /** Simulated time actually credited, after the cap. */
  creditedSeconds: number;
  capped: boolean;
  produced: Map<ResourceId, Decimal>;
  /** Resources that hit their storage ceiling at some point during catch-up. */
  hitStorage: ResourceId[];
  milestonesCrossed: string[];
  logUnlocked: string[];
}

/**
 * Runs the time since `state.lastSeen` through the same `advance` live play
 * uses, chunked so no single call can exceed its own step ceiling.
 *
 * Returns `null`, crediting nothing but resyncing the clock, when there is
 * nothing worth a modal for: a clock that moved backwards (a timezone change,
 * a corrected system clock) or a gap too short to have produced anything
 * visible. Both are silent by design — capping loudly and skipping quietly
 * are the same policy applied to opposite ends of the same axis.
 */
export function catchUp(
  state: GameState,
  index: ContentIndex,
  cache: RateCache,
  nowMs: number = Date.now(),
): OfflineSummary | null {
  const awaySeconds = (nowMs - state.lastSeen) / 1000;

  if (!Number.isFinite(awaySeconds) || awaySeconds < SKIP_THRESHOLD_SECONDS) {
    state.lastSeen = nowMs;
    return null;
  }

  const capped = awaySeconds > OFFLINE_CAP_SECONDS;
  let remaining = Math.min(awaySeconds, OFFLINE_CAP_SECONDS);
  const creditedSeconds = remaining;

  const produced = new Map<ResourceId, Decimal>(RESOURCE_IDS.map((id) => [id, Decimal.ZERO]));
  const hitStorage = new Set<ResourceId>();
  const milestonesCrossed: string[] = [];
  const logUnlocked: string[] = [];

  for (let chunks = 0; remaining > 0 && chunks < MAX_CHUNKS; chunks += 1) {
    const chunk = Math.min(remaining, MAX_CHUNK_SECONDS);
    const report = advance(state, index, cache, chunk);

    for (const [id, amount] of report.produced) {
      produced.set(id, (produced.get(id) ?? Decimal.ZERO).add(amount));
    }
    for (const id of report.capped) hitStorage.add(id);
    milestonesCrossed.push(...report.milestonesCrossed);
    logUnlocked.push(...report.logUnlocked);

    remaining -= chunk;
  }

  state.lastSeen = nowMs;

  return {
    awaySeconds,
    creditedSeconds,
    capped,
    produced,
    hitStorage: [...hitStorage],
    milestonesCrossed,
    logUnlocked,
  };
}
