import { GOLD, NS, Requirement, all, item, itemName, tryGet } from './content';
import { Rng } from './rng';
import { GameState, newState } from './state';
import { LEVEL_CAP, levelForXp, xpForLevel } from './xp';
import { PASSIVES } from './passives';
import type { SkillHandler } from './skills/types';
import { woodcutting } from './skills/woodcutting';
import { mining } from './skills/mining';
import { fishing } from './skills/fishing';
import { firemaking } from './skills/firemaking';
import { cooking } from './skills/cooking';
import { crafting, fletching, runecrafting, smithing } from './skills/artisan';
import { beastcrafting } from './skills/artisan';
import { herblore } from './skills/herblore';
import { thieving } from './skills/thieving';
import { hunting } from './skills/hunting';
import { astrology } from './skills/astrology';
import { agility } from './skills/agility';
import { combat } from './combat/combat';
import type { Bonus } from './combat/data';
import { BASE_BANK_SLOTS, activeBonuses, mod } from './bonuses';
import { goalActive, goalMatches, questEvent } from './quests';
import { checkUnlocks, isUnlocked, unlockEverything } from './navigation';
import { checkGuild, hasRank } from './guild';
import { Tracker, type TrackEvent } from './tracker';

export const TICKS_PER_SECOND = 60;
export const TICK_MS = 1000 / TICKS_PER_SECOND;
export const MAX_OFFLINE_MS = 24 * 60 * 60 * 1000;
const MIN_OFFLINE_MS = 10_000;

export const msToTicks = (ms: number) => Math.max(1, Math.round(ms / TICK_MS));

export const SKILLS: SkillHandler[] = [
  woodcutting, fishing, mining, firemaking, cooking, smithing, fletching, crafting, runecrafting, herblore,
  thieving, hunting, beastcrafting, astrology, agility, combat,
];
/** Skills that run in the background with their own pages rather than as the active action. */
export const PASSIVE_SKILLS = ['Farming', 'Ranching'];
const handlers = new Map(SKILLS.map((h) => [h.skill, h]));

/** Milestones reached going from one level to another: the skill's recipes that need a level in (from, to]. */
export function milestonesBetween(skill: string, from: number, to: number): number {
  const h = handlers.get(skill);
  if (!h) return 0;
  let n = 0;
  for (const id of h.recipes()) {
    const level = h.recipe(id).Requirements?.find((r) => r.Type === `${NS}Level` && r.Data.Component?.Entity === NS + skill)?.Data.Level;
    if (level !== undefined && level > from && level <= to) n++;
  }
  return n;
}

/** Things the UI reacts to (sounds); not sent during offline catch-up. */
export type GameEvent =
  | { type: 'action'; skill: string; recipe: string }
  | { type: 'levelUp'; skill: string; from: number; to: number }
  | { type: 'questComplete' }
  | { type: 'attack'; weaponType?: string };

export interface LogEntry { tick: number; text: string; kind: 'item' | 'level' | 'info' | 'stop' }

export interface OfflineSummary {
  ms: number;
  xp: Record<string, number>;
  items: Record<string, number>;
  gold: number;
}

export class Game {
  state: GameState;
  rng: Rng;
  log: LogEntry[] = [];
  private listeners = new Set<() => void>();
  /** Set while replaying offline time so the log isn't flooded. */
  private quiet = false;

  constructor(state: GameState = newState()) {
    this.state = state;
    this.rng = new Rng(state.rng);
    if (state.legacyUnlockAll) {
      unlockEverything(this);
      delete state.legacyUnlockAll;
    }
    checkUnlocks(this);
  }

  // ---- observers -------------------------------------------------------------------------

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  events = new Set<(e: GameEvent) => void>();

  signal(e: GameEvent): void {
    if (this.quiet) return;
    for (const fn of this.events) fn(e);
  }

  emit(): void {
    for (const fn of this.listeners) fn();
  }

