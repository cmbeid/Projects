/**
 * Which music plays where. Track ids are pokecrystal's file names under
 * audio/music/ — Crystal's arrangements of the Kanto themes — converted by
 * `scripts/fetch-music.ts` into public/music/.
 */
export const TRACKS = [
  'titlescreen',
  'route1',
  'pokemoncenter',
  'gym',
  'route2',
  'mtmoon',
  'ssaqua',
  'celadoncity',
  'lavendertown',
  'rockethideout',
  'route3',
  'viridiancity',
  'victoryroad',
  'darkcave',
  'kantogymbattle',
  'rocketbattle',
  'championbattle',
  'suicunebattle',
  'gymleadervictory',
  'halloffame',
] as const;

export type TrackId = (typeof TRACKS)[number];

export const TITLE_TRACK: TrackId = 'titlescreen';
export const WORLD_TRACK: TrackId = 'route1';
export const MART_TRACK: TrackId = 'pokemoncenter';
export const TEAM_TRACK: TrackId = 'gym';
export const WIN_TRACK: TrackId = 'gymleadervictory';
export const CHAMPION_TRACK: TrackId = 'halloffame';

export function musicUrl(id: TrackId): string {
  return `music/${id}.json`;
}
