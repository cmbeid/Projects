/**
 * What SimTower's resources actually contain, and how to cut them up.
 *
 * Corrected against a real copy: the IDs below were checked against the shape
 * listing `npm run extract` prints, and the arithmetic is what identifies them.
 * A condo bitmap is 128 wide, which is sixteen segments; a hotel suite is 640
 * wide, which is eight states of ten segments; a lift car is 32x36, exactly as
 * documented. Where a size divides cleanly into a documented facility width,
 * that is not a coincidence and the entry is sound.
 *
 * Two conventions run through every sheet:
 *   - an item's *states* (lit/dark, awake/asleep, clean/dirty) lie horizontally
 *   - an item's *variants* (which shop, which restaurant) lie vertically
 *
 * Entries still marked UNVERIFIED are ones whose size is consistent with the
 * guess but does not pin it down. Check those with the ID-named PNGs that
 * `npm run extract -- --all` writes.
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

/**
 * How tall a room's facade is.
 *
 * A floor is 36 pixels but the art for what sits on it — offices, condos,
 * hotel rooms — is only 24. The missing twelve are the floor slab and the
 * ceiling below, which the game draws as structure rather than as part of the
 * tenant. This is the one thing the catalogue got wrong in a way that mattered:
 * everything was assumed to be a full floor tall.
 */
export const ROOM_HEIGHT = 24;

export interface SpriteSpec {
  /** Name the renderer asks for. */
  key: string;
  type: number;
  /** Resource IDs to try, in order; the first that decodes wins. */
  ids: readonly number[];
  /** `cells` for headerless strips of 8px-wide cells, `dib` for real bitmaps. */
  mode: 'dib' | 'cells';
  /** Cell height for `cells` mode. Inferred from the resource length if absent. */
  cellHeight?: number;
  /** Cut the decoded sheet into this many equal columns (states). */
  states?: number;
  /** Cut the decoded sheet into this many equal rows (variants). */
  variants?: number;
  /**
   * Palette index to treat as see-through when drawn over other art.
   *
   * `'corner'` reads it from the sprite's own top-left pixel, which is the
   * usual convention and beats guessing: assuming index 0 gave the people
   * solid rectangular backgrounds.
   */
  transparent?: number | 'corner';
  /**
   * Cut a cell strip into one frame per 8px cell rather than handing back the
   * whole strip. A lobby resource is 140 cells wide; drawn whole at each
   * one-segment placement it smears across the entire ground floor.
   */
  cellFrames?: boolean;
}

function range(from: number, to: number): number[] {
  const ids: number[] = [];
  for (let id = from; id <= to; id += 1) ids.push(id);
  return ids;
}

/**
 * The sprites the spike renders. Deliberately not the whole game: this is the
 * set needed to judge whether a tower reads as a tower on a phone.
 *
 * Widths in the comments are what each cut frame comes out as, which is what
 * `world/facilities.ts` has to agree with.
 */
