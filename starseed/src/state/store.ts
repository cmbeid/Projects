import { Decimal } from '../num/decimal';
import { CONTENT } from '../data/index';
import { buildIndex } from '../data/indexes';
import type { ContentIndex } from '../data/indexes';
import type { ResourceId } from '../data/types';
import { advance, tap } from '../game/engine';
import type { TickReport } from '../game/engine';
import { RateCache } from '../game/rates';
import type { Marginal, Rates } from '../game/rates';
import { costOf, countForMode, sumCost } from '../game/purchase';
import {
  availableAutomation,
  availableDirectives,
  availablePerks,
  availableUpgrades,
  isSatisfied,
} from '../game/unlocks';
import {
  buyPerk,
  canRelaunch,
  valueForSchematics,
  relaunch,
  runValue,
  schematicsFor,
  validateLoadout,
} from '../game/prestige';
import type { RelaunchReport } from '../game/prestige';
import { RELAUNCH_MINIMUM } from '../data/index';
import { clearSave, createInitialState, loadState, saveState } from './persistence';
import type { BuyMode, GameState } from './types';

type Listener = () => void;

const SAVE_DEBOUNCE_MS = 2_000;

/**
 * The single source of truth for the running game.
 *
 * Deliberately small: panels subscribe, read state directly, and update
 * themselves. `structural` fires only when the *shape* of the UI changes —
 * something unlocked, something was bought — which is what lets the render loop
 * repaint numbers sixty times a second while rebuilding DOM almost never.
 */
export class Store {
  readonly index: ContentIndex;
  private readonly cache: RateCache;
  private state: GameState;
  private listeners = new Set<Listener>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(state: GameState, index: ContentIndex = buildIndex(CONTENT)) {
    this.index = index;
    this.state = state;
    this.cache = new RateCache(index);
  }

  get(): Readonly<GameState> {
    return this.state;
  }

  rates(): Rates {
    return this.cache.get(this.state);
  }

  /** Fires on structural change only, never on the numbers ticking up. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // --- Simulation ----------------------------------------------------------

  advance(seconds: number): TickReport {
    const report = advance(this.state, this.index, this.cache, seconds);
    if (report.milestonesCrossed.length > 0 || report.automationActed.length > 0) {
      this.changed();
    } else if (report.stepsRun > 0) {
      this.scheduleSave();
    }
    return report;
  }

  tap(): Decimal {
    const gained = tap(this.state, this.cache);
    this.scheduleSave();
    return gained;
  }

  // --- Buying --------------------------------------------------------------

  /** How many units the current buy mode would purchase, and what it costs. */
  quote(buildingId: string): { count: number; cost: Decimal } | null {
    const building = this.index.buildingById.get(buildingId);
    if (!building) return null;
    const owned = this.state.buildings[buildingId] ?? 0;
    const budget = this.state.resources[building.cost.resource];
    const count = countForMode(building, owned, budget, this.state.settings.buyMode);
    return { count, cost: count > 0 ? sumCost(building, owned, count) : costOf(building, owned) };
  }

  /**
   * What the current buy mode would add, per second, if it were pressed.
   *
   * Priced at what the mode *means* rather than what is affordable right now:
   * ×10 always quotes ten, even with the money for three. A card that silently
   * re-quotes itself as you earn is unreadable, and "what would this get me"
   * is a question worth answering before you can pay it.
   */
  marginal(buildingId: string): Marginal | null {
    if (!this.index.buildingById.has(buildingId)) return null;
    const mode = this.state.settings.buyMode;
    const affordable = this.quote(buildingId)?.count ?? 0;
    // Max with nothing affordable still quotes one, so the card says something.
    const count = mode === 'max' ? Math.max(1, affordable) : mode;
    return this.cache.marginal(this.state, buildingId, count);
  }

  buyBuilding(buildingId: string): boolean {
    const building = this.index.buildingById.get(buildingId);
    if (!building || !isSatisfied(building.unlock, this.state)) return false;

    const quote = this.quote(buildingId);
    if (!quote || quote.count <= 0) return false;
    if (this.state.resources[building.cost.resource].lt(quote.cost)) return false;

    this.state.resources[building.cost.resource] =
      this.state.resources[building.cost.resource].sub(quote.cost);
    this.state.buildings[buildingId] = (this.state.buildings[buildingId] ?? 0) + quote.count;
    this.cache.invalidate();
    this.changed();
    return true;
  }

