/**
 * The small verbs everything else is built from: levels and XP, the bank,
 * notices, and a new game.
 */
import { ITEM } from '../data/items';
import { guildFor, relicCap, relicMods } from '../data/meta';
import { PET } from '../data/meta';
import { SKILL_INFO } from '../data/skills';
import { PENS, PLOTS } from '../data/special';
import { SKILLS, type GameMode, type SkillId } from '../data/types';
import type { GameState, Notice } from '../state/types';
import { chance, rand } from './rng';
import { levelFor } from './xp';

export const SAVE_VERSION = 1;
export const BANK_BASE = 60;
export const BANK_PER_UPGRADE = 8;

export function newGame(seed: number, now = Date.now(), mode: GameMode = 'standard', firstSkill: SkillId = 'woodcutting'): GameState {
  const xp = Object.fromEntries(SKILLS.map((s) => [s, 0])) as Record<SkillId, number>;
  xp.hitpoints = 1154; // level 10: ten hit points a level, so a hundred to start
  const s: GameState = {
    version: SAVE_VERSION, rng: seed | 0, mode, name: 'Adventurer', createdAt: now, time: now, savedAt: now, dead: false,
    gp: 100, slayerCoins: 0, raidCoins: 0, xp, unlocked: mode === 'adventure' ? [firstSkill] : [], relics: {},
    bank: {}, bankOrder: [], locked: [], found: {},
    hp: 100, prayerPoints: 0, loadouts: [{}], loadout: 0, food: [null, null, null], foodSlot: 0, prayers: [], spell: 'air-strike', aurora: null,
    meleeStyle: 'accurate', rangedStyle: 'accurate', magicStyle: 'magic', potions: {},
    activity: null, combat: null, loot: [], slayerTask: null, raid: null, raidBest: 0,
    farm: {
      allotment: Array.from({ length: PLOTS.allotment.start }, () => ({ seed: null, plantedAt: 0, compost: 0 })),
      herb: Array.from({ length: PLOTS.herb.start }, () => ({ seed: null, plantedAt: 0, compost: 0 })),
      tree: Array.from({ length: PLOTS.tree.start }, () => ({ seed: null, plantedAt: 0, compost: 0 })),
    },
    course: Array.from({ length: 10 }, () => null), pillar: null, stars: {}, map: {}, surveyed: ['0,0', '1,-1'], surveyTarget: null, donated: [],
    settlement: {}, settleFrac: {}, ranch: Array.from({ length: PENS.start }, () => ({ animal: null, count: 0, progress: 0 })),
    guilds: {}, quests: [], pets: [], upgrades: {}, counters: {}, buffs: [], earned: [], log: [],
    settings: { sound: true, confirmSell: true, offlineReport: true },
  };
  for (const [id, n] of [['bronze-dagger', 1], ['normal-shortbow', 1], ['bronze-arrows', 50], ['staff', 1], ['food-shrimp', 15], ['rune-air', 60], ['rune-mind', 30], ['seed-potato', 9]] as const) {
    addItem(s, id, n);
  }
  return s;
}

// --- Notices -------------------------------------------------------------------

export function notice(s: GameState, text: string, kind: Notice['kind'] = 'info'): void {
  s.log.push({ t: s.time, text, kind });
  if (s.log.length > 60) s.log.splice(0, s.log.length - 60);
}

// --- Levels --------------------------------------------------------------------

export function levelCap(s: GameState, skill: SkillId): number {
  return s.mode === 'relics' ? relicCap(s.relics[skill] ?? 0) : 99;
}

export function level(s: GameState, skill: SkillId): number {
  return levelFor(s.xp[skill], levelCap(s, skill));
}

export function combatLevel(s: GameState): number {
  const L = (k: SkillId): number => level(s, k);
  const base = 0.25 * (L('defence') + L('hitpoints') + Math.floor(L('prayer') / 2));
  const melee = 0.325 * (L('attack') + L('strength'));
  const ranged = 0.325 * Math.floor(1.5 * L('ranged'));
  const magic = 0.325 * Math.floor(1.5 * L('magic'));
  return Math.floor(base + Math.max(melee, ranged, magic));
}

export function skillUnlocked(s: GameState, skill: SkillId): boolean {
  if (s.mode !== 'adventure') return true;
  if (SKILL_INFO[skill].kind === 'combat') return true;
  return s.unlocked.includes(skill);
}

