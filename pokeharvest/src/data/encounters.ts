/**
 * Who lives in Route 1's tall grass. The grass nearer the farm has younger
 * Pokémon; past the tree line (row 12) they're older and rarer. Night brings
 * its own.
 */
import type { MapId } from './maps';

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
}

export const ENCOUNTERS: Partial<Record<MapId, readonly Zone[]>> = {
  route1: [
    {
      rows: [0, 12],
      levels: [2, 5],
      day: [{ dex: 16, weight: 30 }, { dex: 19, weight: 30 }, { dex: 10, weight: 15 }, { dex: 69, weight: 10 }, { dex: 27, weight: 10 }, { dex: 25, weight: 5 }],
      night: [{ dex: 163, weight: 35 }, { dex: 19, weight: 30 }, { dex: 43, weight: 30 }, { dex: 92, weight: 5 }],
    },
    {
      rows: [12, 99],
      levels: [5, 10],
      day: [{ dex: 179, weight: 18 }, { dex: 50, weight: 15 }, { dex: 74, weight: 15 }, { dex: 194, weight: 12 }, { dex: 270, weight: 12 }, { dex: 66, weight: 10 }, { dex: 58, weight: 10 }, { dex: 16, weight: 5 }, { dex: 133, weight: 3 }],
      night: [{ dex: 92, weight: 30 }, { dex: 163, weight: 25 }, { dex: 43, weight: 20 }, { dex: 194, weight: 15 }, { dex: 179, weight: 10 }],
    },
  ],
};

/** Chance of a wild Pokémon for each step into tall grass. */
export const ENCOUNTER_RATE = 0.12;

/** Night falls for the wild at 8 PM and lifts at 6 AM. */
export function isNight(minute: number): boolean {
  const m = minute % (24 * 60);
  return m >= 20 * 60 || m < 6 * 60;
}
