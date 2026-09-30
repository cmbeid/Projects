/**
 * Party Pokémon out on the map. They follow the farmer and, on the farm in
 * working hours, go off every half hour to do their type's job on the
 * nearest crop that needs it: Water types water it, Grass and Bug types tend
 * it, Normal, Fighting, Ground and Rock types pick it when it's ripe and put
 * it in the shipping bin. Fire and Flying types stay at your side; at night
 * they keep the crows off. A fainted Pokémon rests until it's healed.
 */
import { crop } from '../data/crops';
import { species } from '../data/species';
import { SPAWN, tileAt, walkable, type MapId } from '../data/maps';
import { isRipe, pick } from './farm';
import { monByUid, parseKey, partyMons, tileOf, type Helper, type World } from './model';
import { manhattan, pathBeside, type Point } from './path';
import { walk } from './walk';

/** In-game minutes between jobs. */
export const JOB_INTERVAL = 30;
/** Helpers clock off at 10 PM. */
export const WORK_ENDS = 22 * 60;
const SPEED = 4.5;

export function passableOn(map: MapId): (p: Point) => boolean {
  return (p) => walkable(tileAt(map, p.x, p.y));
}

/** The farm's walkable tiles. */
export const passable = passableOn('farm');

export function newHelper(uid: number, dex: number, x: number, y: number): Helper {
  return { uid, dex, x, y, path: [], facing: 'down', cooldown: JOB_INTERVAL / 2, target: null };
}

/** Make the helpers on the map match the party: new members appear beside you, evolutions show. */
export function syncHelpers(world: World): void {
  const at = tileOf(world.player);
  world.helpers = partyMons(world).map((mon) => {
    const existing = world.helpers.find((h) => h.uid === mon.uid);
    if (existing) {
      existing.dex = mon.dex;
      return existing;
    }
    return newHelper(mon.uid, mon.dex, at.x, at.y);
  });
}

/** Whether any conscious helper scares crows. */
export function guarded(world: World): boolean {
  return partyMons(world).some((m) => m.hp > 0 && species(m.dex).job === 'guard');
}

/** The nearest crop that wants this helper's job, if any. */
function findWork(world: World, h: Helper): Point | null {
  const job = species(h.dex).job;
  if (job === 'guard' || job === 'none') return null;
  const from = tileOf(h);
  let best: Point | null = null;
  let bestD = Infinity;
  for (const [key, plot] of Object.entries(world.plots)) {
    const c = plot.crop;
    if (!c) continue;
    if (job === 'harvest' ? !isRipe(c) : isRipe(c)) continue;
    if (job === 'water' && plot.watered) continue;
    if (job === 'tend' && (c.tended || !plot.watered)) continue;
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
  if (!plot || !c) return;
  const job = species(h.dex).job;
  if (job === 'harvest' && isRipe(c)) {
    const name = crop(c.id).name;
    if (pick(world, at.x, at.y, world.bin)) world.events.push({ kind: 'helper', x: at.x, y: at.y, dex: h.dex, text: `${name} → bin` });
  } else if (isRipe(c)) {
    return;
  } else if (job === 'water' && !plot.watered) {
    plot.watered = true;
    world.events.push({ kind: 'helper', x: at.x, y: at.y, dex: h.dex, text: 'Water Gun!' });
  } else if (job === 'tend' && !c.tended) {
    c.tended = true;
    world.events.push({ kind: 'helper', x: at.x, y: at.y, dex: h.dex, text: 'Growth!' });
  }
}

export function updateHelpers(world: World, dt: number, minutes: number): void {
  const player = tileOf(world.player);
  const ok = passableOn(world.map);
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
    const awake = (monByUid(world, h.uid)?.hp ?? 0) > 0;
    if (awake && world.map === 'farm' && h.cooldown <= 0 && world.clock < WORK_ENDS) {
      const work = findWork(world, h);
      const path = work && pathBeside(tileOf(h), work, ok, true);
      if (work && path) {
        h.target = work;
        h.path = path;
        continue;
      }
      h.cooldown = 10; // nothing to do: look again in a bit
    }
    // Otherwise, keep close to the farmer.
    if (!h.path.length && manhattan(tileOf(h), player) > 2) {
      h.path = pathBeside(tileOf(h), player, ok) ?? [];
    }
    walk(h, SPEED, dt);
  }
}

/** Put every helper beside `at`, as after a night's sleep or walking to a new map. */
export function placeHelpers(world: World, at: Point = SPAWN): void {
  const ok = passableOn(world.map);
  const spots = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: -1, y: 1 }, { x: 0, y: -1 }]
    .map((d) => ({ x: at.x + d.x, y: at.y + d.y }))
    .filter(ok);
  world.helpers.forEach((h, i) => {
    const spot = spots[i % Math.max(1, spots.length)] ?? at;
    h.x = spot.x;
    h.y = spot.y;
    h.path = [];
    h.target = null;
    h.facing = 'down';
    h.cooldown = JOB_INTERVAL / 2;
  });
}
