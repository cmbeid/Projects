import { BIOME, FAUNA_DEF } from '../../data/biomes';
import { CLASS } from '../../data/crew';
import { MAT } from '../../data/materials';
import { BAL } from '../../data/progression';
import type { MatId } from '../../data/types';
import type { AwayEnt, AwayState } from '../../state/types';
import { tileAt, walkable } from './gen';

/**
 * The landing, as a pure fixed-step simulation. `stepAway` takes the stick,
 * the action button and the skill button, and advances one tick; the
 * renderer only reads the state, and the bot drives the same inputs a thumb
 * would.
 */

export const DT = 1 / 60;
export const RADIUS = 0.3;
export const INTERACT = 1.25;
export const LANDER_REACH = 1.6;

export interface AwayInput {
  mx: number;
  my: number;
  act: boolean;
  skill: boolean;
}

export const NO_INPUT: AwayInput = { mx: 0, my: 0, act: false, skill: false };

function rnd(a: AwayState): number {
  a.rng = (a.rng + 0x6d2b79f5) | 0;
  let t = a.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function pop(a: AwayState, x: number, y: number, text: string, color = '#ffffff'): void {
  a.pops.push({ x, y, text, t: 0, color });
  if (a.pops.length > 24) a.pops.shift();
}

function blocked(a: AwayState, x: number, y: number, r: number): boolean {
  return (
    !walkable(tileAt(a, x - r, y - r)) ||
    !walkable(tileAt(a, x + r, y - r)) ||
    !walkable(tileAt(a, x - r, y + r)) ||
    !walkable(tileAt(a, x + r, y + r))
  );
}

/** Moves with wall sliding: each axis on its own. */
function move(a: AwayState, obj: { x: number; y: number }, dx: number, dy: number, r: number): void {
  if (!blocked(a, obj.x + dx, obj.y, r)) obj.x += dx;
  if (!blocked(a, obj.x, obj.y + dy, r)) obj.y += dy;
}

export function carried(a: AwayState): number {
  let n = 0;
  for (const [m, v] of Object.entries(a.haul) as [MatId, number][]) n += v * MAT.get(m)!.weight;
  return n;
}

export function nearestInteractable(a: AwayState): AwayEnt | null {
  let best: AwayEnt | null = null;
  let bd = INTERACT;
  for (const e of a.ents) {
    if (e.k === 'fauna' || e.k === 'turret') continue;
    if (e.k === 'node' && (e.amt ?? 0) <= 0) continue;
    const d = Math.hypot(e.x - a.x, e.y - a.y);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

export function nearLander(a: AwayState): boolean {
  return Math.hypot(a.lander.x - a.x, a.lander.y - a.y) <= LANDER_REACH;
}

function nearestFauna(a: AwayState, x: number, y: number, range: number): AwayEnt | null {
  let best: AwayEnt | null = null;
  let bd = range;
  for (const e of a.ents) {
    if (e.k !== 'fauna' || (e.hp ?? 0) <= 0) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

function shoot(a: AwayState, x: number, y: number, tx: number, ty: number, dmg: number, from: 'player' | 'fauna', speed: number): void {
  const d = Math.hypot(tx - x, ty - y) || 1;
  a.shots.push({ x, y, vx: ((tx - x) / d) * speed, vy: ((ty - y) / d) * speed, life: 1.2, dmg, from });
}

function interact(a: AwayState, e: AwayEnt): void {
  a.gatherCd = BAL.away.gatherCd;
  if (e.k === 'node' && e.mat) {
    const room = a.carryMax - carried(a);
    const weight = MAT.get(e.mat)!.weight;
    const want = Math.max(1, Math.round(BAL.away.gatherPer * a.stats.gather));
    const take = Math.min(e.amt ?? 0, want, Math.floor(room / weight));
    if (take <= 0) {
      pop(a, a.x, a.y - 0.6, 'Full!', '#ff8060');
      a.events.push('full');
      return;
    }
    e.amt = (e.amt ?? 0) - take;
    a.haul[e.mat] = (a.haul[e.mat] ?? 0) + take;
    pop(a, e.x, e.y - 0.5, `+${take} ${MAT.get(e.mat)!.name}`, MAT.get(e.mat)!.color);
    a.events.push('gather');
    return;
  }
  if (e.k === 'cache') {
    const b = BIOME.get(a.biome)!;
    const mats = Object.keys(b.mats) as MatId[];
    const m = mats[Math.floor(rnd(a) * mats.length)]!;
    const n = 2 + Math.floor(rnd(a) * 3);
    a.haul[m] = (a.haul[m] ?? 0) + n;
    a.haul.alloy = (a.haul.alloy ?? 0) + 1;
    const item = rnd(a) < 0.5 ? 'o2can' : rnd(a) < 0.5 ? 'medkit' : 'ration';
    a.items[item] = (a.items[item] ?? 0) + 1;
    pop(a, e.x, e.y - 0.5, 'Supply cache!', '#f0c860');
    a.events.push('cache');
  } else if (e.k === 'terminal') {
    a.terminals++;
    pop(a, e.x, e.y - 0.5, 'Log downloaded', '#5ad0f0');
    a.events.push('terminal');
  } else if (e.k === 'pod') {
    a.colonists++;
    pop(a, e.x, e.y - 0.5, 'Sleeper rescued!', '#a0f0a0');
    a.events.push('pod');
  } else if (e.k === 'objective') {
    a.gotObjective = true;
    pop(a, e.x, e.y - 0.5, 'Objective secured!', '#f0d040');
    a.events.push('objective');
  }
  a.ents = a.ents.filter((x) => x !== e);
}

function useSkill(a: AwayState): void {
  const cls = a.stats.cls;
  a.skillCd = a.skillMax;
  a.events.push(`skill-${cls}`);
  if (cls === 'pilot') a.dash = 0.28;
  else if (cls === 'engineer') a.ents.push({ id: a.nextEnt++, k: 'turret', x: a.x, y: a.y, life: 10, cd: 0 });
  else if (cls === 'scientist') {
    for (const e of a.ents) if (e.k !== 'fauna') e.marked = true;
    pop(a, a.x, a.y - 0.8, 'Survey pulse', '#c090f0');
  } else if (cls === 'medic') {
    a.hp = Math.min(a.hpMax, a.hp + 35);
    pop(a, a.x, a.y - 0.8, '+35', '#80f080');
  } else if (cls === 'soldier') {
    for (const e of a.ents) {
      if (e.k !== 'fauna' || (e.hp ?? 0) <= 0) continue;
      if (Math.hypot(e.x - a.x, e.y - a.y) < 3.2) hurtFauna(a, e, 30 * (a.stats.dmg / BAL.away.dmg));
    }
    pop(a, a.x, a.y - 0.8, 'BOOM', '#ffb040');
  }
}

function hurtFauna(a: AwayState, e: AwayEnt, dmg: number): void {
  e.hp = (e.hp ?? 0) - dmg;
  e.hurt = 0.15;
  e.state = 'chase';
  pop(a, e.x, e.y - 0.5, `${Math.round(dmg)}`, '#ffe0a0');
  if (e.hp <= 0) {
    a.kills++;
    a.events.push('kill');
    // Fauna drop organics; an alpha drops more, and sometimes crystal.
    a.haul.organics = (a.haul.organics ?? 0) + (e.alpha ? 4 : 1);
    if (e.alpha) a.haul.crystal = (a.haul.crystal ?? 0) + 2;
  }
}

function hurtPlayer(a: AwayState, dmg: number): void {
  a.hp -= dmg;
  a.events.push('hurt');
  pop(a, a.x, a.y - 0.6, `-${Math.round(dmg)}`, '#ff6060');
}

export function stepAway(a: AwayState, input: AwayInput, dt = DT): void {
  if (a.status !== 'play') return;
  a.t += dt;
  a.fireCd = Math.max(0, a.fireCd - dt);
  a.gatherCd = Math.max(0, a.gatherCd - dt);
  a.skillCd = Math.max(0, a.skillCd - dt);
  for (const p of a.pops) p.t += dt;
  a.pops = a.pops.filter((p) => p.t < 1.1);

  // ---- Movement
  const here = tileAt(a, a.x, a.y);
  let mx = input.mx;
  let my = input.my;
  const mag = Math.hypot(mx, my);
  if (mag > 1) {
    mx /= mag;
    my /= mag;
  }
  if (mag > 0.15) {
    a.fx = mx / Math.max(mag, 1e-6);
    a.fy = my / Math.max(mag, 1e-6);
  }
  const heavy = carried(a) > a.carryMax * 0.8 ? 0.85 : 1;
  let speed = a.stats.speed * heavy * (here === '~' ? 0.55 : 1);
  if (a.dash > 0) {
    a.dash -= dt;
    speed *= 3;
    if (mag < 0.15) {
      mx = a.fx;
      my = a.fy;
    }
  }
  move(a, a, mx * speed * dt, my * speed * dt, RADIUS);

  // ---- Environment
  const biome = BIOME.get(a.biome)!;
  a.o2 -= dt;
  if (a.o2 <= 0) {
    a.o2 = 0;
    a.hp -= 6 * dt;
  }
  const tile = tileAt(a, a.x, a.y);
  if (tile === ',') {
    if (a.shield > 0) a.shield = Math.max(0, a.shield - 7 * dt);
    else a.hp -= 5 * dt;
  }
  if (tile === '~' && biome.liquid !== 'water') {
    const burn = 14 * dt;
    if (a.shield > 0) a.shield = Math.max(0, a.shield - burn);
    a.hp -= burn * 0.6;
  }

  // ---- Act: interact if something's in reach, else shoot.
  if (input.act) {
    const target = nearestInteractable(a);
    if (target && a.gatherCd <= 0) interact(a, target);
    else if (!target && a.fireCd <= 0) {
      const f = nearestFauna(a, a.x, a.y, a.stats.range);
      a.fireCd = a.stats.fireCd;
      if (f) shoot(a, a.x, a.y, f.x, f.y, a.stats.dmg, 'player', 13);
      else shoot(a, a.x, a.y, a.x + a.fx, a.y + a.fy, a.stats.dmg, 'player', 13);
      a.events.push('shoot');
    }
  }
  if (input.skill && a.skillCd <= 0) useSkill(a);

  // ---- Fauna and turrets
  for (const e of a.ents) {
    if (e.k === 'turret') {
      e.life = (e.life ?? 0) - dt;
      e.cd = (e.cd ?? 0) - dt;
      if ((e.cd ?? 0) <= 0) {
        const f = nearestFauna(a, e.x, e.y, 6);
        if (f) {
          shoot(a, e.x, e.y, f.x, f.y, a.stats.dmg * 0.7, 'player', 12);
          e.cd = 0.55;
        }
      }
      continue;
    }
    if (e.k !== 'fauna' || (e.hp ?? 0) <= 0) continue;
    const def = FAUNA_DEF.get(e.fauna!)!;
    e.cd = (e.cd ?? 0) - dt;
    if (e.hurt) e.hurt = Math.max(0, e.hurt - dt);
    const dx = a.x - e.x;
    const dy = a.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d < def.aggro * (e.alpha ? 1.3 : 1)) e.state = 'chase';
    else if (d > def.aggro * 2.2) e.state = 'idle';
    const sp = def.speed * (e.alpha ? 1.1 : 1);
    if (e.state === 'chase') {
      const keep = def.ranged ? 3.5 : 0.6;
      const dir = d > keep ? 1 : def.ranged && d < keep - 1 ? -0.6 : 0;
      move(a, e, (dx / (d || 1)) * sp * dir * dt, (dy / (d || 1)) * sp * dir * dt, 0.3);
      if (e.cd <= 0) {
        const dmg = def.dmg * (e.alpha ? 1.6 : 1);
        if (def.ranged && d < def.aggro * 1.4) {
          shoot(a, e.x, e.y, a.x, a.y, dmg, 'fauna', 7);
          e.cd = def.cooldown;
        } else if (!def.ranged && d < 0.85) {
          hurtPlayer(a, dmg);
          e.cd = def.cooldown;
        }
      }
    } else {
      if (e.tx === undefined || Math.hypot((e.tx ?? 0) - e.x, (e.ty ?? 0) - e.y) < 0.3 || rnd(a) < 0.005) {
        e.tx = e.x + (rnd(a) - 0.5) * 6;
        e.ty = e.y + (rnd(a) - 0.5) * 6;
      }
      const wx = (e.tx ?? e.x) - e.x;
      const wy = (e.ty ?? e.y) - e.y;
      const wd = Math.hypot(wx, wy) || 1;
      move(a, e, (wx / wd) * sp * 0.35 * dt, (wy / wd) * sp * 0.35 * dt, 0.3);
    }
  }
  a.ents = a.ents.filter((e) => !(e.k === 'turret' && (e.life ?? 0) <= 0) && !(e.k === 'fauna' && (e.hp ?? 0) <= 0));

  // ---- Shots
  for (const sh of a.shots) {
    sh.x += sh.vx * dt;
    sh.y += sh.vy * dt;
    sh.life -= dt;
    if (!walkable(tileAt(a, sh.x, sh.y))) sh.life = 0;
    if (sh.life <= 0) continue;
    if (sh.from === 'player') {
      for (const e of a.ents) {
        if (e.k !== 'fauna' || (e.hp ?? 0) <= 0) continue;
        if (Math.hypot(e.x - sh.x, e.y - sh.y) < (e.alpha ? 0.65 : 0.5)) {
          hurtFauna(a, e, sh.dmg);
          sh.life = 0;
          break;
        }
      }
    } else if (Math.hypot(a.x - sh.x, a.y - sh.y) < 0.45) {
      hurtPlayer(a, sh.dmg);
      sh.life = 0;
    }
  }
  a.shots = a.shots.filter((sh) => sh.life > 0);

  if (a.hp <= 0) {
    a.hp = 0;
    a.status = 'down';
    a.events.push('down');
  }
}

/** Lifting off: only from the lander. */
export function liftOff(a: AwayState): boolean {
  if (a.status !== 'play' || !nearLander(a)) return false;
  a.status = 'done';
  a.events.push('liftoff');
  return true;
}

export function skillName(a: AwayState): string {
  return CLASS.get(a.stats.cls)!.away.name;
}
