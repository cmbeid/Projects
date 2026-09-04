/**
 * Our own art, drawn to SimTower's measurements.
 *
 * The point of this file is not to be pretty. It is to occupy the exact grid
 * the original occupies — 8px segments, 36px floors, an indexed palette that
 * cycles for day and night — so that the deployed page shows a real tower
 * before anyone has supplied a copy of the game, and so the renderer has
 * something to be tested against that carries no copyright but ours.
 *
 * Everything is generated rather than authored: at this size a sprite is a
 * dozen rectangles, and code is easier to re-tune than a PNG.
 */

import type { IndexedImage } from './dib.js';
import type { Atlas } from './atlas.js';
import { PALETTE_ENTRIES, mixPalettes, type Palette } from './palette.js';
import { FLOOR_HEIGHT, SEGMENT_WIDTH, type ExtractedSprite } from './slice.js';

/**
 * Named palette slots. Index 0 is the see-through one, so nothing else may use
 * it. The high indices mirror the range SimTower rotates for lit signage.
 */
export const INK = {
  transparent: 0,
  /**
   * Six steps of sky, horizon to heaven. SimTower ships a bitmap per altitude
   * band rather than one flat colour, and that vertical gradient is a lot of
   * why a hundred storeys feels like a hundred storeys.
   */
  sky0: 1,
  sky1: 2,
  sky2: 22,
  sky3: 23,
  sky4: 24,
  sky5: 25,
  ground: 3,
  slab: 4,
  slabLip: 5,
  wall: 6,
  officeFloor: 7,
  desk: 8,
  windowLit: 9,
  windowDark: 10,
  condoFloor: 11,
  hotelFloor: 12,
  shaft: 13,
  car: 14,
  marble: 15,
  trim: 16,
  personA: 17,
  personB: 18,
  personC: 19,
  personD: 20,
  personAngry: 21,
  townWall: 26,
  townRoof: 27,
  townWindow: 28,
  starLit: 29,
  starDim: 30,
  shopFront: 31,
  shopSign: 32,
  diningFloor: 33,
  cloth: 34,
  counter: 35,
  clinicFloor: 36,
  clinicTrim: 37,
  deck: 38,
  bay: 39,
  house: 40,
  seat: 41,
  screen: 42,
  indicatorA: 197,
  indicatorB: 198,
} as const;

const DAY: Record<number, [number, number, number]> = {
  [INK.transparent]: [255, 0, 255],
  [INK.sky0]: [186, 216, 238],
  [INK.sky1]: [156, 200, 232],
  [INK.sky2]: [126, 182, 226],
  [INK.sky3]: [100, 160, 216],
  [INK.sky4]: [76, 138, 204],
  [INK.sky5]: [54, 114, 188],
  [INK.ground]: [96, 88, 72],
  [INK.slab]: [188, 184, 172],
  [INK.slabLip]: [128, 124, 112],
  [INK.wall]: [72, 70, 66],
  [INK.officeFloor]: [214, 206, 180],
  [INK.desk]: [140, 108, 72],
  [INK.windowLit]: [248, 232, 160],
  [INK.windowDark]: [84, 100, 116],
  [INK.condoFloor]: [206, 180, 188],
  [INK.hotelFloor]: [188, 196, 208],
  [INK.shaft]: [48, 48, 56],
  [INK.car]: [216, 216, 224],
  [INK.marble]: [232, 228, 216],
  [INK.trim]: [176, 148, 96],
  [INK.personA]: [40, 48, 88],
  [INK.personB]: [88, 40, 48],
  [INK.personC]: [40, 80, 56],
  [INK.personD]: [64, 56, 40],
  [INK.personAngry]: [220, 56, 40],
  [INK.townWall]: [104, 112, 128],
  [INK.townRoof]: [72, 78, 92],
  [INK.starLit]: [240, 195, 82],
  [INK.starDim]: [88, 96, 112],
  [INK.shopFront]: [232, 214, 186],
  [INK.shopSign]: [196, 84, 72],
  [INK.diningFloor]: [186, 158, 142],
  [INK.cloth]: [236, 230, 218],
  [INK.counter]: [156, 116, 84],
  [INK.clinicFloor]: [212, 226, 224],
  [INK.clinicTrim]: [96, 156, 148],
  [INK.deck]: [88, 88, 92],
  [INK.bay]: [64, 64, 68],
  [INK.house]: [58, 48, 72],
  [INK.seat]: [138, 62, 74],
  [INK.screen]: [206, 214, 232],
  [INK.townWindow]: [196, 206, 176],
  [INK.indicatorA]: [248, 200, 64],
  [INK.indicatorB]: [80, 60, 24],
};

