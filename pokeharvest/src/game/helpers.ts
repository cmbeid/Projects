/**
 * Pokémon out on the map. Party Pokémon follow the farmer; farm Pokémon stay
 * home in the barn and work the farm all day, even while you're on Route 1.
 *
 * Working hours on the farm, each goes off every half hour (every hour when
 * it went to bed hungry) to do its type's job on the nearest crop that needs
 * it: Water types water it, Grass and Bug types tend it, Normal, Fighting,
 * Rock and Steel types pick it when it's ripe and put it in the shipping
 * bin. Ground types re-till your fields when they go back to grass, and
 * fetch seeds from the Seed Box to plant in empty plots. Fire and Flying types keep the crows off at night, and Electric types
 * power the machines. Fainted Pokémon rest until they're healed.
 */
import { crop } from '../data/crops';
import { ITEMS } from '../data/items';
import { BARNYARD, SEED_BOX, SPAWN, gateAt, tileAt, walkable, type MapId } from '../data/maps';
import { species } from '../data/species';
import { isRipe, pick, plantAt, plantableAt, retillable, tillAt } from './farm';
import { farmMons, monByUid, parseKey, partyMons, plotKey, tileOf, type Helper, type WorkDay, type World } from './model';
import { manhattan, pathBeside, pathTo, type Point } from './path';
import { gainXp } from './mon';
import { nextRandom } from './rng';
import { removeSeed, returnSeed, seedFor, seedFrom } from './seedbox';
import { walk } from './walk';

/** In-game minutes between jobs, when fed. */
export const JOB_INTERVAL = 30;
/** Helpers clock off at 10 PM. */
export const WORK_ENDS = 22 * 60;
const SPEED = 4.5;

/** Walkable tiles on a map, ignoring what's been placed on them. */
export function passableOn(map: MapId): (p: Point) => boolean {
  return (p) => walkable(tileAt(map, p.x, p.y));
}

/** Walkable tiles on a map, minus placed machines and gates the story hasn't opened. */
export function passableFor(world: World, map: MapId = world.map): (p: Point) => boolean {
  const base = passableOn(map);
  const open = (p: Point): boolean => {
    const gate = gateAt(map, p.x, p.y);
    return !gate || world.story.flags.includes(gate.flag);
  };
  return map === 'farm' ? (p) => base(p) && !world.machines[plotKey(p.x, p.y)] : (p) => base(p) && open(p);
}

/** The farm's walkable tiles. */
export const passable = passableOn('farm');

export function newHelper(uid: number, dex: number, role: Helper['role'], x: number, y: number): Helper {
  return { uid, dex, role, x, y, path: [], facing: 'down', cooldown: JOB_INTERVAL / 2, rest: JOB_INTERVAL / 2, target: null, errands: [], carrying: [] };
}

/** Make the helpers match the party and the barn: newcomers appear beside you or the barn; evolutions show. */
export function syncHelpers(world: World): void {
  const at = tileOf(world.player);
  const make = (uid: number, dex: number, role: Helper['role']): Helper => {
    const existing = world.helpers.find((h) => h.uid === uid);
    if (existing && existing.role === role) {
      existing.dex = dex;
      return existing;
    }
    const home = role === 'party' ? at : BARNYARD;
    return newHelper(uid, dex, role, existing && role === 'party' && world.map === 'farm' ? Math.round(existing.x) : home.x, existing && role === 'party' && world.map === 'farm' ? Math.round(existing.y) : home.y);
  };
  const next = [
    ...partyMons(world).map((m) => make(m.uid, m.dex, 'party')),
    ...farmMons(world).map((m) => make(m.uid, m.dex, 'farm')),
  ];
  for (const h of world.helpers) if (!next.includes(h)) dropErrand(world, h);
  world.helpers = next;
}

/** Whether a conscious helper on the farm overnight scares crows. Everyone's home at night. */
export function guarded(world: World): boolean {
  return [...partyMons(world), ...farmMons(world)].some((m) => m.hp > 0 && species(m.dex).job === 'guard');
}

/** Jobs done at a crop, on a timer. Guards and power work just by being there. */
const ACTIVE_JOBS = new Set(['water', 'tend', 'harvest', 'sow']);

/**
 * How far through its rest a working helper is (0 to 1), for the bar over its
 * head, or null when there's no countdown to show: off duty, asleep, idle,
 * already on its way to a job, or not a crop worker at all.
 */
