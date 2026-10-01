/**
 * The farm, in `localStorage`. Saved when you sleep and every in-game hour.
 *
 * Loading is forgiving, as in PokéDefense: anything missing or malformed
 * falls back to its default, so an old or hand-edited save never stops the
 * game starting. Only a save with no readable starter is thrown away.
 */
import { isCrop } from '../data/crops';
import { ITEMS, marketItem, seedId } from '../data/items';
import { DEX_REWARDS } from '../data/dex';
import type { Weather } from '../data/encounters';
import { MACHINES } from '../data/crafting';
import { BARN_LEVELS, FRIENDSHIP } from '../data/ranch';
import { MAP_IDS, MAP_H, MAP_W, SEED_BOX, SPAWN, mapSize, tileAt, walkable, type MapId } from '../data/maps';
import { MOVES } from '../data/moves';
import { PERKS, SKILLS, TOOL_TIERS, type Skill } from '../data/progress';
import { SPECIES } from '../data/species';
import { canCapacity } from '../game/farm';
import { placeHelpers, syncHelpers } from '../game/helpers';
import { maxHp, movesAt, xpForLevel } from '../game/mon';
import { MAX_ENERGY, PARTY_SIZE, plotKey, type Dir, type Machine, type Mon, type Plot, type Request, type World } from '../game/model';
import { rollMarket } from '../game/market';
import { spawnNpcs } from '../game/npcs';
import { catchUpStory } from '../game/story';
import { CHAPTERS } from '../data/story';
import { TRAINERS } from '../data/people';
import { refreshRequests } from '../game/requests';
import { maxEnergyFor } from '../game/skills';
import { DAY_END, DAY_START } from '../game/time';

const KEY = 'pokeharvest.save.v1';
const SETTINGS_KEY = 'pokeharvest.settings.v1';

export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export function defaultStore(): Store | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const int = (v: unknown, fallback: number, min = 0, max = 1e9): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.floor(v))) : fallback;
const real = (v: unknown, fallback: number, min = 0, max = 1e9): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right'];
const WEATHERS: readonly Weather[] = ['sun', 'rain', 'storm', 'snow'];
const ALL_PERKS = new Set(Object.values(PERKS).flatMap((byLevel) => Object.values(byLevel).flatMap((pair) => pair.map((p) => p.id))));

/** Item counts, dropping unknown items and tools. */
function bag(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(obj(raw))) {
    const count = int(n, 0, 0, 9999);
    if (count > 0 && ITEMS.has(id) && ITEMS.get(id)?.kind !== 'tool') out[id] = count;
  }
  return out;
}

function plots(raw: unknown): Record<string, Plot> {
  const out: Record<string, Plot> = {};
  for (const [key, value] of Object.entries(obj(raw))) {
    const m = /^(\d+),(\d+)$/.exec(key);
    if (!m) continue;
    const x = Number(m[1]);
    const y = Number(m[2]);
    const kind = tileAt('farm', x, y);
    if (x >= MAP_W || y >= MAP_H || (kind !== 'grass' && kind !== 'ghsoil')) continue;
    const p = obj(value);
    const c = obj(p.crop);
    const id = typeof c.id === 'string' && isCrop(c.id) ? c.id : null;
    out[key] = {
      watered: p.watered === true,
      crop: id ? { id, growth: real(c.growth, 0, 0, 100), harvests: int(c.harvests, 0), tended: c.tended === true } : null,
    };
  }
  return out;
}

/** Tiles you've tilled: in-bounds farm soil only. */
function field(raw: unknown): string[] {
  return [...new Set(arr(raw).filter((k): k is string => {
    if (typeof k !== 'string') return false;
    const m = /^(\d+),(\d+)$/.exec(k);
    const kind = m ? tileAt('farm', Number(m[1]), Number(m[2])) : 'tree';
    return kind === 'grass' || kind === 'ghsoil';
  }))];
}

function seeds(raw: unknown): Record<string, number> {
  return Object.fromEntries(Object.entries(bag(raw)).filter(([id]) => ITEMS.get(id)?.kind === 'seed'));
}

/** Anything on the tile the Seed Box now stands on goes back to the bag: a crop as its seed, a machine as itself. */
function clearSeedBoxTile(r: Obj, inventory: Record<string, number>): void {
  const key = plotKey(SEED_BOX.x, SEED_BOX.y);
  const give = (id: unknown, n = 1): void => {
    if (typeof id === 'string' && ITEMS.has(id)) inventory[id] = (inventory[id] ?? 0) + n;
  };
  const c = obj(obj(obj(r.plots)[key]).crop);
  if (typeof c.id === 'string' && isCrop(c.id)) give(seedId(c.id));
  const m = obj(obj(r.machines)[key]);
  give(m.id);
  give(m.output, int(m.count, 1, 1, 2));
}

