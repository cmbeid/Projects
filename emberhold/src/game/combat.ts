/**
 * Combat. Player and enemy run swing timers on the game clock; `stepCombat`
 * jumps from one event to the next, so an hour offline costs as much as
 * the swings in it, not the ticks.
 *
 * Damage types are where build variety comes from: every monster resists
 * some types and is weak to others, so the best weapon depends on what you
 * are fighting.
 */
import { AREA, AURORA, MONSTER, PRAYER, SLAYER_TIERS, SPELL, SPELLS, slayerPool } from '../data/combat';
import { ITEM, item } from '../data/items';
import { PET } from '../data/meta';
import { METALS, ROBES, WOODS, HIDES } from '../data/tiers';
import { SLOTS, type CombatStyle, type DamageType, type Item, type Monster, type Mods, type Slot } from '../data/types';
import type { CombatState, Equipment, GameState, Stack } from '../state/types';
import { addItem, bump, combatLevel, count, grantXp, guildRep, invalidate, level, notice, removeItem } from './core';
import { addMods, combatMods, get, xpMult } from './modifiers';
import { allMet, describe } from './requirements';
import { chance, pick, rand, randInt, roll } from './rng';
import { useCharges } from './skilling';

export const LOOT_SLOTS = 16;
export const RESPAWN = 2500;
const UNARMED: Item = { id: 'unarmed', name: 'Fists', category: 'weapon', sell: 0, icon: 'ui.fist', equip: { slot: 'weapon', style: 'melee', damageType: 'crush', speed: 2400, accuracy: 0, power: 0 } };

// --- Raid (the Gauntlet) -----------------------------------------------------------

export const RAID_BOONS: { id: string; name: string; mods: Mods }[] = [
  { id: 'might', name: 'Might', mods: { meleeMaxHit: 12, rangedMaxHit: 12, magicMaxHit: 12 } },
  { id: 'precision', name: 'Precision', mods: { meleeAccuracy: 15, rangedAccuracy: 15, magicAccuracy: 15 } },
  { id: 'bulwark', name: 'Bulwark', mods: { damageReduction: 6 } },
  { id: 'vitality', name: 'Vitality', mods: { maxHP: 15 } },
  { id: 'vampirism', name: 'Vampirism', mods: { lifesteal: 4 } },
  { id: 'haste', name: 'Haste', mods: { attackInterval: -8 } },
  { id: 'renewal', name: 'Renewal', mods: { hpRegen: 200 } },
  { id: 'feast', name: 'Feast', mods: { foodHeal: 30 } },
  { id: 'fortune', name: 'Fortune', mods: { raidCoins: 15 } },
  { id: 'ironhide', name: 'Ironhide', mods: { 'resist:pure': 0.1, damageReduction: 3 } },
];
export const RAID_BOON = new Map(RAID_BOONS.map((b) => [b.id, b]));
const RAID_PER_WAVE = 5;

export function raidMonster(wave: number, i: number): Monster {
  const boss = i === RAID_PER_WAVE - 1 && wave % 5 === 0;
  const lvl = 6 + wave * 4 + i;
  const styles: CombatStyle[] = ['melee', 'ranged', 'magic'];
  const style = styles[(wave + i) % 3]!;
  const name = boss ? 'Gauntlet Champion' : style === 'melee' ? 'Gauntlet Raider' : style === 'ranged' ? 'Gauntlet Archer' : 'Gauntlet Hexer';
  const base = (m: number): number => Math.round((lvl + 9) * (64 + lvl * 1.15 * m));
  return {
    id: `raid-${wave}-${i}`, name, icon: boss ? 'knight.green' : style === 'melee' ? 'humanoid.green' : style === 'ranged' ? 'humanoid.slime' : 'mage.green',
    combatLevel: lvl, hp: Math.round((lvl * 8 + 20) * (boss ? 3 : 1)), style, damageType: style === 'melee' ? 'slash' : style === 'ranged' ? 'pierce' : 'fire',
    speed: 2800, maxHit: Math.round((lvl * 1.7 + 8) * (boss ? 1.25 : 1)), accuracy: base(1), evasion: { melee: base(1), ranged: base(1), magic: base(1) },
    resist: {}, dr: Math.min(30, Math.floor(lvl / 5)), loot: { chance: 0, entries: [] }, gp: [0, 0], ...(boss ? { boss: true } : {}),
  };
}

