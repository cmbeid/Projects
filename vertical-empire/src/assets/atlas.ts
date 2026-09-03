/**
 * The one shape the renderer draws from, whichever way the art arrived.
 */

import type { IndexedImage } from './dib.js';
import type { ExtractedSprite } from './slice.js';
import type { Palette } from './palette.js';

export interface Atlas {
  /**
   * `original` means the player supplied their own copy of the game and we are
   * drawing its actual bitmaps. `fallback` is the art in `fallback.ts`, which
   * is ours and ships with the site.
   */
  source: 'original' | 'fallback';
  palette: Palette;
  /** Day/night tables, in order, crossfaded by the clock. */
  skyPalettes: Palette[];
  sprites: Map<string, ExtractedSprite>;
}

/** Picks a frame, wrapping rather than falling off the end of a short sheet. */
export function frameAt(sprite: ExtractedSprite, index: number): IndexedImage | undefined {
  const count = sprite.frames.length;
  if (count === 0) return undefined;
  return sprite.frames[((index % count) + count) % count];
}

/** The sprite and one of its frames, or nothing if the atlas lacks the key. */
export function lookup(
  atlas: Atlas,
  key: string,
  frame = 0,
): { sprite: ExtractedSprite; image: IndexedImage } | undefined {
  const sprite = atlas.sprites.get(key);
  if (!sprite) return undefined;
  const image = frameAt(sprite, frame);
  return image ? { sprite, image } : undefined;
}
