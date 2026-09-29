/**
 * The nine regions, played in order: becoming Champion of one opens the
 * next. Each has its own Gym Badges — PokeAPI numbers them 1–40 straight
 * through Unova, and Kalos's from 51; Alola's island trials, Galar's and
 * Paldea's badges aren't there, so `fetch-assets` draws them as 101–108,
 * 111–118 and 121–128 — its own music, and a professor who hands over that
 * region's three starters on arrival.
 */
import type { TrackId } from './music';

export const REGION_IDS = ['kanto', 'johto', 'hoenn', 'sinnoh', 'unova', 'kalos', 'alola', 'galar', 'paldea'] as const;
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
  sinnoh: {
    id: 'sinnoh', name: 'Sinnoh', professor: 'Professor Rowan', starters: ['turtwig', 'chimchar', 'piplup'],
    badges: [25, 26, 27, 28, 29, 30, 31, 32], league: 'sinnoh-league', endless: 'spear-pillar',
    worldTrack: 'p_twinleaf', teamTrack: 'p_gym', winTrack: 'p_victory', championTrack: 'p_halloffame',
  },
  unova: {
    id: 'unova', name: 'Unova', professor: 'Professor Juniper', starters: ['snivy', 'tepig', 'oshawott'],
    badges: [33, 34, 35, 36, 37, 38, 39, 40], league: 'unova-league', endless: 'giant-chasm',
    worldTrack: 'u_nuvema', teamTrack: 'u_gym', winTrack: 'u_victory', championTrack: 'p_halloffame',
  },
  kalos: {
    id: 'kalos', name: 'Kalos', professor: 'Professor Sycamore', starters: ['chespin', 'fennekin', 'froakie'],
    badges: [51, 52, 53, 54, 55, 56, 57, 58], league: 'kalos-league', endless: 'terminus-cave',
    worldTrack: 'k_vaniville', teamTrack: 'k_gym', winTrack: 'k_victory', championTrack: 'k_victory',
  },
  alola: {
    id: 'alola', name: 'Alola', professor: 'Professor Kukui', starters: ['rowlet', 'litten', 'popplio'],
    badges: [101, 102, 103, 104, 105, 106, 107, 108], league: 'alola-league', endless: 'altar-of-the-sunne',
    worldTrack: 'k_coumarine', teamTrack: 'e_petalburg', winTrack: 'e_victory_gym_leader', championTrack: 'e_hall_of_fame',
  },
  galar: {
    id: 'galar', name: 'Galar', professor: 'Professor Magnolia', starters: ['grookey', 'scorbunny', 'sobble'],
    badges: [111, 112, 113, 114, 115, 116, 117, 118], league: 'wyndon-stadium', endless: 'slumbering-weald',
    worldTrack: 'p_route206', teamTrack: 'p_gym', winTrack: 'p_victory', championTrack: 'p_halloffame',
  },
  paldea: {
    id: 'paldea', name: 'Paldea', professor: 'Professor Sada', starters: ['sprigatito', 'fuecoco', 'quaxly'],
    badges: [121, 122, 123, 124, 125, 126, 127, 128], league: 'paldea-league', endless: 'area-zero',
    worldTrack: 'k_santalune', teamTrack: 'k_gym', winTrack: 'k_victory', championTrack: 'halloffame',
  },
};

/** The region before this one, whose League opens it. */
export function previousRegion(id: RegionId): RegionId | null {
  const i = REGION_IDS.indexOf(id);
  return i > 0 ? REGION_IDS[i - 1]! : null;
}