function raidKit(s: GameState): Equipment {
  const r = s.raid!;
  const t = Math.min(7, Math.floor((r.wave - 1) / 3));
  const eq: Equipment = {};
  const one = (id: string): Stack => ({ item: id, qty: 1 });
  if (r.style === 'melee') {
    const m = METALS[t]!.id;
    eq.weapon = one(`${m}-sword`);
    for (const k of ['helmet', 'platebody', 'platelegs', 'shield'] as const) eq[ITEM.get(`${m}-${k}`)!.equip!.slot] = one(`${m}-${k}`);
  } else if (r.style === 'ranged') {
    eq.weapon = one(`${WOODS[Math.min(8, t + 1)]!.id}-longbow`);
    eq.ammo = { item: `${METALS[t]!.id}-arrows`, qty: 9999 };
    const h = HIDES[Math.min(5, t)]!.id;
    for (const k of ['coif', 'body', 'chaps', 'vambraces'] as const) eq[ITEM.get(`${h}-${k}`)!.equip!.slot] = one(`${h}-${k}`);
  } else {
    eq.weapon = one(t >= 4 ? 'battlestaff-fire' : 'staff-fire');
    const rb = ROBES[Math.min(4, Math.floor(t / 1.6))]!.id;
    for (const k of ['hat', 'top', 'bottom', 'boots'] as const) eq[ITEM.get(`${rb}-${k}`)!.equip!.slot] = one(`${rb}-${k}`);
  }
  return eq;
}

// --- Equipment -----------------------------------------------------------------

export function equipment(s: GameState): Equipment {
  return s.raid ? raidKit(s) : s.loadouts[s.loadout]!;
}

export function weapon(s: GameState): Item {
  const w = equipment(s).weapon;
  return w ? item(w.item) : UNARMED;
}

export function styleOf(s: GameState): CombatStyle {
  return weapon(s).equip?.style ?? 'melee';
}

/** Mods that apply to a fight: everything, or in the Gauntlet only its boons. */
export function fightMods(s: GameState): Mods {
  if (s.raid) {
    const m: Mods = {};
    for (const b of s.raid.boons) addMods(m, RAID_BOON.get(b)!.mods);
    return m;
  }
  const area = s.combat ? AREA.get(s.combat.area) : undefined;
  if (!area?.hazard) return combatMods(s);
  const m: Mods = { ...combatMods(s) };
  addMods(m, area.hazard.mods);
  return m;
}

export function bestSpell(s: GameState): string {
  const lvl = level(s, 'magic');
  return [...SPELLS].filter((sp) => sp.level <= lvl && sp.element !== 'void').pop()?.id ?? 'air-strike';
}

export function currentSpell(s: GameState): string {
  if (s.raid) return bestSpell(s);
  return s.spell && SPELL.get(s.spell) && SPELL.get(s.spell)!.level <= level(s, 'magic') ? s.spell : 'air-strike';
}

export interface PlayerStats {
  style: CombatStyle;
  damageType: DamageType;
  speed: number;
  accuracy: number;
  maxHit: number;
  evasion: Record<CombatStyle, number>;
  dr: number;
  maxHp: number;
  lifesteal: number;
  resist: Partial<Record<DamageType, number>>;
  protect: Record<CombatStyle, number>;
}

export function maxHp(s: GameState, m: Mods = fightMods(s)): number {
  return Math.round(level(s, 'hitpoints') * 10 * (1 + get(m, 'maxHP') / 100));
}

