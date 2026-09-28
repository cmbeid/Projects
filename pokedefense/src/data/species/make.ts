/** The helper the species tables are written with. */
import type { Species } from '../species';
import type { PokeType } from '../types';

export type Extra = Partial<Omit<Species, 'dex' | 'name' | 'types' | 'hp' | 'speed' | 'catchRate'>>;

export function s(dex: number, name: string, types: PokeType[], hp: number, speed: number, catchRate: number, extra: Extra = {}): Species {
  return {
    dex, name, types, hp, speed, catchRate,
    armor: 0, bounty: Math.max(1, Math.round(hp * 3)), traits: [], abilities: [], regen: 0,
    split: null, evolve: null, explode: null,
    ...extra,
  };
}

export const FLY: Extra = { traits: ['flying'] };

