import { BUILDING } from '../data/buildings';
import { districtAt } from '../data/districts';
import { REGALIA_BASE } from '../data/regalia';
import { BALANCE } from '../data/progression';
import type { BuildingDef, StatKey } from '../data/types';
import type { GameState, Placed } from '../state/types';
import { adjacencyMult, flooded } from './grid';

export interface CityStats {
  pop: number;
  jobs: number;
  /** Share of jobs filled, 0–1. Workplaces run at this share. */
  employ: number;
  /** Multiplies every workplace. 1 is content; homes beside gardens and civic buildings raise it. */
  happiness: number;
  /** Clearing damage per second from crews, before any of the Founder's bonuses. */
  crewBase: number;
  /** Coin per second from trade, before any bonuses. */
  taxBase: number;
  /** Workshop slots: one of your own, plus what industry adds. */
  slots: number;
  /** Workshop speed from industry levels past the first. */
  industrySpeed: number;
}

export interface Derived {
  tap: number;
  critChance: number;
  critMult: number;
  luck: number;
  light: number;
  smogProof: boolean;
  resolveMax: number;
  resolveRegen: number;
  crewDps: number;
  taxPerSec: number;
  xpMult: number;
  salvageMult: number;
  sellMult: number;
  taxMult: number;
  refineSpeed: number;
  offlineHours: number;
  offlineYield: number;
  landmarkMult: number;
  city: CityStats;
  hazard: { tap: number; crew: number; luck: number; warning: string | null };
}

const lvl = (rec: Record<string, number>, id: string): number => rec[id] ?? 0;

export const MAX_SLOTS = 8;
/** However many parks and theatres, a city is only so happy. */
export const MAX_HAPPINESS = 3;

/** Sums one stat across everything the Founder wears, base and affixes. */
export function regaliaStat(s: GameState, stat: StatKey): number {
  let total = 0;
  for (const uid of Object.values(s.equipped)) {
    if (uid == null) continue;
    const item = s.regalia.find((g) => g.uid === uid);
    if (!item) continue;
    total += REGALIA_BASE.get(item.base)?.stats[stat] ?? 0;
    for (const a of item.affixes) if (a.stat === stat) total += a.value;
  }
  return total;
}

export function toolsBase(level: number): number {
  return (1 + level) * 2 ** Math.floor(level / 10);
}

interface Entry {
  b: Placed;
  def: BuildingDef;
  inst: number;
}

/**
 * Adjacency only changes when a building is placed, moved, levelled or
 * pulled down, so the per-building multipliers are kept until the layout
 * changes. The key is the layout itself.
 */
const layoutCache = new WeakMap<GameState, { key: string; entries: Entry[] }>();

export function layoutEntries(s: GameState): Entry[] {
  let key = '';
  for (const b of s.buildings) key += `${b.uid}:${b.type}:${b.lvl}:${b.district}:${b.x}:${b.y};`;
  const hit = layoutCache.get(s);
  if (hit && hit.key === key) return hit.entries;
  const entries: Entry[] = [];
  for (const b of s.buildings) {
    const def = BUILDING.get(b.type);
    if (def) entries.push({ b, def, inst: adjacencyMult(s, b) });
  }
  layoutCache.set(s, { key, entries });
  return entries;
}

export function cityStats(s: GameState): CityStats {
  let pop = 0;
  let jobs = 0;
  let homeLvls = 0;
  let homeInst = 0;
  let cheer = 0;
  let crewBase = 0;
  let taxBase = 0;
  let slots = 1;
  let industryExtra = 0;
  for (const { b, def, inst } of layoutEntries(s)) {
    jobs += (def.jobs ?? 0) * b.lvl;
    switch (def.tag) {
      case 'home':
        pop += (def.pop ?? 0) * b.lvl * inst;
        homeLvls += b.lvl;
        homeInst += b.lvl * inst;
        break;
      case 'civic':
        cheer += (def.cheer ?? 0) * b.lvl * inst;
        break;
      case 'crew':
        if (!flooded(s, b)) crewBase += (def.dps ?? 0) * b.lvl * inst;
        break;
      case 'trade':
        if (!flooded(s, b)) taxBase += (def.tax ?? 0) * b.lvl * inst;
        break;
      case 'industry':
        slots += def.slots ?? 0;
        industryExtra += (b.lvl - 1) * inst;
        break;
      default:
        break;
    }
  }
  const employ = jobs > 0 ? Math.min(1, pop / jobs) : 1;
  const happiness = Math.max(0.5, Math.min(MAX_HAPPINESS, (homeLvls > 0 ? homeInst / homeLvls : 1) + cheer));
  return {
    pop,
    jobs,
    employ,
    happiness,
    crewBase,
    taxBase,
    slots: Math.min(MAX_SLOTS, slots),
    industrySpeed: 1 + 0.1 * industryExtra,
  };
}

/**
 * Everything the Founder's state and the city's layout add up to.
 * Recomputed on demand; only the adjacency underneath is cached.
 */
