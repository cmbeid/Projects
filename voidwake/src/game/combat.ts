import { CLASS } from '../data/crew';
import { ENEMY } from '../data/enemies';
import { BAL } from '../data/progression';
import { SECTORS } from '../data/sectors';
import type { ClassId, ConsumableId, SubsysId } from '../data/types';
import type { CombatState, Fighter, GameState } from '../state/types';
import { gainMats, randomGear } from './crafting';
import { grantXp, healCrew, hurtCrew } from './crew';
import { conscious, derive } from './derive';
import { addLog } from './log';
import { pick, rand, stateRng } from './rng';

export const SUBSYSTEMS: readonly { id: SubsysId; name: string; desc: string }[] = [
  { id: 'weapons', name: 'Weapons', desc: 'Down: weapons stop charging.' },
  { id: 'shields', name: 'Shields', desc: 'Down: shields stop regenerating.' },
  { id: 'engines', name: 'Engines', desc: 'Down: no evasion, and no jumping away.' },
  { id: 'sensors', name: 'Sensors', desc: 'Down: −20% accuracy.' },
  { id: 'life', name: 'Life support', desc: 'Down: the crew take damage every turn.' },
];

export type CombatAction =
  | { k: 'fire' }
  | { k: 'brace' }
  | { k: 'ability'; cls: ClassId }
  | { k: 'jump' }
  | { k: 'item'; id: ConsumableId };

function subs(max: number): Fighter['subs'] {
  return {
    weapons: { hp: max, max },
    shields: { hp: max, max },
    engines: { hp: max, max },
    sensors: { hp: Math.max(2, max - 1), max: Math.max(2, max - 1) },
    life: { hp: Math.max(2, max - 1), max: Math.max(2, max - 1) },
  };
}

/** Enemy stats grow a little for each sector past the one they belong to. */
export function enemyScale(s: GameState, id: string): number {
  const home = SECTORS.findIndex((sec) => sec.enemies.includes(id) || sec.boss === id);
  const extra = Math.max(0, s.sector.index - Math.max(0, home));
  return 1 + extra * BAL.enemyScale;
}

export function startCombat(s: GameState, enemyId: string, opts: { storyId?: string; questUid?: number } = {}): void {
  const id = enemyId === '@sector' ? pick(stateRng(s), SECTORS[s.sector.index]!.enemies) : enemyId;
  const def = ENEMY.get(id)!;
  const k = enemyScale(s, id) * BAL.enemyHull;
  const kd = enemyScale(s, id) * BAL.enemyDmg;
  const weak = def.boss && s.story.flags.includes('echo-weak') && id === 'boss-echo' ? 0.6 : 1;
  const d = derive(s);
  const subMax = def.boss ? 5 + s.sector.index : 3 + Math.floor(s.sector.index / 2);
  const enemy: Fighter = {
    name: def.name,
    hull: Math.round(def.hull * k),
    maxHull: Math.round(def.hull * k),
    shield: Math.round(def.shields * k * weak),
    maxShield: Math.round(def.shields * k * weak),
    regen: Math.max(1, Math.round(def.shields * 0.15 * k * weak)),
    evasion: def.evasion,
    subs: subs(subMax),
    weapons: def.weapons.map((w) => ({ kind: w.kind, dmg: Math.round(w.dmg * kd * 10) / 10, cd: w.cd, charge: w.cd - 1 })),
  };
  const playerSub = 3 + Math.floor(s.sector.index / 2);
  s.combat = {
    enemyId: id,
    enemy,
    player: {
      shield: d.shieldMax,
      maxShield: d.shieldMax,
      regen: d.regen,
      evasion: d.evasion,
      subs: subs(playerSub),
      weapons: d.weapons.map((w) => ({ ...w, charge: w.cd - 1 })),
    },
    target: 'weapons',
    turn: 1,
    evadeTurns: 0,
    scanned: false,
    braced: false,
    jump: 0,
    log: [`${def.name} engages!`],
    result: null,
    loot: null,
    fx: [],
    ...(opts.storyId ? { storyId: opts.storyId } : {}),
    ...(opts.questUid !== undefined ? { questUid: opts.questUid } : {}),
  };
  s.screen = 'combat';
  s.stats.fights++;
  if (!s.codex.enemies.includes(id)) s.codex.enemies.push(id);
  addLog(s, `Engaged ${def.name}.`, 'combat');
}

export function abilityReady(s: GameState, cls: ClassId): boolean {
  return s.crew.some((c) => c.cls === cls && conscious(c));
}

export function canJumpAway(s: GameState): boolean {
  const c = s.combat;
  if (!c) return false;
  return c.player.subs.engines.hp > 0;
}

export const JUMP_TURNS = 3;
/** Shields soak at most this share of each laser shot; the rest burns through. */
export const SHIELD_SOAK = 0.75;

function hitChance(acc: number, evasion: number): number {
  return Math.max(0.15, Math.min(0.97, 0.85 + acc - evasion));
}