export function playerStats(s: GameState, m: Mods = fightMods(s)): PlayerStats {
  const eq = equipment(s);
  const w = weapon(s);
  const style = w.equip?.style ?? 'melee';
  let acc = 0;
  let pow = 0;
  let defMelee = 0;
  let defRanged = 0;
  let defMagic = 0;
  let dr = 0;
  const resist: Partial<Record<DamageType, number>> = {};
  for (const slot of SLOTS) {
    const st = eq[slot];
    if (!st) continue;
    const e = ITEM.get(st.item)?.equip;
    if (!e || ITEM.get(st.item)!.familiar) continue;
    if (slot === 'ammo' && style !== 'ranged') continue;
    acc += e.accuracy ?? 0;
    pow += e.power ?? 0;
    defMelee += e.defMelee ?? 0;
    defRanged += e.defRanged ?? 0;
    defMagic += e.defMagic ?? 0;
    dr += e.dr ?? 0;
  }
  for (const k of Object.keys(m)) if (k.startsWith('resist:')) resist[k.slice(7) as DamageType] = (resist[k.slice(7) as DamageType] ?? 0) + m[k]!;
  const L = (k: Parameters<typeof level>[1]): number => level(s, k);
  let damageType: DamageType = w.equip?.damageType ?? 'crush';
  let speed = w.equip?.speed ?? 2400;
  let accuracy: number;
  let maxHit: number;
  const defStyleBonus = (style === 'melee' && s.meleeStyle === 'defensive') || (style === 'ranged' && s.rangedStyle === 'longrange') || (style === 'magic' && s.magicStyle === 'defensive') ? 3 : 0;
  if (style === 'melee') {
    const effA = L('attack') + 8 + (s.meleeStyle === 'accurate' ? 3 : 0);
    const effS = L('strength') + 8 + (s.meleeStyle === 'aggressive' ? 3 : 0);
    accuracy = (effA + 9) * (acc + 64) * (1 + get(m, 'meleeAccuracy') / 100);
    maxHit = 10 * (1.3 + effS / 10 + pow / 80 + (effS * pow) / 640) * (1 + get(m, 'meleeMaxHit') / 100);
  } else if (style === 'ranged') {
    const effR = L('ranged') + 8 + (s.rangedStyle === 'accurate' ? 3 : 0);
    accuracy = (effR + 9) * (acc + 64) * (1 + get(m, 'rangedAccuracy') / 100);
    maxHit = 10 * (1.3 + effR / 10 + pow / 80 + (effR * pow) / 640) * (1 + get(m, 'rangedMaxHit') / 100);
    if (s.rangedStyle === 'rapid') speed *= 0.9;
  } else {
    const spell = SPELL.get(currentSpell(s))!;
    damageType = spell.element;
    const effM = L('magic') + 8;
    accuracy = (effM + 9) * (acc + 64) * (1 + get(m, 'magicAccuracy') / 100);
    maxHit = spell.maxHit * (1 + (pow + get(m, 'magicMaxHit')) / 100) * (1 + L('magic') / 400);
  }
  speed = Math.max(1000, speed * (1 + get(m, 'attackInterval') / 100));
  const effD = L('defence') + 8 + defStyleBonus;
  return {
    style, damageType, speed: Math.round(speed), accuracy: Math.round(accuracy), maxHit: Math.max(1, Math.round(maxHit)),
    evasion: {
      melee: Math.round((effD + 9) * (defMelee + 64)),
      ranged: Math.round((effD + 9) * (defRanged + 64)),
      magic: Math.round((Math.round(0.7 * L('magic') + 0.3 * L('defence')) + 8 + 9) * (defMagic + 64)),
    },
    dr: Math.min(85, Math.max(0, dr + get(m, 'damageReduction'))),
    maxHp: maxHp(s, m),
    lifesteal: get(m, 'lifesteal'),
    resist,
    protect: { melee: get(m, 'protect:melee'), ranged: get(m, 'protect:ranged'), magic: get(m, 'protect:magic') },
  };
}

export function hitChance(acc: number, eva: number): number {
  return acc < eva ? (0.5 * acc) / eva : 1 - (0.5 * eva) / acc;
}

/** +1 the player is strong against the enemy's style, −1 weak, 0 even. */
export function triangle(player: CombatStyle, enemy: CombatStyle): number {
  if (player === enemy) return 0;
  const beats: Record<CombatStyle, CombatStyle> = { melee: 'ranged', ranged: 'magic', magic: 'melee' };
  return beats[player] === enemy ? 1 : -1;
}

export function typeMult(m: Monster, t: DamageType): number {
  return 1 - (m.resist[t] ?? 0);
}

/** The average damage a swing does after hit chance, triangle and resistances. */
export function expectedDps(s: GameState, m: Monster): number {
  const p = playerStats(s);
  const tri = triangle(p.style, m.style);
  const avg = ((p.maxHit + 1) / 2) * (tri > 0 ? 1.1 : tri < 0 ? 0.85 : 1) * typeMult(m, p.damageType) * (1 - m.dr / 100);
  return (hitChance(p.accuracy, m.evasion[p.style]) * avg * 1000) / p.speed;
}

// --- Food and prayer ---------------------------------------------------------------

export function foodHeal(s: GameState, food: string): number {
  return Math.round((ITEM.get(food)?.heal ?? 0) * (1 + get(fightMods(s), 'foodHeal') / 100));
}