function crops(raw: unknown): Record<string, number> {
  return Object.fromEntries(Object.entries(bag(raw)).filter(([id]) => ITEMS.get(id)?.kind === 'crop'));
}

function machines(raw: unknown): Record<string, Machine> {
  const out: Record<string, Machine> = {};
  for (const [key, value] of Object.entries(obj(raw))) {
    const m = /^(\d+),(\d+)$/.exec(key);
    const v = obj(value);
    const kind = m ? tileAt('farm', Number(m[1]), Number(m[2])) : 'tree';
    if (!m || typeof v.id !== 'string' || !MACHINES[v.id] || (kind !== 'grass' && kind !== 'ghsoil')) continue;
    const output = typeof v.output === 'string' && ITEMS.has(v.output) ? v.output : null;
    const needed = output ? real(v.needed, MACHINES[v.id]!.minutes, 1, 1e6) : 0;
    out[key] = { id: v.id, output, count: output ? int(v.count, 1, 1, 2) : 0, progress: output ? real(v.progress, 0, 0, needed) : 0, needed };
  }
  return out;
}

function market(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, v] of Object.entries(obj(raw))) if (marketItem(id)) out[id] = real(v, 1, 0.5, 1.5);
  return out;
}

function requests(raw: unknown): Request[] {
  return arr(raw).flatMap((v) => {
    const q = obj(v);
    if (typeof q.item !== 'string' || !ITEMS.has(q.item)) return [];
    return [{ id: int(q.id, 0), item: q.item, count: int(q.count, 1, 1, 99), reward: int(q.reward, 0), reputation: int(q.reputation, 1, 0, 5), due: int(q.due, 1, 1) }];
  }).slice(0, 3);
}

function story(raw: unknown): World['story'] {
  const s = obj(raw);
  const strs = (v: unknown): string[] => [...new Set(arr(v).filter((x): x is string => typeof x === 'string'))];
  const delivered: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(s.delivered))) if (ITEMS.has(k) || k.startsWith('kind:')) delivered[k] = int(v, 0, 0, 999);
  return { chapter: int(s.chapter, 0, 0, CHAPTERS.length), flags: strs(s.flags), delivered, seen: strs(s.seen) };
}

function trainerRecords(raw: unknown): World['trainers'] {
  const out: World['trainers'] = {};
  for (const [id, v] of Object.entries(obj(raw))) {
    if (id !== 'kai' && !TRAINERS.some((t) => t.id === id)) continue;
    out[id] = { week: int(obj(v).week, 0), wins: int(obj(v).wins, 1, 1) };
  }
  return out;
}

function nodeDays(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(raw))) if (/^[a-z0-9]+:\d+,\d+$/.test(k)) out[k] = int(v, 0);
  return out;
}

function mon(raw: unknown, uid: number): Mon | null {
  const r = obj(raw);
  if (typeof r.dex !== 'number' || !SPECIES.has(r.dex)) return null;
  const level = int(r.level, 5, 1, 100);
  const base = { dex: r.dex, level };
  const moves = arr(r.moves).filter((id): id is string => typeof id === 'string' && MOVES.has(id)).slice(0, 4);
  return {
    uid,
    dex: r.dex,
    level,
    xp: int(r.xp, xpForLevel(level), xpForLevel(level), xpForLevel(level + 1) - 1),
    hp: int(r.hp, maxHp(base), 0, maxHp(base)),
    moves: moves.length ? moves : movesAt(r.dex, level),
    shiny: r.shiny === true,
    friendship: int(r.friendship, FRIENDSHIP.start, 0, FRIENDSHIP.max),
    fed: r.fed !== false,
  };
}

