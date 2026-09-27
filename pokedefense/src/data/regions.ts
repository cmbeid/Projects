/**
 * The three regions, played in order: becoming Champion of one opens the
 * next. Each has its own Gym Badges (PokeAPI numbers them 1–24 straight
 * through), its own music, and a professor who hands over that region's
 * three starters on arrival.
 */
import type { TrackId } from './music';

export const REGION_IDS = ['kanto', 'johto', 'hoenn'] as const;
export type RegionId = (typeof REGION_IDS)[number];

export interface Region {
  id: RegionId;
  name: string;
  professor: string;
  /** Tower lines given on arrival. Kanto's are the ones every save starts with. */
  starters: readonly string[];
  badges: readonly number[];
  /** The map whose clearing makes you Champion, and opens the next region. */
  league: string;
  endless: string;
  worldTrack: TrackId;
  teamTrack: TrackId;
  winTrack: TrackId;
  championTrack: TrackId;
}

export const REGIONS: Record<RegionId, Region> = {
  kanto: {
    id: 'kanto', name: 'Kanto', professor: 'Professor Oak', starters: ['bulbasaur', 'charmander', 'squirtle'],
    badges: [1, 2, 3, 4, 5, 6, 7, 8], league: 'indigo-plateau', endless: 'cerulean-cave',
    worldTrack: 'route1', teamTrack: 'gym', winTrack: 'gymleadervictory', championTrack: 'halloffame',
  },
  johto: {
    id: 'johto', name: 'Johto', professor: 'Professor Elm', starters: ['chikorita', 'cyndaquil', 'totodile'],
    badges: [9, 10, 11, 12, 13, 14, 15, 16], league: 'johto-league', endless: 'mt-silver',
    worldTrack: 'newbarktown', teamTrack: 'violetcity', winTrack: 'gymleadervictory', championTrack: 'halloffame',
  },
  hoenn: {
    id: 'hoenn', name: 'Hoenn', professor: 'Professor Birch', starters: ['treecko', 'torchic', 'mudkip'],
    badges: [17, 18, 19, 20, 21, 22, 23, 24], league: 'ever-grande', endless: 'sky-pillar',
    worldTrack: 'e_littleroot', teamTrack: 'e_rustboro', winTrack: 'e_victory_gym_leader', championTrack: 'e_hall_of_fame',
  },
};

/** The region before this one, whose League opens it. */
export function previousRegion(id: RegionId): RegionId | null {
  const i = REGION_IDS.indexOf(id);
  return i > 0 ? REGION_IDS[i - 1]! : null;
}