/** Eats one of the selected food. */
export function eat(s: GameState, efficiency = 1): boolean {
  if (s.raid) {
    if (s.raid.food <= 0) return false;
    s.raid.food--;
    s.hp = Math.min(maxHp(s), s.hp + Math.round(120 + s.raid.wave * 12));
    return true;
  }
  const slot = s.food[s.foodSlot] ? s.foodSlot : s.food.findIndex((f) => f && f.qty > 0);
  const st = slot >= 0 ? s.food[slot] : null;
  if (!st || st.qty <= 0) return false;
  s.hp = Math.min(maxHp(s), s.hp + Math.round(foodHeal(s, st.item) * efficiency));
  st.qty--;
  bump(s, 'eaten');
  if (st.qty <= 0) s.food[slot] = null;
  return true;
}

function autoEat(s: GameState, max: number): void {
  const tier = s.raid ? 3 : s.upgrades['autoeat'] ?? 0;
  if (!tier) return;
  const threshold = [0, 0.2, 0.3, 0.4][tier]!;
  const eff = [0, 0.6, 0.8, 1][tier]!;
  let guard = 20;
  while (s.hp < max * threshold && guard-- > 0) if (!eat(s, eff)) break;
}

// --- Starting and stopping -------------------------------------------------------

export function areaBlocker(s: GameState, areaId: string): string | null {
  const a = AREA.get(areaId);
  if (!a) return 'No such area';
  for (const r of a.req ?? []) if (!allMet(s, [r])) return `Needs ${describe(r)}`;
  if (a.needsWorn && !Object.values(s.loadouts[s.loadout]!).some((st) => st?.item === a.needsWorn)) {
    return `Wear a ${item(a.needsWorn).name}`;
  }
  return null;
}

export function startCombat(s: GameState, areaId: string, target: string | null = null): string | null {
  const why = areaBlocker(s, areaId);
  if (why) return why;
  const a = AREA.get(areaId)!;
  s.raid = null;
  s.activity = { kind: 'combat' };
  s.combat = newCombat(areaId, a.kind === 'dungeon' || a.kind === 'stronghold' ? null : target ?? a.monsters[0]!);
  return null;
}

function newCombat(area: string, target: string | null): CombatState {
  return { area, index: 0, target, enemy: null, playerTimer: 0, respawn: 600, regenTimer: 10_000, stun: 0, kills: 0 };
}

export function startRaid(s: GameState, style: CombatStyle): void {
  s.activity = { kind: 'combat' };
  s.raid = { style, wave: 1, killed: 0, boons: [], choice: null, food: 8, hp: 0 };
  s.combat = newCombat('raid', null);
  s.hp = maxHp(s);
}

export function stopCombat(s: GameState, why?: string): void {
  if (why) notice(s, why, 'bad');
  if (s.raid) endRaid(s);
  s.combat = null;
  if (s.activity?.kind === 'combat') s.activity = null;
}

function endRaid(s: GameState): void {
  const r = s.raid!;
  const waves = r.wave - 1;
  const coins = Math.round(((waves * (waves + 1)) / 2) * 5 * (1 + get(fightMods(s), 'raidCoins') / 100));
  s.raidCoins += coins;
  s.raidBest = Math.max(s.raidBest, waves);
  bump(s, 'raids');
  notice(s, `The Gauntlet is over: ${waves} wave${waves === 1 ? '' : 's'} cleared, ${coins} Gauntlet coins.`, 'good');
  s.raid = null;
  s.hp = maxHp(s);
}

export function chooseBoon(s: GameState, boon: string): void {
  const r = s.raid;
  if (!r?.choice?.includes(boon)) return;
  r.boons.push(boon);
  r.choice = null;
  if (s.combat) s.combat.respawn = 500;
}

export function currentMonster(s: GameState): Monster | null {
  const c = s.combat;
  if (!c) return null;
  if (s.raid) return raidMonster(s.raid.wave, s.raid.killed % RAID_PER_WAVE);
  const a = AREA.get(c.area);
  if (!a) return null;
  const id = c.target ?? a.monsters[c.index % a.monsters.length]!;
  return MONSTER.get(id) ?? null;
}

// --- The loop --------------------------------------------------------------------