  buyUpgrade(upgradeId: string): boolean {
    const upgrade = this.index.upgradeById.get(upgradeId);
    if (!upgrade || this.state.upgrades.includes(upgradeId)) return false;
    if (!isSatisfied(upgrade.unlock, this.state)) return false;

    const cost = Decimal.from(upgrade.cost.amount);
    if (this.state.resources[upgrade.cost.resource].lt(cost)) return false;

    this.state.resources[upgrade.cost.resource] =
      this.state.resources[upgrade.cost.resource].sub(cost);
    this.state.upgrades.push(upgradeId);
    this.cache.invalidate();
    this.changed();
    return true;
  }

  buyAutomation(automationId: string): boolean {
    const automation = this.index.automationById.get(automationId);
    if (!automation || this.state.automation.includes(automationId)) return false;
    if (!isSatisfied(automation.unlock, this.state)) return false;

    const cost = Decimal.from(automation.cost.amount);
    if (this.state.resources[automation.cost.resource].lt(cost)) return false;

    this.state.resources[automation.cost.resource] =
      this.state.resources[automation.cost.resource].sub(cost);
    this.state.automation.push(automationId);
    this.state.automationOn[automationId] = true;
    this.cache.invalidate();
    this.changed();
    return true;
  }

  toggleAutomation(automationId: string): void {
    if (!this.state.automation.includes(automationId)) return;
    this.state.automationOn[automationId] = this.state.automationOn[automationId] === false;
    this.cache.invalidate();
    this.changed();
  }

  // --- Prestige ------------------------------------------------------------

  /** Schematics a Relaunch would pay right now. */
  pendingSchematics(): Decimal {
    return schematicsFor(this.state, this.index);
  }

  canRelaunch(): boolean {
    return canRelaunch(this.state, this.index);
  }

  /** What this run has produced, in ore-equivalent — the payout's input. */
  runValue(): Decimal {
    return runValue(this.state, this.index);
  }

  /** Run value still needed before the Relaunch button unlocks. */
  valueForFirstSchematics(): Decimal {
    return valueForSchematics(this.state, this.index, RELAUNCH_MINIMUM);
  }

  availableDirectives() {
    return availableDirectives(this.state, this.index);
  }

  availablePerks() {
    return availablePerks(this.state, this.index);
  }

  /** Trims a proposed loadout to a legal one, for the picker to reflect back. */
  legalLoadout(chosen: readonly string[]): string[] {
    return validateLoadout(this.state, this.index, chosen);
  }

  buyPerk(perkId: string): boolean {
    if (!buyPerk(this.state, this.index, perkId)) return false;
    this.cache.invalidate();
    this.changed();
    return true;
  }

  /**
   * Fires the seed probe. Refuses below the Schematic floor, so a mis-click in
   * the confirmation cannot cost a run for nothing.
   */
  relaunch(chosen: readonly string[]): RelaunchReport | null {
    if (!this.canRelaunch()) return null;
    const report = relaunch(this.state, this.index, chosen);
    this.cache.invalidate();
    this.changed();
    // A reset is the one moment worth writing through the debounce: losing it
    // to a closed tab would hand back a run the player has already spent.
    this.flush();
    return report;
  }

  // --- Views ---------------------------------------------------------------

  availableUpgrades() {
    return availableUpgrades(this.state, this.index);
  }

  availableAutomation() {
    return availableAutomation(this.state, this.index);
  }

  visibleResourceIds(): ResourceId[] {
    return this.index.content.resources
      .filter((resource) => isSatisfied(resource.unlock, this.state))
      .map((resource) => resource.id);
  }

  // --- Settings ------------------------------------------------------------

  setBuyMode(mode: BuyMode): void {
    this.state.settings.buyMode = mode;
    this.changed();
  }

  resetProgress(): void {
    this.state = createInitialState();
    this.cache.invalidate();
    clearSave();
    this.changed();
  }

  // --- Internals -----------------------------------------------------------

  private changed(): void {
    for (const listener of this.listeners) listener();
    this.scheduleSave();
  }

  /**
   * Saving is debounced hard. An idle game changes state ten times a second
   * forever; serialising on every tick would be the most expensive thing the
   * page does, for no benefit over saving every couple of seconds.
   */
  private scheduleSave(): void {
    if (this.saveTimer !== null) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flush();
    }, SAVE_DEBOUNCE_MS);
  }

  /** Writes immediately, for page-hide. */
  flush(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.state.lastSeen = Date.now();
    saveState(this.state);
  }
}

/** The live store, wired to the real content and the real save. */
export function createStore(): Store {
  const index = buildIndex(CONTENT);
  return new Store(loadState(index), index);
}
