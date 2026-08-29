import { Decimal } from '../num/decimal';
import {
  DIRECTIVE_SLOTS,
  RELAUNCH_MINIMUM,
  SCHEMATIC_DIVISOR,
  SCHEMATIC_EXPONENT,
} from '../data/index';
import type { PrestigeEffect, ResourceId } from '../data/types';
import { RESOURCE_IDS } from '../data/types';
import type { ContentIndex } from '../data/indexes';
import type { GameState } from '../state/types';
import { availableDirectives, availablePerks } from './unlocks';

/**
 * Prestige layer 1 — **Relaunch**. You fire a seed probe at a fresh system.
 *
 * Everything about the layer lives here: what it pays, what it destroys, what
 * it keeps, and how the things it keeps reach back into the production
 * pipeline. `rates.ts` asks this module one question — "what are the
 * multipliers?" — and never learns what a perk or a directive is.
 */

/** What the perks and the loadout are worth, folded down into plain numbers. */
export interface PrestigeMultipliers {
  byResource: ReadonlyMap<ResourceId, number>;
  byBuilding: ReadonlyMap<string, number>;
  capacity: ReadonlyMap<ResourceId, number>;
  /** Scales total thermal load. Zero means a directive removed it outright. */
  heat: number;
  tap: number;
  /** Multiplies the Schematics the *next* Relaunch pays out. */
  payout: number;
}

/**
 * Every effect currently in force: the perks bought, then the loadout picked.
 *
 * Unknown ids are skipped rather than trusted. A save written by a build with
 * more content than this one is a normal thing to load, not an error.
 */
export function activeEffects(state: GameState, index: ContentIndex): PrestigeEffect[] {
  const effects: PrestigeEffect[] = [];
  for (const id of state.prestige.perks) {
    const perk = index.perkById.get(id);
    if (perk) effects.push(...perk.effects);
  }
  for (const id of state.prestige.directives) {
    const directive = index.directiveById.get(id);
    if (directive) effects.push(...directive.effects);
  }
  return effects;
}

/**
 * Folds the active effects into the multiplier bundle `rates.ts` consumes.
 *
 * Everything composes multiplicatively, including the penalties: a directive
 * that halves ore and a perk that doubles it cancel exactly, which is the only
 * behaviour a player can reason about without a spreadsheet.
 */
export function prestigeMultipliers(state: GameState, index: ContentIndex): PrestigeMultipliers {
  const byResource = new Map<ResourceId, number>();
  const byBuilding = new Map<string, number>();
  const capacity = new Map<ResourceId, number>();
  let heat = 1;
  let tap = 1;
  let payout = 1;

  for (const effect of activeEffects(state, index)) {
    switch (effect.kind) {
      case 'global':
        byResource.set(effect.resource, (byResource.get(effect.resource) ?? 1) * effect.factor);
        break;
      case 'building':
        byBuilding.set(effect.building, (byBuilding.get(effect.building) ?? 1) * effect.factor);
        break;
      case 'capacity':
        capacity.set(effect.resource, (capacity.get(effect.resource) ?? 1) * effect.factor);
        break;
      case 'heat':
        heat *= effect.factor;
        break;
      case 'tap':
        tap *= effect.factor;
        break;
      case 'payout':
        payout *= effect.factor;
        break;
      case 'start':
      case 'carry':
        // Read once by the reset itself, not every time rates are computed.
        break;
    }
  }

  return { byResource, byBuilding, capacity, heat, tap, payout };
}

// --- The currency ----------------------------------------------------------

/**
 * What the run is worth, in ore-equivalent: everything it produced, each
 * resource weighted by what it cost to make.
 *
 * Measuring ore alone is the obvious first move and it is wrong. It makes two
 * thirds of the economy invisible to prestige, and with it every directive that
 * trades ore for something further up the ladder — a whole family of choices
 * becomes strictly bad, and the "meaningful choices" pillar quietly collapses
 * into one dominant loadout.
 *
 * Read against the run's own lifetime totals, never the all-time ones, or every
 * Relaunch would be paid for the same production twice.
 */
export function runValue(state: GameState, index: ContentIndex): Decimal {
  let value = Decimal.ZERO;
  for (const resource of index.content.resources) {
    const produced = state.lifetime[resource.id];
    if (produced.isPositive) value = value.add(produced.mulNumber(resource.prestigeWeight));
  }
  return value;
}

/**
 * `schematics = floor( (runValue / DIVISOR) ^ EXPONENT * payout )`.
 *
 * The exponent is the load-bearing half. At 0.5 a run ten times as long pays
 * only about three times as much, which is what makes a short deliberate run a
 * viable strategy rather than a mistake — and it is why the Schematics tree can
 * be priced steeply without the game becoming a waiting competition.
 */
export function schematicsFor(state: GameState, index: ContentIndex): Decimal {
  const value = runValue(state, index);
  if (!value.isPositive) return Decimal.ZERO;

  const ratio = value.div(Decimal.from(SCHEMATIC_DIVISOR));
  if (ratio.lt(Decimal.ONE)) return Decimal.ZERO;

  const raw = ratio.pow(SCHEMATIC_EXPONENT).mulNumber(prestigeMultipliers(state, index).payout);
  return raw.floor();
}