export function restProgress(world: World, h: Helper): { progress: number; hungry: boolean } | null {
  const mon = monByUid(world, h.uid);
  const map: MapId = h.role === 'farm' ? 'farm' : world.map;
  if (!ACTIVE_JOBS.has(species(h.dex).job) || map !== 'farm' || (mon?.hp ?? 0) <= 0) return null;
  if (h.target || h.rest <= 0 || world.clock >= WORK_ENDS) return null;
  return { progress: Math.max(0, Math.min(1, 1 - h.cooldown / h.rest)), hungry: mon?.fed === false };
}

/** Plots other helpers are already heading for, or fetching a seed for. */
function takenBy(world: World, h: Helper): Set<string> {
  const out = new Set<string>();
  for (const o of world.helpers) {
    if (o === h) continue;
    if (o.target) out.add(plotKey(o.target.x, o.target.y));
    for (const e of o.errands) out.add(plotKey(e.x, e.y));
  }
  return out;
}

/** A Ground helper's nearest job: an empty plot the Seed Box has a seed for, or a field gone back to grass. */
function findSowing(world: World, h: Helper): Point | null {
  const from = tileOf(h);
  const taken = takenBy(world, h);
  let best: Point | null = null;
  let bestD = Infinity;
  const consider = (p: Point): void => {
    const d = manhattan(from, p);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  };
  for (const [key, plot] of Object.entries(world.plots)) {
    if (plot.crop || taken.has(key) || world.machines[key]) continue;
    const p = parseKey(key);
    if (seedFor(world, p.x, p.y)) consider(p);
  }
  for (const key of world.field) {
    if (taken.has(key)) continue;
    const p = parseKey(key);
    if (retillable(world, p.x, p.y)) consider(p);
  }
  return best;
}

/** How many seeds a sowing Pokémon carries per trip to the Seed Box. */
export function seedsPerTrip(level: number): number {
  return level >= 35 ? 5 : level >= 20 ? 4 : 3;
}

/**
 * A trip's worth of plots, starting from `first`: each next one the nearest
 * empty plot to the last, as many as the Pokémon carries and the Seed Box
 * can fill.
 */
function planSowing(world: World, h: Helper, first: Point): Point[] {
  const mon = monByUid(world, h.uid);
  const size = seedsPerTrip(mon?.level ?? 1);
  const taken = takenBy(world, h);
  const box = { ...world.seedBox };
  const open = Object.entries(world.plots)
    .filter(([key, plot]) => !plot.crop && !taken.has(key) && !world.machines[key])
    .map(([key]) => parseKey(key));
  const trip: Point[] = [];
  let at: Point | undefined = first;
  while (at && trip.length < size) {
    const seed = seedFrom(world, box, at.x, at.y);
    if (!seed) break;
    box[seed]! -= 1;
    trip.push(at);
    const last: Point = at;
    at = undefined;
    let bestD = Infinity;
    for (const p of open) {
      if (trip.some((t) => t.x === p.x && t.y === p.y) || !seedFrom(world, box, p.x, p.y)) continue;
      const d = manhattan(last, p);
      if (d < bestD) {
        bestD = d;
        at = p;
      }
    }
  }
  return trip;
}