  private note(text: string, kind: LogEntry['kind']): void {
    if (this.quiet) return;
    this.log.unshift({ tick: this.state.tick, text, kind });
    if (this.log.length > 50) this.log.length = 50;
  }

  // ---- skills, requirements --------------------------------------------------------------

  level(skill: string): number {
    return levelForXp(this.xp(skill), LEVEL_CAP);
  }

  /** Hitpoints starts at level 10 (as in the game); every other skill starts at 0 XP. */
  xp(skill: string): number {
    return this.state.xp[skill] ?? (skill === 'Hitpoints' ? xpForLevel(10) : 0);
  }

  /** True when the requirement can never be met in this build (demo-locked or not implemented yet). */
  isDemoLocked(reqs: Requirement[] | null | undefined): boolean {
    return !!reqs?.some((r) => r.Type === `${NS}DemoLocked`);
  }

  requirementMet(r: Requirement): boolean {
    switch (r.Type) {
      case `${NS}Level`: {
        const skill = (r.Data.Component?.Entity ?? '').replace(NS, '');
        return this.level(skill) >= (r.Data.Level ?? 1);
      }
      case `${NS}ShopPurchase`: {
        const d = r.Data as { ShopPurchase?: string; Amount?: number };
        return (this.state.purchases[d.ShopPurchase ?? ''] ?? 0) >= (d.Amount ?? 1);
      }
      case `${NS}MasteryGuildRank`: {
        const d = r.Data as { Component?: { Entity: string }; Rank?: string };
        return hasRank(this, (d.Component?.Entity ?? '').replace(NS, ''), d.Rank ?? '');
      }
      case `${NS}QuestComplete`: {
        const d = r.Data as { Quest?: string };
        return !!this.state.quests[d.Quest ?? '']?.done;
      }
      case `${NS}QuestStepActive`: {
        const d = r.Data as { Quest?: string; Step?: number };
        const s = this.state.quests[d.Quest ?? ''];
        return !!s && !s.done && s.step === (d.Step ?? 0);
      }
      case `${NS}QuestTaskGoalActive`: {
        const d = r.Data as { Quest?: string; Step?: number; Task?: number };
        return goalActive(this, d.Quest ?? '', d.Step ?? 0, d.Task ?? 0);
      }
      case `${NS}ItemStatistic`: {
        const d = r.Data as { Statistic?: string; Item?: string; Value?: number };
        return this.itemStatistic((d.Statistic ?? '').replace(NS, ''), d.Item ?? '') >= (d.Value ?? 1);
      }
      case `${NS}CurrencyStatistic`: {
        const d = r.Data as { Statistic?: string; Value?: number };
        return d.Statistic === `${NS}BankCurrencyFromSale` && this.state.stats.goldFromSales >= (d.Value ?? 1);
      }
      case `${NS}HuntingAnimalStatistic`: {
        const d = r.Data as { Animal?: string; Value?: number };
        return (this.state.hunting[d.Animal ?? '']?.trapped ?? 0) >= (d.Value ?? 1);
      }
      case `${NS}EnemyStatistic`: {
        const d = r.Data as { Enemy?: string; Value?: number };
        return (this.state.combat.kills[d.Enemy ?? ''] ?? 0) >= (d.Value ?? 1);
      }
      case `${NS}SlayerMasterStatistic`: {
        const d = r.Data as { Master?: string; Value?: number };
        return (this.state.combat.slayerTasksDone[d.Master ?? ''] ?? 0) >= (d.Value ?? 1);
      }
      case `${NS}ToolbeltItemEquipped`: {
        const d = r.Data as { Item?: string; Quantity?: number };
        return this.toolbeltHas(d.Item ?? '', d.Quantity ?? 1);
      }
      default:
        return false; // DemoLocked, and condition types not implemented yet
    }
  }

