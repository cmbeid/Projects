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
import { inkColumns } from './frames.js';
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
  /**
   * How to divide the sheet. `grid` (the default) cuts it into equal
   * `states` x `variants` cells; `ink` finds the frames by looking for columns
   * of pure background between them, which is the only thing that works on a
   * sheet whose figures are different widths.
   */
  cut?: 'grid' | 'ink';
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
  // Ten of them, one per band of altitude. Tiled, so the size only has to be a
  // multiple of the grid, which it is.
  //
  // The range used to start at 0x8351, which is not a sky at all: it is brown
  // soil. Reading it as the lowest band painted a stripe of dirt across the
  // horizon. It sits next to the sky in the file because both are background
  // fills, not because both are sky.
  { key: 'sky', type: TYPE_BITMAP, ids: range(0x8352, 0x835b), mode: 'dib' },

  // The earth the tower is sunk into. Keyed `ground` because that is what
  // `render/scene.ts` already tiles below the horizon for the fallback art —
  // so nine basements' worth of backdrop arrives without the renderer changing.
  { key: 'ground', type: TYPE_BITMAP, ids: [0x8351], mode: 'dib' },

  // Not the lobby, as first assumed — this is the city. A hundred and forty
  // 8x32 cells of street-level buildings, brick frontages, trees, a park and a
  // flag: the panorama SimTower draws along the ground on either side of the
  // tower. Mapping it to the lobby is what made the ground floor look like a
  // parade of shopfronts, because that is exactly what it is.
  //
  // One strip, not three. 0x89e9 and 0x89ea are the same size and sit next to
  // it, and taking all three appended their cells to this one's — so the street
  // ran as a coherent panorama for a hundred and forty segments and then became
  // something else entirely, which is visible the moment the lot is wider than
  // one strip. What those other two are has not been established; until it is,
  // they are not drawn.
  { key: 'skyline', type: TYPE_CELLS, ids: [0x89e8], mode: 'cells', cellHeight: 32, cellFrames: true },

  // The lobby is still unidentified, and 0x8fe9 is not it.
  //
  // Catalogued as the lobby and looked at, it draws as a dense crowd in the
  // same four colours as the people sprites — no floor, no walls, just figures.
  // It is a queue sheet. That is exactly what a contact sheet of it could not
  // tell you, because a strip of mostly-plain cells with a figure every dozen
  // looks the same whether the plain part is marble or nothing at all, and one
  // look at it in place settled it in a single round trip.
  //
  // Of the eleven cell strips, nine are backdrop panoramas and 0x8fea is the
  // only candidate left. After that the lobby has to be an ordinary bitmap.
  // Until then the ground floor draws as a plain band, which is honest rather
  // than wrong.

  // The theatre: 768x36, four states of twenty-four segments. Raked seating, a
  // door at one end and a stair at the other, confirmed by eye — which is what
  // settles it, because the measurement alone put this at 34% against a 41%
  // runner-up and that is too close to call on its own.
  { key: 'theatre', type: TYPE_BITMAP, ids: [0x88a8], mode: 'dib', states: 4 },

  // The cinema: 560x36, ten states of seven segments. Red curtains, a screen
  // showing a different film in each state, a door below.
  //
  // Seven segments looks narrow and I doubted it. Eyeballing a scaled contact
  // sheet the unit seemed to be fourteen, so this sat in the held-back pile.
  // A window of exactly 112 pixels settled it by holding two complete units,
  // differing only in what is on the screen — states, not halves of one. The
  // measurement had said 56px at 21.9% from the start. Worth remembering which
  // of the two was wrong.
  { key: 'cinema', type: TYPE_BITMAP, ids: [0x8ca8], mode: 'dib', states: 10 },

  // Still out: 0x8e28, a white lattice that reads as structure, not a room.

  // Three sheets, each 288x24 = four states of nine segments. Occupancy runs
  // across: empty, then progressively tenanted.
  //
  // Not four sheets: 0x85ab looks like office art in a thumbnail and is 144x24,
  // half the width of the other three. Cut into four states it yields frames
  // four and a half segments wide against a facility declared nine, which is
  // the kind of thing a picture cannot tell you and the shape listing can.
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

  // The lift car, confirmed by eye: 160x36 cut five ways gives five 32x36
  // frames, each the car interior holding progressively more passengers —
  // empty, one, three, and so on. Drawn opaque over the shaft: the frame is
  // solid car, and its corner index is a colour used inside the car too, so
  // treating that as see-through would punch holes in it.
  { key: 'car', type: TYPE_BITMAP, ids: [0x842a], mode: 'dib', states: 5 },

  // The shaft, which a previous pass concluded did not exist.
  //
  // It was looked for in the 0x842x block, next to the cars, and is not there —
  // but a sweep of every resource in the file found it at 0x87e8: a near-black
  // column, with 0x87e9 and 0x87ea carrying the floor numbers that run down it
  // and 0x87eb-0x87ed repeating all three in red. So the renderer tiles real
  // art instead of filling a rectangle, which is what made lifts read as holes
  // cut in the tower.
  //
  // The digit sheets are not catalogued yet: how they are cut decides whether a
  // floor number is composed from glyphs or indexed whole, and that has to be
  // measured rather than assumed. Same for the machinery at 0x88e8-0x88ed.
  //
  // 352x36 is eleven frames of four segments, which `--period` puts at 8.2%
  // against 51% for the next reading. It was catalogued with no states and
  // tiled whole, and drew the right thing only because `tile` wraps its source
  // and a lift is exactly one frame wide — the right answer for the wrong
  // reason, which stops being right the moment anything else uses it.
  { key: 'shaft', type: TYPE_BITMAP, ids: [0x87e8], mode: 'dib', states: 11 },

  // Both of these were in the catalogue at the right IDs but as cell strips.
  // They are ordinary bitmaps, which is why they came back "not found".
  // Both confirmed by eye. Stairs: seven 64x24 frames of a tan diagonal flight,
  // some with figures climbing. Escalator: eight 64x36 frames, red handrail,
  // riders on some. Eight segments each, as the arithmetic suggested.
  { key: 'stairs', type: TYPE_BITMAP, ids: [0x8968, 0x8969], mode: 'dib', states: 7, transparent: 'corner' },
  { key: 'escalator', type: TYPE_BITMAP, ids: [0x8aa8, 0x8ae8], mode: 'dib', states: 8, transparent: 'corner' },


  // Everything below came from measuring the sheets rather than reading their
  // widths, because a width does not say how it is cut: 288x24 is four states
  // of nine segments if it is an office and three of twelve if it is a shop.
  //
  // The first three are the strongest evidence in the whole catalogue. Their
  // frame widths were recovered from the pixels — 24, 12 and 16 segments — and
  // those are the original's own documented sizes for a restaurant, a shop and
  // a fast food counter. Nothing told the measurement what to look for and it
  // landed on all three.

  // 384x24, two states of 24 segments: 25.0%, against 86.9% for the next.
  { key: 'restaurant', type: TYPE_BITMAP, ids: range(0x8568, 0x8571), mode: 'dib', states: 2 },

  // 288x24, three states of 12 segments: 20.6%, against 91.0%.
  { key: 'shop', type: TYPE_BITMAP, ids: range(0x8668, 0x8672), mode: 'dib', states: 3 },

  // 256x24, two states of 16 segments: 22.9%, against 87.3%.
  { key: 'fast-food', type: TYPE_BITMAP, ids: range(0x86e8, 0x86f1), mode: 'dib', states: 2 },

  // These two repeat at nothing, which is itself the answer: one frame of the
  // whole sheet. Both are 128x24 — the same shape as a condo, which is sixteen
  // segments and was verified separately, so the width is corroborated rather
  // than merely unrefuted.
  { key: 'medical', type: TYPE_BITMAP, ids: [0x8768], mode: 'dib' },
  { key: 'parking', type: TYPE_BITMAP, ids: range(0x8ee8, 0x8eea), mode: 'dib' },

  // Deliberately absent: the chapel (0x8ca8 measures 7 segments, which is not a
  // room), the theatre (0x88a8, 34% against a 41% runner-up — too close to
  // call), the cinema (0x8728) and the metro (0x8e28). Their art is in the file
  // and their widths are not defensible yet, and a facility drawn at the wrong
  // width is how the ground floor came to be a parade of shopfronts.

  // Two pieces of the original's chrome, borrowed for the HUD: the rating star
  // lit and unlit. Icons rather than sheets, so they are taken whole. Both sit
  // on a flat background, which is what the corner convention is for.
  { key: 'star', type: TYPE_BITMAP, ids: [0x8142], mode: 'dib', transparent: 'corner' },
  { key: 'star-dim', type: TYPE_BITMAP, ids: [0x8143], mode: 'dib', transparent: 'corner' },

  // Nine figures across a 96x24 sheet, and — this is the part a grid cannot
  // express — they are six different widths, from five pixels to eleven, with
  // the last few being clumps of two or three people rather than one. Cutting
  // it into twelve equal columns sliced them apart, which is what made the
  // crowd look wrong. Ink rows 3..22, so a figure is 20px in a 24px frame,
  // which is about right against a 24px room.
  { key: 'people', type: TYPE_BITMAP, ids: range(0x82bc, 0x82bf), mode: 'dib', cut: 'ink', transparent: 'corner' },
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
  // Frames separated by background rather than laid on a grid.
  if (spec.cut === 'ink') {
    const background = sheet.pixels[0] ?? 0;
    const runs = inkColumns(sheet, background);
    const frames = runs.map((run) => crop(sheet, run.from, 0, run.to - run.from + 1, sheet.height));
    return frames.length > 0 ? frames : [sheet];
  }

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
