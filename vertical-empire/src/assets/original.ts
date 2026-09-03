/**
 * Builds an atlas from a copy of the game the player supplied.
 *
 * The bytes are read on the player's own device and never leave it. What comes
 * back is the same `Atlas` the fallback art produces, so nothing downstream
 * knows or cares which one it is drawing.
 */

import type { Atlas } from './atlas.js';
import { readResources } from './ne.js';
import { PALETTE_ENTRIES, clonePalette, darkestIndex, mixPalettes, type Palette } from './palette.js';
import { extract, type Extraction } from './slice.js';

export interface OriginalAtlas {
  atlas: Atlas;
  /** Catalogue entries that produced nothing, for the UI to report honestly. */
  problems: Extraction['problems'];
}

export function buildOriginalAtlas(bytes: Uint8Array): OriginalAtlas {
  const extraction = extract(readResources(bytes));
  return {
    atlas: {
      source: 'original',
      palette: extraction.palette,
      skyPalettes: skyPalettes(extraction),
      // The game's palette is fully populated, so its darkest entry really is
      // the near-black the shafts are drawn in.
      shaftInk: darkestIndex(extraction.palette),
      sprites: extraction.sprites,
    },
    problems: extraction.problems,
  };
}

/**
 * The day/night tables.
 *
 * SimTower ships one sky bitmap per band of the day, each carrying its own
 * colour table, so the honest source for "what colour is everything at 4am" is
 * the sky bitmaps themselves. Where they did not decode we fall back to
 * dimming the main table, which is cruder but keeps the cycle running.
 */
function skyPalettes(extraction: Extraction): Palette[] {
  const fromSky = (extraction.sprites.get('sky')?.frames ?? [])
    .map((frame) => frame.palette)
    .filter((palette): palette is Palette => palette !== undefined);

  if (fromSky.length >= 2) return fromSky;

  const day = clonePalette(extraction.palette);
  const night = clonePalette(day);
  for (let i = 0; i < PALETTE_ENTRIES; i += 1) {
    for (let c = 0; c < 3; c += 1) {
      const at = i * 4 + c;
      night[at] = Math.round((night[at] ?? 0) * 0.4 + 10);
    }
  }

  // Midnight first, matching how the clock indexes the ring.
  const steps = 11;
  const palettes: Palette[] = [];
  for (let i = 0; i < steps; i += 1) {
    const phase = i / steps;
    palettes.push(mixPalettes(day, night, Math.abs(1 - phase * 2)));
  }
  return palettes;
}
