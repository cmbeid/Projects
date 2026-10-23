/**
 * The clock. `advance` moves the game forward by some milliseconds: the
 * current activity, crops, the ranch, the settlement and buffs. The same
 * function runs a frame in the browser and a day offline.
 */
import { ACTION } from '../data/skills';
import type { GameState } from '../state/types';
import { notice } from './core';
import { maxHp, stepCombat } from './combat';
import { randInt } from './rng';
import { actionInterval, completeAction } from './skilling';
import { SURVEY_INTERVAL, claimGuildTasks, completeObstacle, completeSurvey, obstacleInterval, ranchTick, settlementTick, syncPlots } from './systems';
import { interval, mods } from './modifiers';

export { newGame } from './core';

const THIEVING_STUN = 3000;

/** At most this much is simulated per call to keep the browser responsive; offline loops over it. */
const SLICE = 60_000;

export function advance(s: GameState, ms: number): void {
  if (s.dead || ms <= 0) return;
  syncPlots(s);
  let left = ms;
  while (left > 0) {
    const dt = Math.min(SLICE, left);
    left -= dt;
    step(s, dt);
  }
  claimGuildTasks(s);
}

function step(s: GameState, dt: number): void {
  s.time += dt;
  ranchTick(s, dt);
  settlementTick(s, dt);
  if (s.buffs.length && s.buffs.some((b) => b.until <= s.time)) s.buffs = s.buffs.filter((b) => b.until > s.time);

  const a = s.activity;
  if (!a) {
    regenIdle(s, dt);
    return;
  }
  if (a.kind === 'combat') {
    stepCombat(s, dt);
    return;
  }
  regenIdle(s, dt);
  if (a.kind === 'skill') {
    const action = ACTION.get(a.action);
    if (!action) {
      s.activity = null;
      return;
    }
    let t = dt;
    while (t > 0 && s.activity === a) {
      if (a.stun > 0) {
        const used = Math.min(a.stun, t);
        a.stun -= used;
        t -= used;
        continue;
      }
      const iv = actionInterval(s, action);
      const need = iv - a.progress;
      if (t < need) {
        a.progress += t;
        break;
      }
      t -= need;
      a.progress = 0;
      const r = completeAction(s, action);
      if (r === 'stop') {
        s.activity = null;
        break;
      }
      if (r === 'failed' && action.skill === 'thieving') {
        a.stun = THIEVING_STUN;
        const max = maxHp(s);
        s.hp = Math.max(1, s.hp - randInt(s, 1, Math.max(1, Math.round(max * 0.06))));
      }
    }
    return;
  }
  if (a.kind === 'agility') {
    let t = dt;
    while (t > 0 && s.activity === a) {
      if (a.index < 0) {
        s.activity = null;
        notice(s, 'Your course is empty.', 'bad');
        return;
      }
      const iv = obstacleInterval(s, a.index);
      const need = iv - a.progress;
      if (t < need) {
        a.progress += t;
        break;
      }
      t -= need;
      a.progress = 0;
      completeObstacle(s);
    }
    return;
  }
  if (a.kind === 'survey') {
    let t = dt;
    while (t > 0 && s.activity === a) {
      const iv = interval(mods(s), 'cartography', SURVEY_INTERVAL);
      const need = iv - a.progress;
      if (t < need) {
        a.progress += t;
        break;
      }
      t -= need;
      a.progress = 0;
      completeSurvey(s);
    }
  }
}

/** Out of combat you heal 1% every two seconds. */
function regenIdle(s: GameState, dt: number): void {
  const max = maxHp(s);
  if (s.hp >= max) {
    s.hp = max;
    return;
  }
  s.hp = Math.min(max, s.hp + (max * 0.01 * dt) / 2000);
}

export function activityProgress(s: GameState): { label: string; frac: number; skill: string | null } | null {
  const a = s.activity;
  if (!a) return null;
  if (a.kind === 'skill') {
    const action = ACTION.get(a.action);
    if (!action) return null;
    return { label: action.name, frac: a.stun > 0 ? 0 : a.progress / actionInterval(s, action), skill: action.skill };
  }
  if (a.kind === 'agility') return { label: 'Agility course', frac: a.index >= 0 ? a.progress / obstacleInterval(s, a.index) : 0, skill: 'agility' };
  if (a.kind === 'survey') return { label: `Surveying ${a.hex}`, frac: a.progress / interval(mods(s), 'cartography', SURVEY_INTERVAL), skill: 'cartography' };
  return { label: 'Combat', frac: 0, skill: null };
}
