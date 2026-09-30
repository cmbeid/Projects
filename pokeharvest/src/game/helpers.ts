/**
 * Helper Pokémon. Each follows the farmer around and, during working hours,
 * goes off every half hour to do its type's job on the nearest crop that
 * needs it: Water types water it, Grass types tend it. Fire types stay at
 * your side; at night their being on the farm keeps the crows off.
 */
import { species } from '../data/species';
import { tileAt, walkable } from '../data/maps';
import { isRipe } from './farm';
import { parseKey, tileOf, type Helper, type World } from './model';
import { manhattan, pathBeside, type Point } from './path';
import { walk } from './walk';

/** In-game minutes between jobs. */
export const JOB_INTERVAL = 30;
/** Helpers clock off at 10 PM. */
export const WORK_ENDS = 22 * 60;
const SPEED = 4.5;

export function passable(p: Point): boolean {
  return walkable(tileAt(p.x, p.y));
}

export function newHelper(dex: number, x: number, y: number): Helper {
  return { dex, x, y, path: [], facing: 'down', cooldown: JOB_INTERVAL / 2, target: null };
}

/** Whether any helper scares crows. */
export function guarded(world: World): boolean {
  return world.helpers.some((h) => species(h.dex).job === 'guard');
}

/** The nearest crop that wants this helper's job, if any. */
function findWork(world: World, h: Helper): Point | null {
  const job = species(h.dex).job;
  if (job === 'guard') return null;
  const from = tileOf(h);
  let best: Point | null = null;
  let bestD = Infinity;
  for (const [key, plot] of Object.entries(world.plots)) {
    const c = plot.crop;
    if (!c || isRipe(c)) continue;
    if (job === 'water' ? plot.watered : c.tended || !plot.watered) continue;
    const p = parseKey(key);
    const d = manhattan(from, p);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

function doJob(world: World, h: Helper, at: Point): void {
  const plot = world.plots[`${at.x},${at.y}`];
  const c = plot?.crop;
  if (!plot || !c || isRipe(c)) return;
  const job = species(h.dex).job;
  if (job === 'water' && !plot.watered) {
    plot.watered = true;
    world.events.push({ kind: 'helper', x: at.x, y: at.y, dex: h.dex, text: 'Water Gun!' });
  } else if (job === 'tend' && !c.tended) {
    c.tended = true;
    world.events.push({ kind: 'helper', x: at.x, y: at.y, dex: h.dex, text: 'Growth!' });
  }
}

export function updateHelpers(world: World, dt: number, minutes: number): void {
  const player = tileOf(world.player);
  for (const h of world.helpers) {
    h.cooldown -= minutes;
    if (h.target) {
      if (walk(h, SPEED, dt)) {
        doJob(world, h, h.target);
        h.target = null;
        h.cooldown = JOB_INTERVAL;
      }
      continue;
    }
    if (h.cooldown <= 0 && world.clock < WORK_ENDS) {
      const work = findWork(world, h);
      const path = work && pathBeside(tileOf(h), work, passable, true);
      if (work && path) {
        h.target = work;
        h.path = path;
        continue;
      }
      h.cooldown = 10; // nothing to do: look again in a bit
    }
    // Otherwise, keep close to the farmer.
    if (!h.path.length && manhattan(tileOf(h), player) > 2) {
      h.path = pathBeside(tileOf(h), player, passable) ?? [];
    }
    walk(h, SPEED, dt);
  }
}

/** Put every helper back beside the door for the morning. */
export function wakeHelpers(world: World, at: Point): void {
  world.helpers.forEach((h, i) => {
    h.x = at.x + 1 + i;
    h.y = at.y;
    h.path = [];
    h.target = null;
    h.facing = 'down';
    h.cooldown = JOB_INTERVAL / 2;
  });
}
