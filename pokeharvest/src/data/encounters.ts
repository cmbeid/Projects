/**
 * Who lives in Route 1's tall grass. The grass nearer the farm has younger
 * Pokémon; past the tree line (row 12) they're older and rarer. Night brings
 * its own, each season adds a few more, and the weather draws out its own
 * types: Water types in the rain, Electric in storms, Ice in the snow.
 */
import type { Season } from '../game/time';
import type { MapId } from './maps';
import type { PokeType } from './types';

export type Weather = 'sun' | 'rain' | 'storm' | 'snow';

export interface Slot {
  dex: number;
  weight: number;
}

export interface Zone {
  /** Rows [from, to) this zone covers. */
  rows: [number, number];
  levels: [number, number];
  day: readonly Slot[];
  night: readonly Slot[];
  /** Extra Pokémon in a season, by day and by night. */
  seasons: Partial<Record<Season, { day?: readonly Slot[]; night?: readonly Slot[] }>>;
}

export const ENCOUNTERS: Partial<Record<MapId, readonly Zone[]>> = {
  route1: [
    {
      rows: [0, 12],
      levels: [2, 5],
      day: [{ dex: 16, weight: 30 }, { dex: 19, weight: 30 }, { dex: 10, weight: 15 }, { dex: 69, weight: 10 }, { dex: 27, weight: 10 }, { dex: 25, weight: 5 }],
      night: [{ dex: 163, weight: 35 }, { dex: 19, weight: 30 }, { dex: 43, weight: 30 }, { dex: 92, weight: 5 }],
      seasons: {
        Spring: { day: [{ dex: 187, weight: 20 }] },
        Summer: { day: [{ dex: 191, weight: 15 }, { dex: 54, weight: 12 }], night: [{ dex: 313, weight: 15 }, { dex: 314, weight: 15 }] },
        Autumn: { day: [{ dex: 216, weight: 12 }], night: [{ dex: 198, weight: 12 }] },
        Winter: { day: [{ dex: 220, weight: 25 }, { dex: 225, weight: 8 }], night: [{ dex: 220, weight: 20 }] },
      },
    },
    {
      rows: [12, 99],
      levels: [5, 10],
      day: [{ dex: 179, weight: 18 }, { dex: 50, weight: 15 }, { dex: 74, weight: 15 }, { dex: 194, weight: 12 }, { dex: 270, weight: 12 }, { dex: 66, weight: 10 }, { dex: 58, weight: 10 }, { dex: 16, weight: 5 }, { dex: 415, weight: 6 }, { dex: 133, weight: 3 }],
      night: [{ dex: 92, weight: 30 }, { dex: 163, weight: 25 }, { dex: 43, weight: 20 }, { dex: 194, weight: 15 }, { dex: 179, weight: 10 }],
      seasons: {
        Spring: { day: [{ dex: 187, weight: 12 }, { dex: 54, weight: 8 }] },
        Summer: { day: [{ dex: 54, weight: 15 }], night: [{ dex: 313, weight: 10 }, { dex: 314, weight: 10 }] },
        Autumn: { day: [{ dex: 231, weight: 15 }, { dex: 216, weight: 12 }], night: [{ dex: 198, weight: 20 }] },
        Winter: { day: [{ dex: 459, weight: 20 }, { dex: 225, weight: 10 }], night: [{ dex: 215, weight: 15 }, { dex: 459, weight: 10 }] },
      },
    },
  ],
};

/** The type each weather draws out, and how strongly. */
export const WEATHER_TYPES: Record<Weather, PokeType | null> = { sun: null, rain: 'water', storm: 'electric', snow: 'ice' };
export const WEATHER_BOOST = 3;

/** Chance of a wild Pokémon for each step into tall grass. */
export const ENCOUNTER_RATE = 0.12;

/** Night falls for the wild at 8 PM and lifts at 6 AM. */
export function isNight(minute: number): boolean {
  const m = minute % (24 * 60);
  return m >= 20 * 60 || m < 6 * 60;
}

/** Everything that could turn up in a zone now. */
export function slotsFor(zone: Zone, season: Season, night: boolean): Slot[] {
  const extra = zone.seasons[season];
  return [...(night ? zone.night : zone.day), ...((night ? extra?.night : extra?.day) ?? [])];
}

/** Where and when a Pokémon can be found on the routes, for the Pokédex. */
export function habitat(dex: number): string[] {
  const out = new Set<string>();
  for (const [map, zones] of Object.entries(ENCOUNTERS)) {
    for (const z of zones ?? []) {
      const where = `${map === 'route1' ? 'Route 1' : map}, ${z.rows[0] === 0 ? 'near the farm' : 'past the trees'}`;
      if (z.day.some((s) => s.dex === dex)) out.add(`${where} by day`);
      if (z.night.some((s) => s.dex === dex)) out.add(`${where} at night`);
      for (const [season, extra] of Object.entries(z.seasons)) {
        if (extra?.day?.some((s) => s.dex === dex)) out.add(`${where}, ${season} days`);
        if (extra?.night?.some((s) => s.dex === dex)) out.add(`${where}, ${season} nights`);
      }
    }
  }
  return [...out];
}
