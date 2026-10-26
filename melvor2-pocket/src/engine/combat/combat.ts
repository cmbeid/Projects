// Combat: the player and one enemy each attack on their own turn timer, as in CharacterComponent.
import { NS, itemName, type Requirement } from '../content';
import type { Game } from '../game';
import type { SkillHandler, SkillRecipe } from '../skills/types';
import { mod } from '../bonuses';
import { goalMatches, questEvent } from '../quests';
import {
  COMBAT_LEVELS, DEFAULT_WEAPON, type Bonus, type Drops, allSlayerMasters, area, attack as attackData, buryCap, enemy as enemyData,
  equipmentCap, equipmentSlots, isDungeon, prayer as prayerData, slayerMaster, spell as spellData, stance as stanceData,
  style as styleData, triangleBonuses, weaponCap, type Dungeon, type CombatArea,
} from './data';
import {
  type Fighter, accuracyRating, addStats, applyBonuses, attackInterval, evasionRating, hitChance, maxHit, minHit, reduceDamage,
} from './stats';

export const SPAWN_INTERVAL_MS = 3000;
const TICK_MS = 1000 / 60;
const toTicks = (ms: number) => Math.max(1, Math.round(ms / TICK_MS));
const local = (id: string) => id.replace(NS, '');

// ---- equipment ------------------------------------------------------------------------------

export function equipped(game: Game, slot: string): { item: string; qty: number } | undefined {
  return game.state.equipment[slot];
}

