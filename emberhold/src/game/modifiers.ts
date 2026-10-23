/**
 * Sums every bonus source into one table. Cached per state until
 * `invalidate` is called, because combat asks for it on every swing.
 */
import { AURORA, PRAYER } from '../data/combat';
import { ITEM } from '../data/items';
import { GUILD_RANKS, GUILDS, PET, guildRankMods } from '../data/meta';
import { BUILDING, CONSTELLATION, MUSEUM_REWARDS, OBSTACLES, PILLARS, STARS, SYNERGIES } from '../data/special';
import { SLOTS, type Mods, type SkillId } from '../data/types';
import type { GameState } from '../state/types';
import { relicBonus, rev } from './core';

export function addMods(into: Mods, from: Mods, times = 1): void {
  for (const k in from) into[k] = (into[k] ?? 0) + from[k]! * times;
}

export function rankOf(rep: number): number {
  let r = 0;
  while (r < GUILD_RANKS.length - 1 && rep >= GUILD_RANKS[r + 1]!) r++;
  return r;
}

const TOOL_UPGRADES: [string, SkillId][] = [['axe', 'woodcutting'], ['pickaxe', 'mining'], ['rod', 'fishing'], ['trowel', 'archaeology']];

/** Everything except combat-only sources (prayers, auroras), which `combatMods` adds. */
function compute(s: GameState): Mods {
  const m: Mods = {};
  const eq = s.loadouts[s.loadout] ?? {};
  const familiars: string[] = [];
  for (const slot of SLOTS) {
    const st = eq[slot];
    if (!st) continue;
    const it = ITEM.get(st.item);
    if (!it) continue;
    if (it.familiar) {
      // A familiar only helps while it has charges.
      if (st.qty > 0) {
        addMods(m, it.familiar.mods);
        familiars.push(st.item.replace('tablet-', ''));
      }
      continue;
    }
    if (it.equip?.mods) addMods(m, it.equip.mods);
    if (it.equip?.resist) for (const [k, v] of Object.entries(it.equip.resist)) m[`resist:${k}`] = (m[`resist:${k}`] ?? 0) + v;
  }
  for (const syn of SYNERGIES) if (familiars.includes(syn.a) && familiars.includes(syn.b)) addMods(m, syn.mods);
  for (const p of Object.values(s.potions)) {
    if (!p || p.charges <= 0) continue;
    const it = ITEM.get(p.item);
    if (it?.potion) addMods(m, it.potion.mods);
  }
  for (const g of GUILDS) {
    const st = s.guilds[g.id];
    if (st) addMods(m, guildRankMods(g.id, rankOf(st.rep)));
  }
  for (const id of s.pets) {
    const pet = PET.get(id);
    if (pet) addMods(m, pet.mods);
  }
  for (const id of s.course) {
    const ob = id ? OBSTACLES.find((o) => o.id === id) : undefined;
    if (ob) addMods(m, ob.mods);
  }
  if (s.pillar) {
    const p = PILLARS.find((x) => x.id === s.pillar);
    if (p) addMods(m, p.mods);
  }
  for (const [cid, levels] of Object.entries(s.stars)) {
    const c = CONSTELLATION.get(cid);
    if (!c) continue;
    STARS.forEach((star, i) => {
      const lv = levels[i] ?? 0;
      if (lv) addMods(m, star.per(c), lv);
    });
  }
  for (const [bid, lv] of Object.entries(s.settlement)) {
    const b = BUILDING.get(bid);
    if (b?.mods && lv) addMods(m, b.mods, lv);
  }
  for (const site of Object.keys(MUSEUM_REWARDS)) {
    if (museumComplete(s, site)) addMods(m, MUSEUM_REWARDS[site]!);
  }
  for (const e of s.earned) addMods(m, e);
  for (const r of relicBonus(s)) addMods(m, r);
  for (const b of s.buffs) if (b.until > s.time) addMods(m, b.mods);
  for (const [up, skill] of TOOL_UPGRADES) {
    const n = s.upgrades[up] ?? 0;
    if (n) m[`interval:${skill}`] = (m[`interval:${skill}`] ?? 0) + n * (up === 'trowel' ? 4 : 5);
  }
  return m;
}

export function museumComplete(s: GameState, site: string): boolean {
  return [0, 1, 2].every((j) => s.donated.includes(`art-${site}-${j}`));
}

const cache = new WeakMap<GameState, { rev: number; buffs: number; mods: Mods }>();

/** Expired buffs are noticed by count, so a buff running out refreshes the table. */
export function mods(s: GameState): Mods {
  const live = s.buffs.filter((b) => b.until > s.time).length;
  const c = cache.get(s);
  if (c && c.rev === rev(s) && c.buffs === live) return c.mods;
  const m = compute(s);
  cache.set(s, { rev: rev(s), buffs: live, mods: m });
  return m;
}

const combatCache = new WeakMap<GameState, { rev: number; key: string; mods: Mods }>();

/** `mods` plus prayers and the aurora. */
export function combatMods(s: GameState): Mods {
  const base = mods(s);
  const key = `${s.prayers.join(',')}|${s.aurora}|${s.buffs.length}`;
  const c = combatCache.get(s);
  if (c && c.rev === rev(s) && c.key === key && c.mods !== undefined && cache.get(s)?.mods === base) return c.mods;
  const m: Mods = { ...base };
  for (const id of s.prayers) {
    const p = PRAYER.get(id);
    if (p) addMods(m, p.mods);
  }
  if (s.aurora) {
    const a = AURORA.get(s.aurora);
    if (a) addMods(m, a.mods);
  }
  combatCache.set(s, { rev: rev(s), key, mods: m });
  return m;
}

export function get(m: Mods, key: string): number {
  return m[key] ?? 0;
}

/** A per-skill modifier, with the `:all` form added in. */
export function skillMod(m: Mods, kind: string, skill: SkillId): number {
  return (m[`${kind}:${skill}`] ?? 0) + (m[`${kind}:all`] ?? 0);
}

export function xpMult(m: Mods, skill: SkillId, combat = false): number {
  return 1 + (get(m, 'skillXP') + skillMod(m, 'skillXP', skill) + (combat ? get(m, 'combatXP') : 0)) / 100;
}

/** Interval with reductions, never below a quarter of the base. */
export function interval(m: Mods, skill: SkillId, base: number): number {
  const pct = Math.min(75, skillMod(m, 'interval', skill));
  return Math.max(250, Math.round(base * (1 - pct / 100)));
}