  /** Conditions combine left to right: each one is AND-ed onto the result, or OR-ed when it has IsOr. */
  requirementsMet(reqs: Requirement[] | null | undefined): boolean {
    if (!reqs?.length) return true;
    let result = this.requirementMet(reqs[0]);
    for (const r of reqs.slice(1)) result = r.Data.IsOr ? result || this.requirementMet(r) : result && this.requirementMet(r);
    return result;
  }

  /** 'WoodcuttingItemGained' style per-skill item counts, or 'BankItemFound' for items found from any source. */
  itemStatistic(stat: string, item: string): number {
    if (stat === 'BankItemFound') return this.state.stats.itemsFound[item] ?? 0;
    const skill = stat.replace(/ItemGained$/, '');
    return this.state.stats.itemGained[skill]?.[item] ?? 0;
  }

  /** Rates for the bottom stats bar (not saved). */
  tracker = new Tracker();

  /** Record a gain/loss for the stats bar: only while the active action is doing it, not offline or passives. */
  private track(kind: TrackEvent['kind'], id: string, amount: number): void {
    const a = this.state.active;
    if (!a || this.quiet || this.itemSource || this.manual) return;
    this.tracker.sync(`${a.skill}|${a.recipe}`, this.state.tick);
    this.tracker.add({ tick: this.state.tick, kind, id, amount });
  }

  /** Set during player actions (selling, eating) so they don't count towards action rates. */
  private manual = false;

  private lastGuildCheck = -Infinity;

  /** Hunting journal level for an amount of journal XP. */
  levelForJournalXp(xp: number): number {
    return levelForXp(xp, 99);
  }

  /** Combat situation for goal conditions; set by the combat module. */
  combatContext: () => import('./guild').GoalContext = () => ({});

  /** Skill credited for items added outside the active action (farming harvests, ranching...). */
  itemSource: string | null = null;

  /** Whether an item is equipped in any toolbelt slot. */
  toolbeltHas(id: string, quantity: number): boolean {
    return Object.values(this.state.toolbelt).some((t) => t.item === id && t.qty >= quantity);
  }

  /** Called whenever something that grants bonuses changes (shop, astrology, equipment). */
  bonusesChanged(): void {
    this.bonusVersion++;
  }

  bonusVersion = 0;

  /** A highlighted message in the log, also kept during offline replay. */
  notice(text: string): void {
    this.note(text, 'level');
  }

  // ---- inventory -------------------------------------------------------------------------

  count(id: string): number {
    return this.state.bank[id] ?? 0;
  }

  /** Adds to the bank. A new kind of item needs a free bank slot; without one it's lost, as in the game. */
  addItem(id: string, quantity: number): boolean {
    if (quantity <= 0) return false;
    if (!(id in this.state.bank) && Object.keys(this.state.bank).length >= this.bankSlots()) {
      this.note(`Bank full: lost ${quantity} ${itemName(id, quantity)}`, 'stop');
      return false;
    }
    this.state.bank[id] = (this.state.bank[id] ?? 0) + quantity;
    this.note(`+${quantity} ${itemName(id, quantity)}`, 'item');
    this.state.found[id] = true;
    this.track('item', id, quantity);
    const st = this.state.stats;
    st.itemsFound[id] = (st.itemsFound[id] ?? 0) + quantity;
    const source = this.itemSource ?? this.state.active?.skill;
    if (source) (st.itemGained[source] ??= {})[id] = (st.itemGained[source][id] ?? 0) + quantity;
    if (source) {
      const value = (item(id).SellsFor?.Quantity ?? 0) * quantity;
      questEvent(this, 'ActionGainItemValue', (d) => (d.Component?.Entity === NS + source ? value : 0));
    }
    const skill = this.state.active?.skill;
    if (skill) questEvent(this, 'ActionGainItem', (d) => (d.Component?.Entity === NS + skill && goalMatches(d, 'Item', id) ? quantity : 0));
    return true;
  }