/** Slots an item goes into: its type's slot (rings fill the first free ring slot), plus any slots it occupies. */
function targetSlot(game: Game, itemId: string): string | null {
  const cap = equipmentCap(itemId);
  if (!cap) return null;
  const fits = equipmentSlots().filter((s) => s.FitsType === cap.Type);
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

function triangle(playerStyle: string, enemyStyle: string, who: 'Player' | 'Enemy'): Bonus[] {
  return triangleBonuses()
    .filter((t) => t.PlayerStyle === playerStyle && t.EnemyStyle === enemyStyle)
    .flatMap((t) => t.Bonuses.Component)
    .filter((b) => b.LocalContext?.Component?.Component === who);
}

/** Bonuses only apply when their CombatStyle (if any) matches. */
const forStyle = (bonuses: Bonus[], styleId: string) =>
  bonuses.filter((b) => !b.LocalContext?.CombatStyle || b.LocalContext.CombatStyle === styleId);

export function playerFighter(game: Game, enemyStyle?: string): Fighter {
  const levels: Record<string, number> = {};
  for (const l of COMBAT_LEVELS) levels[l] = game.level(l);
  const st = stanceData(currentStance(game));
  const sty = styleData(st.CombatStyle);
  const f: Fighter = { levels, stats: {}, power: 0, protection: 0, stance: st, style: sty, mods: {}, maxHp: game.maxHp() };
  const items = Object.values(game.state.equipment).map((e) => e.item);
  if (!equipped(game, `${NS}Weapon`)) items.push(DEFAULT_WEAPON);
  for (const it of items) {
    const cap = equipmentCap(it);
    const pr = addStats(f.stats, cap?.Stats);
    f.power += pr.power;
    f.protection += pr.protection;
    if (cap?.Bonuses) applyBonuses(f, forStyle(cap.Bonuses.Component, sty.Id));
  }
  const sp = game.state.combat.spell;
  if (sty.UsesSpells && sp) addStats(f.stats, spellData(sp).Stats);
  for (const p of game.state.combat.prayers) applyBonuses(f, forStyle(prayerData(p).Bonuses.Component, sty.Id));
  for (const b of game.globalBonuses()) if (b.Stat.StatsType === `${NS}Character`) applyBonuses(f, forStyle([b], sty.Id));
  if (enemyStyle) applyBonuses(f, triangle(sty.Id, enemyStyle, 'Player'));
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
  return f;
}

export const enemyMaxHp = (id: string) => enemyFighter(id).maxHp;

// ---- areas -------------------------------------------------------------------------------------

export function areaEnemies(id: string): string[] {
  const a = area(id);
  if (isDungeon(id)) return (a as Dungeon).Enemies.flatMap((s) => s.Enemies.map((e) => e.Enemy));
  return (a as CombatArea).Enemies;
}

function darkness(game: Game, areaId: string): number {
  const light = playerFighter(game).mods.FlatLight ?? 0;
  return Math.max(0, area(areaId).Darkness - light);
}

function rollDrops(game: Game, d: Drops): void {
  const doubling = mod(game, 'CombatLoot', 'ItemDoublingChance', { entity: 'Combat' });
  const add = (item: string, q: number) => game.addItem(item, game.rng.chance(doubling) ? q * 2 : q);
  for (const f of d.FixedItems) add(f.Item, game.rng.intInclusive(f.MinQuantity, f.MaxQuantity));
  for (const t of d.ItemTables) {
    if (!game.rng.chance(t.Chance) || !t.Table.length) continue;
    const pick = game.rng.weighted(t.Table.map((x) => ({ ...x, Weight: x.Weight ?? 1 })));
    add(pick.Item, game.rng.intInclusive(pick.MinQuantity, pick.MaxQuantity));
  }
  for (const c of d.FixedCurrencies) game.addCurrency(c.Currency, game.rng.intInclusive(c.MinQuantity, c.MaxQuantity));
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

export function slayerTaskRange(game: Game, masterId: string): [number, number] {
  const m = slayerMaster(masterId);
  return [Math.max(1, m.BaseTaskLength), Math.max(1, m.BaseTaskLength + 3 * game.level('Slayer'))];
}

export function newSlayerTask(game: Game, masterId: string): string | null {
  const m = slayerMaster(masterId);
  if (game.isDemoLocked(m.UnlockRequirements)) return 'Not in demo';
  if (!game.requirementsMet(m.UnlockRequirements)) return 'Locked';
  const c = game.state.combat;
  if (c.slayer && c.slayer.left > 0) {
    // Rerolling an active task costs slayer coins.
    if (game.currency(m.RerollCost.Currency) < m.RerollCost.Quantity) return `Need ${m.RerollCost.Quantity} slayer coins`;
    game.addCurrency(m.RerollCost.Currency, -m.RerollCost.Quantity);
  }
  const options = m.Areas.filter((a) => !game.isDemoLocked(area(a).UnlockRequirements))
    .flatMap((a) => areaEnemies(a))
    .filter((e) => !game.isDemoLocked(enemyData(e).Requirements));
  if (!options.length) return 'No enemies available';
  const [min, max] = slayerTaskRange(game, masterId);
  c.slayer = { master: masterId, enemy: options[game.rng.intInclusive(0, options.length - 1)], left: game.rng.intInclusive(min, max) };
  game.state.rng = game.rng.state;
  game.emit();
  return null;
}

function onSlayerKill(game: Game, enemyId: string): void {
  const t = game.state.combat.slayer;
  if (!t || t.enemy !== enemyId || t.left <= 0) return;
  const hp = enemyMaxHp(enemyId);
  game.addXp('Slayer', hp / 8 + 4);
  game.addCurrency(slayerMaster(t.master).RewardCurrency, Math.max(1, Math.floor(0.1 * hp ** 1.15)));
  t.left--;
  if (t.left === 0) {
    const done = game.state.combat.slayerTasksDone;
    done[t.master] = (done[t.master] ?? 0) + 1;
    game.notice('Slayer task complete!');
  }
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
    const sp = game.state.combat.spell;
    if (!sp) return 'Select a spell to fight with magic.';
    const costs = spellData(sp).RuneCosts;
    for (const r of costs) if (game.count(r.Item) < r.Quantity) return `You need ${r.Quantity} ${itemName(r.Item, r.Quantity)}.`;
    return { items: costs.map((r) => [r.Item, r.Quantity]) };
  }
  return { items: [] };
}

function payAttack(game: Game, items: [string, number][]): void {
  const ammoSaved = game.rng.chance(mod(game, 'AmmoConsumption', 'AmmoPreservationChance', { entity: 'Combat' }));
  const runesSaved = game.rng.chance(mod(game, 'MagicSpell', 'RunePreservationChance', { entity: 'Combat', spell: game.state.combat.spell ?? undefined }));
  for (const [id, q] of items) {
    if (id.startsWith('ammo:') ? ammoSaved : runesSaved) continue;
    if (id.startsWith('ammo:')) {
      const ammo = equipped(game, `${NS}Ammo`)!;
      ammo.qty -= q;
      if (ammo.qty <= 0) delete game.state.equipment[`${NS}Ammo`];
    } else {
      game.removeItem(id, q);
    }
  }
}

function startSpawning(game: Game): void {
  const c = game.state.combat;
  c.phase = 'spawning';
  c.enemy = null;
  c.spawnLeft = toTicks(SPAWN_INTERVAL_MS);
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
  const e = enemyFighter(c.enemy);
  c.playerLeft = toTicks(attackInterval(playerFighter(game, e.style.Id)));
  c.enemyLeft = toTicks(attackInterval(e));
}

function enemyKilled(game: Game): void {
  const c = game.state.combat;
  const id = c.enemy!;
  c.kills[id] = (c.kills[id] ?? 0) + 1;
  const styleId = playerFighter(game).style.Id;
  questEvent(game, 'CombatKillEnemy', (d) => (goalMatches(d, 'Enemy', id) && goalMatches(d, 'PlayerCombatStyle', NS + styleId) ? 1 : 0));
  rollDrops(game, enemyData(id).Drops);
  onSlayerKill(game, id);
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
      c.dungeonStage = 0;
      game.notice(`${d.DisplayName} complete!`);
    }
  }
  startSpawning(game);
}

