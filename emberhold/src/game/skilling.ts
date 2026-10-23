/**
 * The generic action runner: every skill whose content is a list of
 * `SkillAction`s goes through `completeAction`.
 */
import { ITEM } from '../data/items';
import { ACTION } from '../data/skills';
import type { SkillAction, SkillId } from '../data/types';
import type { GameState } from '../state/types';
import { addItem, bankFull, bump, count, grantXp, guildRep, invalidate, level, notice, removeItem, rollSkillExtras, skillUnlocked } from './core';
import { get, interval, mods, skillMod, xpMult } from './modifiers';
import { allMet, describe } from './requirements';
import { chance, randInt, roll } from './rng';

export function actionInterval(s: GameState, a: SkillAction): number {
  return interval(mods(s), a.skill, a.interval);
}

/** Why an action can't start, or null if it can. */
export function blocker(s: GameState, a: SkillAction): string | null {
  if (!skillUnlocked(s, a.skill)) return 'Skill locked';
  if (level(s, a.skill) < a.level) return `Needs level ${a.level}`;
  if (a.unlock && !allMet(s, [a.unlock])) return describe(a.unlock);
  for (const inp of a.inputs) {
    if (count(s, inp.item) < inp.qty) return `Needs ${inp.qty} ${ITEM.get(inp.item)?.name ?? inp.item}`;
  }
  return null;
}

export function successChance(s: GameState, a: SkillAction): number {
  if (a.success === undefined) return 1;
  const m = mods(s);
  return Math.min(a.skill === 'cooking' ? 1 : 0.95, a.success + (level(s, a.skill) - a.level) * 0.01 + skillMod(m, 'success', a.skill) / 100);
}

/** Uses a charge of whatever potion and familiar help this skill. */
export function useCharges(s: GameState, skill: SkillId | 'combat'): void {
  const p = s.potions[skill];
  if (p && p.charges > 0) {
    p.charges--;
    if (p.charges <= 0) {
      const name = ITEM.get(p.item)?.name ?? 'potion';
      // Drink the next one straight away if there is one.
      if (removeItem(s, p.item, 1)) {
        p.charges = ITEM.get(p.item)!.potion!.charges;
      } else {
        delete s.potions[skill];
        notice(s, `Your ${name} has run out.`, 'bad');
        invalidate(s);
      }
    }
  }
  const eq = s.loadouts[s.loadout]!;
  for (const slot of ['summon1', 'summon2'] as const) {
    const st = eq[slot];
    if (!st) continue;
    const fam = ITEM.get(st.item)?.familiar;
    if (!fam || fam.skill !== skill) continue;
    st.qty--;
    grantXp(s, 'summoning', Math.max(1, Math.round(ITEM.get(st.item)!.equip!.req!.summoning! / 10)) * xpMult(mods(s), 'summoning'));
    if (st.qty <= 0) {
      delete eq[slot];
      notice(s, `Your ${ITEM.get(st.item)!.name.replace(' Tablet', '')} has gone home.`, 'bad');
      invalidate(s);
    }
  }
}

export type ActionResult = 'ok' | 'failed' | 'stop';

/** One completion of an action. Returns 'stop' when it can't go on. */
export function completeAction(s: GameState, a: SkillAction): ActionResult {
  const why = blocker(s, a);
  if (why) {
    notice(s, `Stopped ${a.name}: ${why.toLowerCase()}.`, 'bad');
    return 'stop';
  }
  const m = mods(s);
  const iv = interval(m, a.skill, a.interval);
  const preserve = skillMod(m, 'preserve', a.skill);

  if (a.success !== undefined && !chance(s, successChance(s, a))) {
    bump(s, `fail:${a.skill}`);
    if (a.skill === 'cooking') {
      for (const inp of a.inputs) removeItem(s, inp.item, inp.qty);
      addItem(s, 'burnt-food', 1);
      grantXp(s, a.skill, a.xp * 0.1);
      return 'failed';
    }
    return 'failed';
  }

  if (!chance(s, preserve / 100)) for (const inp of a.inputs) removeItem(s, inp.item, inp.qty);

  const double = chance(s, skillMod(m, 'doubleChance', a.skill) / 100) ? 2 : 1;
  const bonus = a.bonusPerLevels ? Math.floor((level(s, a.skill) - a.level) / a.bonusPerLevels) : 0;
  let full = false;
  a.outputs.forEach((o, i) => {
    const qty = (o.qty + (i === 0 ? bonus : 0)) * double;
    if (!addItem(s, o.item, qty)) full = true;
  });
  const drop = roll(s, a.loot);
  if (drop && !addItem(s, drop.item, drop.qty)) full = true;
  if (a.skill === 'mining' && a.loot?.chance && chance(s, get(m, 'gemChance') / 100)) {
    const gem = roll(s, { ...a.loot, chance: 1 });
    if (gem) addItem(s, gem.item, 1);
  }
  if (a.gp) {
    const gp = Math.round(randInt(s, a.gp[0], a.gp[1]) * (1 + get(m, 'gpGain') / 100));
    s.gp += gp;
    if (a.skill === 'thieving') bump(s, 'stolenGp', gp);
  }

  grantXp(s, a.skill, a.xp * xpMult(m, a.skill));
  guildRep(s, a.skill, iv / 3000, get(m, 'guildXP'));
  bump(s, `action:${a.id}`);
  bump(s, `skill:${a.skill}`);
  bump(s, 'actions');
  rollSkillExtras(s, a.skill, iv, get(m, 'petChance'));
  useCharges(s, a.skill);
  if (full) {
    notice(s, 'Your bank is full.', 'bad');
    return 'stop';
  }
  return 'ok';
}

/** Can the action keep going after this completion? */
export function startAction(s: GameState, id: string): string | null {
  const a = ACTION.get(id);
  if (!a) return 'No such action';
  const why = blocker(s, a);
  if (why) return why;
  for (const o of a.outputs) if (bankFull(s, o.item)) return 'Bank full';
  stopActivity(s);
  s.activity = { kind: 'skill', action: id, progress: 0, stun: 0 };
  return null;
}

export function stopActivity(s: GameState): void {
  s.activity = null;
  s.combat = null;
}
