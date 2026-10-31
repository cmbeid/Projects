// Combat: the player and one enemy each attack on their own turn timer, as in CharacterComponent.
import { NS, all, itemName, tryGet, type Requirement } from '../content';
import type { Game } from '../game';
import type { SkillHandler, SkillRecipe } from '../skills/types';
import type { SlayerTask } from '../state';
import { activeImbuement, conditionHolds, mod, resolveConditional } from '../bonuses';
import {
  type EffectRef, type FightOps, type Side, type TriggeredEffect, afterAttack, afterDefended, applyEffect, clearEffects, effectData, effectModifiers,
  effectsOn, endTurn, fireTriggers, isStunned, nextProc, other, sideOf, tickDamageOverTime,
} from './effects';
import { goalMatches, questEvent } from '../quests';
import type { GoalContext } from '../guild';
import {
  COMBAT_LEVELS, DEFAULT_WEAPON, type Bonus, type Drops, allSlayerMasters, area, attack as attackData, buryCap, enemy as enemyData,
  equipmentCap, equipmentSlots, isDungeon, prayer as prayerData, prayerChargedOn, slayerMaster, spell as spellData, stance as stanceData,
  style as styleData, triangleBonuses, weaponCap, allSpells, type Dungeon, type CombatArea,
} from './data';
import {
  combatLevel, type Fighter, accuracyRating, addStats, applyBonuses, attackInterval, finishStats, evasionRating, hitChance, maxHit, minHit, armour, resistance,
} from './stats';

export const SPAWN_INTERVAL_MS = 3000;
const TICK_MS = 1000 / 60;
const toTicks = (ms: number) => Math.max(1, Math.round(ms / TICK_MS));
const local = (id: string) => id.replace(NS, '');

// ---- equipment ------------------------------------------------------------------------------

export function equipped(game: Game, slot: string): { item: string; qty: number } | undefined {
  return game.state.equipment[slot];
}

/** Whether a slot is usable yet (the second ring slot needs Crafting 150, beyond the demo). */
export function slotUnlocked(game: Game, slotId: string): boolean {
  const s = equipmentSlots().find((x) => NS + x.Id === slotId);
  return !s || game.requirementsMet(s.UnlockRequirements);
}

/** Slots an item goes into: its type's slot (rings fill the first free ring slot), plus any slots it occupies. */
export function targetSlot(game: Game, itemId: string): string | null {
  const cap = equipmentCap(itemId);
  if (!cap) return null;
  const fits = equipmentSlots().filter((s) => s.FitsType === cap.Type && game.requirementsMet(s.UnlockRequirements));
  if (!fits.length) return null;
  return NS + (fits.find((s) => !equipped(game, NS + s.Id)) ?? fits[0]).Id;
}

export function canEquip(game: Game, itemId: string): string | null {
  const cap = equipmentCap(itemId);
  if (!cap) return 'Not equipment';
  if (!game.requirementsMet(cap.Requirements)) return 'Level too low';
  if (!targetSlot(game, itemId)) return 'No slot for this item';
  return null;
}

export function unequip(game: Game, slot: string): void {
  const e = equipped(game, slot);
  if (!e) return;
  delete game.state.equipment[slot];
  game.addItem(e.item, e.qty);
  game.bonusesChanged();
  game.emit();
}

export function equip(game: Game, itemId: string): string | null {
  const reason = canEquip(game, itemId);
  if (reason) return reason;
  const cap = equipmentCap(itemId)!;
  const slot = targetSlot(game, itemId)!;
  const qty = cap.CanEquipQuantity ? game.count(itemId) : 1;
  if (qty <= 0) return 'You have none';
  const current = equipped(game, slot);
  if (current && current.item === itemId && cap.CanEquipQuantity) {
    game.removeItem(itemId, qty);
    current.qty += qty;
  } else {
    unequip(game, slot);
    for (const occupied of cap.OccupiesSlots ?? []) unequip(game, occupied);
    // Equipping into a slot that another item occupies (e.g. an offhand under a two-handed bow) removes that item.
    for (const [s, e] of Object.entries(game.state.equipment)) {
      if (equipmentCap(e.item)?.OccupiesSlots?.includes(slot)) unequip(game, s);
    }
    game.removeItem(itemId, qty);
    game.state.equipment[slot] = { item: itemId, qty };
  }
  if (game.state.combat.spell && !spellAllowed(game, game.state.combat.spell)) ensureSpell(game);
  const imb = game.state.combat.imbuement ? tryGet<{ Element: string }>('Imbuement', game.state.combat.imbuement) : undefined;
  if (imb && !weaponElements(game).includes(imb.Element)) game.state.combat.imbuement = null;
  game.bonusesChanged();
  game.emit();
  return null;
}

/** Slots blocked by a two-handed item. */
export function occupiedSlots(game: Game): Set<string> {
  const out = new Set<string>();
  for (const e of Object.values(game.state.equipment)) for (const s of equipmentCap(e.item)?.OccupiesSlots ?? []) out.add(s);
  return out;
}

// ---- fighters --------------------------------------------------------------------------------

export function weaponOf(game: Game): string {
  return equipped(game, `${NS}Weapon`)?.item ?? DEFAULT_WEAPON;
}

export function weaponStances(game: Game): string[] {
  const w = weaponCap(weaponOf(game));
  const type = w ? (game.contentWeaponType(w.Type)?.Stances ?? []) : [];
  return type.length ? type : [`${NS}Stab`];
}

export function currentStance(game: Game): string {
  const allowed = weaponStances(game);
  return allowed.includes(game.state.combat.stance) ? game.state.combat.stance : allowed[0];
}

export function triangle(playerStyle: string, enemyStyle: string, who: 'Player' | 'Enemy'): Bonus[] {
  return triangleBonuses()
    .filter((t) => t.PlayerStyle === playerStyle && t.EnemyStyle === enemyStyle)
    .flatMap((t) => t.Bonuses.Component)
    .filter((b) => b.LocalContext?.Component?.Component === who);
}

/** Bonuses only apply when their CombatStyle and AttackStance (if any) match, e.g. the Bruiser belt's min hit with Crush. */
const forStyle = (bonuses: Bonus[], styleId: string, stanceId?: string) =>
  bonuses.filter(
    (b) =>
      (!b.LocalContext?.CombatStyle || b.LocalContext.CombatStyle === styleId) &&
      (!stanceId || !(b.LocalContext as { AttackStance?: string | null } | null)?.AttackStance || (b.LocalContext as { AttackStance?: string }).AttackStance === NS + stanceId),
  );

const isCharacterStat = (b: Bonus) => b.Stat.StatsType === `${NS}Character`;

export function playerFighter(game: Game, enemyStyle?: string): Fighter {
  const levels: Record<string, number> = {};
  for (const l of COMBAT_LEVELS) levels[l] = game.level(l);
  const st = stanceData(currentStance(game));
  const sty = styleData(st.CombatStyle);
  const f: Fighter = { levels, stats: {}, power: 0, protection: 0, stance: st, style: sty, mods: {}, maxHp: game.maxHp() };
  // Gear in a slot that isn't unlocked (from older saves) gives nothing.
  const items = Object.entries(game.state.equipment).filter(([slot]) => slotUnlocked(game, slot)).map(([, e]) => e.item);
  if (!equipped(game, `${NS}Weapon`)) items.push(DEFAULT_WEAPON);
  for (const it of items) {
    const cap = equipmentCap(it);
    const pr = addStats(f.stats, cap?.Stats);
    f.power += pr.power;
    f.protection += pr.protection;
    if (cap?.Bonuses) applyBonuses(f, forStyle(resolveConditional(game, cap.Bonuses.Component).filter(isCharacterStat), sty.Id, st.Id));
  }
  const sp = game.state.combat.spell;
  if (sty.UsesSpells && sp) addStats(f.stats, spellData(sp).Stats);
  for (const p of game.state.combat.prayers) applyBonuses(f, forStyle(prayerData(p).Bonuses.Component, sty.Id));
  for (const b of game.globalBonuses()) if (b.Stat.StatsType === `${NS}Character`) applyBonuses(f, forStyle([b], sty.Id));
  applyBonuses(f, (st as { Bonuses?: { Component: Bonus[] } }).Bonuses?.Component ?? []);
  applyBonuses(f, forStyle(sideBonuses(game, 'player').filter(isCharacterStat), sty.Id));
  if (enemyStyle) applyBonuses(f, triangle(sty.Id, enemyStyle, 'Player'));
  finishStats(f);
  return f;
}

