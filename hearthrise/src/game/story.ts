import { DISTRICT_TEXT } from '../data/flags';
import type { District, MusicParams } from '../data/types';
import type { GameState } from '../state/types';

/** A district's name and blurb as the player now knows it. */
export function districtText(s: GameState, d: District): { name: string; blurb: string } {
  let name = d.name;
  let blurb = d.blurb;
  for (const t of DISTRICT_TEXT) {
    if (t.district !== d.id || !s.flags.includes(t.flag)) continue;
    name = t.name ?? name;
    blurb = t.blurb ?? blurb;
  }
  return { name, blurb };
}

export function hasFlag(s: GameState, flag: string): boolean {
  return s.flags.includes(flag);
}

/** The district's score, shifted by what the player has done and learned. */
export function musicFor(s: GameState, d: District): MusicParams {
  const p: MusicParams = { ...d.music };
  if (hasFlag(s, 'heard') && d.id !== 'landing') p.unease += 0.04;
  if (hasFlag(s, 'hushed')) p.unease *= 0.5;
  if (hasFlag(s, 'rang')) {
    p.filter *= 1.4;
    p.unease *= 0.4;
    // The Spire sings in its own key now, a fifth above the old drone.
    if (d.id === 'spire') p.droneInterval = 7;
  }
  return p;
}

/** A key that changes whenever `musicFor` would. */
export function musicKey(s: GameState, d: District): string {
  return `${d.id}:${['heard', 'hushed', 'rang'].filter((f) => hasFlag(s, f)).join(',')}`;
}
