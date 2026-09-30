/**
 * The Pokémon that live on the farm. Phase 1 has the three Kanto starters
 * and their evolutions (the evolutions are fetched now so later phases can
 * level them up without another asset run).
 */
import type { PokeType } from './types';

/** What a helper does around the farm. */
export type Job = 'water' | 'tend' | 'guard';

export interface Species {
  dex: number;
  name: string;
  types: readonly PokeType[];
  job: Job;
}

function s(dex: number, name: string, types: readonly PokeType[], job: Job): Species {
  return { dex, name, types, job };
}

const LIST: readonly Species[] = [
  s(1, 'Bulbasaur', ['grass', 'poison'], 'tend'),
  s(2, 'Ivysaur', ['grass', 'poison'], 'tend'),
  s(3, 'Venusaur', ['grass', 'poison'], 'tend'),
  s(4, 'Charmander', ['fire'], 'guard'),
  s(5, 'Charmeleon', ['fire'], 'guard'),
  s(6, 'Charizard', ['fire', 'flying'], 'guard'),
  s(7, 'Squirtle', ['water'], 'water'),
  s(8, 'Wartortle', ['water'], 'water'),
  s(9, 'Blastoise', ['water'], 'water'),
];

export const SPECIES: ReadonlyMap<number, Species> = new Map(LIST.map((sp) => [sp.dex, sp]));

/** The three you can pick from on a new farm. */
export const STARTERS: readonly number[] = [1, 4, 7];

export function species(dex: number): Species {
  const sp = SPECIES.get(dex);
  if (!sp) throw new Error(`unknown Pokémon #${dex}`);
  return sp;
}

export const JOB_TEXT: Record<Job, string> = {
  water: 'Waters a thirsty crop every half hour.',
  tend: 'Tends a crop every half hour so it grows 50% faster.',
  guard: 'Keeps crows away from your field at night.',
};

export function spriteUrl(dex: number, shiny = false): string {
  return shiny ? `sprites/${dex}-shiny.png` : `sprites/${dex}.png`;
}

export function sheetUrl(dex: number, shiny = false): string {
  return shiny ? `sprites/${dex}-shiny.json` : `sprites/${dex}.json`;
}

export function cryUrl(dex: number): string {
  return `cries/${dex}.wav`;
}