export function stepCombat(s: GameState, dt: number): void {
  let t = dt;
  let guard = 200_000;
  while (t > 0 && s.combat && !s.dead && guard-- > 0) {
    const c = s.combat;
    if (!c.enemy) {
      if (s.raid?.choice) {
        // Waiting on a boon: pick one after a while so offline raids carry on.
        const step = Math.min(t, c.respawn);
        c.respawn -= step;
        t -= step;
        if (c.respawn <= 0) chooseBoon(s, s.raid.choice[0]!);
        continue;
      }
      const step = Math.min(t, c.respawn);
      c.respawn -= step;
      t -= step;
      regenStep(s, c, step);
      if (c.respawn <= 0) spawn(s);
      continue;
    }
    const step = Math.max(0, Math.min(t, c.playerTimer, c.enemy.timer, c.regenTimer));
    c.playerTimer -= step;
    c.enemy.timer -= step;
    t -= step;
    regenStep(s, c, step);
    if (c.playerTimer <= 0) {
      playerAttack(s);
      if (!s.combat) return;
      if (s.combat.enemy && s.combat.enemy.hp <= 0) {
        onKill(s);
        continue;
      }
    }
    if (s.combat?.enemy && s.combat.enemy.timer <= 0) {
      enemyAttack(s);
      if (s.hp <= 0) {
        onDeath(s);
        return;
      }
    }
  }
}

function regenStep(s: GameState, c: CombatState, step: number): void {
  c.regenTimer -= step;
  if (c.regenTimer <= 0) {
    c.regenTimer += 10_000;
    const m = fightMods(s);
    const max = maxHp(s, m);
    s.hp = Math.min(max, s.hp + Math.round(max * 0.01 * (1 + get(m, 'hpRegen') / 100)));
  }
}

function spawn(s: GameState): void {
  const m = currentMonster(s);
  const c = s.combat!;
  if (!m) {
    stopCombat(s, 'Nothing to fight here.');
    return;
  }
  c.enemy = { id: m.id, hp: m.hp, maxHp: m.hp, timer: m.speed };
  c.playerTimer = playerStats(s).speed;
}

/** Runes a cast needs after free ones from a staff. */
function runeCost(s: GameState, m: Mods): { item: string; qty: number }[] {
  const sp = SPELL.get(currentSpell(s))!;
  return sp.runes.filter((r) => !get(m, `infiniteRune:${r.item}`));
}

function playerAttack(s: GameState): void {
  const c = s.combat!;
  const m = fightMods(s);
  const p = playerStats(s, m);
  c.playerTimer += p.speed + c.stun;
  c.stun = 0;
  const mon = currentMonster(s)!;
  const enemy = c.enemy!;

  if (!s.raid) {
    if (p.style === 'magic') {
      const cost = runeCost(s, m);
      if (!cost.every((r) => count(s, r.item) >= r.qty)) {
        stopCombat(s, 'Out of runes.');
        return;
      }
      if (!chance(s, get(m, 'runePreserve') / 100)) for (const r of cost) removeItem(s, r.item, r.qty);
    } else if (p.style === 'ranged') {
      const eq = s.loadouts[s.loadout]!;
      const ammo = eq.ammo;
      if (!ammo || ammo.qty <= 0 || ITEM.get(ammo.item)?.equip?.ammoFor !== 'bow') {
        stopCombat(s, 'Out of arrows.');
        return;
      }
      if (!chance(s, 0.2 + get(m, 'ammoPreserve') / 100)) {
        ammo.qty--;
        if (ammo.qty <= 0) {
          delete eq.ammo;
          invalidate(s);
        }
      }
    }
    if (s.prayers.length) {
      const cost = s.prayers.reduce((a, id) => a + (prayerCostOf(id) ?? 0), 0) * Math.max(0.1, 1 + get(m, 'prayerCost') / 100);
      if (s.prayerPoints < cost) {
        s.prayers = [];
        notice(s, 'Out of prayer points.', 'bad');
      } else s.prayerPoints -= cost;
    }
    if (s.aurora) {
      const runes = auroraRunes(s.aurora);
      if (runes.every((r) => count(s, r.item) >= r.qty)) for (const r of runes) removeItem(s, r.item, r.qty);
      else {
        s.aurora = null;
        notice(s, 'Your aurora fades: out of runes.', 'bad');
      }
    }
    useCharges(s, 'combat');
  }

  const tri = triangle(p.style, mon.style);
  if (chance(s, hitChance(p.accuracy, mon.evasion[p.style]))) {
    let dmg = randInt(s, 1, p.maxHit) * (tri > 0 ? 1.1 : tri < 0 ? 0.85 : 1);
    dmg *= typeMult(mon, p.damageType);
    dmg *= 1 - mon.dr / 100;
    if (s.slayerTask?.monster === mon.id) dmg *= 1 + get(m, 'slayerDamage') / 100;
    if (mon.icon.startsWith('dragon.')) dmg *= 1 + get(m, 'damageVs:dragon') / 100;
    dmg = Math.max(1, Math.round(dmg));
    enemy.hp -= dmg;
    if (p.lifesteal) s.hp = Math.min(p.maxHp, s.hp + Math.round((dmg * p.lifesteal) / 100));
  }
  // A combat familiar swings alongside you.
  if (!s.raid) {
    for (const slot of ['summon1', 'summon2'] as const) {
      const st = s.loadouts[s.loadout]![slot];
      const fam = st ? ITEM.get(st.item)?.familiar : undefined;
      if (fam?.skill === 'combat' && fam.maxHit && enemy.hp > 0) {
        enemy.hp -= Math.max(1, Math.round(randInt(s, 1, fam.maxHit) * (1 + level(s, 'summoning') / 200) * (1 - mon.dr / 100)));
      }
    }
  }
}

