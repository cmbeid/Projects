/**
 * The farm simulation. No DOM here: the UI changes the world only through
 * the commands below, and reads back `world.events` to animate and play
 * sounds.
 */
import { CROPS } from '../data/crops';
import { TOOLS, seedId } from '../data/items';
import { SPAWN, tileAt, walkable } from '../data/maps';
import { collectBin } from './economy';
import { growNight, intentAt, useAt } from './farm';
import { guarded, newHelper, passable, updateHelpers, wakeHelpers } from './helpers';
import { CAN_SIZE, MAX_ENERGY, START_GOLD, tileOf, type DaySummary, type Dir, type World } from './model';
import { manhattan, pathBeside, pathTo } from './path';
import { DAY_END, DAY_START, SECONDS_PER_MINUTE } from './time';
import { DELTA, faceToward, walk } from './walk';

export * from './model';

/** Tiles a second. */
export const WALK_SPEED = 4;
export const TIRED_SPEED = 2;
/** Passing out costs this share of your gold. */
export const PASS_OUT_FINE = 0.1;
/** The first night crows can come. */
export const CROWS_FROM_DAY = 3;

export function createWorld(seed: number, starter: number): World {
  return {
    day: 1,
    clock: DAY_START,
    rng: { seed: seed | 0 },
    player: { x: SPAWN.x, y: SPAWN.y, path: [], facing: 'down', energy: MAX_ENERGY, maxEnergy: MAX_ENERGY, gold: START_GOLD, water: CAN_SIZE, pending: null },
    helpers: [newHelper(starter, SPAWN.x + 1, SPAWN.y)],
    plots: {},
    inventory: { [seedId('oran')]: 12, [seedId('cheri')]: 6 },
    selected: 'hoe',
    bin: {},
    stats: { harvested: 0, earned: 0 },
    events: [],
  };
}

/** What sits in the hotbar: the tools, then every kind of seed you have. */
export function hotbar(world: World): string[] {
  return [...TOOLS, ...CROPS.map((c) => seedId(c.id)).filter((id) => (world.inventory[id] ?? 0) > 0)];
}

export function select(world: World, id: string): void {
  if (hotbar(world).includes(id)) world.selected = id;
}

/**
 * Tap on a tile: walk there and use it with what's in hand. Tiles that
 * can't be stood on (the bin, the door, the pond) are walked up to.
 */
export function tapTile(world: World, x: number, y: number): void {
  const p = world.player;
  const at = tileOf(p);
  const intent = intentAt(world, x, y);
  const kind = tileAt(x, y);
  if (intent.kind === 'deny' && !walkable(kind)) {
    if (intent.text) world.events.push({ kind: 'hint', x, y, text: intent.text });
    return;
  }
  if (intent.kind === 'use' || intent.kind === 'deny') {
    // Close enough already: do it now.
    if (manhattan(at, { x, y }) <= 1 && p.x === at.x && p.y === at.y) {
      p.path = [];
      faceToward(p, x - at.x, y - at.y);
      useAt(world, x, y);
      return;
    }
    const path = pathBeside(at, { x, y }, passable, walkable(kind));
    if (!path) return;
    p.path = path;
    p.pending = { x, y };
    return;
  }
  const path = pathTo(at, { x, y }, passable);
  if (!path) return;
  p.path = path;
  p.pending = null;
}

/** Keyboard: one step in a direction, or just turn if the way is blocked. */
export function step(world: World, dir: Dir): void {
  const p = world.player;
  if (p.path.length) return;
  p.facing = dir;
  p.pending = null;
  const at = tileOf(p);
  const next = { x: at.x + DELTA[dir].x, y: at.y + DELTA[dir].y };
  if (passable(next)) p.path = [next];
}

/** Keyboard: use the tile being faced (or stood on, for tilling under your feet). */
export function actFacing(world: World): void {
  const p = world.player;
  if (p.path.length) return;
  const at = tileOf(p);
  const ahead = { x: at.x + DELTA[p.facing].x, y: at.y + DELTA[p.facing].y };
  useAt(world, ahead.x, ahead.y);
}

/** Advance by `dt` real seconds. Paused screens simply don't call this. */
export function tick(world: World, dt: number): void {
  const minutes = dt / SECONDS_PER_MINUTE;
  world.clock += minutes;
  const p = world.player;
  const arrived = walk(p, p.energy > 0 ? WALK_SPEED : TIRED_SPEED, dt);
  if (arrived && p.pending) {
    const target = p.pending;
    p.pending = null;
    const at = tileOf(p);
    faceToward(p, target.x - at.x, target.y - at.y);
    useAt(world, target.x, target.y);
  }
  updateHelpers(world, dt, minutes);
  if (world.clock >= DAY_END) endDay(world, true);
}

/** Go to bed: end the day now. */
export function sleep(world: World): DaySummary {
  return endDay(world, false);
}

function endDay(world: World, passedOut: boolean): DaySummary {
  const p = world.player;
  const { shipped, earned } = collectBin(world);
  // Crows only find a new farm once it's a few days old.
  const night = growNight(world, guarded(world) || world.day < CROWS_FROM_DAY);
  const lost = passedOut ? Math.floor(p.gold * PASS_OUT_FINE) : 0;
  p.gold -= lost;
  // Staying up late costs you in the morning.
  const late = world.clock > 24 * 60;
  p.energy = passedOut ? Math.floor(p.maxEnergy / 2) : late ? Math.floor(p.maxEnergy * 0.75) : p.maxEnergy;
  const summary: DaySummary = { day: world.day, shipped, earned, ...night, passedOut, lost };
  world.day += 1;
  world.clock = DAY_START;
  p.x = SPAWN.x;
  p.y = SPAWN.y;
  p.path = [];
  p.pending = null;
  p.facing = 'down';
  wakeHelpers(world, SPAWN);
  world.events.push({ kind: 'day', summary });
  return summary;
}
