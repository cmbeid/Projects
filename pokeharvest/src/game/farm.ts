/**
 * The field: what a tap on a tile does with what's in hand, and how the
 * crops grow overnight.
 */
import { crop, inSeason } from '../data/crops';
import { ITEMS, item } from '../data/items';
import { MAPS, doorAt, gateAt, nodeAt, tileAt, walkable } from '../data/maps';
import { gather } from './forage';
import { npcAt } from './npcs';
import { CAN_CAPACITY, TOOL_TIERS, type UpgradableTool } from '../data/progress';
import { pet } from './barn';
import { canPlace, collectMachine, isDone, pickUpMachine, placeMachine } from './machines';
import { hasBuff, hasPerk, plotKey, tileOf, type CropState, type Dir, type World } from './model';
import type { Point } from './path';
import { nextRandom } from './rng';
import { addSkillXp } from './skills';
import { seasonOf } from './time';
import { DELTA } from './walk';

export type Action =
  | 'till' | 'water' | 'plant' | 'harvest' | 'clear' | 'untill' | 'refill'
  | 'sleep' | 'bin' | 'mart' | 'smith' | 'barn' | 'board' | 'merchant'
  | 'place' | 'machine' | 'pickup' | 'pet' | 'talk' | 'door' | 'gather';

/** What using a tile would do: an action, nothing worth doing (just walk there), or a reason it can't. */
export type Intent = { kind: 'use'; action: Action } | { kind: 'walk' } | { kind: 'deny'; text: string };

/** Energy each action costs with basic tools. */
export const COST: Partial<Record<Action, number>> = { till: 3, water: 2, clear: 2, untill: 1 };

export function isRipe(c: CropState): boolean {
  return c.growth >= crop(c.id).days;
}

/** 0 seed, 1 sprout, 2 growing, 3 ripe: what the renderer draws. */
export function stageOf(c: CropState): 0 | 1 | 2 | 3 {
  if (isRipe(c)) return 3;
  if (c.growth <= 0) return 0;
  return c.growth < crop(c.id).days / 2 ? 1 : 2;
}

export function canCapacity(world: World): number {
  return CAN_CAPACITY[world.tools.can]! * (hasPerk(world, 'deep-can') ? 2 : 1);
}

export function toolName(tool: UpgradableTool, tier: number): string {
  const base = tool === 'hoe' ? 'Hoe' : 'Watering Can';
  return tier === 0 ? base : `${TOOL_TIERS[tier]} ${base}`;
}

/**
 * The tiles a hoe or can of this tier reaches from `at`: one, then three in
 * a line away from the farmer, then a 3 × 3 square around it.
 */
export function toolArea(tier: number, at: Point, facing: Dir): Point[] {
  if (tier <= 0) return [at];
  if (tier === 1) {
    const d = DELTA[facing];
    return [0, 1, 2].map((i) => ({ x: at.x + d.x * i, y: at.y + d.y * i }));
  }
  const out: Point[] = [];
  for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) out.push({ x: at.x + dx, y: at.y + dy });
  return out;
}

/** Energy for a tool action: bigger tools cost a little more, gold ones and the Hardy perk less. */
export function actionCost(world: World, action: Action): number {
  const base = COST[action] ?? 0;
  if (!base) return 0;
  const tier = action === 'till' ? world.tools.hoe : action === 'water' ? world.tools.can : 0;
  const size = tier === 0 ? 0 : tier === 3 ? 1 : tier;
  return Math.max(1, base + size - (hasPerk(world, 'hardy') ? 1 : 0) - (hasBuff(world, 'steady') ? 1 : 0));
}

/** Soil you can dig: open grass, or the greenhouse beds once it's repaired. */
export function soilAt(world: World, x: number, y: number): boolean {
  const kind = tileAt(world.map, x, y);
  return MAPS[world.map].farmable && (kind === 'grass' || (kind === 'ghsoil' && world.greenhouse));
}

/** Under glass, where seasons don't matter. */
export function underGlass(x: number, y: number): boolean {
  return tileAt('farm', x, y) === 'ghsoil';
}

