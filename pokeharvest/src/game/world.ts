/**
 * The simulation. No DOM here: the UI changes the world only through the
 * commands below (and those in `battle.ts`, `economy.ts` and `mon.ts`), and
 * reads back `world.events` to animate and play sounds.
 */
import { CROPS } from '../data/crops';
import { CAVE_RATE, ENCOUNTERS, ENCOUNTER_RATE, WEATHER_BOOST, WEATHER_TYPES, isNight, slotsFor } from '../data/encounters';
import { checkSight, spawnNpcs, updateNpcs } from './npcs';
import { beginStory, checkStory, visit } from './story';
import { species } from '../data/species';
import { ITEMS, TOOLS, seedId } from '../data/items';
import { MAPS, SPAWN, tileAt, walkable, warpAt } from '../data/maps';
import { startBattle } from './battle';
import { collectBin } from './economy';
import { canCapacity, growNight, intentAt, toolName, useAt, witherOutOfSeason } from './farm';
import { feedAndProduce } from './barn';
import { guarded, passableFor, placeHelpers, placeParty, syncHelpers, updateHelpers } from './helpers';
import { runMachines } from './machines';
import { rollMarket } from './market';
import { refreshRequests } from './requests';
import { healAll, healthyParty, makeMon } from './mon';
import { MAX_ENERGY, START_GOLD, hasBuff, tileOf, type DaySummary, type Dir, type World } from './model';
import { manhattan, pathBeside, pathTo, type Point } from './path';
import { nextRandom } from './rng';
import { maxEnergyFor } from './skills';
import { DAY_END, DAY_START, SECONDS_PER_MINUTE, seasonOf } from './time';
import { rainOnFarm, rollWeather } from './weather';
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
    farm: [],
    barn: { level: 0, trough: {}, output: {} },
    machines: {},
    market: {},
    sold: {},
    reputation: 0,
    requests: [],
    nextRequestId: 1,
    merchant: null,
    buffs: [],
    petted: [],
    weather: 'sun',
    tomorrow: 'sun',
    greenhouse: false,
    dexClaimed: [],
    nextUid: 1,
    helpers: [],
    plots: {},
    field: [],
    seedBox: {},
    seedChoice: 'auto',
    inventory: { [seedId('oran')]: 12, [seedId('cheri')]: 6, 'poke-ball': 5 },
    selected: 'hoe',
    bin: {},
    tools: { hoe: 0, can: 0 },
    upgrade: null,
    skills: { farming: 0, battling: 0, crafting: 0 },
    perks: [],
    pendingPerks: [],
    seen: [],
    caught: [],
    stats: { harvested: 0, earned: 0, wins: 0, shippedBerries: 0, apricorns: 0, smelted: {} },
    story: { chapter: 0, flags: ['visited:farm'], delivered: {}, seen: [] },
    trainers: {},
    nodes: {},
    npcs: [],
    approach: null,
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
  rollMarket(world);
  refreshRequests(world);
  world.tomorrow = rollWeather(world, seasonOf(2));
  syncHelpers(world);
  placeHelpers(world, SPAWN);
  beginStory(world);
  return world;
}

const MACHINE_IDS = [...ITEMS.values()].filter((i) => i.kind === 'machine').map((i) => i.id);

/** What sits in the hotbar: the tools, then every kind of seed you have, then machines to place. */
export function hotbar(world: World): string[] {
  const owned = (id: string): boolean => (world.inventory[id] ?? 0) > 0;
  return [...TOOLS, ...CROPS.map((c) => seedId(c.id)).filter(owned), ...MACHINE_IDS.filter(owned)];
}

export function select(world: World, id: string): void {
  if (hotbar(world).includes(id)) world.selected = id;
}

/**
 * Tap on a tile: walk there and use it with what's in hand. Tiles that
 * can't be stood on (the bin, the door, the pond) are walked up to.
 */