/** The nearest crop that wants this helper's job, if any, not already someone else's target. */
function findWork(world: World, h: Helper): Point | null {
  const job = species(h.dex).job;
  if (job === 'sow') return findSowing(world, h);
  if (job !== 'water' && job !== 'tend' && job !== 'harvest') return null;
  const from = tileOf(h);
  const taken = takenBy(world, h);
  let best: Point | null = null;
  let bestD = Infinity;
  for (const [key, plot] of Object.entries(world.plots)) {
    const c = plot.crop;
    if (!c || taken.has(key)) continue;
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

/** Today's record for a Pokémon, started if need be. */
function logFor(world: World, uid: number): WorkDay {
  return (world.workLog[uid] ??= { jobs: {}, xp: 0, levels: [] });
}

/** Experience a Pokémon earns for one job done on the farm: more as it grows. */
export function workXp(level: number): number {
  return 4 + Math.floor(level / 2);
}

/**
 * Give a Pokémon XP for its work and say so over its head. Levels and
 * evolutions show too, and an evolved helper changes on the spot.
 */
export function rewardWork(world: World, uid: number, at: Point, xp: number): void {
  const mon = monByUid(world, uid);
  if (!mon) return;
  const log = logFor(world, uid);
  log.xp += xp;
  for (const line of gainXp(mon, xp)) {
    if (!line.includes('grew to') && !line.includes('evolved')) continue; // moves learned show in the Bag
    log.levels.push(line);
    world.events.push({ kind: 'levelup', x: at.x, y: at.y, dex: mon.dex, text: line, evolved: line.includes('evolved') });
  }
  const h = world.helpers.find((o) => o.uid === uid);
  if (h) h.dex = mon.dex;
}

/** Shifts' worth of XP a guard or power helper earns for a day on the farm: about what a crop worker makes. */
export const STANDING_SHIFTS = 12;

/**
 * At bedtime, the helpers whose job is just being there get paid in XP:
 * guards for keeping watch through the night, Electric types for powering
 * machines (if there are any). Fainted ones missed out.
 */
export function payStandingJobs(world: World): void {
  const machines = Object.keys(world.machines).length > 0;
  for (const mon of [...partyMons(world), ...farmMons(world)]) {
    const job = species(mon.dex).job;
    if (mon.hp <= 0 || !(job === 'guard' || (job === 'power' && machines))) continue;
    const h = world.helpers.find((o) => o.uid === mon.uid);
    const log = logFor(world, mon.uid);
    log.jobs[job] = (log.jobs[job] ?? 0) + 1;
    rewardWork(world, mon.uid, h ? tileOf(h) : BARNYARD, workXp(mon.level) * STANDING_SHIFTS);
  }
}

/** A job done: its line over the plot, and XP for the Pokémon that did it. */
function worked(world: World, h: Helper, at: Point, job: string, text: string): void {
  world.events.push({ kind: 'helper', x: at.x, y: at.y, dex: h.dex, text });
  const log = logFor(world, h.uid);
  log.jobs[job] = (log.jobs[job] ?? 0) + 1;
  const mon = monByUid(world, h.uid);
  if (mon) rewardWork(world, h.uid, tileOf(h), workXp(mon.level));
}

/** Arrived beside the Seed Box: take a seed for each plot on the trip, dropping any it can't fill. True if it's off to plant. */
function fetchSeeds(world: World, h: Helper): boolean {
  const plots: Point[] = [];
  for (const at of h.errands) {
    const seed = seedFor(world, at.x, at.y);
    if (!seed || !removeSeed(world, seed)) continue;
    plots.push(at);
    h.carrying.push(seed);
  }
  h.errands = plots;
  if (!plots.length) return false;
  const one = h.carrying.length === 1 ? crop(ITEMS.get(h.carrying[0]!)!.crop!).name.replace(' Berry', '') : '';
  world.events.push({ kind: 'helper', x: SEED_BOX.x, y: SEED_BOX.y, dex: h.dex, text: one ? `Took a ${one} seed` : `Took ${h.carrying.length} seeds` });
  return true;
}

/** Arrived at the next plot with its seed: plant it, or put it back in the box if the plot's no use now. */
function sow(world: World, h: Helper, at: Point): void {
  const seed = h.carrying.shift()!;
  h.errands.shift();
  const plot = world.plots[plotKey(at.x, at.y)];
  const cropId = ITEMS.get(seed)!.crop!;
  if (!plot || plot.crop || !plantableAt(world, cropId, at.x, at.y)) {
    returnSeed(world, seed);
    return;
  }
  plantAt(world, cropId, at.x, at.y);
  worked(world, h, at, 'plant', `Planted ${crop(cropId).name}!`);
}

function doJob(world: World, h: Helper, at: Point): void {
  if (species(h.dex).job === 'sow' && !world.plots[plotKey(at.x, at.y)]) {
    if (retillable(world, at.x, at.y)) {
      tillAt(world, at.x, at.y);
      worked(world, h, at, 'till', 'Dig!');
    }
    return;
  }
  const plot = world.plots[plotKey(at.x, at.y)];
  const c = plot?.crop;
  if (!plot || !c) return;
  const job = species(h.dex).job;
  if (job === 'harvest' && isRipe(c)) {
    const name = crop(c.id).name;
    if (pick(world, at.x, at.y, world.bin)) worked(world, h, at, 'harvest', `${name} → bin`);
  } else if (isRipe(c)) {
    return;
  } else if (job === 'water' && !plot.watered) {
    plot.watered = true;
    worked(world, h, at, 'water', 'Water Gun!');
  } else if (job === 'tend' && !c.tended) {
    c.tended = true;
    worked(world, h, at, 'tend', 'Growth!');
  }
}

export function updateHelpers(world: World, dt: number, minutes: number): void {
  const player = tileOf(world.player);
  for (const h of world.helpers) {
    const map: MapId = h.role === 'farm' ? 'farm' : world.map;
    const ok = passableFor(world, map);
    const mon = monByUid(world, h.uid);
    h.cooldown -= minutes;
    if (h.target) {
      if (walk(h, SPEED, dt)) {
        const done = (): void => {
          dropErrand(world, h);
          h.target = null;
          h.cooldown = mon?.fed === false ? JOB_INTERVAL * 2 : JOB_INTERVAL;
          h.rest = h.cooldown;
        };
        /** On to the next plot of a sowing trip, if there's one and a way there. */
        const onward = (): boolean => {
          const next = h.errands[0];
          const path = next && pathBeside(tileOf(h), next, ok, true);
          if (!next || !path) return false;
          h.target = next;
          h.path = path;
          return true;
        };
        if (h.errands.length && !h.carrying.length) {
          // At the Seed Box: take the trip's seeds and head for the first plot.
          if (!(fetchSeeds(world, h) && onward())) done();
          continue;
        }
        if (h.carrying.length) {
          sow(world, h, h.target);
          // Straight on to the next plot; the rest comes after the last one.
          if (!onward()) done();
          continue;
        }
        doJob(world, h, h.target);
        done();
      }
      continue;
    }
    const awake = (mon?.hp ?? 0) > 0;
    if (awake && map === 'farm' && h.cooldown <= 0 && world.clock < WORK_ENDS) {
      const work = findWork(world, h);
      // Planting starts with a trip to the Seed Box; re-tilling goes straight there.
      const fetch = work && species(h.dex).job === 'sow' && world.plots[plotKey(work.x, work.y)];
      const first = fetch ? SEED_BOX : work;
      const path = first && pathBeside(tileOf(h), first, ok, true);
      if (work && first && path) {
        h.target = first;
        h.errands = fetch ? planSowing(world, h, work) : [];
        h.path = path;
        continue;
      }
      h.cooldown = 10; // nothing to do: look again in a bit
      h.rest = 0;
    }
    if (h.role === 'party') {
      // Keep close to the farmer.
      if (!h.path.length && manhattan(tileOf(h), player) > 2) h.path = pathBeside(tileOf(h), player, ok) ?? [];
    } else if (!h.path.length && nextRandom(world.rng) < dt * 0.15) {
      // Pottering about the barnyard.
      const spot = { x: BARNYARD.x - 3 + Math.floor(nextRandom(world.rng) * 7), y: BARNYARD.y + Math.floor(nextRandom(world.rng) * 4) };
      if (ok(spot)) h.path = pathTo(tileOf(h), spot, ok) ?? [];
    }
    walk(h, SPEED, dt);
  }
}

/** Put the party beside `at`, as after walking to a new map. */
export function placeParty(world: World, at: Point = SPAWN): void {
  const ok = passableFor(world);
  const spots = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: -1, y: 1 }, { x: 0, y: -1 }]
    .map((d) => ({ x: at.x + d.x, y: at.y + d.y }))
    .filter(ok);
  world.helpers.filter((h) => h.role === 'party').forEach((h, i) => {
    const spot = spots[i % Math.max(1, spots.length)] ?? at;
    reset(world, h, spot);
  });
}

/** Everyone home for the morning: the party by the door, the farm Pokémon by the barn. */
export function placeHelpers(world: World, at: Point = SPAWN): void {
  placeParty(world, at);
  const ok = passableFor(world, 'farm');
  world.helpers.filter((h) => h.role === 'farm').forEach((h, i) => {
    const spot = { x: BARNYARD.x - 2 + (i % 5), y: BARNYARD.y + Math.floor(i / 5) };
    reset(world, h, ok(spot) ? spot : BARNYARD);
  });
}

/** Call off a helper's planting trip, putting any seed it carried back in the box. */
export function dropErrand(world: World, h: Helper): void {
  for (const seed of h.carrying) returnSeed(world, seed);
  h.carrying = [];
  h.errands = [];
}

function reset(world: World, h: Helper, at: Point): void {
  dropErrand(world, h);
  h.x = at.x;
  h.y = at.y;
  h.path = [];
  h.target = null;
  h.facing = 'down';
  h.cooldown = JOB_INTERVAL / 2;
  h.rest = JOB_INTERVAL / 2;
}
