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
   * sheet whose figures are different widths; `glyph` cuts a fixed pitch and
   * then trims every frame to the box that actually differs between them.
   */
  cut?: 'grid' | 'ink' | 'glyph';
  /** Pitch for `glyph` mode, in pixels. */
  cellWidth?: number;
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
   *
   * `'sheet'` reads it from the *sheet's* top-left instead, which is what a
   * trimmed cut needs: a glyph frame has been cropped past the background, so
   * its own corner is whatever the trim landed on. On 0x87ea that is shaft ink,
   * and taking it as see-through punches the shaft through every number.
   */
  transparent?: number | 'corner' | 'sheet';
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

  // The lobby is not catalogued, and the hunt for it is over.
  //
  // All eleven cell strips are accounted for: nine are backdrop panoramas,
  // 0x8fe9 is a crowd (catalogued as the lobby once, and it drew as confetti on
  // a black strip), and 0x8fea is a flight of stairs with riders on it. The
  // widest room-height bitmaps went the same way — 0x8868 is hotel interiors,
  // 0x8b28 a function room, 0x8c68 the cinema auditorium, 0x8ba8 a shopping
  // arcade, 0x85e8 the office's own staff and 0x87a8 a housekeeping room.
  //
  // The last two are worth more than the search that found them: 0x85e8 is
  // 0x85a8 + 0x40 and 0x87a8 is 0x87e8 - 0x40, so both land exactly where the
  // slot table says a facility's neighbours live.
  //
  // So the lobby is drawn rather than extracted, in colours sampled from the
  // game's own palette — see `drawnLobby` in `original.ts`. Clearly ours rather
  // than theirs, and it fixes the one part of the tower that read as a hole.

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
  // 352x36 is eleven frames of four segments, which `--period` puts at 8.2%
  // against 51% for the next reading. It was catalogued with no states and
  // tiled whole, and drew the right thing only because `tile` wraps its source
  // and a lift is exactly one frame wide — the right answer for the wrong
  // reason, which stops being right the moment anything else uses it.
  { key: 'shaft', type: TYPE_BITMAP, ids: [0x87e8], mode: 'dib', states: 11 },

  // The digits that run down the shaft: 160x36, ten cells of sixteen pixels,
  // holding 0 to 9 in order. Two digits is 32px, which is exactly the width of
  // a four-segment lift — neat enough to be suspicious of, and it held.
  //
  // `--period` is the wrong instrument here and said so: it reported 32px at
  // 14.1% and 80px at 12.1%, both multiples of the real pitch, because
  // autocorrelation on a row of *different* glyphs finds where the furniture
  // lines up rather than where a glyph ends. `--frames` settled it in one look
  // — the hairline down each cell's right edge falls every sixteen columns —
  // and the glyph shapes read off the dump as the digits in order.
  //
  // Cut with `glyph` rather than `states: 10`: an equal-tenths cut keeps the
  // slab rule and shadow band that every cell shares, and a number composed of
  // those has a rule through the middle of it. See `varyingBox`.
  { key: 'digits', type: TYPE_BITMAP, ids: [0x87e9], mode: 'dib', cut: 'glyph', cellWidth: 16, transparent: 'sheet' },

  // The basement alphabet: 0x87ea, 192x36, twelve cells at the same sixteen-
  // pixel pitch. Cells 2 to 11 are `B` followed by 1 to 9 — and the missing
  // zero is the tell that this is the right reading rather than a coincidence.
  // There is no B0 and no B10, so a basement label needs exactly a B and the
  // digits one to nine, which is exactly what is here. A sheet that is complete
  // for its job and complete for nothing else has been read correctly.
  //
  // Cells 0 and 1 each carry a small `B` raised above a 1 and a 2. They are not
  // needed to spell anything and are not used; what they are for is unresolved,
  // and saying so beats inventing a story for them.
  //
  // Basement labels are spelled entirely from this sheet, never mixed with
  // 0x87e9 — same sheet means same trim box, so the B and its digit line up
  // with each other by construction rather than by a fudge factor.
  //
  // 0x87eb-0x87ed repeat the shaft and both alphabets in red. The machinery at
  // 0x88e8-0x88ed is still unmeasured.
  { key: 'digits-basement', type: TYPE_BITMAP, ids: [0x87ea], mode: 'dib', cut: 'glyph', cellWidth: 16, transparent: 'sheet' },

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

/** Where the facility slot table starts, and how far apart its slots are. */
export const SLOT_BASE = 0x84a8;
export const SLOT_STRIDE = 0x40;