export function enemyFighter(id: string, stanceId?: string, playerStyle?: string): Fighter {
  const e = enemyData(id);
  const levels: Record<string, number> = {};
  for (const l of e.Levels) levels[local(l.Key)] = l.Value;
  const st = stanceData(stanceId ?? e.Stances[0].Stance);
  const sty = styleData(st.CombatStyle);
  const f: Fighter = { levels, stats: {}, power: 0, protection: 0, stance: st, style: sty, mods: {}, maxHp: (levels.Hitpoints ?? 1) * 10 };
  const pr = addStats(f.stats, e.Stats);
  f.power = pr.power;
  f.protection = pr.protection;
  if (playerStyle) applyBonuses(f, triangle(playerStyle, sty.Id, 'Enemy'));
  finishStats(f);
  return f;
}

export const enemyMaxHp = (id: string) => enemyFighter(id).maxHp;

// ---- areas -------------------------------------------------------------------------------------

export function areaEnemies(id: string): string[] {
  const a = area(id);
  if (isDungeon(id)) return (a as Dungeon).Enemies.flatMap((s) => s.Enemies.map((e) => e.Enemy));
  return (a as CombatArea).Enemies;
}

/** The player's darkness penalty in an area (CharacterStats.ComputeDarknessPenalty). Enemies never have one. */
export function darkness(game: Game, areaId: string): number {
  const f = playerFighter(game);
  return Math.max(0, Math.trunc(area(areaId).Darkness * (1 + (f.mods.PercentDarkness ?? 0)) + (f.mods.FlatDarkness ?? 0) - (f.mods.FlatLight ?? 0)));
}

function rollDrops(game: Game, d: Drops): void {
  const doubling = mod(game, 'CombatLoot', 'ItemDoublingChance', { entity: 'Combat' });
  // Bones and other buriables have their own extra doubling bonus on top.
  const buriable = mod(game, 'CombatLoot', 'BuriableDoublingChance', { entity: 'Combat' });
  const loot = game.state.combat.loot;
  const add = (item: string, q: number) => {
    const n = game.rng.chance(doubling + (buryCap(item) ? buriable : 0)) ? q * 2 : q;
    game.addItem(item, n);
    if (loot) loot.items[item] = (loot.items[item] ?? 0) + n;
  };
  const currencyDoubling = mod(game, 'CombatLoot', 'CurrencyDoublingChance', { entity: 'Combat' });
  for (const f of d.FixedItems) add(f.Item, game.rng.intInclusive(f.MinQuantity, f.MaxQuantity));
  for (const t of d.ItemTables) {
    if (!game.rng.chance(t.Chance) || !t.Table.length) continue;
    const pick = game.rng.weighted(t.Table.map((x) => ({ ...x, Weight: x.Weight ?? 1 })));
    add(pick.Item, game.rng.intInclusive(pick.MinQuantity, pick.MaxQuantity));
  }
  for (const c of d.FixedCurrencies) {
    const q = game.rng.intInclusive(c.MinQuantity, c.MaxQuantity) * (game.rng.chance(currencyDoubling) ? 2 : 1);
    game.addCurrency(c.Currency, q);
    if (loot) loot.currencies[c.Currency] = (loot.currencies[c.Currency] ?? 0) + q;
  }
}

/** Time between kills and the next spawn, with Flat/Percent spawn interval bonuses. */
const spawnInterval = (game: Game) =>
  Math.max(250, (SPAWN_INTERVAL_MS + mod(game, 'CombatAction', 'FlatSpawnInterval', { entity: 'Combat' })) * (1 + mod(game, 'CombatAction', 'PercentSpawnInterval', { entity: 'Combat' })));

/** A prayer's cost with any flat prayer cost bonus. */
const prayerCost = (game: Game, id: string) => Math.max(0, prayerData(id).Cost.Quantity + mod(game, 'Prayer', 'FlatPrayerCost', { entity: 'Combat', prayer: id }));

/** Prayer points all active prayers cost (for prayer XP). */
const prayerTurnCost = (game: Game) => game.state.combat.prayers.reduce((s, x) => s + prayerCost(game, x), 0);

/**
 * Each prayer is charged on its own trigger: the player's or the enemy's attack turn. One that can't be paid turns off.
 */
function chargePrayers(game: Game, side: Side): void {
  const c = game.state.combat;
  let dropped = false;
  for (const id of c.prayers.filter((x) => prayerChargedOn(prayerData(x)) === side)) {
    if (game.rng.chance(mod(game, 'Prayer', 'CostPreservationChance', { entity: 'Combat', prayer: id }))) continue;
    const cost = prayerCost(game, id);
    if (prayerPoints(game) >= cost) {
      game.addCurrency(`${NS}PrayerPoints`, -cost);
      questEvent(game, 'SpendPrayerCurrency', () => cost, combatContext(game));
    } else {
      c.prayers = c.prayers.filter((x) => x !== id);
      dropped = true;
    }
  }
  if (dropped) {
    game.notice('You ran out of prayer points.');
    game.bonusesChanged();
  }
  startSlayerTasks(game);
}

// ---- prayer, slayer, burying --------------------------------------------------------------------

export function prayerPoints(game: Game): number {
  return game.currency(`${NS}PrayerPoints`);
}

export function togglePrayer(game: Game, id: string): string | null {
  const c = game.state.combat;
  if (c.prayers.includes(id)) {
    c.prayers = c.prayers.filter((p) => p !== id);
  } else {
    const p = prayerData(id);
    if (!game.requirementsMet(p.UnlockRequirements)) return 'Prayer level too low';
    if (prayerPoints(game) < p.Cost.Quantity) return 'Not enough prayer points';
    // One prayer per slot type (two combat slots once Prayer 50 unlocks the second).
    const sameSlot = c.prayers.filter((x) => prayerData(x).FitsInSlot === p.FitsInSlot);
    const limit = game.prayerSlots(p.FitsInSlot);
    if (sameSlot.length >= limit) c.prayers = c.prayers.filter((x) => x !== sameSlot[0]);
    c.prayers.push(id);
  }
  game.bonusesChanged();
  game.emit();
  return null;
}

export function bury(game: Game, itemId: string, qty: number): void {
  const cap = buryCap(itemId);
  const n = Math.min(qty, game.count(itemId));
  if (!cap || n <= 0) return;
  game.removeItem(itemId, n);
  game.addCurrency(cap.CurrencyGain.Currency, cap.CurrencyGain.Quantity * n);
  game.emit();
}

// Slayer costs and rewards follow the desktop's formulas, with their Percent/Flat bonuses.
const slayerMod = (game: Game, masterId: string, name: string, currency?: string) =>
  mod(game, 'SlayerTasks', name, { master: masterId, currency });

export function slayerTaskRange(game: Game, masterId: string): [number, number] {
  const m = slayerMaster(masterId);
  const pct = 1 + slayerMod(game, masterId, 'PercentTaskLength');
  return [Math.max(1, Math.floor(m.BaseTaskLength * pct)), Math.max(1, Math.floor((m.BaseTaskLength + 3 * game.level('Slayer')) * pct))];
}

export function slayerRerollCost(game: Game, masterId: string): number {
  const m = slayerMaster(masterId);
  return Math.max(1, Math.floor(m.RerollCost.Quantity * (1 + slayerMod(game, masterId, 'PercentRerollCost', m.RerollCost.Currency))));
}

/** Extending doubles a task once (adds the master's base length) for half the reroll price. */
export function slayerExtensionCost(game: Game, masterId: string): number {
  const m = slayerMaster(masterId);
  return Math.max(1, Math.floor(Math.floor(m.RerollCost.Quantity / 2) * (1 + slayerMod(game, masterId, 'PercentExtensionCost', m.RerollCost.Currency))));
}

