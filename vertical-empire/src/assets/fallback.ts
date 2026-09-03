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
  const image = blank(SEGMENT_WIDTH * 4, FLOOR_HEIGHT, INK.wall);
  for (let step = 0; step < 8; step += 1) {
    fill(image, step * 4, FLOOR_HEIGHT - 5 - step * 4, 4, 3, INK.slab);
  }
  return image;
}

function person(tint: number): IndexedImage {
  const image = blank(2, 4, INK.transparent);
  fill(image, 0, 0, 2, 4, tint);
  return image;
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
  sprites.set('ground', sprite('ground', [ground()]));
  sprites.set('lobby', sprite('lobby', [lobby()]));
  sprites.set('office', sprite('office', [office(0), office(1), office(2), office(3)]));
  sprites.set('condo', sprite('condo', [condo(0), condo(1)]));
  sprites.set('hotel', sprite('hotel', [hotel(0), hotel(1), hotel(2)]));
  sprites.set('elevator', sprite('elevator', [shaft()]));
  sprites.set('car', sprite('car', [car()], INK.transparent));
  sprites.set('stairs', sprite('stairs', [stairs()]));
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

  const skyPalettes = buildSkyPalettes();
  return {
    source: 'fallback',
    // The still palette, used where nothing is cycling: noon, not midnight.
    palette: skyPalettes[Math.floor(skyPalettes.length / 2)] ?? buildPalette(DAY),
    skyPalettes,
    shaftInk: INK.shaft,
    sprites,
  };
}
