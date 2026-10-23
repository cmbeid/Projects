import { AREA } from '../data/combat';
import { ITEM } from '../data/items';
import { QUEST } from '../data/meta';
import { POI } from '../data/special';
import { SKILL_INFO } from '../data/skills';
import type { Requirement } from '../data/types';
import type { GameState } from '../state/types';
import { count, level } from './core';

export function met(s: GameState, r: Requirement): boolean {
  switch (r.kind) {
    case 'level':
      return level(s, r.skill) >= r.level;
    case 'quest':
      return s.quests.includes(r.quest);
    case 'poi':
      return poiFound(s, r.poi);
    case 'dungeon':
      return (s.counters[`clear:${r.dungeon}`] ?? 0) > 0;
    case 'item':
      return count(s, r.item) > 0;
  }
}

export function allMet(s: GameState, reqs: readonly Requirement[] | undefined): boolean {
  return !reqs || reqs.every((r) => met(s, r));
}

export function describe(r: Requirement): string {
  switch (r.kind) {
    case 'level':
      return `${SKILL_INFO[r.skill].name} ${r.level}`;
    case 'quest':
      return `Quest: ${QUEST.get(r.quest)?.name ?? r.quest}`;
    case 'poi':
      return `Find ${POI.get(r.poi)?.name ?? r.poi} (Cartography)`;
    case 'dungeon':
      return `Clear ${AREA.get(r.dungeon)?.name ?? r.dungeon}`;
    case 'item':
      return `Own ${ITEM.get(r.item)?.name ?? r.item}`;
  }
}

export function poiFound(s: GameState, poi: string): boolean {
  const p = POI.get(poi);
  if (!p) return false;
  return s.surveyed.includes(`${p.q},${p.r}`);
}
