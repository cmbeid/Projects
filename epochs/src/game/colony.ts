import { HERITAGE_NODE, TRAITS, WORLD_NAMES } from '../data/heritage';
import { HERITAGE_BASE, HERITAGE_PER_TECH, HERITAGE_PER_WONDER } from '../data/progression';
import { WONDER, WONDERS } from '../data/wonders';
import type { GameState, World } from '../state/types';
import { derive } from './derive';
import { startRun } from './engine';
import { emit } from './events';
import { unlockFeature } from './features';
import { wonderComplete } from './progress';
import { rand } from './rng';

/**
 * The prestige layer. The colony ship carries the city's Heritage to a new
 * world, chosen from three on offer, each with its own traits. Everything
 * else stays behind.
 */

export const SHIP = 'colony-ship';

export function shipReady(s: GameState): boolean {
  return wonderComplete(s, WONDER.get(SHIP)!);
}

/** Heritage the colonists would carry if they launched now. */
export function heritageFor(s: GameState): number {
  const wonders = WONDERS.filter((w) => wonderComplete(s, w)).length;
  const base = HERITAGE_BASE + Math.sqrt(Math.floor(s.pop)) + wonders * HERITAGE_PER_WONDER + s.techs.length * HERITAGE_PER_TECH;
  return Math.floor(base * (1 + derive(s).bonuses.heritageGain));
}

function rollWorld(s: GameState, taken: Set<string>): World {
  let name = WORLD_NAMES[Math.floor(rand(s) * WORLD_NAMES.length)]!;
  for (let i = 0; taken.has(name) && i < 20; i++) name = WORLD_NAMES[Math.floor(rand(s) * WORLD_NAMES.length)]!;
  taken.add(name);
  const traits: string[] = [];
  const count = rand(s) < 0.5 ? 1 : 2;
  while (traits.length < count) {
    const t = TRAITS[Math.floor(rand(s) * TRAITS.length)]!;
    if (!traits.includes(t.id)) traits.push(t.id);
  }
  return { name, traits, number: s.world.number + 1 };
}

/** Once the ship is finished, three worlds are offered, and stay offered until one is chosen. */
export function checkShip(s: GameState): void {
  if (s.offers || !shipReady(s)) return;
  const taken = new Set<string>([s.world.name]);
  s.offers = [rollWorld(s, taken), rollWorld(s, taken), rollWorld(s, taken)];
  unlockFeature(s, 'heritage');
  emit({ type: 'shipReady' });
}

export function launch(s: GameState, offer: number): boolean {
  const world = s.offers?.[offer];
  if (!world) return false;
  const gain = heritageFor(s);
  s.heritage.points += gain;
  s.heritage.earned += gain;
  s.stats.launches += 1;
  s.world = world;
  startRun(s);
  unlockFeature(s, 'heritage');
  emit({ type: 'launch', heritage: gain, world: world.name });
  return true;
}

export function canBuyNode(s: GameState, id: string): boolean {
  const n = HERITAGE_NODE.get(id);
  if (!n || s.heritage.nodes.includes(id)) return false;
  return s.heritage.points >= n.cost && n.requires.every((r) => s.heritage.nodes.includes(r));
}

/** Heritage nodes take effect at once where they can, and the rest from the next landing. */
export function buyNode(s: GameState, id: string): boolean {
  if (!canBuyNode(s, id)) return false;
  const n = HERITAGE_NODE.get(id)!;
  s.heritage.points -= n.cost;
  s.heritage.nodes.push(id);
  for (const e of n.effects) if (e.k === 'feature') unlockFeature(s, e.f);
  return true;
}
