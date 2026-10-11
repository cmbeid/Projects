import { CLASS, FIRST_NAMES, LAST_NAMES, TRAITS } from '../data/crew';
import { GEAR_DEF } from '../data/gear';
import { BAL } from '../data/progression';
import { SKILL } from '../data/skills';
import type { ClassId, GearSlot, StatId } from '../data/types';
import type { Crew, GameState } from '../state/types';
import { conscious, maxHp, shipMods } from './derive';
import { addLog } from './log';
import { pick, randInt, type Rng } from './rng';

export const PORTRAIT_PARTS = 6;

export function makeCrew(s: GameState, r: Rng, cls: ClassId, level = 1): Crew {
  const def = CLASS.get(cls)!;
  const stats = { ...def.stats };
  // A little spread so two pilots are never quite the same person.
  for (const k of Object.keys(stats) as StatId[]) stats[k] = Math.max(1, stats[k] + randInt(r, -1, 1));
  const traits: string[] = [];
  const good = TRAITS.filter((t) => t.good);
  const bad = TRAITS.filter((t) => !t.good);
  traits.push(pick(r, good).id);
  if (r() < 0.45) traits.push(pick(r, bad).id);
  const c: Crew = {
    id: s.nextId++,
    name: `${pick(r, FIRST_NAMES)} ${pick(r, LAST_NAMES)}`,
    cls,
    stats,
    hp: 0,
    morale: 65,
    xp: 0,
    level: 1,
    skillPts: 0,
    statPts: 0,
    skills: [],
    traits,
    gear: {},
    portrait: [randInt(r, 0, 5), randInt(r, 0, 5), randInt(r, 0, 5), randInt(r, 0, 5), randInt(r, 0, 5), randInt(r, 0, 5)],
    captain: false,
  };
  while (c.level < level) levelUp(c);
  autoSpend(c);
  c.hp = maxHp(c);
  return c;
}

function levelUp(c: Crew): void {
  c.level++;
  c.skillPts++;
  if (c.level % 2 === 0) c.statPts++;
}

export function xpToNext(c: Crew): number {
  return BAL.xpFor(c.level);
}

/** XP goes to every crew member on their feet, boosted by Field Notes. */
export function grantXp(s: GameState, amount: number): string[] {
  const mult = 1 + (shipMods(s).xp ?? 0);
  const ups: string[] = [];
  for (const c of s.crew) {
    if (!conscious(c)) continue;
    c.xp += Math.round(amount * mult);
    while (c.level < BAL.maxLevel && c.xp >= xpToNext(c)) {
      c.xp -= xpToNext(c);
      const before = maxHp(c);
      levelUp(c);
      c.hp += maxHp(c) - before;
      ups.push(`${c.name} reached level ${c.level}`);
      addLog(s, `${c.name} reached level ${c.level}.`, 'ship');
    }
    if (c.level >= BAL.maxLevel) c.xp = 0;
  }
  return ups;
}

export function canLearn(c: Crew, id: string): boolean {
  const sk = SKILL.get(id);
  if (!sk || sk.cls !== c.cls || c.skills.includes(id)) return false;
  if (c.skillPts <= 0 || c.level < sk.level) return false;
  return !sk.req || c.skills.includes(sk.req);
}

export function learn(c: Crew, id: string): boolean {
  if (!canLearn(c, id)) return false;
  c.skills.push(id);
  c.skillPts--;
  return true;
}

export function spendStat(c: Crew, stat: StatId): boolean {
  if (c.statPts <= 0) return false;
  const before = maxHp(c);
  c.stats[stat]++;
  c.statPts--;
  if (stat === 'grit') c.hp += maxHp(c) - before;
  return true;
}

/** For recruits and the bot: learn whatever is available, in list order. */
export function autoSpend(c: Crew): void {
  let progress = true;
  while (progress) {
    progress = false;
    for (const sk of SKILL.values()) {
      if (canLearn(c, sk.id)) {
        learn(c, sk.id);
        progress = true;
      }
    }
  }
  const main = (Object.entries(CLASS.get(c.cls)!.stats) as [StatId, number][]).sort((a, b) => b[1] - a[1])[0]![0];
  while (c.statPts > 0) spendStat(c, main);
}

export function equip(s: GameState, c: Crew, uid: number): boolean {
  const g = s.gear.find((x) => x.uid === uid);
  if (!g) return false;
  const slot = slotOf(g.base);
  if (!slot) return false;
  // Take it off whoever had it.
  for (const other of s.crew) for (const k of Object.keys(other.gear) as GearSlot[]) if (other.gear[k] === uid) delete other.gear[k];
  c.gear[slot] = uid;
  return true;
}

export function unequip(c: Crew, slot: GearSlot): void {
  delete c.gear[slot];
}

export function equippedBy(s: GameState, uid: number): Crew | null {
  return s.crew.find((c) => Object.values(c.gear).includes(uid)) ?? null;
}

export function slotOf(base: string): GearSlot | null {
  return GEAR_DEF.get(base)?.slot ?? null;
}

export function healCrew(c: Crew, amount: number): void {
  c.hp = Math.min(maxHp(c), Math.max(0, c.hp + amount));
}

export function hurtCrew(c: Crew, amount: number): void {
  c.hp = Math.max(0, c.hp - amount);
}

export function setMorale(c: Crew, value: number): void {
  c.morale = Math.max(0, Math.min(100, Math.round(value)));
}