export function slayerBlockCost(game: Game, masterId: string): number {
  const m = slayerMaster(masterId);
  return Math.max(1, Math.floor(m.BlockCost.Quantity * (1 + slayerMod(game, masterId, 'PercentBlockCost', m.BlockCost.Currency))));
}

/** A master's block slots: unlocked ones (by tasks done for that master) and what each is blocking. */
export function slayerBlockSlots(game: Game, masterId: string): { id: string; unlocked: boolean; enemy?: string }[] {
  const m = slayerMaster(masterId);
  const blocks = game.state.combat.slayerBlocks ?? {};
  return (m.BlockSlots ?? []).map((s) => ({ id: s.Id, unlocked: game.requirementsMet(s.UnlockRequirements), enemy: blocks[s.Id] }));
}

/** A master's current task, if it has one going. */
export function slayerTask(game: Game, masterId: string): SlayerTask | null {
  const t = game.state.combat.slayerTasks?.[masterId];
  return t && t.left > 0 ? t : null;
}

export function extendSlayerTask(game: Game, masterId: string): string | null {
  const t = slayerTask(game, masterId);
  if (!t) return 'No task to extend';
  if (t.extended) return 'Already extended';
  const m = slayerMaster(masterId);
  const cost = slayerExtensionCost(game, masterId);
  if (game.currency(m.RerollCost.Currency) < cost) return `Need ${cost} slayer coins`;
  game.addCurrency(m.RerollCost.Currency, -cost);
  t.left += m.BaseTaskLength;
  t.extended = true;
  game.emit();
  return null;
}

/** Block a master's current task enemy from its future tasks (replacing a slot's old block if all are full). */
export function blockSlayerEnemy(game: Game, masterId: string): string | null {
  const t = slayerTask(game, masterId);
  if (!t) return 'No task';
  const slots = slayerBlockSlots(game, masterId).filter((s) => s.unlocked);
  if (!slots.length) return 'No block slots unlocked yet';
  const slot = slots.find((s) => !s.enemy) ?? slots[0];
  const m = slayerMaster(masterId);
  const cost = slayerBlockCost(game, masterId);
  if (game.currency(m.BlockCost.Currency) < cost) return `Need ${cost} slayer coins`;
  game.addCurrency(m.BlockCost.Currency, -cost);
  (game.state.combat.slayerBlocks ??= {})[slot.id] = t.enemy;
  game.emit();
  return null;
}

export function unblockSlayerEnemy(game: Game, slotId: string): void {
  if (game.state.combat.slayerBlocks) delete game.state.combat.slayerBlocks[slotId];
  game.emit();
}

/** Enemies a master can give tasks for: in its areas, in the demo, and not blocked. */
function slayerOptions(game: Game, masterId: string): string[] {
  const m = slayerMaster(masterId);
  const blocked = new Set(slayerBlockSlots(game, masterId).map((s) => s.enemy));
  return m.Areas.filter((a) => !game.isDemoLocked(area(a).UnlockRequirements))
    .flatMap((a) => areaEnemies(a))
    .filter((e) => !game.isDemoLocked(enemyData(e).Requirements) && !blocked.has(e));
}

/** Roll a master's next task (ActiveSlayerMaster.SetNewTask). Returns false if it has no enemies to give. */
function setNewTask(game: Game, masterId: string): boolean {
  const options = slayerOptions(game, masterId);
  const tasks = (game.state.combat.slayerTasks ??= {});
  if (!options.length) {
    delete tasks[masterId];
    return false;
  }
  const [min, max] = slayerTaskRange(game, masterId);
  tasks[masterId] = { enemy: options[game.rng.intInclusive(0, options.length - 1)], left: game.rng.intInclusive(min, max) };
  game.state.rng = game.rng.state;
  return true;
}

/** Get a task from a master, or reroll its current one for slayer coins. */
export function newSlayerTask(game: Game, masterId: string): string | null {
  const m = slayerMaster(masterId);
  if (game.isDemoLocked(m.UnlockRequirements)) return 'Not in demo';
  if (!game.requirementsMet(m.UnlockRequirements)) return 'Locked';
  if (!slayerOptions(game, masterId).length) return 'No enemies available';
  if (slayerTask(game, masterId)) {
    // Rerolling an active task costs slayer coins.
    const cost = slayerRerollCost(game, masterId);
    if (game.currency(m.RerollCost.Currency) < cost) return `Need ${cost} slayer coins`;
    game.addCurrency(m.RerollCost.Currency, -cost);
  }
  setNewTask(game, masterId);
  game.bonusesChanged();
  game.emit();
  return null;
}

/** Every unlocked master starts with a task (ActiveSlayerMaster.StartInitialTask). */
export function startSlayerTasks(game: Game): void {
  for (const m of allSlayerMasters()) {
    const id = NS + m.Id;
    if (slayerTask(game, id) || game.isDemoLocked(m.UnlockRequirements) || !game.requirementsMet(m.UnlockRequirements)) continue;
    setNewTask(game, id);
  }
}

/**
 * A kill counts for every master whose task is that enemy: Slayer XP and coins each, and a finished task is replaced
 * straight away. With Auto Slayer on, if you were fighting the finished task you move on to the new task's enemy.
 */
function onSlayerKill(game: Game, enemyId: string): void {
  const c = game.state.combat;
  for (const [masterId, t] of Object.entries(c.slayerTasks ?? {})) {
    if (t.enemy !== enemyId || t.left <= 0) continue;
    const hp = enemyMaxHp(enemyId);
    game.addXp('Slayer', hp / 8 + 4);
    const cur = slayerMaster(masterId).RewardCurrency;
    const reward = 0.1 * hp ** 1.15 * (1 + slayerMod(game, masterId, 'PercentRewardCurrency', cur)) + slayerMod(game, masterId, 'FlatRewardCurrency', cur);
    game.addCurrency(cur, Math.max(1, Math.floor(reward)));
    t.left--;
    game.stat('SlayerTotalTaskEnemiesKilled');
    if (t.left > 0) continue;
    c.slayerTasksDone[masterId] = (c.slayerTasksDone[masterId] ?? 0) + 1;
    game.notice(`Slayer task complete! (${slayerMaster(masterId).DisplayName})`);
    if (setNewTask(game, masterId) && c.autoSlayer && !isDungeon(c.area!)) {
      const next = c.slayerTasks![masterId].enemy;
      const nextArea = slayerMaster(masterId).Areas.find((a) => areaEnemies(a).includes(next));
      if (nextArea) {
        c.area = nextArea;
        c.selectedEnemy = next;
      }
    }
    game.bonusesChanged();
  }
}

// ---- spells ------------------------------------------------------------------------------------

/** Elements the weapon lets you cast (MagicSpellsComponent.SetAvailableElements): an Air staff casts Air spells. */
export function weaponElements(game: Game): string[] {
  return (weaponCap(weaponOf(game)) as { Elements?: string[] } | undefined)?.Elements ?? [];
}

export function spellAllowed(game: Game, spellId: string): boolean {
  const el = (spellData(spellId) as { Element?: string }).Element;
  return !el || weaponElements(game).includes(el);
}

/**
 * With a weapon that can't cast the selected spell, switch to a default one for its element: as on the desktop
 * (SelectDefaultSpellForElement), the first spell of that element.
 */
export function ensureSpell(game: Game): void {
  const c = game.state.combat;
  if (c.spell && spellAllowed(game, c.spell)) return;
  const el = weaponElements(game)[0];
  const ofElement = allSpells().filter((s) => (s as { Element?: string }).Element === el && !game.isDemoLocked(s.UnlockRequirements));
  const unlocked = ofElement.filter((s) => game.requirementsMet(s.UnlockRequirements));
  const pick = unlocked[0] ?? ofElement[0];
  c.spell = pick ? NS + pick.Id : null;
}

/** Select an imbuement (or none). It must be unlocked and match an element your weapon allows. */
export function setImbuement(game: Game, id: string | null): string | null {
  const c = game.state.combat;
  if (id) {
    const imb = tryGet<{ Element: string; UnlockRequirements: Requirement[] | null }>('Imbuement', id);
    if (!imb) return 'Unknown imbuement';
    if (game.isDemoLocked(imb.UnlockRequirements)) return 'Not in demo';
    if (!game.requirementsMet(imb.UnlockRequirements)) return 'Magic level too low';
    if (!weaponElements(game).includes(imb.Element)) return 'Your weapon can’t use this element';
  }
  c.imbuement = c.imbuement === id ? null : id;
  game.bonusesChanged();
  game.emit();
  return null;
}