function playerTurn(game: Game): boolean {
  const c = game.state.combat;
  const e = enemyFighter(c.enemy!);
  const p = playerFighter(game, e.style.Id);
  const cost = attackCost(game, p);
  if (typeof cost === 'string') {
    game.stop(cost);
    return false;
  }
  payAttack(game, cost.items);
  const dark = darkness(game, c.area!);
  const enemyAsDefender = enemyFighter(c.enemy!, undefined, p.style.Id);
  c.playerLeft = toTicks(attackInterval(p));
  if (!game.rng.chance(hitChance(accuracyRating(p, dark), evasionRating(enemyAsDefender, p.stance, dark), p.mods.FlatHitChance ?? 0))) return true;
  const max = maxHit(p, p.mods.MaxHitCombatTriangle ?? 0);
  let raw = game.rng.intInclusive(minHit(p, max), max);
  if (game.rng.chance(Math.max(0, Math.min(1, p.mods.FlatCriticalHitChance ?? 0)))) raw = Math.floor(raw * Math.max(1, 1.5 + (p.mods.FlatCriticalHitMultiplier ?? 0)));
  const dealt = Math.min(c.enemyHp, reduceDamage(raw, p, enemyAsDefender, enemyAsDefender.mods.ResistanceCombatTriangle ?? 0));
  c.enemyHp -= dealt;
  c.damageDealt += dealt;
  // Combat XP is per point of damage, split by the stance (e.g. Stab: 0.4 Attack + 0.133 Hitpoints).
  for (const g of p.stance.ExperienceGain) game.addXp(local(g.Component.Entity), g.ExperiencePerDamage * dealt);
  if (c.prayers.length) {
    const cost = c.prayers.reduce((s, x) => s + prayerData(x).Cost.Quantity, 0);
    game.addXp('Prayer', Math.sqrt(3 + 0.2 * dealt * cost));
  }
  if (c.enemyHp <= 0) {
    enemyKilled(game);
    return true;
  }
  return true;
}

function rollEnemyAttack(game: Game, id: string): string {
  const specials = enemyData(id).Attacks;
  const roll = game.rng.next();
  let acc = 0;
  for (const a of specials) {
    acc += a.Chance;
    if (roll < acc) return a.Attack;
  }
  return `${NS}Normal`;
}

function enemyTurn(game: Game): boolean {
  const c = game.state.combat;
  const e0 = enemyData(c.enemy!);
  const stanceId = game.rng.weighted(e0.Stances).Stance;
  const p0 = playerFighter(game);
  const e = enemyFighter(c.enemy!, stanceId, p0.style.Id);
  const p = playerFighter(game, e.style.Id);
  c.enemyLeft = toTicks(attackInterval(e));
  // Prayers drain their cost at the start of each enemy attack turn.
  if (c.prayers.length) {
    const cost = c.prayers.reduce((s, x) => s + prayerData(x).Cost.Quantity, 0);
    if (game.rng.chance(mod(game, 'Prayer', 'CostPreservationChance', { entity: 'Combat' }))) {
      // preserved: no cost this turn
    } else if (prayerPoints(game) >= cost) game.addCurrency(`${NS}PrayerPoints`, -cost);
    else {
      c.prayers = [];
      game.notice('You ran out of prayer points.');
      game.bonusesChanged();
    }
  }
  const atk = attackData(rollEnemyAttack(game, c.enemy!));
  const dark = darkness(game, c.area!);
  for (const hit of atk.Hits) {
    for (let i = 0; i < hit.Count; i++) {
      if (atk.IsAvoidable && game.rng.chance(Math.min(1, p.mods.AvoidanceChance ?? 0))) continue;
      if (!game.rng.chance(hitChance(accuracyRating(e, dark), evasionRating(p, e.stance, dark)))) continue;
      const max = maxHit(e, e.mods.MaxHitCombatTriangle ?? 0);
      let raw = 0;
      for (const d of hit.Damage) {
        const pct = d.Formula.Data.Percent ?? 1;
        const kind = local(d.Formula.Type);
        if (kind === 'CurrentHitpoints') raw += Math.floor(game.hp() * pct);
        else if (kind === 'MaxHit') raw += Math.floor(max * pct);
        else raw += Math.floor(game.rng.intInclusive(minHit(e, max), max) * pct);
      }
      const dealt = reduceDamage(Math.max(1, raw), e, p, p.mods.ResistanceCombatTriangle ?? 0);
      c.damageTaken += dealt;
      if (game.damage(dealt)) {
        deathPenalty(game);
        game.stop('You died in combat.');
        return false;
      }
    }
  }
  return true;
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
  return c.phase === 'spawning' ? c.spawnLeft : Math.min(c.playerLeft, c.enemyLeft);
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
    const elapsed = c.pending;
    if (c.phase === 'spawning') {
      c.spawnLeft -= elapsed;
      if (c.spawnLeft <= 0) spawn(game);
    } else {
      c.playerLeft -= elapsed;
      c.enemyLeft -= elapsed;
      // The player acts first when both turns land on the same tick.
      if (c.playerLeft <= 0 && !playerTurn(game)) return null;
      if (c.phase === 'fighting' && c.enemyLeft <= 0 && !enemyTurn(game)) return null;
    }
    c.pending = Math.max(1, nextEventTicks(game));
    return c.pending * TICK_MS;
  },
};

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
