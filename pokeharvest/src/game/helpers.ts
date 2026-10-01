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
import { farmMons, monByUid, parseKey, partyMons, plotKey, tileOf, type Helper, type World } from './model';
import { manhattan, pathBeside, pathTo, type Point } from './path';
import { nextRandom } from './rng';
import { removeSeed, returnSeed, seedFor } from './seedbox';
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
  return { uid, dex, role, x, y, path: [], facing: 'down', cooldown: JOB_INTERVAL / 2, target: null, errand: null, carrying: null };
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

/** Plots other helpers are already heading for, or fetching a seed for. */
function takenBy(world: World, h: Helper): Set<string> {
  const out = new Set<string>();
  for (const o of world.helpers) {
    if (o === h) continue;
    if (o.target) out.add(plotKey(o.target.x, o.target.y));
    if (o.errand) out.add(plotKey(o.errand.x, o.errand.y));
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

/** Arrived beside the Seed Box: pick up a seed for the errand plot. True if it's off to plant. */
function fetchSeed(world: World, h: Helper): boolean {
  const at = h.errand;
  const seed = at && seedFor(world, at.x, at.y);
  if (!at || !seed || !removeSeed(world, seed)) return false;
  h.carrying = seed;
  world.events.push({ kind: 'helper', x: SEED_BOX.x, y: SEED_BOX.y, dex: h.dex, text: `Took a ${crop(ITEMS.get(seed)!.crop!).name.replace(' Berry', '')} seed` });
  return true;
}

/** Arrived at the plot with a seed: plant it, or put it back in the box if the plot's no use now. */
function sow(world: World, h: Helper, at: Point): void {
  const seed = h.carrying!;
  h.carrying = null;
  const plot = world.plots[plotKey(at.x, at.y)];
  const cropId = ITEMS.get(seed)!.crop!;
  if (!plot || plot.crop || !plantableAt(world, cropId, at.x, at.y)) {
    returnSeed(world, seed);
    return;
  }
  plantAt(world, cropId, at.x, at.y);
  world.events.push({ kind: 'helper', x: at.x, y: at.y, dex: h.dex, text: `Planted ${crop(cropId).name}!` });
}

function doJob(world: World, h: Helper, at: Point): void {
  if (species(h.dex).job === 'sow' && !world.plots[plotKey(at.x, at.y)]) {
    if (retillable(world, at.x, at.y)) {
      tillAt(world, at.x, at.y);
      world.events.push({ kind: 'helper', x: at.x, y: at.y, dex: h.dex, text: 'Dig!' });
    }
    return;
  }
  const plot = world.plots[plotKey(at.x, at.y)];
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
  for (const h of world.helpers) {
    const map: MapId = h.role === 'farm' ? 'farm' : world.map;
    const ok = passableFor(world, map);
    const mon = monByUid(world, h.uid);
    h.cooldown -= minutes;
    if (h.target) {
      if (walk(h, SPEED, dt)) {
        const done = (): void => {
          h.target = null;
          h.errand = null;
          h.cooldown = mon?.fed === false ? JOB_INTERVAL * 2 : JOB_INTERVAL;
        };
        if (h.errand && !h.carrying) {
          // At the Seed Box: take a seed and head for the plot.
          const path = fetchSeed(world, h) ? pathBeside(tileOf(h), h.errand, ok, true) : null;
          if (path) {
            h.target = h.errand;
            h.path = path;
          } else {
            dropErrand(world, h);
            done();
          }
          continue;
        }
        if (h.carrying) sow(world, h, h.target);
        else doJob(world, h, h.target);
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
        h.errand = fetch ? work : null;
        h.path = path;
        continue;
      }
      h.cooldown = 10; // nothing to do: look again in a bit
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
  if (h.carrying) returnSeed(world, h.carrying);
  h.carrying = null;
  h.errand = null;
}

function reset(world: World, h: Helper, at: Point): void {
  dropErrand(world, h);
  h.x = at.x;
  h.y = at.y;
  h.path = [];
  h.target = null;
  h.facing = 'down';
  h.cooldown = JOB_INTERVAL / 2;
}