export const CATALOGUE: readonly SpriteSpec[] = [
  // Eleven of them, one per band of the day, each 32x360 — four segments wide
  // and ten floors tall. Tiled, so the size only has to be a multiple of the
  // grid, which it is.
  { key: 'sky', type: TYPE_BITMAP, ids: range(0x8351, 0x835b), mode: 'dib' },

  // Lobby, in three variants: ground, sky lobby, and the high one. Cells are 32
  // tall rather than a full floor — see `ROOM_HEIGHT`.
  { key: 'lobby', type: TYPE_CELLS, ids: range(0x89e8, 0x89ea), mode: 'cells', cellHeight: 32, cellFrames: true },

  // 288x24 = four states of nine segments. Occupancy runs across: empty, then
  // progressively tenanted.
  { key: 'office', type: TYPE_BITMAP, ids: range(0x85a8, 0x85aa), mode: 'dib', states: 4 },

  // Fifteen separate 128x24 bitmaps — five states across three variants, which
  // is exactly what the documentation describes, stored one per resource
  // rather than as a sheet.
  { key: 'condo', type: TYPE_BITMAP, ids: range(0x8628, 0x8636), mode: 'dib' },

  // Hotel rooms come as a base bitmap plus a sheet of eight states beside it:
  // 32/256 for singles, 48/384 for doubles, 80/640 for suites. The sheets are
  // the useful half. Four segments, six, and ten — the documented widths.
  { key: 'hotel', type: TYPE_BITMAP, ids: [0x84a9, 0x84ab], mode: 'dib', states: 8 },
  { key: 'hotel-double', type: TYPE_BITMAP, ids: [0x84e9, 0x84eb, 0x84ed, 0x84ef], mode: 'dib', states: 8 },
  { key: 'hotel-suite', type: TYPE_BITMAP, ids: [0x8529, 0x852b], mode: 'dib', states: 8 },

  // The lift car: 160x36 cut five ways gives 32x36, the documented car size,
  // and five frames is the door opening. 0x8428 is the same car as a single
  // bitmap; 0x842d is the 48x36 express one.
  { key: 'car', type: TYPE_BITMAP, ids: [0x842a], mode: 'dib', states: 5, transparent: 'corner' },

  // No shaft entry, deliberately. Nothing in the 0x842x block is an empty
  // shaft: 0x8429 and 0x8468 both read as cars carrying passengers, and twenty
  // frames is about a SimTower car's capacity. The original draws the shaft as
  // a flat dark column with floor numbers over it, so `render/scene.ts` paints
  // it rather than looking for a bitmap that does not exist.

  // Both of these were in the catalogue at the right IDs but as cell strips.
  // They are ordinary bitmaps, which is why they came back "not found".
  // UNVERIFIED: the eight-segment width is inferred from the state count
  // dividing cleanly, not from the documentation.
  { key: 'stairs', type: TYPE_BITMAP, ids: [0x8968, 0x8969], mode: 'dib', states: 7 },
  { key: 'escalator', type: TYPE_BITMAP, ids: [0x8aa8, 0x8ae8], mode: 'dib', states: 8 },

  // UNVERIFIED, and the least certain entry here. 96x24 is not an obvious shape
  // for the four-pixel people the game draws, and the same ID exists under
  // resource type 0xFF06 as well. Twelve eight-wide frames is a guess; check
  // raw-0x8002-0x82bc.png before trusting it.
  { key: 'people', type: TYPE_BITMAP, ids: range(0x82bc, 0x82bf), mode: 'dib', states: 12, transparent: 'corner' },
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
  return spec.mode === 'cells' ? readCellStrip(data, SEGMENT_WIDTH, spec.cellHeight) : decodeDIB(data);
}

/** Cuts a decoded sheet into its states and variants. */
function cutFrames(spec: SpriteSpec, sheet: IndexedImage): IndexedImage[] {
  // A strip is a run of single-segment cells, each its own frame.
  if (spec.cellFrames) {
    const cells = Math.floor(sheet.width / SEGMENT_WIDTH);
    const frames: IndexedImage[] = [];
    for (let cell = 0; cell < cells; cell += 1) {
      frames.push(crop(sheet, cell * SEGMENT_WIDTH, 0, SEGMENT_WIDTH, sheet.height));
    }
    return frames.length > 0 ? frames : [sheet];
  }

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
    const transparent = resolveTransparent(spec, frames);
    if (transparent !== undefined) sprite.transparent = transparent;
    sprites.set(spec.key, sprite);
  }

  return { palette, sprites, problems };
}

/** Turns `'corner'` into the actual index the sprite uses for see-through. */
function resolveTransparent(spec: SpriteSpec, frames: IndexedImage[]): number | undefined {
  if (spec.transparent === undefined) return undefined;
  if (spec.transparent !== 'corner') return spec.transparent;
  return frames[0]?.pixels[0];
}

function firstValue<K, V>(map: Map<K, V> | undefined): V | undefined {
  if (!map) return undefined;
  for (const value of map.values()) return value;
  return undefined;
}