function damageSub(f: { subs: Fighter['subs'] }, sub: SubsysId, n: number): void {
  const x = f.subs[sub];
  x.hp = Math.max(0, x.hp - n);
}

function liveTarget(f: { subs: Fighter['subs'] }, prefer: readonly SubsysId[]): SubsysId {
  for (const p of prefer) if (f.subs[p].hp > 0) return p;
  const any = (Object.keys(f.subs) as SubsysId[]).find((k) => f.subs[k].hp > 0);
  return any ?? prefer[0] ?? 'weapons';
}

/**
 * One full round: our action, our volley, their action, their volley, then
 * regeneration. Returns false if the action isn't legal right now.
 */
export function combatTurn(s: GameState, action: CombatAction): boolean {
  const c = s.combat;
  if (!c || c.result) return false;
  const d = derive(s);
  const p = c.player;
  const e = c.enemy;
  const def = ENEMY.get(c.enemyId)!;
  const log: string[] = [];
  c.fx = [];
  c.braced = false;
  let focus = 0;

  // ---- Our action
  switch (action.k) {
    case 'fire':
      focus = 0.1;
      break;
    case 'brace':
      c.braced = true;
      p.shield = Math.min(p.maxShield, p.shield + p.regen);
      log.push('You brace and divert power to the shields.');
      break;
    case 'jump':
      if (!canJumpAway(s)) return false;
      c.jump++;
      log.push(`Jump drive charging: ${c.jump}/${JUMP_TURNS}.`);
      break;
    case 'ability': {
      if (!abilityReady(s, action.cls)) return false;
      const name = CLASS.get(action.cls)!.combat.name;
      if (action.cls === 'pilot') c.evadeTurns = 2;
      if (action.cls === 'engineer') {
        const worst = (Object.keys(p.subs) as SubsysId[]).sort((a, b) => p.subs[a].hp / p.subs[a].max - p.subs[b].hp / p.subs[b].max)[0]!;
        const n = Math.round(2 * (1 + (d.mods.repair ?? 0)));
        p.subs[worst].hp = Math.min(p.subs[worst].max, p.subs[worst].hp + n);
        s.res.hull = Math.min(d.maxHull, s.res.hull + Math.round(3 * (1 + (d.mods.repair ?? 0))));
      }
      if (action.cls === 'scientist') c.scanned = true;
      if (action.cls === 'soldier') {
        damageSub(e, c.target, 3);
        e.hull -= 4;
        const soldier = s.crew.find((m) => m.cls === 'soldier' && conscious(m))!;
        if (rand(s) < 0.4) hurtCrew(soldier, 8);
      }
      if (action.cls === 'medic') for (const m of s.crew) healCrew(m, 15);
      log.push(`${name}!`);
      break;
    }
    case 'item': {
      if (s.items[action.id] <= 0) return false;
      if (action.id === 'repairkit') s.res.hull = Math.min(d.maxHull, s.res.hull + 12);
      else if (action.id === 'shieldcell') p.shield = p.maxShield;
      else if (action.id === 'decoy') {
        if (def.boss) return false;
        c.jump = JUMP_TURNS;
      } else if (action.id === 'powercell') {
        for (const w of p.weapons) w.charge = w.cd;
      } else if (action.id === 'medkit') {
        const hurt = [...s.crew].sort((a, b) => a.hp - b.hp)[0];
        if (hurt) healCrew(hurt, 40);
      } else return false;
      s.items[action.id]--;
      log.push(`Used a ${action.id === 'powercell' ? 'power cell (weapons charged)' : action.id}.`);
      break;
    }
  }
  if (c.jump >= JUMP_TURNS) {
    c.result = 'fled';
    c.log = [...log, 'The jump drive fires. You escape!'];
    s.res.fuel = Math.max(0, s.res.fuel - 0.5);
    addLog(s, `Escaped from ${def.name}.`, 'combat');
    return true;
  }

  // ---- Our volley
  if (p.subs.weapons.hp > 0) for (const w of p.weapons) w.charge = Math.min(w.cd, w.charge + 1);
  const acc = d.accuracy + focus + (c.scanned ? 0.25 : 0) - (p.subs.sensors.hp > 0 ? 0 : 0.2);
  const eEvasion = e.subs.engines.hp > 0 ? e.evasion : 0;
  for (const w of p.weapons) {
    if (w.charge < w.cd) continue;
    w.charge = 0;
    const hit = rand(s) < hitChance(acc, eEvasion);
    c.fx.push({ from: 'player', kind: w.kind, hit, sub: c.target });
    if (!hit) {
      log.push(`Your ${w.kind} misses.`);
      continue;
    }
    const subDmg = c.scanned ? 2 : 1;
    if (w.kind === 'ion') {
      const before = e.shield;
      e.shield = Math.max(0, e.shield - w.dmg * 1.5);
      if (before <= w.dmg * 1.5) {
        damageSub(e, c.target, subDmg);
        for (const ew of e.weapons) ew.charge = Math.max(0, ew.charge - 1);
      }
      log.push(`Ion hit: shields down to ${Math.round(e.shield)}.`);
      continue;
    }
    let dmg = w.dmg;
    if (w.kind === 'laser') {
      const soak = Math.min(e.shield, dmg * SHIELD_SOAK);
      e.shield -= soak;
      dmg -= soak;
    }
    if (dmg > 0) {
      e.hull -= dmg;
      damageSub(e, c.target, subDmg);
    }
    log.push(dmg > 0 ? `Your ${w.kind} hits for ${Math.round(dmg)}.` : `Your ${w.kind} splashes on their shields.`);
  }
  c.scanned = false;
  if (e.hull <= 0) {
    win(s, c);
    c.log = [...log, `${def.name} breaks apart!`];
    return true;
  }

  // ---- Their action: patch a broken system now and then, otherwise fire.
  const broken = (Object.keys(e.subs) as SubsysId[]).find((k) => e.subs[k].hp === 0);
  if (broken && rand(s) < 0.3) {
    e.subs[broken].hp = 1;
    log.push(`They patch their ${broken}.`);
  }
  if (e.subs.weapons.hp > 0) for (const w of e.weapons) w.charge = Math.min(w.cd, w.charge + 1);
  const pEvasion = p.subs.engines.hp > 0 ? p.evasion + (c.evadeTurns > 0 ? 0.3 : 0) : 0;
  const eAcc = e.subs.sensors.hp > 0 ? 0 : -0.2;
  for (const w of e.weapons) {
    if (w.charge < w.cd) continue;
    w.charge = 0;
    const target = liveTarget(p, def.targets);
    const hit = rand(s) < hitChance(eAcc, pEvasion);
    c.fx.push({ from: 'enemy', kind: w.kind, hit, sub: target });
    if (!hit) {
      log.push(`Their ${w.kind} misses.`);
      continue;
    }
    if (w.kind === 'ion') {
      const before = p.shield;
      p.shield = Math.max(0, p.shield - w.dmg * 1.5);
      if (before <= w.dmg * 1.5) damageSub(p, target, 1);
      log.push('Ion hit: your shields flicker.');
      continue;
    }
    let dmg = w.dmg * (c.braced ? 0.75 : 1);
    if (w.kind === 'laser') {
      const soak = Math.min(p.shield, dmg * SHIELD_SOAK);
      p.shield -= soak;
      dmg -= soak;
    }
    if (dmg > 0) {
      s.res.hull = Math.max(0, s.res.hull - dmg);
      damageSub(p, target, 1);
      if (rand(s) < 0.25) {
        const victims = s.crew.filter(conscious);
        if (victims.length) {
          const v = pick(stateRng(s), victims);
          hurtCrew(v, 6);
          log.push(`${v.name} is hurt by the impact.`);
        }
      }
    }
    log.push(dmg > 0 ? `Their ${w.kind} hits your ${target} for ${Math.round(dmg)}.` : `Their ${w.kind} splashes on your shields.`);
  }

  // ---- Regeneration and upkeep
  if (p.subs.shields.hp > 0) p.shield = Math.min(p.maxShield, p.shield + p.regen);
  if (e.subs.shields.hp > 0) e.shield = Math.min(e.maxShield, e.shield + e.regen);
  if (p.subs.life.hp <= 0) {
    for (const m of s.crew) hurtCrew(m, 4);
    log.push('Life support is down: the crew are choking.');
  }
  if (c.evadeTurns > 0) c.evadeTurns--;
  c.turn++;
  s.res.hull = Math.round(s.res.hull * 10) / 10;
  e.hull = Math.round(e.hull * 10) / 10;
  if (s.res.hull <= 0 || s.crew.every((m) => !conscious(m))) {
    c.result = 'lose';
    log.push('The Wren goes dark.');
    addLog(s, `Destroyed by ${def.name}.`, 'combat');
  }
  c.log = log;
  return true;
}

function win(s: GameState, c: CombatState): void {
  const def = ENEMY.get(c.enemyId)!;
  const k = enemyScale(s, c.enemyId);
  const r = stateRng(s);
  const mats: typeof def.reward.mats = {};
  for (const [m, n] of Object.entries(def.reward.mats)) mats[m as keyof typeof mats] = Math.max(1, Math.round(n * k * (0.7 + r() * 0.6)));
  const credits = Math.round(def.reward.credits * k * (0.8 + r() * 0.4));
  const gear = def.boss || r() < 0.25 ? randomGear(s, r, s.sector.index, def.boss ? 2 : 0) : null;
  c.result = 'win';
  c.loot = { credits, mats, gear };
  s.res.credits += credits;
  gainMats(s, mats);
  if (gear) s.gear.push(gear);
  if (def.faction !== 'none' && !def.boss) s.rep[def.faction] = Math.max(-100, s.rep[def.faction] - 4);
  s.stats.wins++;
  grantXp(s, def.boss ? 60 + 25 * s.sector.index : 18 + 8 * s.sector.index);
  addLog(s, `Defeated ${def.name}. +${credits} credits.`, 'combat');
}
