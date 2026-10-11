import { BAL } from '../data/progression';
import type { GameState } from '../state/types';
import { healCrew, hurtCrew, setMorale } from './crew';
import { conscious, derive } from './derive';
import { addLog } from './log';

export interface DayReport {
  ate: number;
  grew: number;
  energy: number;
  refined: number;
  starving: boolean;
  dark: boolean;
}

/**
 * One day aboard: the crew eat, hydroponics grows, the reactor charges and
 * life support draws, the refinery cracks ice, wounds heal and morale drifts.
 * Running out of food or power hurts the crew instead of ending the game.
 */
export function passDay(s: GameState): DayReport {
  s.day++;
  const d = derive(s);
  const rep: DayReport = { ate: d.eat, grew: d.grow, energy: d.reactor - d.upkeep, refined: 0, starving: false, dark: false };

  s.res.food = Math.min(d.maxFood, s.res.food + d.grow);
  s.res.food -= d.eat;
  if (s.res.food < 0) {
    s.res.food = 0;
    rep.starving = true;
  }

  s.res.energy = Math.min(d.maxEnergy, s.res.energy + d.reactor) - d.upkeep;
  if (s.res.energy < 0) {
    s.res.energy = 0;
    rep.dark = true;
  }
  s.res.food = Math.round(s.res.food * 100) / 100;
  s.res.energy = Math.round(s.res.energy * 100) / 100;

  const moraleMods = 1 - (d.mods.morale ?? 0);
  for (const c of s.crew) {
    if (rep.starving) {
      hurtCrew(c, BAL.starveHp);
      setMorale(c, c.morale - BAL.starveMorale * moraleMods);
    }
    if (rep.dark) {
      hurtCrew(c, BAL.darkHp);
      setMorale(c, c.morale - 6 * moraleMods);
    }
    if (!rep.starving && !rep.dark) {
      healCrew(c, (BAL.healPerDay + d.medbay) * (1 + (d.mods.heal ?? 0)) * (conscious(c) ? 1 : 0.5) + (conscious(c) ? 0 : 1));
      // Morale drifts back toward its resting point; good traits slow the fall.
      const rest = BAL.moraleRest + (s.colonists >= 30 ? 5 : 0);
      if (c.morale < rest) setMorale(c, c.morale + 2);
      else if (c.morale > rest) setMorale(c, c.morale - 1 * moraleMods);
    }
  }
  if (rep.starving) addLog(s, 'The food ran out. The crew are starving.', 'warn');
  if (rep.dark) addLog(s, 'The batteries are flat. Life support is failing.', 'warn');
  return rep;
}

/** After a jump, the refinery turns ice into fuel. */
export function refine(s: GameState): number {
  const d = derive(s);
  if (!d.refinery) return 0;
  const room = d.maxFuel - s.res.fuel;
  const most = Math.min(d.refinery * 2, Math.floor(s.mats.ice / 2), Math.floor(room));
  if (most <= 0) return 0;
  s.mats.ice -= most * 2;
  s.res.fuel += most;
  return most;
}

export function allDown(s: GameState): boolean {
  return s.crew.every((c) => !conscious(c));
}