function prayerCostOf(id: string): number {
  return PRAYER.get(id)?.cost ?? 0;
}

function auroraRunes(id: string): { item: string; qty: number }[] {
  return AURORA.get(id)?.runes ?? [];
}

function enemyAttack(s: GameState): void {
  const c = s.combat!;
  const enemy = c.enemy!;
  const mon = currentMonster(s)!;
  enemy.timer += mon.speed;
  const m = fightMods(s);
  const p = playerStats(s, m);
  const special = mon.special && chance(s, mon.special.chance) ? mon.special : null;
  if (!special && !chance(s, hitChance(mon.accuracy, p.evasion[mon.style]))) return;
  let dmg = randInt(s, 1, mon.maxHit) * (special?.mult ?? 1);
  const tri = triangle(p.style, mon.style);
  if (mon.damageType === 'void') {
    dmg *= 1 - Math.min(0.9, p.resist.void ?? 0);
  } else if (mon.damageType === 'pure') {
    dmg *= 1 - Math.min(0.5, p.resist.pure ?? 0);
  } else {
    const dr = p.dr * (tri > 0 ? 1.25 : tri < 0 ? 0.75 : 1);
    dmg *= 1 - Math.min(95, dr) / 100;
    dmg *= 1 - Math.min(0.75, p.resist[mon.damageType] ?? 0);
  }
  dmg *= 1 - Math.min(80, p.protect[mon.style]) / 100;
  dmg = Math.max(1, Math.round(dmg));
  s.hp -= dmg;
  if (special?.heal) enemy.hp = Math.min(enemy.maxHp, enemy.hp + Math.round(enemy.maxHp * special.heal));
  if (special?.stun) c.stun += 1500;
  if (s.hp > 0) autoEat(s, p.maxHp);
}

function giveLoot(s: GameState, id: string, qty: number): void {
  if (s.upgrades['autoloot'] && addItem(s, id, qty)) return;
  const st = s.loot.find((l) => l.item === id);
  if (st) st.qty += qty;
  else if (s.loot.length < LOOT_SLOTS) s.loot.push({ item: id, qty });
}

export function collectLoot(s: GameState): number {
  let n = 0;
  s.loot = s.loot.filter((l) => {
    if (addItem(s, l.item, l.qty)) {
      n++;
      return false;
    }
    return true;
  });
  return n;
}