/** An imbuement's runes are paid at the start of each attack turn (ConsumeImbuementCosts), with its own preservation. */
function chargeImbuement(game: Game): void {
  const imb = activeImbuement(game);
  if (!imb) return;
  const preserve = mod(game, 'MagicSpell', 'RunePreservationChance', { entity: 'Combat', element: imb.Element });
  if (!game.rng.chance(preserve)) for (const r of imb.RuneCosts) game.removeItem(r.Item, r.Quantity);
  // Out of runes: its bonuses stop.
  if (!activeImbuement(game)) game.bonusesChanged();
}

// ---- the fight ---------------------------------------------------------------------------------

/** Ammo or runes for the next player attack, or why it can't be paid. */
function attackCost(game: Game, f: Fighter): { items: [string, number][] } | string {
  const w = weaponCap(weaponOf(game));
  if (w?.RequiredAmmoType) {
    const ammo = equipped(game, `${NS}Ammo`);
    if (!ammo || equipmentCap(ammo.item)?.AmmoType !== w.RequiredAmmoType || ammo.qty <= 0) return 'You have no ammo for this weapon.';
    return { items: [[`ammo:${ammo.item}`, 1]] };
  }
  if (f.style.UsesSpells) {
    ensureSpell(game);
    const sp = game.state.combat.spell;
    if (!sp) return 'Select a spell to fight with magic.';
    // Staves and wands lower the cost of their element's runes (FlatRuneCost), down to free.
    const costs = spellData(sp)
      .RuneCosts.map((r) => ({ Item: r.Item, Quantity: Math.max(0, r.Quantity + mod(game, 'MagicSpell', 'FlatRuneCost', { entity: 'Combat', spell: sp, rune: r.Item })) }))
      .filter((r) => r.Quantity > 0);
    for (const r of costs) if (game.count(r.Item) < r.Quantity) return `You need ${r.Quantity} ${itemName(r.Item, r.Quantity)}.`;
    return { items: costs.map((r) => [r.Item, r.Quantity]) };
  }
  return { items: [] };
}

/**
 * Pay for an attack: runes once per turn, ammo once per hit (PlayerComponent.OnAttack), each with its own preservation
 * roll. Preservation bonuses can be scoped to the spell's element (wizard sets) or the ammo type (boomerangs).
 */
function payAttack(game: Game, items: [string, number][], hitCount = 1): void {
  const sp = game.state.combat.spell;
  const element = sp ? (spellData(sp) as { Element?: string }).Element : undefined;
  const runesSaved = game.rng.chance(mod(game, 'MagicSpell', 'RunePreservationChance', { entity: 'Combat', spell: sp ?? undefined, element }));
  for (const [id, q] of items) {
    if (id.startsWith('ammo:')) {
      for (let i = 0; i < hitCount; i++) {
        const ammo = equipped(game, `${NS}Ammo`);
        if (!ammo) break;
        const ammoType = equipmentCap(ammo.item)?.AmmoType ?? undefined;
        if (game.rng.chance(mod(game, 'AmmoConsumption', 'AmmoPreservationChance', { entity: 'Combat', ammoType }))) continue;
        ammo.qty -= q;
        if (ammo.qty <= 0) {
          delete game.state.equipment[`${NS}Ammo`];
          game.bonusesChanged();
        }
      }
    } else if (!runesSaved) {
      game.removeItem(id, q);
    }
  }
}

interface ConsumeTrigger { Type: string; Data: { WasHit?: boolean | null; Conditions?: { Type: string; Data: { IsOr?: boolean } }[] | null } }

/** Gear used up each time you're hit, like lit lanterns in dark areas (the item's CharacterDefended ConsumesOn). */
function consumeOnDefended(game: Game, wasHit: boolean): void {
  for (const [slot, e] of Object.entries(game.state.equipment)) {
    const triggers = (equipmentCap(e.item) as { ConsumesOn?: ConsumeTrigger[] | null } | undefined)?.ConsumesOn;
    if (!Array.isArray(triggers)) continue;
    for (const t of triggers) {
      if (t.Type !== `${NS}CharacterDefended` || (t.Data.WasHit != null && t.Data.WasHit !== wasHit)) continue;
      const conds = t.Data.Conditions ?? [];
      // Conditions join with AND unless marked IsOr (any of the OR group will do).
      const and = conds.filter((x) => !x.Data.IsOr);
      const or = conds.filter((x) => x.Data.IsOr);
      const ok = and.every((x) => conditionHolds(game, x as never)) || (or.length > 0 && or.some((x) => conditionHolds(game, x as never)));
      if (!ok) continue;
      e.qty--;
      if (e.qty <= 0) {
        delete game.state.equipment[slot];
        game.notice(`Your ${itemName(e.item, 1)} ran out.`);
        game.bonusesChanged();
      }
    }
  }
}

function startSpawning(game: Game): void {
  const c = game.state.combat;
  c.phase = 'spawning';
  c.enemy = null;
  c.spawnLeft = toTicks(spawnInterval(game));
}

function pickEnemy(game: Game): string {
  const c = game.state.combat;
  if (isDungeon(c.area!)) {
    const stage = (area(c.area!) as Dungeon).Enemies[c.dungeonStage];
    return game.rng.weighted(stage.Enemies).Enemy;
  }
  return c.selectedEnemy ?? areaEnemies(c.area!)[0];
}

function spawn(game: Game): void {
  const c = game.state.combat;
  c.enemy = pickEnemy(game);
  c.enemyHp = enemyMaxHp(c.enemy);
  c.phase = 'fighting';
  c.enemyWard = enemyMaxWard(c.enemy);
  c.enemyArmourBroken = false;
  clearEffects(game);
  const e = liveEnemyFighter(game);
  c.playerLeft = c.playerTurn = toTicks(attackInterval(playerFighter(game, e.style.Id)));
  c.enemyLeft = c.enemyTurn = toTicks(attackInterval(e));
  game.toolbeltTrigger('CharacterFightStarted', { entity: 'Combat' });
  // AtStartOfFight triggers (e.g. a slime's regeneration, a passive's opening buff).
  const ops = fightOps(game);
  fireTriggers(game, triggersFor(game, 'player'), 'player', 'AtStartOfFight', ops);
  fireTriggers(game, triggersFor(game, 'enemy'), 'enemy', 'AtStartOfFight', ops);
}

function enemyKilled(game: Game): void {
  const c = game.state.combat;
  const id = c.enemy!;
  c.kills[id] = (c.kills[id] ?? 0) + 1;
  if (c.loot) {
    c.loot.kills++;
    (c.loot.enemies ??= {})[id] = (c.loot.enemies[id] ?? 0) + 1;
  }
  const styleId = playerFighter(game).style.Id;
  questEvent(game, 'CombatKillEnemy', (d) => (goalMatches(d, 'Enemy', id) && goalMatches(d, 'PlayerCombatStyle', NS + styleId) ? 1 : 0), combatContext(game));
  if (!isDungeon(c.area!)) rollDrops(game, enemyData(id).Drops);
  onSlayerKill(game, id);
  // The fight is over: every effect on both sides ends with it.
  clearEffects(game);
  if (isDungeon(c.area!)) {
    const d = area(c.area!) as Dungeon;
    c.dungeonCount++;
    if (c.dungeonCount >= d.Enemies[c.dungeonStage].Count) {
      c.dungeonStage++;
      c.dungeonCount = 0;
    }
    if (c.dungeonStage >= d.Enemies.length) {
      rollDrops(game, d.Rewards);
      c.dungeonsDone[c.area!] = (c.dungeonsDone[c.area!] ?? 0) + 1;
      game.stat('CombatTotalDungeonsCompleted');
      c.dungeonStage = 0;
      game.notice(`${d.DisplayName} complete!`);
    }
  }
  startSpawning(game);
}

// ---- the fight: turns, attacks and combat effects (CharacterComponent.PerformAttack) ---------------------------