/** How far each slot travels toward night. Windows go the other way and light up. */
const NIGHT_OVERRIDES: Record<number, [number, number, number]> = {
  [INK.sky0]: [46, 44, 74],
  [INK.sky1]: [36, 36, 64],
  [INK.sky2]: [28, 30, 54],
  [INK.sky3]: [20, 24, 46],
  [INK.sky4]: [14, 18, 38],
  [INK.sky5]: [8, 10, 26],
  [INK.windowLit]: [255, 240, 176],
  [INK.windowDark]: [30, 36, 52],
};

function buildPalette(entries: Record<number, [number, number, number]>): Palette {
  const palette = new Uint8Array(PALETTE_ENTRIES * 4);
  for (let i = 0; i < PALETTE_ENTRIES; i += 1) palette[i * 4 + 3] = 255;
  for (const [key, rgb] of Object.entries(entries)) {
    const index = Number(key);
    palette[index * 4 + 0] = rgb[0];
    palette[index * 4 + 1] = rgb[1];
    palette[index * 4 + 2] = rgb[2];
  }
  return palette;
}

/**
 * Eleven tables from noon to midnight and back, matching the count the
 * original ships. The renderer crossfades between neighbours, so eleven steps
 * is plenty for a smooth day.
 */
function buildSkyPalettes(): Palette[] {
  const day = buildPalette(DAY);
  const night = buildPalette({ ...DAY, ...NIGHT_OVERRIDES });
  // Darken everything else a little at night too, or the tower floats.
  for (let i = 0; i < PALETTE_ENTRIES; i += 1) {
    if (i in NIGHT_OVERRIDES || i === INK.transparent) continue;
    for (let c = 0; c < 3; c += 1) {
      const at = i * 4 + c;
      night[at] = Math.round((night[at] ?? 0) * 0.45 + 12);
    }
  }

  // Index 0 is midnight and the middle is noon, because that is how the clock
  // indexes them: hour/24 across the ring. Building it noon-first put 22:00 in
  // broad daylight.
  const steps = 11;
  const palettes: Palette[] = [];
  for (let i = 0; i < steps; i += 1) {
    const phase = i / steps;
    palettes.push(mixPalettes(day, night, Math.abs(1 - phase * 2)));
  }
  return palettes;
}

// --- the smallest raster library that will do -------------------------------

function blank(width: number, height: number, fill: number): IndexedImage {
  const pixels = new Uint8Array(width * height);
  if (fill !== 0) pixels.fill(fill);
  return { width, height, pixels };
}

function fill(image: IndexedImage, x: number, y: number, w: number, h: number, ink: number): void {
  for (let row = y; row < y + h; row += 1) {
    if (row < 0 || row >= image.height) continue;
    for (let column = x; column < x + w; column += 1) {
      if (column < 0 || column >= image.width) continue;
      image.pixels[row * image.width + column] = ink;
    }
  }
}

/** The floor slab every occupied segment sits on, and the ceiling above it. */
function addSlab(image: IndexedImage): void {
  fill(image, 0, 0, image.width, 2, INK.wall);
  fill(image, 0, FLOOR_HEIGHT - 3, image.width, 2, INK.slab);
  fill(image, 0, FLOOR_HEIGHT - 1, image.width, 1, INK.slabLip);
}

/** A row of windows, which is what makes a facade read as a facade. */
function addWindows(image: IndexedImage, lit: boolean, spacing: number): void {
  const ink = lit ? INK.windowLit : INK.windowDark;
  for (let x = 2; x + 3 <= image.width - 2; x += spacing) {
    fill(image, x, 6, 3, 10, ink);
  }
}