/**
 * The bases of the seven sound banks, which are a *different* table.
 *
 * A listing of a real copy found 58 sounds in two groups. Eleven sit on the
 * 0x40 facility slots and name themselves that way. The other forty-seven sit
 * in banks based here — and these bases are exactly **1000 decimal apart**
 * (0x9388 = 37768, 0x9770 = 38768, and so on, all ≡ 768 mod 1000), with the
 * last one ten thousand further on.
 *
 * Two tables with two strides, one hexadecimal and one decimal, is worth
 * stating plainly because it is the sort of thing that looks like noise until
 * you check: a 0x40 stride reads as a compiler's doing, a 1000 stride reads as
 * a person numbering things by hand. The banks hold most of the audio — every
 * blip, chime, alarm and fanfare — and nothing in them can be identified by
 * arithmetic. That takes an ear, which is what `--sounds --all` is for.
 */
export const SOUND_BANKS: readonly number[] = [0x9388, 0x9770, 0x9b58, 0x9f40, 0xa328, 0xa710, 0xce20];

/**
 * Which table a sound belongs to, and where in it.
 *
 * Slot numbers are the useful part: slot 17 is the lift machinery, slot 3 the
 * restaurant. A sound one past a slot boundary is that slot's second sound,
 * which several facilities have.
 */
export function soundGroup(id: number): { slot?: number; offset?: number; bank?: number } {
  let best: number | undefined;
  for (const base of SOUND_BANKS) {
    if (id >= base && (best === undefined || base > best)) best = base;
  }
  if (best !== undefined) return { bank: best };
  if (id < SLOT_BASE) return {};
  return { slot: Math.floor((id - SLOT_BASE) / SLOT_STRIDE), offset: (id - SLOT_BASE) % SLOT_STRIDE };
}

/**
 * The sound each buildable facility makes, keyed by the id `world/facilities.ts`
 * uses.
 *
 * This table used to be described as "the sound catalogue", which was wrong and
 * wrong in the direction that flatters it. Slots are 0x40 apart and hold a
 * facility's whole existence in the file — its bitmaps, and at the very same ID
 * under type 0xff0a its sound — so the arithmetic really does name a sound
 * without anyone listening to it. But a listing of a real copy found sounds on
 * only **four** buildable facilities. Nine have art and no audio at their slot.
 *
 * The mechanism was right and the coverage claim was not, which is a distinction
 * worth keeping: the fix is a fallback for the nine, not a different mechanism.
 *
 * Keyed by *facility* id, not by sprite key, and a test holds it to that. The
 * escalator was in here at 0x8aa8 on the strength of its art: it is a sprite the
 * atlas carries and not a thing the player can build, so its sound could never
 * have been asked for.
 *
 * Entries now come from two places, and the difference matters because they fail
 * differently. An arithmetic entry is wrong only if the stride is wrong, which a
 * test catches. An ear entry is wrong if somebody misheard, which nothing
 * catches — so each one says what it rests on.
 */
export const FACILITY_SOUNDS: Readonly<Record<string, number>> = {
  // Arithmetic: the sound sits at the facility's own slot.
  restaurant: 0x8568,
  office: 0x85a8,
  condo: 0x8628,
  shop: 0x8668,

  // Ear. Slot 8 holds an engine revving and a horn, and parking is the only
  // thing in the game with cars in it — but this is a borrowing, not an
  // identification. Parking's *art* is at 0x8ee8, slot 41, so slot 8 belongs to
  // some facility we have not found, and finding it may take this sound back.
  parking: 0x86a8,

  // Ear, and the weakest entry here. 0x9b58 opens the construction bank, ahead
  // of build, refusal and demolish, and was heard as "elevator c…" — which reads
  // as the lift's own build sound sitting with the other build sounds. If it
  // turns out to be a car or a chime instead, this is the line to delete.
  elevator: 0x9b58,
};

/**
 * Sounds for things that happen to the tower rather than to one facility.
 *
 * Every one of these came from listening; none could have been derived. The
 * useful discovery is that the 0x9b58 bank is the **construction bank** —
 * build, "you cannot put that there", demolish, in that order, one after
 * another — which is the sort of grouping the 0x40 arithmetic cannot see at all.
 *
 * `lift` is worth its own note. Slot 17 (0x88e8) is the lift machinery and the
 * arithmetic named it without anyone listening, which is how it was wired first.
 * Listening found the 0x9770 bank: doors opening, ding-then-doors, going up. A
 * car reaching a floor is the ding, so the ear beat the arithmetic here — the
 * derivation was sound and the answer was still second best.
 *
 * `place` is the fallback for facilities with no sound of their own.
 */