function onKill(s: GameState): void {
  const c = s.combat!;
  const mon = currentMonster(s)!;
  const m = fightMods(s);
  c.enemy = null;
  c.respawn = RESPAWN;
  c.kills++;
  // XP for the damage it took.
  const style = styleOf(s);
  const xpPerHp = 0.4;
  const mult = s.raid ? 0.5 : 1;
  const give = (skill: Parameters<typeof grantXp>[1], share: number): void => grantXp(s, skill, mon.hp * xpPerHp * share * mult * xpMult(m, skill, true));
  if (style === 'melee') give(s.meleeStyle === 'accurate' ? 'attack' : s.meleeStyle === 'aggressive' ? 'strength' : 'defence', 1);
  else if (style === 'ranged') {
    if (s.rangedStyle === 'longrange') {
      give('ranged', 0.5);
      give('defence', 0.5);
    } else give('ranged', 1);
  } else if (s.magicStyle === 'defensive') {
    give('magic', 0.5);
    give('defence', 0.5);
  } else give('magic', 1);
  give('hitpoints', 1 / 3);

  if (s.raid) {
    const r = s.raid;
    r.killed++;
    bump(s, 'raidKills');
    if (r.killed % RAID_PER_WAVE === 0) {
      r.wave++;
      r.food += 3;
      const pool = RAID_BOONS.map((b) => b.id);
      const offer: string[] = [];
      while (offer.length < 3) {
        const b = pick(s, pool);
        if (!offer.includes(b)) offer.push(b);
      }
      r.choice = offer;
      c.respawn = 30_000;
      notice(s, `Wave ${r.wave - 1} cleared. Choose a boon.`, 'good');
    }
    return;
  }

  bump(s, `kill:${mon.id}`);
  bump(s, 'kills');
  guildRep(s, 'attack', Math.max(1, mon.combatLevel / 12), get(m, 'guildXP'));
  // Loot.
  s.gp += Math.round(randInt(s, mon.gp[0], mon.gp[1]) * (1 + get(m, 'gpGain') / 100));
  if (mon.bones) giveLoot(s, mon.bones, 1);
  const drop = roll(s, mon.loot);
  if (drop) giveLoot(s, drop.item, drop.qty * (chance(s, get(m, 'lootDouble') / 100) ? 2 : 1));
  // Slayer.
  const task = s.slayerTask;
  if (task && task.monster === mon.id) {
    const tier = SLAYER_TIERS.find((t) => t.id === task.tier)!;
    s.slayerCoins += Math.max(1, Math.round((mon.combatLevel / 10) * tier.coins * (1 + get(m, 'slayerCoins') / 100)));
    grantXp(s, 'slayer', mon.hp * 0.15 * xpMult(m, 'slayer', true));
    task.left--;
    if (task.left <= 0) {
      s.slayerTask = null;
      bump(s, 'slayerTasks');
      s.slayerCoins += Math.round(tier.coins * 25 * (1 + get(m, 'slayerCoins') / 100));
      notice(s, 'Slayer task complete.', 'good');
      const pet = PET.get('pet-slayer')!;
      if (!s.pets.includes(pet.id) && chance(s, 1 / 120)) {
        s.pets.push(pet.id);
        notice(s, `A pet! ${pet.name} has decided to follow you.`, 'good');
        invalidate(s);
      }
    }
  }
  // Dungeons.
  const a = AREA.get(c.area)!;
  if (a.kind === 'dungeon' || a.kind === 'stronghold') {
    c.index++;
    if (c.index >= a.monsters.length) {
      c.index = 0;
      bump(s, `clear:${a.id}`);
      for (const r of a.reward ?? []) giveLoot(s, r.item, r.qty);
      notice(s, `${a.name} cleared!`, 'good');
      if (a.pet && !s.pets.includes(a.pet)) {
        const pet = PET.get(a.pet)!;
        if (chance(s, 1 / pet.odds)) {
          s.pets.push(pet.id);
          notice(s, `A pet! ${pet.name} has decided to follow you.`, 'good');
          invalidate(s);
        }
      }
    }
  }
}

function onDeath(s: GameState): void {
  if (s.raid) {
    stopCombat(s);
    return;
  }
  const m = fightMods(s);
  s.combat = null;
  s.activity = null;
  bump(s, 'deaths');
  if (s.mode === 'hardcore') {
    s.dead = true;
    s.hp = 0;
    notice(s, 'You have died. In Hardcore, that is the end.', 'bad');
    return;
  }
  s.hp = maxHp(s, m);
  if (get(m, 'protectItem') > 0) {
    notice(s, 'You died, but your prayer protected your gear.', 'bad');
    return;
  }
  const eq = s.loadouts[s.loadout]!;
  const slots = (Object.keys(eq) as Slot[]).filter((k) => eq[k] && k !== 'summon1' && k !== 'summon2');
  if (slots.length) {
    const lost = pick(s, slots);
    const name = item(eq[lost]!.item).name;
    delete eq[lost];
    invalidate(s);
    notice(s, `You died and lost your ${name}.`, 'bad');
  } else notice(s, 'You died.', 'bad');
}

// --- Slayer --------------------------------------------------------------------

export function newSlayerTask(s: GameState, tierId: string): string | null {
  const tier = SLAYER_TIERS.find((t) => t.id === tierId);
  if (!tier) return 'No such tier';
  if (combatLevel(s) < tier.combat) return `Needs combat level ${tier.combat}`;
  if (s.slayerTask) return 'You already have a task';
  const pool = slayerPool(tier).filter((mon) => (mon.slayerLevel ?? 0) <= level(s, 'slayer'));
  if (!pool.length) return 'Nothing to hunt at this tier yet';
  const mon = pick(s, pool);
  const qty = Math.round((10 + rand(s) * 30) * (1 + SLAYER_TIERS.indexOf(tier) * 0.3));
  s.slayerTask = { monster: mon.id, left: qty, total: qty, tier: tier.id };
  return null;
}

// --- Equip -----------------------------------------------------------------------