// --- the sprites ------------------------------------------------------------

/**
 * One flat tile per altitude band. Flat is deliberate: anything drawn *inside*
 * the tile repeats every 36 pixels and turns the sky into stripes. The
 * gradient belongs to the sequence of bands, not to any one of them.
 */
function sky(band: number): IndexedImage {
  return blank(SEGMENT_WIDTH, FLOOR_HEIGHT, band);
}

function ground(): IndexedImage {
  // No lip: the horizon line is drawn once by the scene, not once per tile.
  return blank(SEGMENT_WIDTH, FLOOR_HEIGHT, INK.ground);
}

function lobby(): IndexedImage {
  const image = blank(SEGMENT_WIDTH, FLOOR_HEIGHT, INK.marble);
  addSlab(image);
  fill(image, 0, 2, SEGMENT_WIDTH, 3, INK.trim);
  fill(image, 0, FLOOR_HEIGHT - 8, SEGMENT_WIDTH, 5, INK.trim);
  return image;
}

function office(state: number): IndexedImage {
  const image = blank(SEGMENT_WIDTH * 9, FLOOR_HEIGHT, INK.officeFloor);
  addSlab(image);
  addWindows(image, state > 0, 8);
  if (state > 0) {
    // Desks appear as the floor fills up, which is the whole tell for occupancy.
    for (let i = 0; i < state * 2; i += 1) {
      fill(image, 5 + i * 10, FLOOR_HEIGHT - 10, 6, 5, INK.desk);
    }
  }
  return image;
}

function condo(state: number): IndexedImage {
  const image = blank(SEGMENT_WIDTH * 16, FLOOR_HEIGHT, INK.condoFloor);
  addSlab(image);
  addWindows(image, state > 0, 10);
  fill(image, 0, 2, image.width, 2, INK.trim);
  return image;
}

function hotel(state: number): IndexedImage {
  const image = blank(SEGMENT_WIDTH * 4, FLOOR_HEIGHT, INK.hotelFloor);
  addSlab(image);
  addWindows(image, state === 1, 9);
  // Asleep: the window is dark but the bed is still there.
  fill(image, 3, FLOOR_HEIGHT - 11, 12, 6, state === 2 ? INK.trim : INK.desk);
  return image;
}

function shaft(): IndexedImage {
  const image = blank(SEGMENT_WIDTH * 4, FLOOR_HEIGHT, INK.shaft);
  fill(image, 0, 0, 1, FLOOR_HEIGHT, INK.wall);
  fill(image, image.width - 1, 0, 1, FLOOR_HEIGHT, INK.wall);
  fill(image, 0, FLOOR_HEIGHT - 2, image.width, 2, INK.wall);
  // The one thing that rotates: a call indicator by the doors.
  fill(image, 1, 3, 2, 2, INK.indicatorA);
  fill(image, image.width - 3, 3, 2, 2, INK.indicatorB);
  return image;
}

function car(): IndexedImage {
  const image = blank(SEGMENT_WIDTH * 4, FLOOR_HEIGHT - 4, INK.car);
  fill(image, 0, 0, image.width, 2, INK.wall);
  fill(image, 0, image.height - 2, image.width, 2, INK.wall);
  fill(image, image.width / 2 - 1, 2, 2, image.height - 4, INK.wall);
  return image;
}

function stairs(): IndexedImage {
  // Eight segments, which is what the world declares and what the original's
  // own sheet divides into. This was four, drawing half a flight in the gap
  // left by a full-width one, for as long as nothing compared the two numbers.
  const width = SEGMENT_WIDTH * 8;
  const image = blank(width, FLOOR_HEIGHT, INK.wall);
  const steps = 10;
  const rise = (FLOOR_HEIGHT - 6) / steps;
  const run = width / steps;
  for (let step = 0; step < steps; step += 1) {
    fill(image, Math.round(step * run), Math.round(FLOOR_HEIGHT - 5 - step * rise), Math.ceil(run), 3, INK.slab);
  }
  return image;
}

/**
 * One 8px slice of the town the tower stands in.
 *
 * The original ships a hundred and forty of these as a panorama; ours is eight
 * heights cycled, which is enough to read as a street rather than a wall. Cells
 * are 32 tall and sit on the ground line.
 */
