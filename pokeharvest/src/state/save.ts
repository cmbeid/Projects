/**
 * The farm, in `localStorage`. Saved when you sleep and every in-game hour.
 *
 * Loading is forgiving, as in PokéDefense: anything missing or malformed
 * falls back to its default, so an old or hand-edited save never stops the
 * game starting. Only a save with no readable starter is thrown away.
 */
import { isCrop } from '../data/crops';
import { ITEMS } from '../data/items';
import { MAP_H, MAP_W, SPAWN, tileAt, walkable } from '../data/maps';
import { SPECIES } from '../data/species';
import { newHelper } from '../game/helpers';
import { CAN_SIZE, MAX_ENERGY, type Dir, type Plot, type World } from '../game/model';
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
const int = (v: unknown, fallback: number, min = 0, max = 1e9): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.floor(v))) : fallback;
const real = (v: unknown, fallback: number, min = 0, max = 1e9): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right'];

/** Item counts, dropping unknown items and tools. */
function bag(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(obj(raw))) {
    const count = int(n, 0, 0, 9999);
    if (count > 0 && ITEMS.get(id)?.kind !== 'tool' && ITEMS.has(id)) out[id] = count;
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
    if (x >= MAP_W || y >= MAP_H || tileAt(x, y) !== 'grass') continue;
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

/** Rebuild a world from whatever was stored, or null if it's unusable. */
export function parseWorld(raw: unknown): World | null {
  const r = obj(raw);
  const helpersRaw = Array.isArray(r.helpers) ? r.helpers : [];
  const helpers = helpersRaw
    .map((hr) => obj(hr))
    .filter((hr) => typeof hr.dex === 'number' && SPECIES.has(hr.dex))
    .map((hr, i) => newHelper(hr.dex as number, SPAWN.x + 1 + i, SPAWN.y));
  if (!helpers.length) return null;

  const pr = obj(r.player);
  let x = int(pr.x, SPAWN.x, 0, MAP_W - 1);
  let y = int(pr.y, SPAWN.y, 0, MAP_H - 1);
  if (!walkable(tileAt(x, y))) ({ x, y } = SPAWN);
  const maxEnergy = int(pr.maxEnergy, MAX_ENERGY, 1, 999);
  const inventory = bag(r.inventory);
  const selected = typeof r.selected === 'string' && (ITEMS.get(r.selected)?.kind === 'tool' || (inventory[r.selected] ?? 0) > 0) ? r.selected : 'hoe';
  const stats = obj(r.stats);
  return {
    day: int(r.day, 1, 1),
    clock: real(r.clock, DAY_START, DAY_START, DAY_END - 1),
    rng: { seed: int(obj(r.rng).seed, 1, -2147483648, 2147483647) },
    player: {
      x, y, path: [], pending: null,
      facing: DIRS.includes(pr.facing as Dir) ? (pr.facing as Dir) : 'down',
      energy: int(pr.energy, maxEnergy, 0, maxEnergy),
      maxEnergy,
      gold: int(pr.gold, 0),
      water: int(pr.water, CAN_SIZE, 0, CAN_SIZE),
    },
    helpers,
    plots: plots(r.plots),
    inventory,
    selected,
    bin: bag(r.bin),
    stats: { harvested: int(stats.harvested, 0), earned: int(stats.earned, 0) },
    events: [],
  };
}

/** What gets written: the world, minus the per-frame bits. */
function serialize(world: World): unknown {
  const { events: _events, ...rest } = world;
  return {
    ...rest,
    player: { ...world.player, x: Math.round(world.player.x), y: Math.round(world.player.y), path: [], pending: null },
    helpers: world.helpers.map((h) => ({ dex: h.dex })),
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
