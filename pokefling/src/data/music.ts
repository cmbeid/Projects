/**
 * Which music plays where. Track ids are pokecrystal's file names under
 * audio/music/, converted by `scripts/fetch-music.ts` into public/music/.
 */
export const TRACKS = [
  'titlescreen',
  'route2',
  'mtmoon',
  'lavendertown',
  'rockethideout',
  'sprouttower',
  'unioncave',
  'burnedtower',
  'surf',
  'rocketbattle',
  'victoryroad',
  'championbattle',
  'wildpokemonvictory',
  'trainervictory',
] as const;

export type TrackId = (typeof TRACKS)[number];

/** The title screen and level select. */
export const MENU_TRACK: TrackId = 'titlescreen';
/** After clearing a level, and after clearing an area's boss. */
export const WIN_TRACK: TrackId = 'wildpokemonvictory';
export const BOSS_WIN_TRACK: TrackId = 'trainervictory';

export function musicUrl(id: TrackId): string {
  return `music/${id}.json`;
}