function town(step: number): IndexedImage {
  const height = 32;
  const image = blank(SEGMENT_WIDTH, height, INK.transparent);
  // A repeating but not-quite-regular skyline: eight steps that do not divide
  // evenly into the lot, so the pattern does not visibly tile.
  const roof = 6 + ((step * 5) % 18);
  fill(image, 0, roof, SEGMENT_WIDTH, height - roof, INK.townWall);
  fill(image, 0, roof, SEGMENT_WIDTH, 1, INK.townRoof);
  for (let y = roof + 3; y < height - 3; y += 5) {
    fill(image, 2, y, 4, 2, INK.townWindow);
  }
  return image;
}

function person(tint: number): IndexedImage {
  const image = blank(2, 4, INK.transparent);
  fill(image, 0, 0, 2, 4, tint);
  return image;
}

/**
 * A restaurant: twenty-four segments of tables under a long window.
 *
 * The width is not invented. `--period` cut the original's own sheet at 192px
 * and that is twenty-four segments, which is what SimTower documents — so the
 * placeholder is drawn to the real size rather than to a convenient one.
 */
function restaurant(state: number): IndexedImage {
  const image = blank(SEGMENT_WIDTH * 24, FLOOR_HEIGHT, INK.diningFloor);
  addSlab(image);
  addWindows(image, state > 0, 16);
  for (let table = 0; table < 7; table += 1) {
    const x = 8 + table * 26;
    fill(image, x, FLOOR_HEIGHT - 12, 14, 2, INK.cloth);
    fill(image, x + 6, FLOOR_HEIGHT - 10, 2, 5, INK.counter);
    // Diners only once the place is open, which is the whole tell for state.
    if (state > 0) {
      fill(image, x - 2, FLOOR_HEIGHT - 15, 3, 8, INK.personA);
      fill(image, x + 13, FLOOR_HEIGHT - 15, 3, 8, INK.personC);
    }
  }
  return image;
}

/** A shop: twelve segments of lit frontage with a sign over it. */
function shop(state: number): IndexedImage {
  const image = blank(SEGMENT_WIDTH * 12, FLOOR_HEIGHT, INK.shopFront);
  addSlab(image);
  fill(image, 2, 5, SEGMENT_WIDTH * 12 - 4, 5, INK.shopSign);
  // Shuttered at state 0; goods in the window once it is trading.
  if (state === 0) {
    for (let bar = 0; bar < 12; bar += 1) fill(image, 4 + bar * 8, 12, 5, FLOOR_HEIGHT - 18, INK.wall);
    return image;
  }
  // Shelves fill up as the state rises, the way an office grows desks: the
  // three states have to look like three things or the third frame is dead
  // weight in the sheet.
  for (let shelf = 0; shelf < 3; shelf += 1) {
    fill(image, 6, 14 + shelf * 6, SEGMENT_WIDTH * 12 - 12, 2, INK.counter);
    for (let item = 0; item < 2 + state * 3; item += 1) {
      fill(image, 8 + item * 11, 11 + shelf * 6, 4, 3, item % 2 === 0 ? INK.windowLit : INK.shopSign);
    }
  }
  // And a shopper once it is busy.
  if (state > 1) fill(image, SEGMENT_WIDTH * 12 - 14, FLOOR_HEIGHT - 15, 3, 8, INK.personC);
  return image;
}

/** Fast food: sixteen segments, a counter across the front and a menu board. */
function fastFood(state: number): IndexedImage {
  const image = blank(SEGMENT_WIDTH * 16, FLOOR_HEIGHT, INK.shopFront);
  addSlab(image);
  fill(image, 0, 5, SEGMENT_WIDTH * 16, 6, INK.shopSign);
  for (let panel = 0; panel < 6; panel += 1) fill(image, 6 + panel * 20, 6, 12, 4, INK.windowLit);
  fill(image, 4, FLOOR_HEIGHT - 13, SEGMENT_WIDTH * 16 - 8, 4, INK.counter);
  if (state > 0) {
    for (let queue = 0; queue < 5; queue += 1) {
      fill(image, 10 + queue * 24, FLOOR_HEIGHT - 20, 3, 8, queue % 2 === 0 ? INK.personB : INK.personD);
    }
  }
  return image;
}