interface AttackHit { Count: number; Interval?: number; Damage: { Character: string; Formula: { Type: string; Data: { Percent?: number; Damage?: number } } }[] }
export interface FullAttack {
  Id: string;
  DisplayName: string;
  Hits: AttackHit[];
  IsAvoidable: boolean;
  PreHitEffects: { Effect: EffectRef; Chance: number; AppliesTo: 'Self' | 'Target' }[];
  OnHitEffects: { Effect: EffectRef; Chance: number; AppliesTo: 'Self' | 'Target' }[];
}
interface PassiveData { Modifiers: { Global?: Bonus[]; Component?: Bonus[]; CombatEffect?: TriggeredEffect[] } }
interface AreaEffect { Modifiers: { Global?: Bonus[]; Component?: Bonus[]; CombatEffect?: TriggeredEffect[] }; Magnitude: number }

const enemyPassives = (enemyId: string | null) =>
  ((enemyId && enemyData(enemyId).Passives) || []).map((p) => tryGet<PassiveData>('CombatPassive', p)).filter((p): p is PassiveData => !!p);

/** The current area's effect, unless a shop purchase has removed it. */
function currentAreaEffect(game: Game): AreaEffect | null {
  const a = game.state.combat.area;
  const effect = a ? ((area(a) as { Effect?: AreaEffect | null }).Effect ?? null) : null;
  if (!effect || mod(game, 'CombatAreas', 'DisableAreaEffect', { entity: 'Combat', area: a! }) > 0) return null;
  return effect;
}

/** Your element: the spell's when casting, else the weapon's. */
export function playerElement(game: Game): string | undefined {
  const st = styleData(stanceData(currentStance(game)).CombatStyle);
  if (st.UsesSpells && game.state.combat.spell) return (spellData(game.state.combat.spell) as { Element?: string }).Element;
  return (weaponCap(weaponOf(game)) as { Elements?: string[] } | undefined)?.Elements?.[0];
}

/** Elemental matchup bonuses for the current fight (e.g. Air vs Earth: +15% max hit). */
export function elementalBonuses(game: Game): Bonus[] {
  const enemy = game.state.combat.enemy;
  if (!enemy) return [];
  const mine = playerElement(game);
  const theirs = (enemyData(enemy) as { Element?: string }).Element;
  return all<{ PlayerElement: string; EnemyElement: string; Bonuses: { Global?: Bonus[]; Component?: Bonus[] } }>('ElementalBonus')
    .filter((e) => e.PlayerElement === mine && e.EnemyElement === theirs)
    .flatMap((e) => [...(e.Bonuses.Global ?? []), ...(e.Bonuses.Component ?? [])]);
}

const componentOf = (b: Bonus) => (b.LocalContext as { Component?: { Component?: string } } | null | undefined)?.Component?.Component;

/**
 * Fight-only bonuses for one side: its active effects' modifiers, plus enemy passives, the area effect and elemental
 * matchups, each sorted to Player or Enemy by its context marker.
 */
function sideBonuses(game: Game, side: Side): Bonus[] {
  const out: Bonus[] = [...effectModifiers(game, side)];
  const fighting = game.state.active?.skill === 'Combat' && game.state.combat.phase === 'fighting';
  const pool: Bonus[] = [];
  if (fighting) for (const p of enemyPassives(game.state.combat.enemy)) pool.push(...(p.Modifiers.Global ?? []), ...(p.Modifiers.Component ?? []));
  const ae = game.state.active?.skill === 'Combat' ? currentAreaEffect(game) : null;
  if (ae) for (const b of [...(ae.Modifiers.Global ?? []), ...(ae.Modifiers.Component ?? [])]) pool.push({ ...b, Value: b.Value * (ae.Magnitude ?? 1) });
  if (fighting) pool.push(...elementalBonuses(game));
  for (const b of pool) if ((sideOf(componentOf(b)) ?? 'player') === side) out.push(b);
  return out;
}

/** Triggered effects owned by a side: gear, astrology, prayers, the area effect and enemy passives. */
function triggersFor(game: Game, side: Side): TriggeredEffect[] {
  const pool = [...game.combatEffects()];
  const ae = currentAreaEffect(game);
  if (ae) pool.push(...(ae.Modifiers.CombatEffect ?? []));
  for (const p of enemyPassives(game.state.combat.enemy)) pool.push(...(p.Modifiers.CombatEffect ?? []));
  return pool.filter((t) => (sideOf(t.Character?.Component) ?? 'player') === side);
}

/**
 * "Target" stats a defender holds against its attacker: immunity to a combat style, extra damage taken from attacks of
 * a style or element (e.g. Drenched: +25% from Water magic).
 */
function targetStat(game: Game, defender: Side, name: string, attacker: Fighter, attackerElement?: string): number {
  let v = 0;
  const lists = [sideBonuses(game, defender), ...(defender === 'player' ? [game.bonuses()] : [])];
  for (const list of lists) {
    for (const b of list) {
      if (b.Stat.StatsType !== `${NS}Target` || b.Stat.Name !== name) continue;
      const lc = (b.LocalContext ?? {}) as { CombatStyle?: string | null; Element?: string | null };
      if (lc.CombatStyle && lc.CombatStyle !== NS + attacker.style.Id) continue;
      if (lc.Element && lc.Element !== attackerElement) continue;
      v += b.Value;
    }
  }
  return v;
}

/** The enemy as it fights right now: its passives, effects, area effect and elemental modifiers applied. */
export function liveEnemyFighter(game: Game, stanceId?: string, playerStyle?: string): Fighter {
  const f = enemyFighter(game.state.combat.enemy!, stanceId, playerStyle);
  applyBonuses(f, sideBonuses(game, 'enemy').filter((b) => b.Stat.StatsType === `${NS}Character`));
  finishStats(f);
  return f;
}

let acting: Side | null = null;
let lastDamage = 0;

function fightOps(game: Game): FightOps {
  const c = game.state.combat;
  const fighter = (s: Side) => fighters(game)[s];
  return {
    hp: (s) => (s === 'player' ? game.hp() : c.enemyHp),
    maxHp: (s) => fighter(s).maxHp,
    maxHit: (s) => {
      const f = fighter(s);
      return maxHit(f, f.mods.MaxHitCombatTriangle ?? 0);
    },
    damage: (s, amount, source, effectId) => effectDamage(game, s, amount, source, effectId),
    ward: (s) => (s === 'enemy' ? c.enemyWard ?? 0 : 0),
    applied: (effectId, source, target) => {
      if (source === 'player' && target === 'enemy') questEvent(game, 'CombatApplyEffect', (d) => (goalMatches(d, 'Effect', effectId) ? 1 : 0), combatContext(game));
    },
    heal: (s, amount) => {
      if (s === 'player') game.heal(amount);
      else c.enemyHp = Math.min(fighter('enemy').maxHp, c.enemyHp + amount);
    },
    get acting() {
      return acting;
    },
    get lastDamage() {
      return lastDamage;
    },
    effectStat: (s, name, effectId) => {
      const lists = [sideBonuses(game, s), ...(s === 'player' ? [game.bonuses()] : [])];
      let v = 0;
      for (const list of lists) {
        for (const b of list) {
          if (b.Stat.StatsType !== `${NS}CombatEffect` || b.Stat.Name !== name) continue;
          const eff = (b.LocalContext as { Effect?: string | null } | null)?.Effect;
          if (!eff || eff === effectId) v += b.Value;
        }
      }
      return v;
    },
    ticks: toTicks,
  };
}

