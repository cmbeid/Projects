/**
 * Which music plays where: Pokémon Crystal's own songs, converted from the
 * pret/pokecrystal disassembly by `scripts/fetch-music.ts` into note lists
 * that `src/audio/music.ts` plays on a Game Boy-style synth (both adapted
 * from PokéDefense).
 */
import type { Season } from '../game/time';

export const TRACKS = [
  'titlescreen', 'newbarktown', 'cherrygrovecity', 'ecruteakcity', 'lakeofrage', 'pokemonlullaby',
  'route29', 'route37', 'johtowildbattle', 'wildpokemonvictory',
] as const;
export type TrackId = (typeof TRACKS)[number];

export const TITLE_TRACK: TrackId = 'titlescreen';

/** The farm's tune for each season, by day. */
export const FARM_TRACKS: Record<Season, TrackId> = {
  Spring: 'newbarktown',
  Summer: 'cherrygrovecity',
  Autumn: 'ecruteakcity',
  Winter: 'lakeofrage',
};
export const FARM_NIGHT: TrackId = 'pokemonlullaby';
export const ROUTE_DAY: TrackId = 'route29';
export const ROUTE_NIGHT: TrackId = 'route37';
export const BATTLE: TrackId = 'johtowildbattle';
export const VICTORY: TrackId = 'wildpokemonvictory';

export function musicUrl(id: TrackId): string {
  return `music/${id}.json`;
}