export function equipBlocker(s: GameState, id: string): string | null {
  const it = ITEM.get(id);
  if (!it?.equip) return 'Not equipment';
  for (const [skill, lvl] of Object.entries(it.equip.req ?? {})) {
    if (level(s, skill as Parameters<typeof level>[1]) < (lvl ?? 0)) return `Needs ${skill[0]!.toUpperCase()}${skill.slice(1)} ${lvl}`;
  }
  if (id === 'max-cape' && Object.keys(s.xp).some((k) => level(s, k as Parameters<typeof level>[1]) < 99)) return 'Needs every skill at 99';
  return null;
}

/** Equips from the bank. Stackables (ammo, tablets) go on whole. */
export function equip(s: GameState, id: string, slotHint?: Slot): string | null {
  const why = equipBlocker(s, id);
  if (why) return why;
  const it = item(id);
  const e = it.equip!;
  let slot: Slot = e.slot;
  const eq = s.loadouts[s.loadout]!;
  if (it.familiar) slot = slotHint === 'summon2' || (eq.summon1 && eq.summon1.item !== id && !eq.summon2 && slotHint !== 'summon1') ? 'summon2' : 'summon1';
  const stack = e.slot === 'ammo' || it.familiar;
  const qty = stack ? count(s, id) : 1;
  if (qty <= 0) return 'None in the bank';
  if (stack && eq[slot]?.item === id) {
    removeItem(s, id, qty);
    eq[slot]!.qty += qty;
    invalidate(s);
    return null;
  }
  unequip(s, slot);
  if (slot === 'weapon' && e.twoHanded) unequip(s, 'shield');
  if (slot === 'shield' && eq.weapon && ITEM.get(eq.weapon.item)?.equip?.twoHanded) unequip(s, 'weapon');
  removeItem(s, id, qty);
  eq[slot] = { item: id, qty };
  invalidate(s);
  return null;
}

export function unequip(s: GameState, slot: Slot): boolean {
  const eq = s.loadouts[s.loadout]!;
  const st = eq[slot];
  if (!st) return true;
  if (!addItem(s, st.item, st.qty)) return false;
  delete eq[slot];
  invalidate(s);
  return true;
}

export function equipFood(s: GameState, id: string): string | null {
  const it = ITEM.get(id);
  if (!it?.heal) return 'Not food';
  const have = count(s, id);
  if (!have) return 'None in the bank';
  let slot = s.food.findIndex((f) => f?.item === id);
  if (slot < 0) slot = s.food.findIndex((f) => !f);
  if (slot < 0) {
    slot = s.foodSlot;
    const old = s.food[slot]!;
    addItem(s, old.item, old.qty);
    s.food[slot] = null;
  }
  removeItem(s, id, have);
  const cur = s.food[slot];
  s.food[slot] = { item: id, qty: (cur?.qty ?? 0) + have };
  s.foodSlot = slot;
  return null;
}

export function unequipFood(s: GameState, slot: number): void {
  const f = s.food[slot];
  if (f && addItem(s, f.item, f.qty)) s.food[slot] = null;
}

export function togglePrayer(s: GameState, id: string): string | null {
  const p = PRAYER.get(id);
  if (!p) return 'No such prayer';
  if (s.prayers.includes(id)) {
    s.prayers = s.prayers.filter((x) => x !== id);
    return null;
  }
  if (level(s, 'prayer') < p.level) return `Needs Prayer ${p.level}`;
  if (s.prayerPoints <= 0) return 'No prayer points: bury some bones';
  if (s.prayers.length >= 2) s.prayers.shift();
  s.prayers.push(id);
  return null;
}

export function bury(s: GameState, id: string, qty: number): string | null {
  const it = ITEM.get(id);
  if (!it?.bury) return 'You cannot bury that';
  const n = Math.min(qty, count(s, id));
  if (n <= 0) return 'None in the bank';
  removeItem(s, id, n);
  const m = combatMods(s);
  grantXp(s, 'prayer', it.bury * n * (1 + get(m, 'buryBonus') / 100) * xpMult(m, 'prayer', true));
  s.prayerPoints += it.bury * n;
  bump(s, 'buried', n);
  const pet = PET.get('pet-prayer')!;
  if (!s.pets.includes(pet.id) && chance(s, 1 - (1 - 1 / 4000) ** n)) {
    s.pets.push(pet.id);
    notice(s, `A pet! ${pet.name} has decided to follow you.`, 'good');
    invalidate(s);
  }
  return null;
}

export function weaponTypeLabel(t: DamageType): string {
  return t[0]!.toUpperCase() + t.slice(1);
}