function tillable(world: World, x: number, y: number): boolean {
  return soilAt(world, x, y) && !world.plots[plotKey(x, y)] && !world.machines[plotKey(x, y)];
}

function waterable(world: World, x: number, y: number): boolean {
  const plot = world.map === 'farm' ? world.plots[plotKey(x, y)] : undefined;
  return Boolean(plot && !plot.watered && !(plot.crop && isRipe(plot.crop)));
}

/**
 * What tapping (x, y) would do. A Pokémon standing there gets a pat, but
 * only when what's in hand has nothing better to do on that tile.
 */
export function intentAt(world: World, x: number, y: number): Intent {
  if (npcAt(world, x, y)) return { kind: 'use', action: 'talk' };
  const gate = gateAt(world.map, x, y);
  if (gate && !world.story.flags.includes(gate.flag)) return { kind: 'deny', text: gate.text };
  const base = toolIntent(world, x, y);
  if (base.kind !== 'walk') return base;
  const friend = helperAt(world, x, y);
  return friend !== null && !world.petted.includes(friend) ? { kind: 'use', action: 'pet' } : base;
}

function toolIntent(world: World, x: number, y: number): Intent {
  const kind = tileAt(world.map, x, y);
  const held = world.selected;
  if (kind === 'door') return { kind: 'use', action: 'sleep' };
  if (kind === 'bin') return { kind: 'use', action: 'bin' };
  if (kind === 'mart') return { kind: 'use', action: 'mart' };
  if (kind === 'smith') return { kind: 'use', action: 'smith' };
  if (kind === 'barn' || kind === 'barndoor') return { kind: 'use', action: 'barn' };
  if (kind === 'board') return { kind: 'use', action: 'board' };
  if (kind === 'merchant') return { kind: 'use', action: 'merchant' };
  if (doorAt(world.map, x, y)) return { kind: 'use', action: 'door' };
  if (nodeAt(world.map, x, y)) return { kind: 'use', action: 'gather' };
  if (world.map === 'farm' && world.machines[plotKey(x, y)]) return { kind: 'use', action: held === 'sickle' ? 'pickup' : 'machine' };
  if (kind === 'water') {
    if (held !== 'can') return { kind: 'deny', text: 'Hold the can to fill it' };
    return world.player.water >= canCapacity(world) ? { kind: 'deny', text: 'The can is full' } : { kind: 'use', action: 'refill' };
  }
  if (!walkable(kind)) return { kind: 'deny', text: '' };

  const farm = MAPS[world.map].farmable;
  const plot = farm ? world.plots[plotKey(x, y)] : undefined;
  if (plot?.crop && isRipe(plot.crop)) return { kind: 'use', action: 'harvest' };
  const def = ITEMS.get(held);
  const tool = held === 'hoe' || held === 'can' || held === 'sickle' || def?.kind === 'seed' || def?.kind === 'machine';
  // Off the farm, tools do nothing: a tap just walks.
  if (tool && !farm) return { kind: 'walk' };
  if (kind === 'ghsoil' && !world.greenhouse) {
    return held === 'hoe' ? { kind: 'deny', text: 'The greenhouse needs repairs. Ask the carpenter at the barn' } : { kind: 'walk' };
  }
  if (kind !== 'grass' && kind !== 'ghsoil') return { kind: 'walk' };

  if (held === 'hoe') return plot ? { kind: 'walk' } : { kind: 'use', action: 'till' };
  if (held === 'can') {
    if (!plot || plot.watered) return { kind: 'walk' };
    return world.player.water > 0 ? { kind: 'use', action: 'water' } : { kind: 'deny', text: 'The can is empty. Fill it at the pond' };
  }
  if (held === 'sickle') {
    if (plot?.crop) return { kind: 'use', action: 'clear' };
    return plot ? { kind: 'use', action: 'untill' } : { kind: 'walk' };
  }
  if (def?.kind === 'machine') {
    return canPlace(world, x, y) ? { kind: 'use', action: 'place' } : { kind: 'deny', text: 'Place it on open grass' };
  }
  if (def?.kind === 'seed') {
    if (!plot) return { kind: 'deny', text: 'Till the soil first' };
    if (plot.crop) return { kind: 'walk' };
    const season = seasonOf(world.day);
    if (!underGlass(x, y) && !inSeason(def.crop!, season)) return { kind: 'deny', text: `${crop(def.crop!).name} won't grow in ${season}` };
    return { kind: 'use', action: 'plant' };
  }
  return { kind: 'walk' };
}

