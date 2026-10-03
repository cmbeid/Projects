import { BIOME_TEXT } from '../data/flags';
import type { Biome, MusicParams } from '../data/types';
import type { GameState } from '../state/types';

/** A biome's name and blurb as the player now knows it. */
export function biomeText(s: GameState, b: Biome): { name: string; blurb: string } {
  let name = b.name;
  let blurb = b.blurb;
  for (const t of BIOME_TEXT) {
    if (t.biome !== b.id || !s.flags.includes(t.flag)) continue;
    name = t.name ?? name;
    blurb = t.blurb ?? blurb;
  }
  return { name, blurb };
}

export function hasFlag(s: GameState, flag: string): boolean {
  return s.flags.includes(flag);
}

/** The biome's score, shifted by what the player has done and learned. */
export function musicFor(s: GameState, b: Biome): MusicParams {
  const p: MusicParams = { ...b.music };
  if (hasFlag(s, 'synced')) p.heartbeat = true;
  if (hasFlag(s, 'lullaby')) p.unease *= 0.5;
  if (hasFlag(s, 'woken')) {
    p.filter *= 1.4;
    p.unease *= 0.7;
  }
  return p;
}

/** A key that changes whenever `musicFor` would. */
export function musicKey(s: GameState, b: Biome): string {
  return `${b.id}:${['synced', 'lullaby', 'woken'].filter((f) => hasFlag(s, f)).join(',')}`;
}

/** Eyes in the dark: in The Hollow always; everywhere once something knows your name. */
export function eyesEverywhere(s: GameState): boolean {
  return hasFlag(s, 'woken') || s.bargains.includes('name');
}