export const EVENT_SOUNDS: Readonly<
  Partial<Record<'place' | 'blocked' | 'bulldoze' | 'lift' | 'star', number>>
> = {
  place: 0x9b59,
  blocked: 0x9b5a,
  bulldoze: 0x9b5b,
  lift: 0x9771,
  star: 0xa710,
};

/**
 * The cinema's reel: fifteen unrelated snatches of film, played at random.
 *
 * The original plays one when you click a movie theatre, and playing the same
 * one every time would be a worse imitation than playing none. They are
 * contiguous from 0xa329 — note that the bank *base* 0xa328 holds no resource,
 * so this bank starts one past its own base, which none of the others do.
 */
export const CINEMA_REEL: readonly number[] = range(0xa329, 0xa337);

/**
 * The ambient layer, by time of day.
 *
 * These are the sounds the tower has no event for: birds, bells, weather, a
 * crowd. Nothing in the game asks for them and nothing here simulates what would
 * — they are chosen by the clock, which the palette already follows, so dawn
 * sounds like dawn.
 *
 * `crowd` is kept separate because it is the one pool that would be a lie in an
 * empty lot. The rest can play over bare ground quite happily.
 */
export const AMBIENCE = {
  /** 05:00–09:00. Two birds, a crow, and a second bird from the other bank. */
  dawn: [0x9388, 0x9389, 0x938a, 0xa71c],
  /** 09:00–18:00. Church bells, which at 3.75s to the game hour cannot be hourly. */
  day: [0x938c],
  /** 18:00–21:00. */
  dusk: [0x938a, 0x938c],
  /** 21:00–05:00. Crickets. */
  night: [0xa71b],
  /** Any hour, rarely. */
  weather: [0x938d],
  /** Any daylight hour, and only once the tower has something in it. */
  crowd: [0x9f40, 0x9f41],
} as const satisfies Readonly<Record<string, readonly number[]>>;

export interface ExtractedSprite {
  key: string;
  /** One entry per state; each entry one per variant. */
  frames: IndexedImage[];
  transparent?: number;
  /**
   * Where a trimmed frame sat inside the cell it was cut from.
   *
   * Only `glyph` mode sets this. A digit that has been trimmed out of its
   * 16x36 cell has lost the one thing that says where on a floor it belongs,
   * and the renderer would otherwise have to reinvent it as a magic number.
   */
  origin?: { x: number; y: number };
}

export interface Extraction {
  palette: Palette;
  sprites: Map<string, ExtractedSprite>;
  /**
   * Every sound in the file, keyed by resource ID.
   *
   * Taken wholesale rather than catalogued. A sound needs no cutting, no
   * measuring and no identification to be stored correctly — the only question
   * is which one to play, and the tables above answer that by ID. So there is
   * nothing here to get wrong, which is a pleasant change.
   */
  sounds: Map<number, Uint8Array>;
  /** Specs that produced nothing, with the reason. For the CLI to report. */
  problems: { key: string; reason: string }[];
}

/** Decodes one resource according to its spec, before any state/variant cutting. */
function decodeSheet(spec: SpriteSpec, data: Uint8Array): IndexedImage {
  return spec.mode === 'cells' ? readCellStrip(data, SEGMENT_WIDTH, spec.cellHeight) : decodeDIB(data);
}

interface Cut {
  frames: IndexedImage[];
  origin?: { x: number; y: number };
  /** The sheet's own corner index, for `transparent: 'sheet'`. */
  background?: number;
}

/**
 * The box inside a repeating cell whose pixels are not the same in every cell.
 *
 * A digit sheet is not only digits. SimTower's is ten 16px cells each carrying
 * a slab rule along the top, a shadow band under it and a hairline down the
 * right edge — decoration identical in all ten — with the glyph itself in the
 * lower half. Cutting on the pitch alone hands the renderer ten copies of that
 * furniture and no idea which part is the number.
 *
 * What separates the two is not brightness or position but *variation*: the
 * furniture is by definition the part that repeats. So compare the cells to one
 * another and keep the bounding box of everything they disagree about. Nothing
 * here knows it is looking at digits, which is the point — the same cut works
 * on whatever the `B` sheet turns out to hold.
 */