  removeItem(id: string, quantity: number): boolean {
    const have = this.count(id);
    if (have < quantity) return false;
    if (have === quantity) delete this.state.bank[id];
    else this.state.bank[id] = have - quantity;
    this.track('item', id, -quantity);
    return true;
  }

  addCurrency(currency: string, quantity: number): void {
    if (currency === GOLD) {
      this.state.gold += quantity;
      this.track('gold', currency, quantity);
    }
    else this.state.currencies[currency] = (this.state.currencies[currency] ?? 0) + quantity;
  }

  currency(id: string): number {
    return id === GOLD ? this.state.gold : this.state.currencies[id] ?? 0;
  }

  contentWeaponType(id: string): { Stances: string[] } | undefined {
    return tryGet<{ Stances: string[] }>('WeaponType', id);
  }

  /** How many prayers of a slot type can be active (slots unlock with Prayer levels). */
  prayerSlots(fitsType: string): number {
    return all<{ FitsType: string; UnlockRequirements: Requirement[] | null }>('PrayerSlot').filter(
      (s) => s.FitsType === fitsType && this.requirementsMet(s.UnlockRequirements),
    ).length;
  }

  private bonusCache: { version: number; all: Bonus[]; noGear: Bonus[] } | null = null;

  private bonusLists(): { all: Bonus[]; noGear: Bonus[] } {
    if (!this.bonusCache || this.bonusCache.version !== this.bonusVersion) {
      this.bonusCache = { version: this.bonusVersion, all: activeBonuses(this), noGear: activeBonuses(this, false) };
    }
    return this.bonusCache;
  }

  /** All active bonuses (shop, astrology, equipment, sets, toolbelt), cached until something changes. */
  bonuses(): Bonus[] {
    return this.bonusLists().all;
  }

  /** Bonuses from everything except worn equipment, which combat applies itself. */
  globalBonuses(): Bonus[] {
    return this.bonusLists().noGear;
  }

  bankSlots(): number {
    return Math.max(1, BASE_BANK_SLOTS + mod(this, 'BankInventory', 'FlatMaxStacks', { entity: 'Bank' }));
  }

  sell(id: string, quantity: number): number {
    const q = Math.min(quantity, this.count(id));
    const price = item(id).SellsFor;
    if (q <= 0 || !price) return 0;
    this.manual = true;
    this.removeItem(id, q);
    const gold = price.Quantity * q;
    this.addCurrency(price.Currency, gold);
    this.state.stats.itemsSold += q;
    this.state.stats.goldFromSales += gold;
    this.manual = false;
    checkUnlocks(this);
    this.emit();
    return gold;
  }

  /** Record a failed action (e.g. a burnt cook). */
  failed(skill: string, what: string): void {
    const fails = this.state.stats.failures;
    fails[skill] = (fails[skill] ?? 0) + 1;
    this.note(`Failed: ${what}`, 'info');
  }

  addXp(skill: string, amount: number): void {
    const before = this.level(skill);
    // PercentXPGained bonuses (astrology nodes, gear, shop) scale every XP gain for the skill.
    const pct = mod(this, 'Experience', 'PercentXPGained', { entity: skill });
    this.state.xp[skill] = this.xp(skill) + amount * (1 + pct);
    this.track('xp', skill, amount * (1 + pct));
    const after = this.level(skill);
    if (after > before) {
      this.note(`${skill} level ${after}!`, 'level');
      this.signal({ type: 'levelUp', skill, from: before, to: after });
    }
  }

  // ---- actions ---------------------------------------------------------------------------

  handler(skill: string): SkillHandler {
    const h = handlers.get(skill);
    if (!h) throw new Error(`No handler for ${skill}`);
    return h;
  }

  /** Why the recipe can't be started, or null if it can. */
  blockReason(skill: string, recipe: string): string | null {
    const h = this.handler(skill);
    const r = h.recipe(recipe);
    if (this.isDemoLocked(r.Requirements)) return 'Not in demo';
    if (!this.requirementsMet(r.Requirements)) return 'Level too low';
    return h.canStart?.(this, recipe) ?? null;
  }