/** Grants XP already multiplied by its bonuses. Announces level-ups. */
export function grantXp(s: GameState, skill: SkillId, amount: number): void {
  if (amount <= 0) return;
  const cap = levelCap(s, skill);
  const before = levelFor(s.xp[skill], cap);
  s.xp[skill] += amount;
  const after = levelFor(s.xp[skill], cap);
  if (after > before) {
    notice(s, `${SKILL_INFO[skill].name} is now level ${after}.`, 'level');
    s.counters[`level:${skill}`] = after;
    invalidate(s);
  }
}

// --- Bank ----------------------------------------------------------------------

export function bankSlots(s: GameState): number {
  return BANK_BASE + BANK_PER_UPGRADE * (s.upgrades['bank'] ?? 0);
}

export function count(s: GameState, item: string): number {
  return s.bank[item] ?? 0;
}

export function bankFull(s: GameState, item: string): boolean {
  return !(item in s.bank) && s.bankOrder.length >= bankSlots(s);
}

/** Adds to the bank. False (and nothing added) if a new stack would not fit. */
export function addItem(s: GameState, item: string, qty: number): boolean {
  if (qty <= 0) return true;
  if (!ITEM.has(item)) throw new Error(`no item "${item}"`);
  if (!(item in s.bank)) {
    if (s.bankOrder.length >= bankSlots(s)) return false;
    s.bank[item] = 0;
    s.bankOrder.push(item);
  }
  s.bank[item]! += qty;
  s.found[item] = 1;
  s.counters[`got:${item}`] = (s.counters[`got:${item}`] ?? 0) + qty;
  return true;
}

export function removeItem(s: GameState, item: string, qty: number): boolean {
  const have = s.bank[item] ?? 0;
  if (have < qty) return false;
  if (have === qty && !s.locked.includes(item)) {
    delete s.bank[item];
    s.bankOrder.splice(s.bankOrder.indexOf(item), 1);
  } else s.bank[item] = have - qty;
  return true;
}

export function bump(s: GameState, counter: string, n = 1): void {
  s.counters[counter] = (s.counters[counter] ?? 0) + n;
}

// --- Modifier cache ------------------------------------------------------------

/**
 * Bumped by anything that changes a bonus source: gear, prayers, guild
 * ranks, stars, pets. `modifiers.ts` recomputes only when it moves.
 */
const revs = new WeakMap<GameState, number>();
export function invalidate(s: GameState): void {
  revs.set(s, (revs.get(s) ?? 0) + 1);
}
export function rev(s: GameState): number {
  return revs.get(s) ?? 0;
}

// --- Pets and relics -------------------------------------------------------------

/** Called once per action of a skill (scaled by the action's length). */
export function rollSkillExtras(s: GameState, skill: SkillId, intervalMs: number, petChanceMod: number): void {
  const pet = PET.get(`pet-${skill}`);
  if (pet && !s.pets.includes(pet.id)) {
    const p = (intervalMs / 3000 / pet.odds) * (1 + petChanceMod / 100);
    if (chance(s, p)) {
      s.pets.push(pet.id);
      notice(s, `A pet! ${pet.name} has decided to follow you.`, 'good');
      invalidate(s);
    }
  }
  if (s.mode === 'relics') {
    const have = s.relics[skill] ?? 0;
    if (have < 5 && rand(s) < intervalMs / 3000 / 1200) {
      s.relics[skill] = have + 1;
      notice(s, `You uncover a ${SKILL_INFO[skill].name} relic (${have + 1}/5). The level cap rises.`, 'good');
      invalidate(s);
    }
  }
}

export function relicBonus(s: GameState): Record<string, number>[] {
  if (s.mode !== 'relics') return [];
  const out: Record<string, number>[] = [];
  for (const [skill, n] of Object.entries(s.relics)) for (let i = 0; i < (n ?? 0); i++) out.push(relicMods(skill as SkillId, i));
  return out;
}

export function guildRep(s: GameState, skill: SkillId, amount: number, guildXpMod: number): void {
  const g = guildFor(skill);
  const entry = (s.guilds[g] ??= { rep: 0, claimed: [] });
  entry.rep += amount * (1 + guildXpMod / 100);
}