export function varyingBox(
  sheet: IndexedImage,
  cellWidth: number,
): { x: number; y: number; width: number; height: number } | undefined {
  const cells = Math.floor(sheet.width / cellWidth);
  // One cell has nothing to differ from, and zero cells is not a sheet.
  if (cells < 2 || cellWidth <= 0) return undefined;

  let left = cellWidth;
  let right = -1;
  let top = sheet.height;
  let bottom = -1;

  for (let y = 0; y < sheet.height; y += 1) {
    for (let x = 0; x < cellWidth; x += 1) {
      const first = sheet.pixels[y * sheet.width + x];
      let varies = false;
      for (let cell = 1; cell < cells; cell += 1) {
        if (sheet.pixels[y * sheet.width + cell * cellWidth + x] !== first) {
          varies = true;
          break;
        }
      }
      if (!varies) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }

  // Every cell identical: a sheet of one repeated thing, not a set of glyphs.
  if (right < left || bottom < top) return undefined;
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/** Cuts a decoded sheet into its states and variants. */
function cutFrames(spec: SpriteSpec, sheet: IndexedImage): Cut {
  // A fixed pitch, trimmed to the part that is not shared furniture.
  if (spec.cut === 'glyph') {
    const cellWidth = Math.max(1, spec.cellWidth ?? SEGMENT_WIDTH);
    const cells = Math.floor(sheet.width / cellWidth);
    const box = varyingBox(sheet, cellWidth);
    if (!box || cells < 1) return { frames: [sheet] };
    const frames: IndexedImage[] = [];
    for (let cell = 0; cell < cells; cell += 1) {
      frames.push(crop(sheet, cell * cellWidth + box.x, box.y, box.width, box.height));
    }
    return { frames, origin: { x: box.x, y: box.y }, background: sheet.pixels[0] ?? 0 };
  }

  // Frames separated by background rather than laid on a grid.
  if (spec.cut === 'ink') {
    const background = sheet.pixels[0] ?? 0;
    const runs = inkColumns(sheet, background);
    const frames = runs.map((run) => crop(sheet, run.from, 0, run.to - run.from + 1, sheet.height));
    return { frames: frames.length > 0 ? frames : [sheet] };
  }

  // A strip is a run of single-segment cells, each its own frame.
  if (spec.cellFrames) {
    const cells = Math.floor(sheet.width / SEGMENT_WIDTH);
    const frames: IndexedImage[] = [];
    for (let cell = 0; cell < cells; cell += 1) {
      frames.push(crop(sheet, cell * SEGMENT_WIDTH, 0, SEGMENT_WIDTH, sheet.height));
    }
    return { frames: frames.length > 0 ? frames : [sheet] };
  }

  const states = Math.max(1, spec.states ?? 1);
  const variants = Math.max(1, spec.variants ?? 1);
  if (states === 1 && variants === 1) return { frames: [sheet] };

  const frameWidth = Math.floor(sheet.width / states);
  const frameHeight = Math.floor(sheet.height / variants);
  if (frameWidth <= 0 || frameHeight <= 0) return { frames: [sheet] };

  const frames: IndexedImage[] = [];
  for (let variant = 0; variant < variants; variant += 1) {
    for (let state = 0; state < states; state += 1) {
      frames.push(crop(sheet, state * frameWidth, variant * frameHeight, frameWidth, frameHeight));
    }
  }
  return { frames };
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
    let origin: { x: number; y: number } | undefined;
    let background: number | undefined;
    for (const id of spec.ids) {
      const data = byId.get(id);
      if (!data) continue;
      try {
        const cut = cutFrames(spec, decodeSheet(spec, data));
        frames.push(...cut.frames);
        origin ??= cut.origin;
        background ??= cut.background;
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
    const transparent = resolveTransparent(spec, frames, background);
    if (transparent !== undefined) sprite.transparent = transparent;
    if (origin !== undefined) sprite.origin = origin;
    sprites.set(spec.key, sprite);
  }

  return { palette, sprites, sounds: new Map(resources.get(TYPE_SOUND) ?? []), problems };
}

/** Turns `'corner'`/`'sheet'` into the actual index the sprite uses for see-through. */
function resolveTransparent(
  spec: SpriteSpec,
  frames: IndexedImage[],
  background: number | undefined,
): number | undefined {
  if (spec.transparent === undefined) return undefined;
  if (spec.transparent === 'sheet') return background;
  if (spec.transparent !== 'corner') return spec.transparent;
  return frames[0]?.pixels[0];
}

function firstValue<K, V>(map: Map<K, V> | undefined): V | undefined {
  if (!map) return undefined;
  for (const value of map.values()) return value;
  return undefined;
}