/**
 * Pick a ripe crop: berries to the bag (or wherever `into` says), the plant
 * reset if it regrows. Returns what was picked.
 */
export function pick(world: World, x: number, y: number, into: Record<string, number> = world.inventory): { id: string; count: number } | null {
  const plot = world.plots[plotKey(x, y)];
  const c = plot?.crop;
  if (!plot || !c || !isRipe(c)) return null;
  const def = crop(c.id);
  const bonus = (hasPerk(world, 'green-thumb') ? 0.4 : 0.2) + (hasBuff(world, 'lucky') ? 0.2 : 0);
  const count = 1 + (nextRandom(world.rng) < bonus ? 1 : 0);
  into[def.id] = (into[def.id] ?? 0) + count;
  world.stats.harvested += count;
  c.harvests += 1;
  if (def.regrow) c.growth = def.days - def.regrow;
  else plot.crop = null;
  return { id: def.id, count };
}

/**
 * Use the tile with what's in hand. Returns true if something happened.
 * Menus (sleep, bin, mart, smith) are only asked for; the UI opens them.
 */
export function useAt(world: World, x: number, y: number): boolean {
  const intent = intentAt(world, x, y);
  const p = world.player;
  if (intent.kind === 'deny') {
    if (intent.text) world.events.push({ kind: 'hint', x, y, text: intent.text });
    return false;
  }
  if (intent.kind === 'walk') return false;
  const { action } = intent;
  const cost = actionCost(world, action);
  if (p.energy < cost) {
    world.events.push({ kind: 'hint', x, y, text: 'Too tired. Get some sleep' });
    return false;
  }
  p.energy -= cost;
  const key = plotKey(x, y);
  const plot = world.plots[key];
  switch (action) {
    case 'sleep':
    case 'bin':
    case 'mart':
    case 'smith':
    case 'barn':
    case 'board':
    case 'merchant':
      world.events.push({ kind: 'open', ui: action });
      return true;
    case 'machine':
      if (isDone(world, key)) return collectMachine(world, x, y);
      world.events.push({ kind: 'machine', x, y });
      return true;
    case 'pickup':
      return pickUpMachine(world, x, y);
    case 'talk': {
      const npc = npcAt(world, x, y);
      if (npc) world.events.push({ kind: 'talk', npc: npc.id });
      return Boolean(npc);
    }
    case 'door':
      world.events.push({ kind: 'door', door: doorAt(world.map, x, y)!, x, y });
      return true;
    case 'gather':
      return gather(world, x, y);
    case 'place':
      return placeMachine(world, world.selected, x, y);
    case 'pet': {
      const uid = helperAt(world, x, y);
      if (uid === null || !pet(world, uid)) return false;
      world.events.push({ kind: 'pet', x, y, text: '♥' });
      return true;
    }
    case 'refill':
      p.water = canCapacity(world);
      world.events.push({ kind: 'refill', x, y, text: 'Filled up!' });
      return true;
    case 'till': {
      let n = 0;
      for (const t of toolArea(world.tools.hoe, { x, y }, p.facing)) {
        if (!tillable(world, t.x, t.y)) continue;
        world.plots[plotKey(t.x, t.y)] = { watered: false, crop: null };
        world.events.push({ kind: 'till', x: t.x, y: t.y });
        n += 1;
      }
      addSkillXp(world, 'farming', n);
      return true;
    }
    case 'untill':
      delete world.plots[key];
      world.events.push({ kind: 'clear', x, y });
      return true;
    case 'water': {
      let n = 0;
      for (const t of toolArea(world.tools.can, { x, y }, p.facing)) {
        if (p.water <= 0 || !waterable(world, t.x, t.y)) continue;
        world.plots[plotKey(t.x, t.y)]!.watered = true;
        p.water -= 1;
        world.events.push({ kind: 'water', x: t.x, y: t.y });
        n += 1;
      }
      addSkillXp(world, 'farming', n);
      return true;
    }
    case 'plant': {
      const seed = item(world.selected);
      plot!.crop = { id: seed.crop!, growth: 0, harvests: 0, tended: false };
      takeItem(world, seed.id, 1);
      addSkillXp(world, 'farming', 1);
      world.events.push({ kind: 'plant', x, y });
      return true;
    }
    case 'clear':
      plot!.crop = null;
      world.events.push({ kind: 'clear', x, y });
      return true;
    case 'harvest': {
      const got = pick(world, x, y)!;
      const def = crop(got.id);
      addSkillXp(world, 'farming', 2 + Math.floor(def.days / 2));
      world.events.push({ kind: 'harvest', x, y, text: got.count > 1 ? `${def.name} ×${got.count}` : def.name });
      return true;
    }
  }
}

