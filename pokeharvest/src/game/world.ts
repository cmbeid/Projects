/**
 * The simulation. No DOM here: the UI changes the world only through the
 * commands below (and those in `battle.ts`, `economy.ts` and `mon.ts`), and
 * reads back `world.events` to animate and play sounds.
 */
import { CROPS } from '../data/crops';
import { ENCOUNTERS, ENCOUNTER_RATE, isNight } from '../data/encounters';
import { TOOLS, seedId } from '../data/items';
import { MAPS, SPAWN, tileAt, walkable, warpAt } from '../data/maps';
import { startBattle } from './battle';
import { collectBin } from './economy';
import { canCapacity, growNight, intentAt, toolName, useAt } from './farm';
import { guarded, passableOn, placeHelpers, syncHelpers, updateHelpers } from './helpers';
import { healAll, healthyParty, makeMon } from './mon';
import { MAX_ENERGY, START_GOLD, tileOf, type DaySummary, type Dir, type World } from './model';
import { manhattan, pathBeside, pathTo, type Point } from './path';
import { nextRandom } from './rng';
import { maxEnergyFor } from './skills';
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
export const STARTER_LEVEL = 5;

export function createWorld(seed: number, starter: number): World {
  const world: World = {
    day: 1,
    clock: DAY_START,
    rng: { seed: seed | 0 },
    map: 'farm',
    player: { x: SPAWN.x, y: SPAWN.y, path: [], facing: 'down', energy: MAX_ENERGY, maxEnergy: MAX_ENERGY, gold: START_GOLD, water: 20, pending: null },
    mons: [],
    party: [],
    nextUid: 1,
    helpers: [],
    plots: {},
    inventory: { [seedId('oran')]: 12, [seedId('cheri')]: 6, 'poke-ball': 5 },
    selected: 'hoe',
    bin: {},
    tools: { hoe: 0, can: 0 },
    upgrade: null,
    skills: { farming: 0, battling: 0 },
    perks: [],
    pendingPerks: [],
    seen: [],
    caught: [],
    stats: { harvested: 0, earned: 0, wins: 0 },
    battle: null,
    events: [],
  };
  const mon = makeMon(starter, STARTER_LEVEL, world.rng);
  mon.shiny = false;
  mon.uid = world.nextUid++;
  world.mons.push(mon);
  world.party.push(mon.uid);
  world.seen.push(starter);
  world.caught.push(starter);
  syncHelpers(world);
  placeHelpers(world, SPAWN);
  return world;
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
  if (world.battle) return;
  const p = world.player;
  const at = tileOf(p);
  const intent = intentAt(world, x, y);
  const kind = tileAt(world.map, x, y);
  const ok = passableOn(world.map);
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
    const path = pathBeside(at, { x, y }, ok, walkable(kind));
    if (!path) return;
    p.path = path;
    p.pending = { x, y };
    return;
  }
  const path = pathTo(at, { x, y }, ok);
  if (!path) return;
  p.path = path;
  p.pending = null;
}

/** Keyboard: one step in a direction, or just turn if the way is blocked. */
export function step(world: World, dir: Dir): void {
  const p = world.player;
  if (p.path.length || world.battle) return;
  p.facing = dir;
  p.pending = null;
  const at = tileOf(p);
  const next = { x: at.x + DELTA[dir].x, y: at.y + DELTA[dir].y };
  if (passableOn(world.map)(next)) p.path = [next];
}

/** Keyboard: use the tile being faced. */
export function actFacing(world: World): void {
  const p = world.player;
  if (p.path.length || world.battle) return;
  const at = tileOf(p);
  useAt(world, at.x + DELTA[p.facing].x, at.y + DELTA[p.facing].y);
}

/** Go to another map, arriving at (x, y) with the party around you. */
export function warpTo(world: World, map: World['map'], x: number, y: number): void {
  const p = world.player;
  world.map = map;
  p.x = x;
  p.y = y;
  p.path = [];
  p.pending = null;
  placeHelpers(world, { x, y });
  world.events.push({ kind: 'warp', map });
}

/** Each new tile stepped on: a warp, or maybe a wild Pokémon in the tall grass. */
function onStep(world: World, at: Point): void {
  const warp = warpAt(world.map, at.x, at.y);
  if (warp) {
    warpTo(world, warp.to, warp.tx, warp.ty);
    return;
  }
  if (tileAt(world.map, at.x, at.y) !== 'tall') return;
  const zones = ENCOUNTERS[world.map];
  if (!zones || nextRandom(world.rng) >= ENCOUNTER_RATE) return;
  if (!healthyParty(world).length) {
    world.events.push({ kind: 'hint', x: at.x, y: at.y, text: 'Something rustles, but your Pokémon need rest' });
    return;
  }
  const zone = zones.find((z) => at.y >= z.rows[0] && at.y < z.rows[1]);
  if (!zone) return;
  const slots = isNight(world.clock) ? zone.night : zone.day;
  let r = nextRandom(world.rng) * slots.reduce((a, s) => a + s.weight, 0);
  const slot = slots.find((s) => (r -= s.weight) < 0) ?? slots[0]!;
  const [lo, hi] = zone.levels;
  const level = lo + Math.floor(nextRandom(world.rng) * (hi - lo + 1));
  startBattle(world, slot.dex, level);
}

/** Advance by `dt` real seconds. Paused screens, and battles, simply don't call this. */
export function tick(world: World, dt: number): void {
  if (world.battle) return;
  const minutes = dt / SECONDS_PER_MINUTE;
  world.clock += minutes;
  const p = world.player;
  const arrived = walk(p, p.energy > 0 ? WALK_SPEED : TIRED_SPEED, dt, (x, y) => onStep(world, { x, y }));
  if (world.battle) return;
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
  let upgraded: string | null = null;
  if (world.upgrade && world.upgrade.day < world.day + 1) {
    const { tool, tier } = world.upgrade;
    world.tools[tool] = tier;
    world.upgrade = null;
    upgraded = toolName(tool, tier);
    if (tool === 'can') p.water = canCapacity(world);
  }
  healAll(world);
  p.maxEnergy = maxEnergyFor(world);
  // Staying up late costs you in the morning.
  const late = world.clock > 24 * 60;
  p.energy = passedOut ? Math.floor(p.maxEnergy / 2) : late ? Math.floor(p.maxEnergy * 0.75) : p.maxEnergy;
  const summary: DaySummary = { day: world.day, shipped, earned, ...night, passedOut, lost, upgraded };
  world.day += 1;
  world.clock = DAY_START;
  world.map = 'farm';
  world.battle = null;
  p.x = SPAWN.x;
  p.y = SPAWN.y;
  p.path = [];
  p.pending = null;
  p.facing = 'down';
  syncHelpers(world);
  placeHelpers(world, SPAWN);
  world.events.push({ kind: 'day', summary });
  return summary;
}

export { MAPS };
