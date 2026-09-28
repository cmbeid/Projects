/**
 * A battle as a string and back, so one in progress survives the tab
 * closing. Everything that changes during a battle is written; what can be
 * rebuilt from the map (its paths, the tile sets) is rebuilt instead, and
 * shared data — tower lines, species — is stored by id and relinked, as
 * `retryWave` does for its checkpoint.
 *
 * The random numbers start from a fresh seed: a resumed battle carries on,
 * it doesn't replay.
 */
import { MAP_BY_ID } from '../data/maps';
import { type Species, species } from '../data/species';
import { line, type TowerLine } from '../data/towers';
import { type BattleSetup, type Enemy, type Game, newGame, type Tower } from './game';

const VERSION = 1;

/** Fields rebuilt from the map rather than stored. */
const REBUILT = new Set<keyof Game>(['map', 'rng', 'paths', 'pathSet', 'iceSet', 'events']);

export function serializeGame(g: Game): string {
  const state = Object.fromEntries(Object.entries(g).filter(([k]) => !REBUILT.has(k as keyof Game)));
  return JSON.stringify({ v: VERSION, mapId: g.map.id, state }, (key, value: unknown) => {
    if (value instanceof Set) return { __set: [...value] };
    // Shared data by id: a tower's line, an enemy's species.
    if (key === 'line' && value && typeof value === 'object' && 'stages' in value) return (value as TowerLine).id;
    if (key === 'sp' && value && typeof value === 'object' && 'catchRate' in value) return (value as Species).dex;
    return value;
  });
}

function relink(towers: Tower[], enemies: Enemy[]): void {
  for (const t of towers) t.line = line(t.line as unknown as string);
  for (const e of enemies) e.sp = species(e.dex);
}

/** The battle a snapshot holds, or null if it can't be read (an old version, a map that's gone). */
export function restoreGame(json: string, setup: Omit<BattleSetup, 'map'>): Game | null {
  try {
    const data = JSON.parse(json, (_key, value: unknown) =>
      value && typeof value === 'object' && '__set' in value ? new Set((value as { __set: unknown[] }).__set) : value,
    ) as { v: number; mapId: string; state: Partial<Game> };
    const map = MAP_BY_ID.get(data.mapId);
    if (data.v !== VERSION || !map || !data.state) return null;
    const g = newGame({ ...setup, map });
    Object.assign(g, data.state, { events: [] });
    relink(g.towers, g.enemies);
    if (g.checkpoint) relink(g.checkpoint.state.towers, g.checkpoint.state.enemies);
    return g;
  } catch {
    return null;
  }
}
