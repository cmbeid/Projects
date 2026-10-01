/**
 * Resource spots on the routes: Apricorn trees in Whisperwood (one colour
 * each, regrowing over a few days), fallen logs there (fresh wood each day)
 * and ore rocks in Granite Pass (deeper rocks hold more iron).
 */
import { item } from '../data/items';
import { nodeAt, type MapId, type ResourceNode } from '../data/maps';
import { giveItem } from './farm';
import type { World } from './model';
import { nextRandom } from './rng';
import { addSkillXp } from './skills';

export const GATHER_ENERGY = 3;
const REGROW: Record<ResourceNode['kind'], number> = { apricorn: 3, log: 1, ore: 1 };

export function nodeKey(map: MapId, x: number, y: number): string {
  return `${map}:${x},${y}`;
}

export function nodeReady(world: World, map: MapId, x: number, y: number): boolean {
  return (world.nodes[nodeKey(map, x, y)] ?? 0) <= world.day;
}

/** What a spot gives: an Apricorn, two or three logs' worth of wood, or a lump of ore. */
function yieldOf(world: World, node: ResourceNode): [string, number] {
  if (node.kind === 'apricorn') return [node.apricorn!, 1];
  if (node.kind === 'log') return ['wood', 2 + (nextRandom(world.rng) < 0.5 ? 1 : 0)];
  const deep = node.y >= 16;
  const r = nextRandom(world.rng);
  const ore = r < (deep ? 0.1 : 0.05) ? 'nugget' : r < (deep ? 0.6 : 0.3) ? 'iron-ore' : 'copper-ore';
  return [ore, ore === 'nugget' ? 1 : 1 + (nextRandom(world.rng) < 0.4 ? 1 : 0)];
}

export function gather(world: World, x: number, y: number): boolean {
  const node = nodeAt(world.map, x, y);
  if (!node) return false;
  if (!nodeReady(world, world.map, x, y)) {
    world.events.push({ kind: 'hint', x, y, text: node.kind === 'apricorn' ? 'No Apricorns yet. Check back in a day or two' : 'Nothing left today' });
    return false;
  }
  if (world.player.energy < GATHER_ENERGY) {
    world.events.push({ kind: 'hint', x, y, text: 'Too tired. Get some sleep' });
    return false;
  }
  world.player.energy -= GATHER_ENERGY;
  const [id, n] = yieldOf(world, node);
  giveItem(world, id, n);
  if (node.kind === 'apricorn') world.stats.apricorns += n;
  world.nodes[nodeKey(world.map, x, y)] = world.day + REGROW[node.kind];
  addSkillXp(world, 'farming', 2);
  world.events.push({ kind: 'gather', x, y, text: n > 1 ? `${item(id).name} ×${n}` : item(id).name });
  return true;
}
