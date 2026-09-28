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
 * - Sinnoh: Pokémon Platinum's sequences, which pret/pokeplatinum keeps as
 *   MIDI with the DS sequencer's loops and calls written in as markers;
 *   arranged the same way.
 * - Unova: Pokémon Black and White's sequences, read from the game's own
 *   sound archive (a `.sdat` you supply: `npm run fetch-music -- --sdat
 *   <file>`). Until a track is converted it plays a stand-in (below).
 * - Kalos: X and Y's music is streamed audio with no notes to arrange, so
 *   Kalos has original tunes written for this game (`scripts/music/kalos.ts`).
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

/** pokeplatinum sequence names under res/sound/SEQ/, by track id. */
const PLATINUM = {
  p_twinleaf: 'SEQ_TOWN01_D', p_gym: 'SEQ_GYM', p_oreburgh_mine: 'SEQ_D_04', p_eterna_forest: 'SEQ_D_02',
  p_veilstone: 'SEQ_CITY07_D', p_great_marsh: 'SEQ_D_SAFARI', p_hearthome: 'SEQ_CITY05_D', p_canalave: 'SEQ_CITY02_D',
  p_snowpoint: 'SEQ_CITY09_D', p_sunyshore: 'SEQ_CITY08_D', p_league: 'SEQ_D_LEAGUE', p_spear_pillar: 'SEQ_D_MOUNT2',
  p_gymbattle: 'BATTLE_GYM_LEADER', p_elitefour: 'BATTLE_ELITE_FOUR', p_champion: 'BATTLE_CHAMPION',
  p_giratina: 'BATTLE_GIRATINA', p_victory: 'VICTORY_GYM_LEADER', p_halloffame: 'SEQ_BLD_DENDO',
  p_jubilife: 'SEQ_CITY01_D', p_route206: 'SEQ_ROAD_D_D',
} as const;

/**
 * Black and White tracks, each with the Platinum track it plays until it has
 * been converted from the game's sound archive.
 */
const UNOVA = {
  u_nuvema: 'p_twinleaf', u_gym: 'p_gym', u_striaton: 'p_jubilife', u_nacrene: 'p_canalave',
  u_pinwheel: 'p_eterna_forest', u_nimbasa: 'p_veilstone', u_driftveil: 'p_sunyshore', u_mistralton: 'p_route206',
  u_twist_mountain: 'p_snowpoint', u_opelucid: 'p_hearthome', u_league: 'p_league', u_giant_chasm: 'p_spear_pillar',
  u_gymbattle: 'p_gymbattle', u_elitefour: 'p_elitefour', u_champion: 'p_champion', u_kyurem: 'p_giratina',
  u_victory: 'p_victory',
} as const satisfies Record<string, keyof typeof PLATINUM>;

/**
 * The sound archive's name for each converted Unova track. A track listed
 * here plays its own file; the rest play their stand-in.
 */
const UNOVA_SEQ: Partial<Record<keyof typeof UNOVA, string>> = {};

/** Original Kalos tunes, compiled from `scripts/music/kalos.ts`. */
const KALOS = [
  'k_vaniville', 'k_santalune', 'k_cave', 'k_shalour', 'k_coumarine', 'k_lumiose', 'k_laverre', 'k_anistar',
  'k_snowbelle', 'k_league', 'k_gym', 'k_gymbattle', 'k_champion', 'k_legend', 'k_victory',
] as const;

export const TRACKS = [
  ...CRYSTAL, ...EMERALD,
  ...(Object.keys(PLATINUM) as (keyof typeof PLATINUM)[]),
  ...(Object.keys(UNOVA) as (keyof typeof UNOVA)[]),
  ...KALOS,
] as const;
export type TrackId = (typeof TRACKS)[number];

export type TrackSource =
  | { from: 'crystal' | 'emerald' | 'platinum' | 'score'; file: string }
  | { from: 'sdat'; file: string | null; standIn: TrackId };

export function trackSource(id: TrackId): TrackSource {
  if (id.startsWith('e_')) return { from: 'emerald', file: `mus_${id.slice(2)}` };
  if (id.startsWith('p_')) return { from: 'platinum', file: PLATINUM[id as keyof typeof PLATINUM] };
  if (id.startsWith('u_')) {
    const key = id as keyof typeof UNOVA;
    return { from: 'sdat', file: UNOVA_SEQ[key] ?? null, standIn: UNOVA[key] };
  }
  if (id.startsWith('k_')) return { from: 'score', file: id };
  return { from: 'crystal', file: id };
}

/** The file a track plays from: its own, or its stand-in until it has been converted. */
export function trackFile(id: TrackId): TrackId {
  const source = trackSource(id);
  return source.from === 'sdat' && !source.file ? source.standIn : id;
}

export const TITLE_TRACK: TrackId = 'titlescreen';
export const MART_TRACK: TrackId = 'pokemoncenter';

export function musicUrl(id: TrackId): string {
  return `music/${trackFile(id)}.json`;
}
