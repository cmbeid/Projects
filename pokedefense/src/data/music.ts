/**
 * Which music plays where. `scripts/fetch-music.ts` converts every track into
 * public/music/<id>.json, all in the same note-list format, so one Game Boy
 * synth plays the lot:
 *
 * - Kanto and Johto: Pokémon Crystal's own music, from the pret/pokecrystal
 *   disassembly, played the way the Game Boy's sound engine plays it.
 * - Hoenn: Pokémon Emerald's music is GBA sampled audio, so there is no Game
 *   Boy original. pret/pokeemerald keeps each song as MIDI, which
 *   `scripts/music/midi.ts` arranges for the same four channels — a chiptune
 *   cover of the real tune.
 */

/** pokecrystal file names under audio/music/. */
const CRYSTAL = [
  // Kanto
  'titlescreen', 'route1', 'pokemoncenter', 'gym', 'route2', 'mtmoon', 'ssaqua', 'celadoncity', 'lavendertown',
  'rockethideout', 'route3', 'viridiancity', 'victoryroad', 'darkcave', 'kantogymbattle', 'rocketbattle',
  'championbattle', 'suicunebattle', 'gymleadervictory', 'halloffame',
  // Johto
  'newbarktown', 'violetcity', 'sprouttower', 'azaleatown', 'goldenrodcity', 'burnedtower', 'route37', 'lighthouse',
  'lakeofrage', 'dragonsden', 'indigoplateau', 'tintower', 'johtogymbattle', 'johtotrainerbattle',
] as const;

/** pokeemerald MIDI names under sound/songs/midi/, as `e_` + the name without `mus_`. */
const EMERALD = [
  'e_littleroot', 'e_rustboro', 'e_petalburg_woods', 'e_cave_of_origin', 'e_route110', 'e_mt_chimney', 'e_petalburg',
  'e_route119', 'e_lilycove', 'e_sootopolis', 'e_victory_road', 'e_abnormal_weather', 'e_vs_gym_leader',
  'e_vs_elite_four', 'e_vs_champion', 'e_vs_rayquaza', 'e_victory_gym_leader', 'e_hall_of_fame',
] as const;

export const TRACKS = [...CRYSTAL, ...EMERALD] as const;
export type TrackId = (typeof TRACKS)[number];

export type TrackSource = { from: 'crystal'; file: string } | { from: 'emerald'; file: string };

export function trackSource(id: TrackId): TrackSource {
  return id.startsWith('e_') ? { from: 'emerald', file: `mus_${id.slice(2)}` } : { from: 'crystal', file: id };
}

export const TITLE_TRACK: TrackId = 'titlescreen';
export const MART_TRACK: TrackId = 'pokemoncenter';

export function musicUrl(id: TrackId): string {
  return `music/${id}.json`;
}