/** A clinic: sixteen segments, pale and evenly lit. */
function clinic(): IndexedImage {
  const image = blank(SEGMENT_WIDTH * 16, FLOOR_HEIGHT, INK.clinicFloor);
  addSlab(image);
  addWindows(image, true, 12);
  fill(image, 0, FLOOR_HEIGHT - 12, SEGMENT_WIDTH * 16, 1, INK.clinicTrim);
  for (let bed = 0; bed < 4; bed += 1) {
    fill(image, 10 + bed * 30, FLOOR_HEIGHT - 10, 18, 4, INK.cloth);
    fill(image, 10 + bed * 30, FLOOR_HEIGHT - 10, 4, 4, INK.clinicTrim);
  }
  return image;
}

/** Parking: sixteen segments of dark deck, marked out into bays. */
function parking(): IndexedImage {
  const image = blank(SEGMENT_WIDTH * 16, FLOOR_HEIGHT, INK.deck);
  addSlab(image);
  for (let bay = 0; bay < 6; bay += 1) {
    const x = 6 + bay * 20;
    fill(image, x, 8, 1, FLOOR_HEIGHT - 14, INK.bay);
    // A car in every other bay, so the deck reads as used rather than empty.
    if (bay % 2 === 0) fill(image, x + 4, FLOOR_HEIGHT - 14, 12, 5, bay === 2 ? INK.shopSign : INK.personA);
  }
  return image;
}

/**
 * A theatre: twenty-four segments of raked seating facing a lit screen.
 *
 * A full floor tall rather than a room's twenty-four pixels, which is what the
 * original's own sheet is — so this one does not get `addSlab`, and nothing
 * carries its last row down to fill a gap it does not leave.
 */
function theatre(state: number): IndexedImage {
  const width = SEGMENT_WIDTH * 24;
  const image = blank(width, FLOOR_HEIGHT, INK.house);
  // The screen, lit, at the left; the rake climbs away from it.
  fill(image, 4, 5, 34, FLOOR_HEIGHT - 14, INK.screen);
  fill(image, 4, 5, 34, 2, INK.trim);

  const rows = 9;
  for (let row = 0; row < rows; row += 1) {
    const x = 48 + row * 14;
    // Each row sits a little higher and a little further back than the last.
    const top = FLOOR_HEIGHT - 8 - Math.round((row / rows) * (FLOOR_HEIGHT - 18));
    fill(image, x, top, 11, 3, INK.seat);
    // Filling up as the state rises, the way the offices fill with desks.
    if (row % 3 <= state) fill(image, x + 3, top - 3, 5, 3, row % 2 === 0 ? INK.personA : INK.personD);
  }
  fill(image, 0, FLOOR_HEIGHT - 3, width, 3, INK.slab);
  return image;
}

/**
 * A cinema: seven segments of screen between curtains, with a door below.
 *
 * Narrow, and that is the point — the original's own sheet divides into ten of
 * these across 560 pixels, which took a 112-pixel window to believe.
 */
function cinema(state: number): IndexedImage {
  const width = SEGMENT_WIDTH * 7;
  const image = blank(width, FLOOR_HEIGHT, INK.house);
  // Curtain down each side, screen between them.
  fill(image, 0, 0, 8, FLOOR_HEIGHT - 3, INK.seat);
  fill(image, width - 8, 0, 8, FLOOR_HEIGHT - 3, INK.seat);
  fill(image, 9, 3, width - 18, 17, INK.screen);
  // Whatever is showing: a different shape on the screen for each state, so
  // ten frames read as ten films rather than as one repeated.
  const band = 4 + (state % 5) * 2;
  fill(image, 11, band, width - 22, 5, state % 2 === 0 ? INK.windowLit : INK.clinicTrim);
  fill(image, 13, band + 6, Math.max(4, width - 30 - state), 3, INK.trim);
  // The door out, and the floor.
  fill(image, width / 2 - 4, FLOOR_HEIGHT - 12, 8, 9, INK.shopSign);
  fill(image, 0, FLOOR_HEIGHT - 3, width, 3, INK.slab);
  return image;
}