export function tapTile(world: World, x: number, y: number): void {
  if (world.battle || world.approach) return;
  const p = world.player;
  const at = tileOf(p);
  const intent = intentAt(world, x, y);
  const kind = tileAt(world.map, x, y);
  const ok = passableFor(world);
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
    const path = pathBeside(at, { x, y }, ok, walkable(kind) && ok({ x, y }));
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
  if (p.path.length || world.battle || world.approach) return;
  p.facing = dir;
  p.pending = null;
  const at = tileOf(p);
  const next = { x: at.x + DELTA[dir].x, y: at.y + DELTA[dir].y };
  if (passableFor(world)(next)) p.path = [next];
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
  placeParty(world, { x, y });
  spawnNpcs(world);
  world.events.push({ kind: 'warp', map });
  visit(world, map);
}

/** Each new tile stepped on: a warp, or maybe a wild Pokémon in the tall grass. */
function onStep(world: World, at: Point): void {
  const warp = warpAt(world.map, at.x, at.y);
  if (warp) {
    warpTo(world, warp.to, warp.tx, warp.ty);
    return;
  }
  if (checkSight(world)) return;
  const tile = tileAt(world.map, at.x, at.y);
  if (tile !== 'tall' && tile !== 'cavefloor') return;
  const zones = ENCOUNTERS[world.map];
  if (!zones || nextRandom(world.rng) >= (tile === 'cavefloor' ? CAVE_RATE : ENCOUNTER_RATE)) return;
  if (!healthyParty(world).length) {
    world.events.push({ kind: 'hint', x: at.x, y: at.y, text: 'Something rustles, but your Pokémon need rest' });
    return;
  }
  const zone = zones.find((z) => at.y >= z.rows[0] && at.y < z.rows[1]);
  if (!zone) return;
  // The weather draws out its own types.
  const boosted = WEATHER_TYPES[world.weather];
  const slots = slotsFor(zone, seasonOf(world.day), !MAPS[world.map].cave && isNight(world.clock))
    .map((s) => ({ ...s, weight: boosted && species(s.dex).types.includes(boosted) ? s.weight * WEATHER_BOOST : s.weight }));
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
  const speed = (p.energy > 0 ? WALK_SPEED : TIRED_SPEED) * (hasBuff(world, 'swift') ? 1.3 : 1);
  updateNpcs(world, dt);
  const arrived = world.approach ? false : walk(p, speed, dt, (x, y) => onStep(world, { x, y }));
  if (world.battle || world.approach) return;
  if (arrived && p.pending) {
    const target = p.pending;
    p.pending = null;
    const at = tileOf(p);
    faceToward(p, target.x - at.x, target.y - at.y);
    useAt(world, target.x, target.y);
  }
  updateHelpers(world, dt, minutes);
  runMachines(world, minutes);
  checkStory(world);
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
  const { produced, hungry } = feedAndProduce(world);
  // Everyone sleeps at home, and the machines keep going through the night.
  world.map = 'farm';
  runMachines(world, 24 * 60 + DAY_START - world.clock);
  const oldSeason = seasonOf(world.day);
  world.day += 1;
  world.clock = DAY_START;
  world.battle = null;
  const newSeason = seasonOf(world.day) !== oldSeason;
  const withered = newSeason ? witherOutOfSeason(world) : 0;
  world.weather = world.tomorrow;
  world.tomorrow = rollWeather(world, seasonOf(world.day + 1));
  rainOnFarm(world);
  world.buffs = [];
  world.petted = [];
  world.sold = {};
  rollMarket(world);
  const expired = refreshRequests(world);
  const summary: DaySummary = { day: world.day - 1, shipped, earned, ...night, passedOut, lost, upgraded, produced, hungry, expired, withered, newSeason };
  p.x = SPAWN.x;
  p.y = SPAWN.y;
  p.path = [];
  p.pending = null;
  p.facing = 'down';
  syncHelpers(world);
  placeHelpers(world, SPAWN);
  spawnNpcs(world);
  world.events.push({ kind: 'day', summary });
  checkStory(world);
  return summary;
}

export { MAPS };