  /** Start (or toggle off) an action. Only one action runs at a time, as in the game. */
  toggle(skill: string, recipe: string): void {
    const a = this.state.active;
    if (a && a.skill === skill && a.recipe === recipe) {
      this.stop();
      return;
    }
    const reason = isUnlocked(this, skill) ? this.blockReason(skill, recipe) : 'That skill is still locked';
    if (reason) {
      this.note(reason, 'stop');
      this.emit();
      return;
    }
    this.state.thieving.stunned = false;
    const ticks = msToTicks(this.handler(skill).interval(this, recipe));
    this.state.active = { skill, recipe, waitTicks: ticks, ticksLeft: ticks };
    this.tracker.sync(`${skill}|${recipe}`, this.state.tick);
    this.emit();
  }

  stop(reason?: string): void {
    if (reason) this.note(reason, 'stop');
    this.state.active = null;
    this.emit();
  }

  /** Advance the simulation. Jumps straight to each timer firing, so long offline gaps are cheap. */
  advance(ticks: number): void {
    let left = Math.floor(ticks);
    while (left > 0) {
      const a = this.state.active;
      // Background systems (ranching, ...) schedule events at absolute ticks; step to whichever comes first.
      const passiveAt = this.nextPassiveTick();
      let step = left;
      if (a) step = Math.min(step, a.ticksLeft);
      if (passiveAt != null) step = Math.min(step, Math.max(0, passiveAt - this.state.tick));
      if (a) a.ticksLeft -= step;
      left -= step;
      this.state.tick += step;
      if (passiveAt != null && this.state.tick >= passiveAt) this.runPassives();
      if (a && this.state.active === a && a.ticksLeft === 0) this.fire(a.skill, a.recipe);
    }
    this.state.rng = this.rng.state;
  }

  private nextPassiveTick(): number | null {
    let next: number | null = null;
    for (const p of PASSIVES) {
      const t = p.nextEvent(this);
      if (t != null && (next == null || t < next)) next = t;
    }
    return next;
  }

  private runPassives(): void {
    for (const p of PASSIVES) {
      const t = p.nextEvent(this);
      if (t != null && t <= this.state.tick) p.process(this);
    }
  }

  // ---- player health and food ------------------------------------------------------------

  /** Max HP is Hitpoints level × 10, as in the game. Hitpoints starts at level 10. */
  maxHp(): number {
    return this.level('Hitpoints') * 10;
  }

  hp(): number {
    return Math.min(this.state.hp ?? this.maxHp(), this.maxHp());
  }

  /** Apply damage, auto-eating the selected food at 25% HP like the game. Returns true if the player died. */
  damage(amount: number): boolean {
    this.state.hp = Math.max(0, this.hp() - amount);
    this.autoEat();
    if (this.state.hp > 0) return false;
    this.state.hp = this.maxHp();
    this.note('You died!', 'stop');
    this.state.stats.deaths = (this.state.stats.deaths ?? 0) + 1;
    return true;
  }

  heal(amount: number): void {
    this.state.hp = Math.min(this.maxHp(), this.hp() + amount);
  }

  foodHealing(id: string): number {
    const food = item(id).Capabilities?.[`${NS}Food`] as { BaseHealing: number } | undefined;
    if (!food) return 0;
    const pct = mod(this, 'CombatFood', 'PercentHealing', { entity: 'Combat' });
    return Math.max(1, Math.floor(food.BaseHealing * (1 + pct) + mod(this, 'CombatFood', 'FlatHealing', { entity: 'Combat' })));
  }

  /** HP at or below which the selected food is eaten: 25% of max, as on the desktop, plus any threshold bonuses. */
  autoEatAt(): number {
    const pct = Math.min(1, Math.max(0, 0.25 + mod(this, 'CombatFood', 'FlatAutoEatThreshold', { entity: 'Combat' })));
    return Math.round(pct * this.maxHp());
  }