/**
 * Run value still needed before Relaunching is worth it.
 *
 * Inverts the formula rather than searching for it, so the progress readout
 * costs nothing to show every frame.
 */
export function valueForSchematics(state: GameState, index: ContentIndex, count: number): Decimal {
  const payout = prestigeMultipliers(state, index).payout;
  const needed = Math.max(count, 0) / (payout > 0 ? payout : 1);
  return Decimal.from(needed).pow(1 / SCHEMATIC_EXPONENT).mulNumber(SCHEMATIC_DIVISOR);
}

/** Relaunching below the floor is a trap, so the button is not offered. */
export function canRelaunch(state: GameState, index: ContentIndex): boolean {
  return schematicsFor(state, index).gte(Decimal.from(RELAUNCH_MINIMUM));
}

// --- The loadout -----------------------------------------------------------

/**
 * Trims a proposed loadout to a legal one: known, unlocked, deduplicated, one
 * per family, and no longer than the slot count.
 *
 * The UI enforces all of this too, but the reset validates rather than trusts —
 * a loadout is the one player choice that persists into a run whose whole
 * balance depends on it.
 */
export function validateLoadout(
  state: GameState,
  index: ContentIndex,
  chosen: readonly string[],
): string[] {
  const unlocked = new Set(availableDirectives(state, index).map((d) => d.id));
  const families = new Set<string>();
  const loadout: string[] = [];

  for (const id of chosen) {
    if (loadout.length >= DIRECTIVE_SLOTS) break;
    const directive = index.directiveById.get(id);
    if (!directive || !unlocked.has(id)) continue;
    if (loadout.includes(id) || families.has(directive.family)) continue;
    families.add(directive.family);
    loadout.push(id);
  }
  return loadout;
}

// --- The reset -------------------------------------------------------------

export interface RelaunchReport {
  schematics: Decimal;
  loadout: string[];
  /** What the new run opens holding, from `start` and `carry` effects. */
  granted: Map<ResourceId, Decimal>;
}

/**
 * Fires the seed probe.
 *
 * *Resets:* resources, buildings, run upgrades, automators, and the run's own
 * lifetime totals — the new system really is untouched, so its content re-gates
 * honestly.
 *
 * *Persists:* Schematics and the tree, the milestone log, all-time statistics,
 * settings, and the seed.
 *
 * Mutates in place, because the store holds this object by reference and the
 * running UI reads through it.
 */
export function relaunch(
  state: GameState,
  index: ContentIndex,
  chosen: readonly string[],
): RelaunchReport {
  const schematics = schematicsFor(state, index);
  // Read before the reset: Salvage Doctrine keeps a fraction of what the run
  // *ends* holding, so the old stock has to be captured while it still exists.
  const ending = { ...state.resources };

  // Rounded, not merely added: Schematics are a counting currency, and float
  // noise in the balance would eventually refuse a perk the player can afford.
  state.prestige.schematics = state.prestige.schematics.add(schematics).round();
  state.prestige.schematicsEarned = state.prestige.schematicsEarned.add(schematics).round();
  state.prestige.relaunches += 1;
  // Set before the grants are computed, so the incoming loadout's own `carry`
  // and `start` effects are the ones that apply to the run they begin.
  state.prestige.directives = validateLoadout(state, index, chosen);

  for (const id of RESOURCE_IDS) {
    state.resources[id] = Decimal.ZERO;
    state.lifetime[id] = Decimal.ZERO;
  }
  state.buildings = {};
  state.upgrades = [];
  state.automation = [];
  state.automationOn = {};
  state.buildingActive = {};
  state.accumulator = 0;
  state.stats.runSeconds = 0;

  const granted = new Map<ResourceId, Decimal>();
  for (const effect of activeEffects(state, index)) {
    if (effect.kind === 'start') {
      add(granted, effect.resource, Decimal.from(effect.amount));
    } else if (effect.kind === 'carry') {
      add(granted, effect.resource, (ending[effect.resource] ?? Decimal.ZERO).mulNumber(effect.fraction));
    }
  }

  for (const [id, amount] of granted) {
    if (!amount.isPositive) continue;
    state.resources[id] = amount;
    // Granted stock counts towards the run's lifetime as well, or the resource
    // it belongs to stays gated and the player holds alloy they cannot see.
    // It is deliberately *not* added to all-time totals: it was not produced
    // twice, it was carried.
    state.lifetime[id] = amount;
  }

  return { schematics, loadout: state.prestige.directives, granted };
}

/** Spends Schematics on a perk. Returns false and changes nothing if it cannot. */
export function buyPerk(state: GameState, index: ContentIndex, perkId: string): boolean {
  const perk = index.perkById.get(perkId);
  if (!perk || state.prestige.perks.includes(perkId)) return false;
  if (!availablePerks(state, index).some((p) => p.id === perkId)) return false;

  const cost = Decimal.from(perk.cost);
  if (state.prestige.schematics.lt(cost)) return false;

  state.prestige.schematics = state.prestige.schematics.sub(cost).round();
  state.prestige.perks.push(perkId);
  return true;
}

function add(into: Map<ResourceId, Decimal>, id: ResourceId, amount: Decimal): void {
  into.set(id, (into.get(id) ?? Decimal.ZERO).add(amount));
}