/**
 * A five-pointed star for the rating badge, as a picture of itself.
 *
 * Everything else here is generated, because a rectangle is easier to re-tune
 * as code than as pixels. A star is the exception: at eleven pixels across the
 * maths that puts five points in the right places is fiddlier to read *and*
 * gets them wrong, while the shape below can be checked by looking at it.
 */
const STAR = [
  '.....#.....',
  '....###....',
  '....###....',
  '###########',
  '.#########.',
  '..#######..',
  '..#######..',
  '.###...###.',
  '.##.....##.',
  '.#.......#.',
];

function star(ink: number): IndexedImage {
  const width = STAR[0]?.length ?? 0;
  const height = STAR.length;
  const pixels = new Uint8Array(width * height).fill(INK.transparent);
  for (let y = 0; y < height; y += 1) {
    const row = STAR[y] ?? '';
    for (let x = 0; x < width; x += 1) {
      if (row[x] === '#') pixels[y * width + x] = ink;
    }
  }
  return { width, height, pixels };
}

function sprite(key: string, frames: IndexedImage[], transparent?: number): ExtractedSprite {
  const value: ExtractedSprite = { key, frames };
  if (transparent !== undefined) value.transparent = transparent;
  return value;
}

/** Builds the whole fallback atlas. Cheap enough to do at startup. */
export function buildFallbackAtlas(): Atlas {
  const sprites = new Map<string, ExtractedSprite>();
  // Horizon first, so a frame index counts upward the way altitude does.
  sprites.set(
    'sky',
    sprite('sky', [INK.sky0, INK.sky1, INK.sky2, INK.sky3, INK.sky4, INK.sky5].map(sky)),
  );
  sprites.set('star', sprite('star', [star(INK.starLit)], INK.transparent));
  sprites.set('star-dim', sprite('star-dim', [star(INK.starDim)], INK.transparent));
  sprites.set('ground', sprite('ground', [ground()]));
  sprites.set('lobby', sprite('lobby', [lobby()]));
  sprites.set('office', sprite('office', [office(0), office(1), office(2), office(3)]));
  sprites.set('condo', sprite('condo', [condo(0), condo(1)]));
  sprites.set('hotel', sprite('hotel', [hotel(0), hotel(1), hotel(2)]));
  sprites.set('elevator', sprite('elevator', [shaft()]));
  sprites.set('car', sprite('car', [car()], INK.transparent));
  sprites.set('stairs', sprite('stairs', [stairs()]));
  sprites.set('restaurant', sprite('restaurant', [restaurant(0), restaurant(1)]));
  sprites.set('shop', sprite('shop', [shop(0), shop(1), shop(2)]));
  sprites.set('fast-food', sprite('fast-food', [fastFood(0), fastFood(1)]));
  sprites.set('medical', sprite('medical', [clinic()]));
  sprites.set('parking', sprite('parking', [parking()]));
  sprites.set('theatre', sprite('theatre', [theatre(0), theatre(1), theatre(2), theatre(3)]));
  sprites.set('cinema', sprite('cinema', Array.from({ length: 10 }, (_, state) => cinema(state))));
  sprites.set(
    'people',
    sprite(
      'people',
      [
        person(INK.personA),
        person(INK.personB),
        person(INK.personC),
        person(INK.personD),
        person(INK.personAngry),
      ],
      INK.transparent,
    ),
  );

  sprites.set(
    'skyline',
    sprite('skyline', [0, 1, 2, 3, 4, 5, 6, 7].map(town), INK.transparent),
  );

  const skyPalettes = buildSkyPalettes();
  return {
    source: 'fallback',
    // The still palette, used where nothing is cycling: noon, not midnight.
    palette: skyPalettes[Math.floor(skyPalettes.length / 2)] ?? buildPalette(DAY),
    skyPalettes,
    shaftInk: INK.shaft,
    // No sounds of our own. Silence is the honest placeholder for audio, where
    // a drawn rectangle is a usable one for a sprite.
    sounds: new Map<number, Uint8Array>(),
    sprites,
  };
}