  private autoEat(): void {
    const food = this.state.selectedFood;
    if (!food || this.hp() > this.autoEatAt()) return;
    const have = this.count(food);
    const heal = this.foodHealing(food);
    if (!have || !heal) return;
    const n = Math.min(have, Math.max(1, Math.floor((this.maxHp() - this.hp()) / heal)));
    // Each food eaten can be preserved by FoodPreservationChance bonuses.
    let eaten = 0;
    const keep = mod(this, 'CombatFood', 'FoodPreservationChance', { entity: 'Combat' });
    for (let i = 0; i < n; i++) if (!this.rng.chance(keep)) eaten++;
    this.removeItem(food, eaten);
    const before = this.hp();
    this.heal(n * heal);
    if (this.state.active?.skill === 'Combat') questEvent(this, 'CombatHealFromAutoEat', () => this.hp() - before, this.combatContext());
    this.note(`Ate ${n} ${itemName(food, n)}`, 'info');
  }

  eat(id: string): void {
    const heal = this.foodHealing(id);
    if (!heal || this.hp() >= this.maxHp()) return;
    this.manual = true;
    const ate = this.removeItem(id, 1);
    this.manual = false;
    if (!ate) return;
    this.heal(heal);
    this.emit();
  }

  /** Advance by wall-clock ms, carrying the sub-tick remainder so online and offline time add up exactly. */
  advanceMs(ms: number): void {
    const total = this.state.msCarry + ms;
    const ticks = Math.floor((total * TICKS_PER_SECOND) / 1000 + 1e-9);
    this.state.msCarry = total - (ticks * 1000) / TICKS_PER_SECOND;
    this.advance(ticks);
  }

  private fire(skill: string, recipe: string): void {
    const h = this.handler(skill);
    const stats = this.state.stats.actions;
    stats[skill] = (stats[skill] ?? 0) + 1;
    const nextMs = h.fire(this, recipe);
    this.signal({ type: 'action', skill, recipe });
    checkUnlocks(this);
    // State-based guild tasks (levels, items owned, gear) are checked about once a second of game time.
    if (this.state.tick - this.lastGuildCheck >= 60) {
      this.lastGuildCheck = this.state.tick;
      checkGuild(this);
    }
    const a = this.state.active;
    if (!a) return;
    if (nextMs == null) {
      this.state.active = null;
      return;
    }
    a.waitTicks = msToTicks(nextMs);
    a.ticksLeft = a.waitTicks;
  }

  /** Bring the simulation up to wall-clock time. Returns a summary when the gap counts as offline. */
  catchUp(now = Date.now()): OfflineSummary | null {
    const elapsed = Math.max(0, now - this.state.lastUpdate);
    this.state.lastUpdate = now;
    if (elapsed < MIN_OFFLINE_MS) {
      this.state.stats.onlineMs += elapsed;
      this.advanceMs(elapsed);
      return null;
    }
    const ms = Math.min(elapsed, MAX_OFFLINE_MS);
    const xpBefore = { ...this.state.xp };
    const bankBefore = { ...this.state.bank };
    const goldBefore = this.state.gold;
    this.quiet = true;
    try {
      this.advanceMs(ms);
    } finally {
      this.quiet = false;
    }
    this.state.stats.offlineMs += ms;
    const xp: Record<string, number> = {};
    for (const [k, v] of Object.entries(this.state.xp)) if (v !== (xpBefore[k] ?? 0)) xp[k] = v - (xpBefore[k] ?? 0);
    const items: Record<string, number> = {};
    for (const k of new Set([...Object.keys(bankBefore), ...Object.keys(this.state.bank)])) {
      const d = (this.state.bank[k] ?? 0) - (bankBefore[k] ?? 0);
      if (d) items[k] = d;
    }
    this.emit();
    return { ms, xp, items, gold: this.state.gold - goldBefore };
  }
}
