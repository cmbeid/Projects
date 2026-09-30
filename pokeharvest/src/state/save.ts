/**
 * The farm, in `localStorage`. Saved when you sleep and every in-game hour.
 *
 * Loading is forgiving, as in PokéDefense: anything missing or malformed
 * falls back to its default, so an old or hand-edited save never stops the
 * game starting. Only a save with no readable starter is thrown away.
 */
import { isCrop } from '../data/crops';
import { ITEMS } from '../data/items';
import { MAP_IDS, MAP_H, MAP_W, SPAWN, mapSize, tileAt, walkable, type MapId } from '../data/maps';
import { MOVES } from '../data/moves';
import { PERKS, SKILLS, TOOL_TIERS, type Skill } from '../data/progress';
import { SPECIES } from '../data/species';
import { canCapacity } from '../game/farm';
import { placeHelpers, syncHelpers } from '../game/helpers';
import { maxHp, movesAt, xpForLevel } from '../game/mon';
import { MAX_ENERGY, PARTY_SIZE, type Dir, type Mon, type Plot, type World } from '../game/model';
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
    if (x >= MAP_W || y >= MAP_H || tileAt('farm', x, y) !== 'grass') continue;
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

  const map: MapId = MAP_IDS.includes(r.map as MapId) ? (r.map as MapId) : 'farm';
  const size = mapSize(map);
  const pr = obj(r.player);
  let x = int(pr.x, SPAWN.x, 0, size.w - 1);
  let y = int(pr.y, SPAWN.y, 0, size.h - 1);
  const onMap = walkable(tileAt(map, x, y));
  if (!onMap) ({ x, y } = SPAWN);
  const inventory = bag(r.inventory);
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
    nextUid,
    helpers: [],
    plots: plots(r.plots),
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
    stats: { harvested: int(stats.harvested, 0), earned: int(stats.earned, 0), wins: int(stats.wins, 0) },
    battle: null,
    events: [],
  };
  for (const m of mons) {
    if (!world.seen.includes(m.dex)) world.seen.push(m.dex);
    if (!world.caught.includes(m.dex)) world.caught.push(m.dex);
  }
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
    player: { ...world.player, x: Math.round(world.player.x), y: Math.round(world.player.y), path: [], pending: null },
    helpers: [],
    battle: null,
  };
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

export interface Settings {
  sfx: number;
  cries: number;
  muted: boolean;
}

export const DEFAULT_SETTINGS: Settings = { sfx: 80, cries: 70, muted: false };

export function loadSettings(store: Store | null = defaultStore()): Settings {
  try {
    const r = obj(JSON.parse(store?.getItem(SETTINGS_KEY) ?? '{}'));
    return { sfx: int(r.sfx, DEFAULT_SETTINGS.sfx, 0, 100), cries: int(r.cries, DEFAULT_SETTINGS.cries, 0, 100), muted: r.muted === true };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings, store: Store | null = defaultStore()): void {
  try {
    store?.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // As above.
  }
}