/** Rebuild a world from whatever was stored, or null if it's unusable. */
export function parseWorld(raw: unknown): World | null {
  const r = obj(raw);
  const rng = { seed: int(obj(r.rng).seed, 1, -2147483648, 2147483647) };

  // Pokémon, with uids made unique. A Phase 1 save has only `helpers: [{ dex }]`.
  const seenUids = new Set<number>();
  const mons: Mon[] = [];
  const monsRaw = Array.isArray(r.mons) ? r.mons : arr(r.helpers).map((h) => ({ ...obj(h), level: 5 }));
  for (const m of monsRaw) {
    const wanted = int(obj(m).uid, 0, 0);
    const parsed = mon(m, 0);
    if (!parsed) continue;
    const uid = wanted > 0 && !seenUids.has(wanted) ? wanted : 0;
    parsed.uid = uid;
    mons.push(parsed);
    if (uid) seenUids.add(uid);
  }
  let nextUid = Math.max(0, ...seenUids) + 1;
  for (const m of mons) if (!m.uid) m.uid = nextUid++;
  if (!mons.length) return null;
  let party = arr(r.party).filter((u): u is number => typeof u === 'number' && mons.some((m) => m.uid === u));
  party = [...new Set(party)].slice(0, PARTY_SIZE);
  if (!party.length) party = mons.slice(0, PARTY_SIZE).map((m) => m.uid);
  const barnRaw = obj(r.barn);
  const barnLevel = int(barnRaw.level, 0, 0, BARN_LEVELS.length - 1);
  const farm = [...new Set(arr(r.farm).filter((u): u is number => typeof u === 'number' && mons.some((m) => m.uid === u) && !party.includes(u)))]
    .slice(0, BARN_LEVELS[barnLevel]!.capacity);

  const map: MapId = MAP_IDS.includes(r.map as MapId) ? (r.map as MapId) : 'farm';
  const size = mapSize(map);
  const pr = obj(r.player);
  let x = int(pr.x, SPAWN.x, 0, size.w - 1);
  let y = int(pr.y, SPAWN.y, 0, size.h - 1);
  const onMap = walkable(tileAt(map, x, y));
  if (!onMap) ({ x, y } = SPAWN);
  const inventory = bag(r.inventory);
  clearSeedBoxTile(r, inventory);
  const selected = typeof r.selected === 'string' && (ITEMS.get(r.selected)?.kind === 'tool' || (inventory[r.selected] ?? 0) > 0) ? r.selected : 'hoe';
  const stats = obj(r.stats);
  const toolsRaw = obj(r.tools);
  const maxTier = TOOL_TIERS.length - 1;
  const up = obj(r.upgrade);
  const skillsRaw = obj(r.skills);
  const skills = Object.fromEntries(SKILLS.map((k) => [k, int(skillsRaw[k], 0)])) as Record<Skill, number>;
  const dexList = (v: unknown): number[] => [...new Set(arr(v).filter((d): d is number => typeof d === 'number' && SPECIES.has(d)))];

  const world: World = {
    day: int(r.day, 1, 1),
    clock: real(r.clock, DAY_START, DAY_START, DAY_END - 1),
    rng,
    map: onMap ? map : 'farm',
    player: {
      x, y, path: [], pending: null,
      facing: DIRS.includes(pr.facing as Dir) ? (pr.facing as Dir) : 'down',
      energy: 0, maxEnergy: MAX_ENERGY,
      gold: int(pr.gold, 0),
      water: 0,
    },
    mons,
    party,
    farm,
    barn: { level: barnLevel, trough: crops(barnRaw.trough), output: bag(barnRaw.output) },
    machines: machines(r.machines),
    market: market(r.market),
    sold: bag(r.sold),
    reputation: int(r.reputation, 0),
    requests: requests(r.requests),
    nextRequestId: int(r.nextRequestId, 1, 1),
    merchant: null,
    buffs: arr(r.buffs).filter((b): b is World['buffs'][number] => b === 'swift' || b === 'lucky' || b === 'coach' || b === 'steady'),
    petted: arr(r.petted).filter((u): u is number => typeof u === 'number'),
    weather: WEATHERS.includes(r.weather as Weather) ? (r.weather as Weather) : 'sun',
    tomorrow: WEATHERS.includes(r.tomorrow as Weather) ? (r.tomorrow as Weather) : 'sun',
    greenhouse: r.greenhouse === true,
    dexClaimed: arr(r.dexClaimed).filter((n): n is number => typeof n === 'number' && DEX_REWARDS.some((d) => d.caught === n)),
    nextUid,
    helpers: [],
    plots: plots(r.plots),
    field: [],
    seedBox: seeds(r.seedBox),
    seedChoice: typeof r.seedChoice === 'string' && ITEMS.get(r.seedChoice)?.kind === 'seed' ? r.seedChoice : 'auto',
    inventory,
    selected,
    bin: bag(r.bin),
    tools: { hoe: int(toolsRaw.hoe, 0, 0, maxTier), can: int(toolsRaw.can, 0, 0, maxTier) },
    upgrade: (up.tool === 'hoe' || up.tool === 'can') && typeof up.tier === 'number'
      ? { tool: up.tool, tier: int(up.tier, 1, 1, maxTier), day: int(up.day, 1, 1) }
      : null,
    skills,
    perks: [...new Set(arr(r.perks).filter((p): p is string => typeof p === 'string' && ALL_PERKS.has(p)))],
    pendingPerks: arr(r.pendingPerks).flatMap((pp) => {
      const o = obj(pp);
      return SKILLS.includes(o.skill as Skill) && (o.level === 5 || o.level === 10) ? [{ skill: o.skill as Skill, level: o.level as 5 | 10 }] : [];
    }),
    seen: dexList(r.seen),
    caught: dexList(r.caught),
    stats: {
      harvested: int(stats.harvested, 0), earned: int(stats.earned, 0), wins: int(stats.wins, 0),
      shippedBerries: int(stats.shippedBerries, 0), apricorns: int(stats.apricorns, 0), smelted: bag(stats.smelted),
    },
    story: story(r.story),
    trainers: trainerRecords(r.trainers),
    nodes: nodeDays(r.nodes),
    npcs: [],
    approach: null,
    battle: null,
    events: [],
  };
  // Older saves count the plots you have now as your fields.
  world.field = Array.isArray(r.field) ? field(r.field) : Object.keys(world.plots);
  // Older saves: a market for the day, and a request or two on the board.
  if (!Object.keys(world.market).length) rollMarket(world);
  if (!world.requests.length) refreshRequests(world);
  for (const m of mons) {
    if (!world.seen.includes(m.dex)) world.seen.push(m.dex);
    if (!world.caught.includes(m.dex)) world.caught.push(m.dex);
  }
  // A farm from before the story: catch it up, and hand over the Workbench its machines would now need.
  if (!r.story) {
    catchUpStory(world);
    world.inventory.workbench = (world.inventory.workbench ?? 0) + 1;
  }
  world.story.flags = [...new Set(['visited:farm', ...world.story.flags])];
  spawnNpcs(world);
  const maxEnergy = maxEnergyFor(world);
  world.player.maxEnergy = maxEnergy;
  world.player.energy = int(pr.energy, maxEnergy, 0, maxEnergy);
  world.player.water = int(pr.water, canCapacity(world), 0, canCapacity(world));
  syncHelpers(world);
  placeHelpers(world, { x, y });
  return world;
}