/** Damage from an effect (ModifyEffectDamage), with effect lifesteal. Handles a death; returns true if one happened. */
function effectDamage(game: Game, target: Side, amount: number, source: Side, effectId: string): boolean {
  // Ward soaks effect damage entirely while it lasts.
  if (target === 'enemy' && (game.state.combat.enemyWard ?? 0) > 0) return false;
  const ops = fightOps(game);
  const { player, enemy } = fighters(game);
  const src = source === 'player' ? player : enemy;
  const tgt = target === 'player' ? player : enemy;
  const c = game.state.combat;
  // Damage dealt and taken (plus the effect's own damage taken), resistance, then armour unless it is broken.
  const srcElement = source === 'player' ? playerElement(game) : (enemyData(c.enemy!) as { Element?: string }).Element;
  const taken = (tgt.mods.PercentDamageTaken ?? 0) + ops.effectStat(source, 'PercentDamageTaken', effectId) + targetStat(game, target, 'PercentDamageTakenFrom', src, srcElement);
  let n = amount * (1 + (src.mods.PercentDamageDealt ?? 0)) * (1 + taken);
  if (source !== target) n *= 1 - resistanceAgainst(game, src, tgt, target, srcElement);
  if (!(target === 'enemy' && c.enemyArmourBroken)) n -= armour(tgt);
  const dealt = Math.max(1, Math.floor(n));
  if (source === 'player' && target === 'enemy') {
    const n = Math.min(dealt, game.state.combat.enemyHp);
    questEvent(game, 'CombatDamageDealtByEffect', (d) => (goalMatches(d, 'CombatEffect', effectId) ? n : 0), combatContext(game));
  }
  // Effect lifesteal (e.g. a bleed that feeds its source) heals whoever applied it; so does the source's own lifesteal
  // (TargetHealthDamagedHandler heals on any damage the character deals).
  const steal = ops.effectStat(source, 'EffectLifesteal', effectId);
  const hpBefore = ops.hp(target);
  const died = applyDamage(game, target, dealt);
  if (!died && game.state.active?.skill === 'Combat' && source !== target) {
    if (steal > 0) ops.heal(source, Math.max(1, Math.floor(dealt * steal)));
    lifesteal(game, source, src, Math.min(dealt, hpBefore));
  }
  return died;
}

/** An enemy's Ward pool (Will-o'-Wisps, Spirit Stags) and armour, from its stats. */
const enemyStat = (id: string, stat: string) => enemyData(id).Stats.Stats.find((s) => s.Stat === NS + stat)?.Value ?? 0;
export const enemyMaxWard = (id: string) => enemyStat(id, 'MaximumWard');

/**
 * Attack damage after the defender's modifiers (CharacterComponent.ModifyAttackDamage): damage dealt/taken bonuses,
 * resistance, the Ward's share still up, then armour (unless broken). Also reports what the Ward soaked.
 */
function modifyAttackDamage(raw: number, a: Fighter, d: Fighter, wardShare: number, armourBroken: boolean, res: number): { dealt: number; negated: number; armourValue: number } {
  const base = raw * (1 + (a.mods.PercentDamageDealt ?? 0)) * (1 + (d.mods.PercentDamageTaken ?? 0));
  const afterRes = base * (1 - res);
  const afterWard = afterRes * (1 - wardShare);
  const armourValue = armour(d);
  return { dealt: Math.max(Math.floor(afterWard - (armourBroken ? 0 : armourValue)), 1), negated: Math.floor(afterRes - afterWard), armourValue };
}

/** How much of `a`'s damage the defender (`dSide`) resists, with its resistance bonuses against that attacker. */
function resistanceAgainst(game: Game, a: Fighter, d: Fighter, dSide: Side, aElement?: string): number {
  return resistance(
    a,
    d,
    d.mods.ResistanceCombatTriangle ?? 0,
    targetStat(game, dSide, 'FlatResistance', a, aElement),
    targetStat(game, dSide, 'PercentResistance', a, aElement),
  );
}

/** Lifesteal heals a character on any damage it deals, attacks and effects alike (CharacterComponent.Lifesteal). */
function lifesteal(game: Game, side: Side, f: Fighter, dealt: number): void {
  const ls = (f.mods.DisableLifesteal ?? 0) > 0 ? 0 : f.stats.Lifesteal ?? 0;
  if (ls <= 0 || dealt <= 0) return;
  const healed = Math.max(1, Math.floor(dealt * ls));
  fightOps(game).heal(side, healed);
  if (side === 'player') questEvent(game, 'CombatStealHitpoints', () => healed, combatContext(game));
}

/** Both fighters as they stand right now, each with the combat triangle against the other. */
function fighters(game: Game): { player: Fighter; enemy: Fighter } {
  const e0 = liveEnemyFighter(game);
  const player = playerFighter(game, e0.style.Id);
  return { player, enemy: liveEnemyFighter(game, undefined, player.style.Id) };
}

/** Take HP off a side and handle death (enemy killed, or you die). Returns true if that side died. */
function applyDamage(game: Game, target: Side, dealt: number): boolean {
  const c = game.state.combat;
  if (target === 'enemy') {
    const hit = Math.min(c.enemyHp, dealt);
    c.enemyHp -= hit;
    c.damageDealt += hit;
    if (c.enemyHp <= 0) {
      enemyKilled(game);
      return true;
    }
    return false;
  }
  c.damageTaken += dealt;
  if (game.damage(dealt)) {
    deathPenalty(game);
    clearEffects(game);
    game.stop('You died in combat.');
    return true;
  }
  return false;
}

function rollAttack(list: { Attack: string; Chance: number }[] | null | undefined, game: Game): string {
  const roll = game.rng.next();
  let acc = 0;
  for (const a of list ?? []) {
    acc += a.Chance;
    if (roll < acc) return a.Attack;
  }
  return `${NS}Normal`;
}

/** Your attack: a spell's own attack when casting one, else your weapon's special attacks by chance, else a normal hit. */
function playerAttackId(game: Game, p: Fighter): string {
  const sp = game.state.combat.spell;
  const override = p.style.UsesSpells && sp ? (spellData(sp) as { AttackOverride?: string | null }).AttackOverride : null;
  if (override) return override;
  return rollAttack((equipmentCap(weaponOf(game)) as { Attacks?: { Attack: string; Chance: number }[] | null } | undefined)?.Attacks, game);
}

/**
 * One attack from `side`: every hit of it, with immunity, accuracy, damage formulas, crits, negation, reflection,
 * lifesteal, pre-hit and on-hit effects, and the attacker's and defender's triggers. Returns false if the fight ended.
 */
