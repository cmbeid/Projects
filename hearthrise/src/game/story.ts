import { DISTRICT_TEXT } from '../data/flags';
import type { District, SongParams } from '../data/types';
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

/** The district's tune, shifted by what the player has done and learned. */
export function musicFor(s: GameState, d: District): SongParams {
  const p: SongParams = { ...d.music };
  if (d.id === 'spire') {
    // Rung, the Spire's hymn gets a beat and a brighter voice; locked, it slows to a lullaby.
    if (hasFlag(s, 'rang')) Object.assign(p, { bpm: 92, drums: 'waltz', duty: 0.25 });
    else if (hasFlag(s, 'hushed')) p.bpm = 60;
  }
  // Once you know what is under the city, the Undercroft is less muffled.
  if (d.id === 'undercroft' && hasFlag(s, 'above')) p.muffle = 0.4;
  // After the treaty, the Far Shore's polka swaps its oom-pah for a running arpeggio.
  if (d.id === 'shore' && hasFlag(s, 'treaty')) Object.assign(p, { arp: 'up', arpRate: 2 });
  return p;
}

/** A key that changes whenever `musicFor` would. */
export function musicKey(s: GameState, d: District): string {
  return `${d.id}:${['rang', 'hushed', 'above', 'treaty'].filter((f) => hasFlag(s, f)).join(',')}`;
}
