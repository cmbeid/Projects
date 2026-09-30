/**
 * The field: what a tap on a tile does with what's in hand, and how the
 * crops grow overnight.
 */
import { crop } from '../data/crops';
import { ITEMS, item } from '../data/items';
import { tileAt, walkable } from '../data/maps';
import { CAN_SIZE, plotKey, type CropState, type World } from './model';
import { nextRandom } from './rng';

export type Action = 'till' | 'water' | 'plant' | 'harvest' | 'clear' | 'untill' | 'refill' | 'sleep' | 'bin' | 'mart';

/** What using a tile would do: an action, nothing worth doing (just walk there), or a reason it can't. */
export type Intent = { kind: 'use'; action: Action } | { kind: 'walk' } | { kind: 'deny'; text: string };

/** Energy each action costs. */
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

export function intentAt(world: World, x: number, y: number): Intent {
  const kind = tileAt(x, y);
  const held = world.selected;
  if (kind === 'door') return { kind: 'use', action: 'sleep' };
  if (kind === 'bin') return { kind: 'use', action: 'bin' };
  if (kind === 'mart') return { kind: 'use', action: 'mart' };
  if (kind === 'water') {
    if (held !== 'can') return { kind: 'deny', text: 'Hold the can to fill it' };
    return world.player.water >= CAN_SIZE ? { kind: 'deny', text: 'The can is full' } : { kind: 'use', action: 'refill' };
  }
  if (!walkable(kind)) return { kind: 'deny', text: '' };

  const plot = world.plots[plotKey(x, y)];
  if (plot?.crop && isRipe(plot.crop)) return { kind: 'use', action: 'harvest' };
  if (kind === 'path') return held === 'hoe' ? { kind: 'deny', text: "Can't dig up the path" } : { kind: 'walk' };

  const def = ITEMS.get(held);
  if (held === 'hoe') return plot ? { kind: 'walk' } : { kind: 'use', action: 'till' };
  if (held === 'can') {
    if (!plot || plot.watered) return { kind: 'walk' };
    return world.player.water > 0 ? { kind: 'use', action: 'water' } : { kind: 'deny', text: 'The can is empty. Fill it at the pond' };
  }
  if (held === 'sickle') {
    if (plot?.crop) return { kind: 'use', action: 'clear' };
    return plot ? { kind: 'use', action: 'untill' } : { kind: 'walk' };
  }
  if (def?.kind === 'seed') {
    if (!plot) return { kind: 'deny', text: 'Till the soil first' };
    return plot.crop ? { kind: 'walk' } : { kind: 'use', action: 'plant' };
  }
  return { kind: 'walk' };
}

/**
 * Use the tile with what's in hand. Returns true if something happened.
 * Menus (sleep, bin, mart) are only asked for; the UI opens them.
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
  const cost = COST[action] ?? 0;
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
      world.events.push({ kind: 'open', ui: action });
      return true;
    case 'refill':
      p.water = CAN_SIZE;
      world.events.push({ kind: 'refill', x, y, text: 'Filled up!' });
      return true;
    case 'till':
      world.plots[key] = { watered: false, crop: null };
      world.events.push({ kind: 'till', x, y });
      return true;
    case 'untill':
      delete world.plots[key];
      world.events.push({ kind: 'clear', x, y });
      return true;
    case 'water':
      plot!.watered = true;
      p.water -= 1;
      world.events.push({ kind: 'water', x, y });
      return true;
    case 'plant': {
      const seed = item(world.selected);
      plot!.crop = { id: seed.crop!, growth: 0, harvests: 0, tended: false };
      takeItem(world, seed.id, 1);
      world.events.push({ kind: 'plant', x, y });
      return true;
    }
    case 'clear':
      plot!.crop = null;
      world.events.push({ kind: 'clear', x, y });
      return true;
    case 'harvest': {
      const c = plot!.crop!;
      const def = crop(c.id);
      // A good harvest now and then: one extra berry, more often from a well-tended plant.
      const count = 1 + (nextRandom(world.rng) < 0.2 ? 1 : 0);
      giveItem(world, def.id, count);
      world.stats.harvested += count;
      c.harvests += 1;
      if (def.regrow) {
        c.growth = def.days - def.regrow;
      } else {
        plot!.crop = null;
      }
      world.events.push({ kind: 'harvest', x, y, text: count > 1 ? `${def.name} ×${count}` : def.name });
      return true;
    }
  }
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
    const growing = Object.values(world.plots).filter((p) => p.crop && !isRipe(p.crop));
    if (growing.length) {
      const victim = growing[Math.floor(nextRandom(world.rng) * growing.length)]!;
      crowAte = crop(victim.crop!.id).name;
      victim.crop = null;
    }
  }
  return { grown, ripe, dried, crowAte };
}