function performAttack(game: Game, side: Side, atk: FullAttack, a: Fighter, d: Fighter, aElement?: string): boolean {
  const c = game.state.combat;
  const ops = fightOps(game);
  const foe = other(side);
  // Darkness only ever weakens the player: its accuracy when attacking, its evasion when defending.
  const dark = darkness(game, c.area!);
  const aDark = side === 'player' ? dark : 0;
  const dDark = foe === 'player' ? dark : 0;
  const aTriggers = triggersFor(game, side);
  const dTriggers = triggersFor(game, foe);
  const immune = targetStat(game, foe, 'ImmunityFrom', a, aElement) > 0;
  const extraTaken = targetStat(game, foe, 'PercentDamageTakenFromAttacks', a, aElement);
  let attacks = 0;
  let hits = 0;
  for (const hit of atk.Hits) {
    for (let i = 0; i < hit.Count; i++) {
      for (const e of atk.PreHitEffects) if (game.rng.chance(e.Chance)) applyEffect(game, e.Effect, e.AppliesTo === 'Self' ? side : foe, side, ops, e.AppliesTo !== 'Self' && immune);
      const avoided = side === 'enemy' && atk.IsAvoidable && game.rng.chance(Math.min(1, d.mods.AvoidanceChance ?? 0));
      const landed =
        !immune && !avoided && (!atk.IsAvoidable || game.rng.chance(hitChance(accuracyRating(a, aDark), evasionRating(d, a.stance, dDark), a.mods.FlatHitChance ?? 0)));
      attacks++;
      let dealt = 0;
      let crit = false;
      if (landed) {
        const max = maxHit(a, a.mods.MaxHitCombatTriangle ?? 0);
        let raw = 0;
        for (const dmg of hit.Damage) {
          const who = dmg.Character === 'Defender' ? d : a;
          const whoSide = dmg.Character === 'Defender' ? foe : side;
          const pct = dmg.Formula.Data.Percent ?? 1;
          switch (local(dmg.Formula.Type)) {
            case 'CurrentHitpoints':
              raw += Math.floor(ops.hp(whoSide) * pct);
              break;
            case 'MaxHit':
              raw += Math.floor(maxHit(who, who.mods.MaxHitCombatTriangle ?? 0) * pct);
              break;
            case 'Fixed':
              raw += dmg.Formula.Data.Damage ?? 0;
              break;
            default:
              raw += Math.floor(game.rng.intInclusive(minHit(a, max), max) * pct);
          }
        }
        if (game.rng.chance(Math.max(0, Math.min(1, a.mods.FlatCriticalHitChance ?? 0)))) {
          raw = Math.floor(raw * Math.max(1, 1.5 + (a.mods.FlatCriticalHitMultiplier ?? 0)));
          crit = true;
        }
        if (game.rng.chance(d.mods.AttackDamageNegationChance ?? 0)) raw = 0;
        if (raw > 0) {
          const dd: Fighter = { ...d, mods: { ...d.mods, PercentDamageTaken: (d.mods.PercentDamageTaken ?? 0) + extraTaken } };
          const maxWard = foe === 'enemy' ? enemyMaxWard(c.enemy!) : 0;
          const wardShare = maxWard > 0 ? (c.enemyWard ?? 0) / maxWard : 0;
          // Resistance changes against this attacker (e.g. Exsanguinate: −1% resistance a stack).
          const m = modifyAttackDamage(raw, a, dd, wardShare, foe === 'enemy' && !!c.enemyArmourBroken, resistanceAgainst(game, a, d, foe, aElement));
          dealt = Math.min(ops.hp(foe), m.dealt);
          if (foe === 'enemy') {
            if (m.negated > 0) {
              questEvent(game, 'CombatDamageNegatedByWard', () => m.negated, combatContext(game));
              game.stat('CombatTotalDamageNegatedByWard', m.negated);
            }
            // A hit at least as big as the armour breaks it for the rest of the fight.
            if (m.armourValue > 0 && m.dealt >= m.armourValue) c.enemyArmourBroken = true;
            // Each landed hit wears 1 Ward off (2 with a double ward damage bonus).
            if ((c.enemyWard ?? 0) > 0) c.enemyWard = Math.max(0, (c.enemyWard ?? 0) - (game.rng.chance(a.mods.DoubleWardDamageChance ?? 0) ? 2 : 1));
          }
        }
        hits++;
      }
      lastDamage = dealt;
      // For the fight screen's hit / miss splats.
      game.signal({ type: 'hit', target: foe, damage: dealt, landed, crit });
      if (side === 'player' && dealt > 0) {
        const gctx = combatContext(game);
        questEvent(game, 'CombatDamageEnemy', () => dealt, gctx);
        questEvent(game, 'CombatSingleHitDamage', (q) => (dealt >= Number(q.MinDamage ?? 0) ? 1 : 0), gctx);
        // Combat XP is per point of damage, split by the stance (e.g. Stab: 0.4 Attack + 0.133 Hitpoints).
        for (const g of a.stance.ExperienceGain) game.addXp(local(g.Component.Entity), g.ExperiencePerDamage * dealt);
        if (c.prayers.length) game.addXp('Prayer', Math.sqrt(3 + 0.2 * dealt * prayerTurnCost(game)));
      }
      if (side === 'enemy' && !landed) questEvent(game, 'CombatEvadeAttacks', () => 1, combatContext(game));
      if (side === 'enemy') consumeOnDefended(game, landed);
      if (dealt > 0) {
        // Lifesteal heals the attacker; reflection hurts it, but never below 1 HP.
        if (applyDamage(game, foe, dealt)) return false;
        lifesteal(game, side, a, dealt);
        const reflect = Math.floor(dealt * (d.mods.PercentAttackReflect ?? 0));
        if (reflect > 0) {
          let n = reflect * (1 + (d.mods.PercentDamageDealt ?? 0)) * (1 + (a.mods.PercentDamageTaken ?? 0));
          n *= 1 - resistanceAgainst(game, d, a, side);
          if (!(side === 'enemy' && c.enemyArmourBroken)) n -= armour(a);
          const back = Math.min(Math.max(1, Math.floor(n)), ops.hp(side) - 1);
          if (back > 0) applyDamage(game, side, back);
        }
      }
      if (landed) for (const e of atk.OnHitEffects) if (game.rng.chance(e.Chance)) applyEffect(game, e.Effect, e.AppliesTo === 'Self' ? side : foe, side, ops, e.AppliesTo !== 'Self' && immune);
      // Triggers, as the desktop names them.
      const first = attacks === 1;
      fireTriggers(game, aTriggers, side, 'OnAttack', ops, immune);
      if (first) fireTriggers(game, aTriggers, side, 'OnFirstAttack', ops, immune);
      fireTriggers(game, dTriggers, foe, 'WhenAttacked', ops);
      if (first) fireTriggers(game, dTriggers, foe, 'WhenFirstAttacked', ops);
      if (landed) {
        fireTriggers(game, aTriggers, side, 'OnHit', ops, immune);
        if (hits === 1) fireTriggers(game, aTriggers, side, 'OnFirstHit', ops, immune);
        if (first) fireTriggers(game, aTriggers, side, 'OnFirstAttackHit', ops, immune);
        fireTriggers(game, dTriggers, foe, 'WhenHit', ops);
        if (hits === 1) fireTriggers(game, dTriggers, foe, 'WhenFirstHit', ops);
      } else {
        fireTriggers(game, aTriggers, side, 'OnMiss', ops, immune);
        if (attacks - hits === 1) fireTriggers(game, aTriggers, side, 'OnFirstMiss', ops, immune);
        if (first) fireTriggers(game, aTriggers, side, 'OnFirstAttackMiss', ops, immune);
        fireTriggers(game, dTriggers, foe, 'WhenAttackEvaded', ops);
        if (attacks - hits === 1) fireTriggers(game, dTriggers, foe, 'WhenFirstAttackEvaded', ops);
      }
      afterAttack(game, side, ops);
      afterDefended(game, foe, ops);
      if (c.phase !== 'fighting' || game.state.active?.skill !== 'Combat') return false;
    }
  }
  return true;
}

/** End a side's turn: its effects tick. Returns false if the fight ended (an end-of-turn effect killed someone). */
function finishTurn(game: Game, side: Side): boolean {
  const died = endTurn(game, side, fightOps(game));
  acting = null;
  return !died && game.state.combat.phase === 'fighting' && game.state.active?.skill === 'Combat';
}

/**
 * Multi-hit attacks space their hits by each hit's Interval, and the next turn only starts after the last one
 * (CharacterComponent's hit timer). The hits still land together here, so the time between them goes on the next turn.
 */
export function hitSpacing(atk: FullAttack): number {
  let ms = 0;
  let first = true;
  for (const h of atk.Hits) {
    for (let i = 0; i < h.Count; i++) {
      if (!first) ms += h.Interval ?? 0;
      first = false;
    }
  }
  return Math.round(ms / TICK_MS);
}

function playerTurn(game: Game): boolean {
  const c = game.state.combat;
  const e = liveEnemyFighter(game);
  const p = playerFighter(game, e.style.Id);
  c.playerLeft = c.playerTurn = toTicks(attackInterval(p));
  acting = 'player';
  chargePrayers(game, 'player');
  chargeImbuement(game);
  // A stunned character loses its turn (the turn still ends, so the stun counts down).
  if (isStunned(game, 'player')) return finishTurn(game, 'player');
  const cost = attackCost(game, p);
  if (typeof cost === 'string') {
    acting = null;
    game.stop(cost);
    return false;
  }
  const atk = attackData(playerAttackId(game, p)) as unknown as FullAttack;
  payAttack(game, cost.items, atk.Hits.reduce((n, h) => n + h.Count, 0));
  game.signal({ type: 'attack', weaponType: weaponCap(weaponOf(game))?.Type });
  game.toolbeltTrigger('CharacterAttacked', { entity: 'Combat' });
  const enemyAsDefender = liveEnemyFighter(game, undefined, p.style.Id);
  const spacing = hitSpacing(atk);
  c.playerLeft += spacing;
  c.playerTurn = c.playerLeft;
  if (!performAttack(game, 'player', atk, p, enemyAsDefender, playerElement(game))) {
    acting = null;
    return game.state.active?.skill === 'Combat';
  }
  return finishTurn(game, 'player');
}