export function derive(s: GameState): Derived {
  const p = s.passives;
  const c = s.charter;
  const u = s.upgrades;
  const district = districtAt(s.ward);
  const calm = s.buffs.calm > 0;

  const light = regaliaStat(s, 'light');
  const smogProof = regaliaStat(s, 'smogRes') > 0;
  const hazard = { tap: 1, crew: 1, luck: 1, warning: null as string | null };
  const pen = BALANCE.hazardPenalty;
  const fix = (id: Parameters<typeof s.fixtures.includes>[0]): boolean => s.fixtures.includes(id);
  if (!calm) {
    if (district.hazard === 'tide' && !fix('seawall')) {
      hazard.crew = pen;
      hazard.warning = 'The tide keeps flooding the crews’ work. Build a Sea Wall.';
    } else if (district.hazard === 'crowd' && !fix('charter')) {
      hazard.crew = pen;
      hazard.warning = 'Crowds are in your crews’ way. A Town Charter would sort them out.';
    } else if (district.hazard === 'smog') {
      if (!smogProof) hazard.tap = pen;
      if (!fix('scrubbers')) hazard.crew = pen;
      if (!smogProof || !fix('scrubbers')) {
        const need = [!smogProof && 'a sealed coat', !fix('scrubbers') && 'Smog Scrubbers'].filter(Boolean).join(' and ');
        hazard.warning = `The smog is choking the work. You need ${need}.`;
      }
    } else if (district.hazard === 'silence') {
      if (light < BALANCE.fogLight) {
        hazard.tap = pen;
        hazard.luck = 0.5;
      }
      if (!fix('beacons')) hazard.crew = pen;
      if (light < BALANCE.fogLight || !fix('beacons')) {
        const need = [light < BALANCE.fogLight && `a lantern with ${BALANCE.fogLight} light`, !fix('beacons') && 'a Beacon Line'].filter(Boolean).join(' and ');
        hazard.warning = `The fog is too thick to work in. You need ${need}.`;
      }
    }
  }

  const hum = lvl(c, 'hum') > 0 ? 1 + 0.02 * s.memories : 1;
  const city = cityStats(s);
  const festival = s.buffs.festival > 0 ? 3 : 1;

  const tap =
    toolsBase(lvl(u, 'tools')) *
    (1 + 0.1 * s.stats.craft) *
    (1 + regaliaStat(s, 'dmgPct') / 100) *
    (1 + 0.15 * lvl(p, 'brawn')) *
    2 ** lvl(c, 'hands') *
    hum *
    hazard.tap;

  const critChance = Math.min(75, BALANCE.baseCrit + 0.5 * s.stats.vision + lvl(u, 'hands') + 2 * lvl(p, 'eye') + regaliaStat(s, 'critChance'));
  const critMult = BALANCE.baseCritMult + 0.01 * s.stats.vision + 0.3 * lvl(p, 'wrecker') + regaliaStat(s, 'critMult');

  const luck =
    (s.stats.charm + regaliaStat(s, 'luck') + 4 * lvl(p, 'lucky') + 6 * lvl(c, 'omens') +
      (s.buffs.survey > 0 ? 30 : 0) + (s.buffs.ink > 0 ? 40 : 0)) * hazard.luck;

  const crewDps =
    city.crewBase *
    city.employ *
    city.happiness *
    1.25 ** lvl(u, 'foremen') *
    (1 + regaliaStat(s, 'crewPct') / 100) *
    (1 + 0.15 * lvl(p, 'gaffer')) *
    2 ** lvl(c, 'crews') *
    hum *
    festival *
    (s.buffs.overtime > 0 ? 3 : 1) *
    hazard.crew;

  const wine = s.buffs.wine > 0 ? 2 : 1;
  const sellMult = (1 + 0.08 * lvl(u, 'ledgers')) * (1 + 0.1 * lvl(p, 'broker')) * 1.5 ** lvl(c, 'tithe') * wine;
  const taxMult = sellMult * (1 + 0.03 * s.stats.charm) * (1 + regaliaStat(s, 'taxPct') / 100) * hum;

  return {
    tap,
    critChance,
    critMult,
    luck,
    light,
    smogProof,
    resolveMax: BALANCE.baseResolve + 5 * s.stats.grit + regaliaStat(s, 'resolve'),
    resolveRegen: BALANCE.resolveRegen + 0.05 * s.stats.grit,
    crewDps,
    taxPerSec: city.taxBase * city.employ * city.happiness * taxMult * festival,
    xpMult: (1 + regaliaStat(s, 'xpPct') / 100) * (1 + 0.12 * lvl(p, 'scholar')) * (1 + 0.3 * lvl(c, 'lore')) * (s.buffs.almanac > 0 ? 2 : 1),
    salvageMult:
      (1 + 0.1 * lvl(u, 'barrows')) * (1 + regaliaStat(s, 'salvagePct') / 100) * (1 + 0.1 * lvl(p, 'scavenger')) *
      (s.buffs.survey > 0 ? 2 : 1) * (s.buffs.seek > 0 ? 3 : 1),
    sellMult,
    taxMult,
    refineSpeed: (1 + 0.25 * lvl(u, 'kilns')) * (1 + 0.2 * lvl(p, 'kilnwise')) * (1 + 0.3 * lvl(c, 'trades')) * city.industrySpeed,
    offlineHours: BALANCE.offlineHours + lvl(p, 'nightwatch') + 2 * lvl(c, 'patience'),
    offlineYield: 1 + 0.1 * lvl(p, 'nightwatch'),
    landmarkMult: 1 + 0.25 * lvl(p, 'landmarks'),
    city,
    hazard,
  };
}
