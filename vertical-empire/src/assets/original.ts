/**
 * Builds an atlas from a copy of the game the player supplied.
 *
 * The bytes are read on the player's own device and never leave it. What comes
 * back is the same `Atlas` the fallback art produces, so nothing downstream
 * knows or cares which one it is drawing.
 */

import type { Atlas } from './atlas.js';
import type { IndexedImage } from './dib.js';
import { readResources } from './ne.js';
import {
  PALETTE_ENTRIES,
  clonePalette,
  darkestIndex,
  mixPalettes,
  nearestIndex,
  type Palette,
} from './palette.js';
import { ROOM_HEIGHT, SEGMENT_WIDTH, extract, type ExtractedSprite, type Extraction } from './slice.js';

export interface OriginalAtlas {
  atlas: Atlas;
  /** Catalogue entries that produced nothing, for the UI to report honestly. */
  problems: Extraction['problems'];
}

export function buildOriginalAtlas(bytes: Uint8Array): OriginalAtlas {
  const extraction = extract(readResources(bytes));
  // The one piece of the tower with no art behind it. Guarded rather than
  // assigned outright, so the day a lobby bitmap is identified the catalogue
  // simply wins and this stops being reached.
  if (!extraction.sprites.has('lobby')) {
    extraction.sprites.set('lobby', drawnLobby(extraction.palette));
  }
  return {
    atlas: {
      source: 'original',
      palette: extraction.palette,
      skyPalettes: skyPalettes(extraction),
      // The game's palette is fully populated, so its darkest entry really is
      // the near-black the shafts are drawn in.
      shaftInk: darkestIndex(extraction.palette),
      sprites: extraction.sprites,
      sounds: extraction.sounds,
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

/**
 * A lobby, drawn rather than extracted, because there is nothing to extract.
 *
 * Every cell strip in the file has been identified and none is a lobby; so have
 * the widest room-height bitmaps. Rather than keep spending round trips on it,
 * the ground floor gets a band of our own: a marble wall, a trim line at the
 * ceiling, a skirting shadow and a floor tone under it. One segment wide, drawn
 * per segment like the real thing, so a frontage of any length is continuous.
 *
 * The colours are *sampled from the game's palette* rather than chosen. We
 * cannot add entries to an indexed table we did not author, and taking the
 * nearest match to each intent keeps this inside the original's own range and
 * keeps it cycling with the day/night tables. It stays visibly ours — a plain
 * band where SimTower has a decorated concourse — which is the honest way for
 * a placeholder to look.
 */
function drawnLobby(palette: Palette): ExtractedSprite {
  const shadow = darkestIndex(palette);
  const marble = nearestIndex(palette, 0xd8, 0xd4, 0xc8, [shadow]);
  const trim = nearestIndex(palette, 0x8a, 0x82, 0x70, [shadow, marble]);
  const floor = nearestIndex(palette, 0xa8, 0xa4, 0x9c, [shadow, marble, trim]);

  const image: IndexedImage = {
    width: SEGMENT_WIDTH,
    height: ROOM_HEIGHT,
    pixels: new Uint8Array(SEGMENT_WIDTH * ROOM_HEIGHT).fill(marble),
  };
  const band = (top: number, height: number, ink: number): void => {
    image.pixels.fill(ink, top * SEGMENT_WIDTH, (top + height) * SEGMENT_WIDTH);
  };

  band(0, 2, trim);
  band(ROOM_HEIGHT - 4, 1, shadow);
  // The last row is the one the scene repeats down into the slab, so it has to
  // be the floor rather than the skirting — otherwise every lobby stands on a
  // twelve-pixel stripe of its own shadow.
  band(ROOM_HEIGHT - 3, 3, floor);

  return { key: 'lobby', frames: [image] };
}