/** What gets written: the world, minus the per-frame bits. */
function serialize(world: World): unknown {
  const { events: _events, ...rest } = world;
  return {
    ...rest,
    npcs: [],
    approach: null,
    player: { ...world.player, x: Math.round(world.player.x), y: Math.round(world.player.y), path: [], pending: null },
    helpers: [],
    // Seeds a helper is carrying go back in the box: helpers aren't saved.
    seedBox: withCarried(world),
    battle: null,
  };
}

function withCarried(world: World): Record<string, number> {
  const box = { ...world.seedBox };
  for (const h of world.helpers) if (h.carrying) box[h.carrying] = (box[h.carrying] ?? 0) + 1;
  return box;
}

export function saveWorld(world: World, store: Store | null = defaultStore()): void {
  try {
    store?.setItem(KEY, JSON.stringify(serialize(world)));
  } catch {
    // Private mode or full: the game carries on, it just won't remember.
  }
}

export function loadWorld(store: Store | null = defaultStore()): World | null {
  try {
    const text = store?.getItem(KEY);
    return text ? parseWorld(JSON.parse(text)) : null;
  } catch {
    return null;
  }
}

export function clearSave(store: Store | null = defaultStore()): void {
  try {
    store?.removeItem?.(KEY);
  } catch {
    // Nothing to do.
  }
}

// --- settings, kept apart from the farm so a new game keeps them -----------------

export interface DpadSettings {
  enabled: boolean;
  size: 'S' | 'M' | 'L';
  opacity: number;
  /** Top-left corner, as percentages of the screen. */
  x: number;
  y: number;
}

/** On by default on touch screens, bottom left, above the hotbar. */
export function defaultDpad(): DpadSettings {
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  return { enabled: touch, size: 'M', opacity: 80, x: 3, y: 62 };
}

export interface Settings {
  sfx: number;
  cries: number;
  music: number;
  dpad: DpadSettings;
  muted: boolean;
}

export const DEFAULT_SETTINGS: Settings = { sfx: 80, cries: 70, music: 50, muted: false, dpad: { enabled: false, size: 'M', opacity: 80, x: 3, y: 62 } };

export function loadSettings(store: Store | null = defaultStore()): Settings {
  try {
    const r = obj(JSON.parse(store?.getItem(SETTINGS_KEY) ?? '{}'));
    const d = obj(r.dpad);
    const base = defaultDpad();
    const dpad: DpadSettings = {
      enabled: typeof d.enabled === 'boolean' ? d.enabled : base.enabled,
      size: d.size === 'S' || d.size === 'L' ? d.size : 'M',
      opacity: int(d.opacity, base.opacity, 20, 100),
      x: real(d.x, base.x, 0, 95),
      y: real(d.y, base.y, 0, 95),
    };
    return { sfx: int(r.sfx, DEFAULT_SETTINGS.sfx, 0, 100), cries: int(r.cries, DEFAULT_SETTINGS.cries, 0, 100), music: int(r.music, DEFAULT_SETTINGS.music, 0, 100), muted: r.muted === true, dpad };
  } catch {
    return { ...DEFAULT_SETTINGS, dpad: defaultDpad() };
  }
}

export function saveSettings(s: Settings, store: Store | null = defaultStore()): void {
  try {
    store?.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // As above.
  }
}
