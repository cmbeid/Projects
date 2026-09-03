/**
 * What SimTower's resources actually contain, and how to cut them up.
 *
 * The IDs below come from the format documentation the OpenSkyscraper project
 * published (read as documentation only — none of its GPL code is used here).
 * Treat the table as a strong starting point rather than gospel: it has been
 * written against the documented layout, and `npm run extract` dumps a full
 * inventory precisely so it can be checked against a real copy of the game and
 * corrected where it is wrong.
 *
 * Two conventions run through every sheet:
 *   - an item's *states* (lit/dark, awake/asleep, clean/dirty) lie horizontally
 *   - an item's *variants* (which shop, which restaurant) lie vertically
 */

import { crop, decodeDIB, readCellStrip, type IndexedImage } from './dib.js';
import { decodePalette, type Palette } from './palette.js';
import { hex, type ResourceTable } from './ne.js';

/** Resource type IDs, as stored — the high bit marks an integer type. */
export const TYPE_BITMAP = 0x8002;
export const TYPE_CELLS = 0xff02;
export const TYPE_PALETTE = 0xff03;
export const TYPE_SOUND = 0xff0a;

/** The palette the cell resources are drawn against. */
export const MAIN_PALETTE_ID = 0x83e8;

/** The grid SimTower is built on. Every sprite dimension is a multiple of these. */
export const SEGMENT_WIDTH = 8;
export const FLOOR_HEIGHT = 36;

export interface SpriteSpec {
  /** Name the renderer asks for. */
  key: string;
  type: number;
  /** Resource IDs to try, in order; the first that decodes wins. */
  ids: readonly number[];
  /** `cells` for headerless 8x36 strips, `dib` for real bitmaps. */
  mode: 'dib' | 'cells';
  /** Cut the decoded sheet into this many equal columns (states). */
  states?: number;
  /** Cut the decoded sheet into this many equal rows (variants). */
  variants?: number;
  /** Palette index to treat as see-through when drawn over other art. */
  transparent?: number;
}

function range(from: number, to: number): number[] {
  const ids: number[] = [];
  for (let id = from; id <= to; id += 1) ids.push(id);
  return ids;
}

/**
 * The sprites the spike renders. Deliberately not the whole game: this is the
 * set needed to judge whether a tower reads as a tower on a phone.
 */
export const CATALOGUE: readonly SpriteSpec[] = [
  // The sky is the single biggest contributor to the feel — it is what the
  // day/night palette cycle acts on, and it is most of the screen.
  { key: 'sky', type: TYPE_BITMAP, ids: range(0x8351, 0x835a), mode: 'dib' },

  // Lobby, and the sky lobbies that break the tower into fifteen-floor bands.
  { key: 'lobby', type: TYPE_CELLS, ids: range(0x89e8, 0x89ec), mode: 'cells' },

  // Occupancy states run across: vacant, then progressively tenanted.
  { key: 'office', type: TYPE_BITMAP, ids: range(0x85a8, 0x85ab), mode: 'dib', states: 4 },
  { key: 'condo', type: TYPE_BITMAP, ids: range(0x8628, 0x862a), mode: 'dib', states: 5 },
  { key: 'hotel', type: TYPE_BITMAP, ids: range(0x84a8, 0x84b0), mode: 'dib', states: 6 },

  // Cars and the shafts they run in. Express cars are half again as wide.
  { key: 'elevator', type: TYPE_BITMAP, ids: range(0x8428, 0x842c), mode: 'dib', states: 5, transparent: 0 },
  { key: 'stairs', type: TYPE_CELLS, ids: range(0x8968, 0x896c), mode: 'cells' },
  { key: 'escalator', type: TYPE_CELLS, ids: range(0x8aa8, 0x8aac), mode: 'cells' },

  // One tiny sprite in five tints. Mood is colour, which is why the people
  // turning red as the lifts back up is legible at four pixels tall.
  { key: 'people', type: TYPE_BITMAP, ids: [0x82bc], mode: 'dib', variants: 5, transparent: 0 },
];

export interface ExtractedSprite {
  key: string;
  /** One entry per state; each entry one per variant. */
  frames: IndexedImage[];
  transparent?: number;
}

export interface Extraction {
  palette: Palette;
  sprites: Map<string, ExtractedSprite>;
  /** Specs that produced nothing, with the reason. For the CLI to report. */
  problems: { key: string; reason: string }[];
}

/** Decodes one resource according to its spec, before any state/variant cutting. */
function decodeSheet(spec: SpriteSpec, data: Uint8Array): IndexedImage {
  return spec.mode === 'cells'
    ? readCellStrip(data, SEGMENT_WIDTH, FLOOR_HEIGHT)
    : decodeDIB(data);
}

/** Cuts a decoded sheet into its states and variants. */
function cutFrames(spec: SpriteSpec, sheet: IndexedImage): IndexedImage[] {
  const states = Math.max(1, spec.states ?? 1);
  const variants = Math.max(1, spec.variants ?? 1);
  if (states === 1 && variants === 1) return [sheet];

  const frameWidth = Math.floor(sheet.width / states);
  const frameHeight = Math.floor(sheet.height / variants);
  if (frameWidth <= 0 || frameHeight <= 0) return [sheet];

  const frames: IndexedImage[] = [];
  for (let variant = 0; variant < variants; variant += 1) {
    for (let state = 0; state < states; state += 1) {
      frames.push(crop(sheet, state * frameWidth, variant * frameHeight, frameWidth, frameHeight));
    }
  }
  return frames;
}

/**
 * Pulls the catalogue out of an already-parsed resource table.
 *
 * A spec that fails is recorded and skipped rather than thrown: a copy of the
 * game whose IDs differ slightly should still produce a mostly-drawable tower,
 * and the CLI can then say exactly which entries need correcting.
 */
export function extract(resources: ResourceTable): Extraction {
  const paletteResource = resources.get(TYPE_PALETTE)?.get(MAIN_PALETTE_ID);
  const palette = paletteResource
    ? decodePalette(paletteResource)
    : // Fall back to any palette at all before giving up on colour entirely.
      decodePalette(firstValue(resources.get(TYPE_PALETTE)) ?? new Uint8Array(0));

  const sprites = new Map<string, ExtractedSprite>();
  const problems: { key: string; reason: string }[] = [];

  for (const spec of CATALOGUE) {
    const byId = resources.get(spec.type);
    if (!byId) {
      problems.push({ key: spec.key, reason: `no resources of type ${hex(spec.type)}` });
      continue;
    }

    const frames: IndexedImage[] = [];
    const failures: string[] = [];
    for (const id of spec.ids) {
      const data = byId.get(id);
      if (!data) continue;
      try {
        frames.push(...cutFrames(spec, decodeSheet(spec, data)));
      } catch (error) {
        failures.push(`${hex(id)}: ${(error as Error).message}`);
      }
    }

    if (frames.length === 0) {
      problems.push({
        key: spec.key,
        reason: failures.length > 0 ? failures.join('; ') : `none of ${spec.ids.map(hex).join(', ')} present`,
      });
      continue;
    }

    const sprite: ExtractedSprite = { key: spec.key, frames };
    if (spec.transparent !== undefined) sprite.transparent = spec.transparent;
    sprites.set(spec.key, sprite);
  }

  return { palette, sprites, problems };
}

function firstValue<K, V>(map: Map<K, V> | undefined): V | undefined {
  if (!map) return undefined;
  for (const value of map.values()) return value;
  return undefined;
}