function enemyTurn(game: Game): boolean {
  const c = game.state.combat;
  const e0 = enemyData(c.enemy!);
  const stanceId = game.rng.weighted(e0.Stances).Stance;
  const p0 = playerFighter(game);
  const e = liveEnemyFighter(game, stanceId, p0.style.Id);
  const p = playerFighter(game, e.style.Id);
  c.enemyLeft = c.enemyTurn = toTicks(attackInterval(e));
  acting = 'enemy';
  chargePrayers(game, 'enemy');
  if (isStunned(game, 'enemy')) return finishTurn(game, 'enemy');
  const atk = attackData(rollAttack(e0.Attacks, game)) as unknown as FullAttack;
  c.enemyLeft += hitSpacing(atk);
  c.enemyTurn = c.enemyLeft;
  if (!performAttack(game, 'enemy', atk, e, p, (e0 as { Element?: string }).Element)) {
    acting = null;
    return game.state.active?.skill === 'Combat';
  }
  return finishTurn(game, 'enemy');
}

/** Auto-eating can trigger effects (FoodEaten triggers on gear). */
export function onFoodEaten(game: Game): void {
  if (game.state.active?.skill !== 'Combat' || game.state.combat.phase !== 'fighting') return;
  fireTriggers(game, triggersFor(game, 'player'), 'player', 'FoodEaten', fightOps(game));
}

/** Effects on a side for display: name, and turns, stacks or attacks left. */
export function effectsView(game: Game, side: Side): { name: string; detail: string; positive: boolean; icon?: string }[] {
  return effectsOn(game, side).map((e) => {
    const data = effectData(e.kind, NS + e.id);
    const detail =
      e.turns != null ? `${e.turns} turn${e.turns === 1 ? '' : 's'}` : e.attacks != null ? `${e.attacks} attack${e.attacks === 1 ? '' : 's'}` : e.stacks > 1 ? `×${e.stacks}` : '';
    return { name: data?.DisplayName ?? e.id, detail, positive: !!data?.IsPositive, icon: data?.Icon };
  });
}

/** On death you lose the item in one random equipment slot (10% of a stack), unless a bonus prevents it. */
function deathPenalty(game: Game): void {
  if ((playerFighter(game).mods.NoDeathPenalty ?? 0) > 0) return;
  const slots = equipmentSlots();
  const slot = NS + slots[game.rng.intInclusive(0, slots.length - 1)].Id;
  const e = equipped(game, slot);
  if (!e) return;
  const cap = equipmentCap(e.item);
  const lost = cap?.CanEquipQuantity ? Math.max(1, Math.floor(e.qty * 0.1)) : e.qty;
  e.qty -= lost;
  if (e.qty <= 0) delete game.state.equipment[slot];
  game.notice(`You lost ${lost} ${itemName(e.item, lost)}.`);
  game.bonusesChanged();
}

function nextEventTicks(game: Game): number {
  const c = game.state.combat;
  if (c.phase === 'spawning') return c.spawnLeft;
  const proc = nextProc(game);
  return Math.min(c.playerLeft, c.enemyLeft, proc ?? Infinity);
}

export interface AreaRecipe extends SkillRecipe {
  UnlockRequirements: Requirement[] | null;
}

export const combat: SkillHandler = {
  skill: 'Combat',
  recipes: () => [],
  recipe: (id) => {
    const a = area(id);
    return { Id: a.Id, DisplayName: a.DisplayName, BaseExperience: 0, Requirements: a.UnlockRequirements, DisplayRequirements: a.DisplayRequirements };
  },
  interval: (game) => {
    const c = game.state.combat;
    c.dungeonStage = 0;
    c.dungeonCount = 0;
    c.paused = false;
    c.loot = { items: {}, currencies: {}, kills: 0, since: game.state.tick };
    clearEffects(game);
    startSpawning(game);
    c.pending = c.spawnLeft;
    return c.spawnLeft * TICK_MS;
  },
  canStart(game, id) {
    if (game.isDemoLocked(area(id).UnlockRequirements)) return 'Not in demo';
    const p = playerFighter(game);
    const cost = attackCost(game, p);
    return typeof cost === 'string' ? cost : null;
  },
  fire(game) {
    const c = game.state.combat;
    // Paused: nothing moves; check back in a second.
    if (c.paused) {
      c.pending = 0;
      return 1000;
    }
    const elapsed = c.pending;
    if (c.phase === 'spawning') {
      c.spawnLeft -= elapsed;
      if (c.spawnLeft <= 0) spawn(game);
    } else {
      c.playerLeft -= elapsed;
      c.enemyLeft -= elapsed;
      // Damage over time runs on its own timers between turns.
      const died = tickDamageOverTime(game, elapsed, fightOps(game));
      if (died === 'player' || game.state.active?.skill !== 'Combat') return null;
      // The player acts first when both turns land on the same tick.
      if (c.phase === 'fighting' && c.playerLeft <= 0 && !playerTurn(game)) {
        if (game.state.active?.skill !== 'Combat') return null;
      }
      if (c.phase === 'fighting' && c.enemyLeft <= 0 && !enemyTurn(game)) {
        if (game.state.active?.skill !== 'Combat') return null;
      }
    }
    c.pending = Math.max(1, nextEventTicks(game));
    return c.pending * TICK_MS;
  },
};

/** What an enemy (or a dungeon's reward) can drop, with the chance of each per kill. */
export function dropChances(d: Drops): { item: string; chance: number; min: number; max: number }[] {
  const out: { item: string; chance: number; min: number; max: number }[] = [];
  for (const f of d.FixedItems) out.push({ item: f.Item, chance: 1, min: f.MinQuantity, max: f.MaxQuantity });
  for (const t of d.ItemTables) {
    const total = t.Table.reduce((s, x) => s + (x.Weight ?? 1), 0) || 1;
    for (const x of t.Table) out.push({ item: x.Item, chance: (t.Chance * (x.Weight ?? 1)) / total, min: x.MinQuantity, max: x.MaxQuantity });
  }
  return out;
}

/** Start the loot history over (the desktop's Reset). */
export function resetLoot(game: Game): void {
  game.state.combat.loot = { items: {}, currencies: {}, kills: 0, since: game.state.tick };
  game.emit();
}

export function togglePause(game: Game): void {
  const c = game.state.combat;
  const a = game.state.active;
  if (a?.skill === 'Combat') {
    // Settle the turn time that ran before pausing, then re-check on the next tick. Pausing and resuming both restart
    // the wait, so time spent paused never comes off the turn timers.
    if (!c.paused) {
      const since = Math.max(0, c.pending - a.ticksLeft);
      if (c.phase === 'spawning') c.spawnLeft -= since;
      else {
        c.playerLeft -= since;
        c.enemyLeft -= since;
      }
    }
    // Resuming, the one-tick wait is fight time and counts; pausing, it doesn't.
    c.pending = c.paused ? 1 : 0;
    a.waitTicks = a.ticksLeft = 1;
  }
  c.paused = !c.paused;
  game.emit();
}

/** Start fighting a specific enemy in an area (or a dungeon run). */
export function fight(game: Game, areaId: string, enemyId: string | null): void {
  if (enemyId && !areaEnemies(areaId).includes(enemyId)) throw new Error(`${enemyId} is not in ${areaId}`);
  game.state.combat.area = areaId;
  game.state.combat.selectedEnemy = enemyId;
  const a = game.state.active;
  if (a?.skill === 'Combat') game.stop();
  game.toggle('Combat', areaId);
}

export const slayerMasters = () => allSlayerMasters();

/** The fight's situation, for guild goal conditions (enemy level, your style and stance, slayer task, prayers). */
export function combatContext(game: Game): GoalContext {
  const c = game.state.combat;
  const p = playerFighter(game);
  const e = c.enemy ? enemyFighter(c.enemy) : null;
  return {
    enemyLevel: e ? combatLevel(e, e.style) : undefined,
    style: NS + p.style.Id,
    stance: NS + p.stance.Id,
    onSlayerTask: !!c.slayer && c.slayer.left > 0 && c.slayer.enemy === c.enemy,
    prayerCost: c.prayers.reduce((s, x) => s + prayerData(x).Cost.Quantity, 0),
    enemyArmour: e ? armour(e) : undefined,
    enemyWard: c.enemy ? enemyMaxWard(c.enemy) : undefined,
  };
}