/** The Pokémon standing on (x, y), if any is out on this map. */
export function helperAt(world: World, x: number, y: number): number | null {
  for (const h of world.helpers) {
    if (h.role === 'farm' && world.map !== 'farm') continue;
    const t = tileOf(h);
    if (t.x === x && t.y === y) return h.uid;
  }
  return null;
}

export function giveItem(world: World, id: string, count: number): void {
  world.inventory[id] = (world.inventory[id] ?? 0) + count;
}

export function takeItem(world: World, id: string, count: number): boolean {
  const have = world.inventory[id] ?? 0;
  if (have < count) return false;
  if (have === count) {
    delete world.inventory[id];
    // Ran out of the seeds in hand: put them away.
    if (world.selected === id) world.selected = 'hoe';
  } else {
    world.inventory[id] = have - count;
  }
  return true;
}

/** How much faster tended crops grow. */
export const TEND_BONUS = 0.5;
/** Chance an empty, dry plot goes back to grass overnight. */
export const REVERT_CHANCE = 0.2;
/** Chance a crow comes for a crop overnight when nothing scares it off. */
export const CROW_CHANCE = 0.3;

/** When a new season starts, outdoor crops that don't belong in it wither. */
export function witherOutOfSeason(world: World): number {
  const season = seasonOf(world.day);
  let n = 0;
  for (const [key, plot] of Object.entries(world.plots)) {
    if (!plot.crop || inSeason(plot.crop.id, season)) continue;
    const [x, y] = key.split(',').map(Number) as [number, number];
    if (underGlass(x, y)) continue;
    plot.crop = null;
    n += 1;
  }
  return n;
}

/** Overnight: watered crops grow, the soil dries, and crows may visit. */
export function growNight(world: World, guarded: boolean): { grown: number; ripe: number; dried: number; crowAte: string | null } {
  let grown = 0;
  let ripe = 0;
  let dried = 0;
  for (const [key, plot] of Object.entries(world.plots)) {
    const c = plot.crop;
    if (c && plot.watered && !isRipe(c)) {
      c.growth = Math.min(crop(c.id).days, c.growth + 1 + (c.tended ? TEND_BONUS : 0));
      grown += 1;
      if (isRipe(c)) ripe += 1;
    } else if (!c && !plot.watered && nextRandom(world.rng) < REVERT_CHANCE) {
      delete world.plots[key];
      dried += 1;
      continue;
    }
    if (c) c.tended = false;
    plot.watered = false;
  }
  let crowAte: string | null = null;
  if (!guarded && nextRandom(world.rng) < CROW_CHANCE) {
    // Crows can't get into the greenhouse.
    const growing = Object.entries(world.plots).filter(([k, p]) => p.crop && !isRipe(p.crop) && !underGlass(...(k.split(',').map(Number) as [number, number]))).map(([, p]) => p);
    if (growing.length) {
      const victim = growing[Math.floor(nextRandom(world.rng) * growing.length)]!;
      crowAte = crop(victim.crop!.id).name;
      victim.crop = null;
    }
  }
  return { grown, ripe, dried, crowAte };
}
