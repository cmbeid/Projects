import { describe, expect, it } from 'vitest';

import { NotAnExecutableError, readResources } from '../src/assets/ne.js';
import { BitmapFormatError, crop, decodeDIB, inferCellHeight, readCellStrip } from '../src/assets/dib.js';
import { CYCLE_GROUPS, decodePalette, mixPalettes, nearestIndex, rotateCycles } from '../src/assets/palette.js';
import { inkColumns } from '../src/assets/frames.js';
import {
  FLOOR_HEIGHT,
  ROOM_HEIGHT,
  SEGMENT_WIDTH,
  TYPE_BITMAP,
  TYPE_PALETTE,
  extract,
  varyingBox,
} from '../src/assets/slice.js';
import { buildOriginalAtlas } from '../src/assets/original.js';
import { buildCellStrip, buildDIB, buildNE, buildPaletteResource } from './fixtures.js';


describe('NE resources', () => {
  it('reads every resource back out, keyed by raw type and id', () => {
    const spec = new Map([
      [TYPE_BITMAP, new Map([[0x85a8, Uint8Array.from([1, 2, 3])], [0x85a9, Uint8Array.from([4, 5])]])],
      [TYPE_PALETTE, new Map([[0x83e8, Uint8Array.from([9])]])],
    ]);

    const resources = readResources(buildNE(spec));

    expect([...resources.keys()].sort()).toEqual([TYPE_BITMAP, TYPE_PALETTE].sort());
    // Lengths round up to the table's alignment, so compare the leading bytes.
    expect(resources.get(TYPE_BITMAP)?.get(0x85a8)?.subarray(0, 3)).toEqual(Uint8Array.from([1, 2, 3]));
    expect(resources.get(TYPE_BITMAP)?.get(0x85a9)?.subarray(0, 2)).toEqual(Uint8Array.from([4, 5]));
    expect(resources.get(TYPE_PALETTE)?.get(0x83e8)?.[0]).toBe(9);
  });

  it('refuses anything that is not a 16-bit Windows executable', () => {
    expect(() => readResources(new Uint8Array(8))).toThrow(NotAnExecutableError);

    // A DOS program with no Windows half — which is what a compressed EX_ looks
    // like before it is expanded.
    const dosOnly = new Uint8Array(128);
    new DataView(dosOnly.buffer).setUint16(0, 0x5a4d, true);
    new DataView(dosOnly.buffer).setUint32(0x3c, 64, true);
    expect(() => readResources(dosOnly)).toThrow(/16-bit Windows/);
  });
});

describe('bitmaps', () => {
  it('decodes a headerless DIB right way up', () => {
    // Encode the row into the pixel, so an upside-down read is unmistakable.
    const image = decodeDIB(buildDIB(6, 4, (_x, y) => y + 1));

    expect(image.width).toBe(6);
    expect(image.height).toBe(4);
    expect(image.pixels[0]).toBe(1); // top row
    expect(image.pixels[3 * 6]).toBe(4); // bottom row
  });

  it('undoes the four-byte row padding', () => {
    // Width 6 pads to a stride of 8, so an unpadded read would drift sideways.
    const image = decodeDIB(buildDIB(6, 3, (x) => x + 1));
    for (let y = 0; y < 3; y += 1) {
      expect([...image.pixels.subarray(y * 6, y * 6 + 6)]).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });

  it('rejects depths and compressions SimTower never uses', () => {
    const bytes = buildDIB(4, 4, () => 0);
    new DataView(bytes.buffer).setUint16(14, 24, true);
    expect(() => decodeDIB(bytes)).toThrow(BitmapFormatError);
  });

  it('lays a stacked cell column out side by side', () => {
    // Three cells, each a flat block of its own index.
    const strip = readCellStrip(
      buildCellStrip(3, SEGMENT_WIDTH, FLOOR_HEIGHT, (cell) => cell + 1),
      SEGMENT_WIDTH,
      FLOOR_HEIGHT,
    );

    expect(strip.width).toBe(3 * SEGMENT_WIDTH);
    expect(strip.height).toBe(FLOOR_HEIGHT);
    expect(strip.pixels[0]).toBe(1);
    expect(strip.pixels[SEGMENT_WIDTH]).toBe(2);
    expect(strip.pixels[SEGMENT_WIDTH * 2]).toBe(3);
  });

  it('flips each cell the right way up', () => {
    const strip = readCellStrip(
      buildCellStrip(1, SEGMENT_WIDTH, FLOOR_HEIGHT, (_cell, _x, y) => (y === 0 ? 200 : 5)),
      SEGMENT_WIDTH,
      FLOOR_HEIGHT,
    );
    expect(strip.pixels[0]).toBe(200);
    expect(strip.pixels[SEGMENT_WIDTH]).toBe(5);
  });

  it('crops without reading past the edges', () => {
    const image = decodeDIB(buildDIB(8, 8, (x, y) => x + y * 8));
    const patch = crop(image, 6, 6, 4, 4);
    expect(patch.width).toBe(4);
    expect(patch.pixels[0]).toBe((6 + 6 * 8) & 0xff);
    // Two columns of the crop lie outside the source and come back empty.
    expect(patch.pixels[2]).toBe(0);
  });
});

describe('palettes', () => {
  it('pulls red, green and blue from the widened entry', () => {
    const palette = decodePalette(buildPaletteResource((i) => [i, 255 - i, (i * 2) & 0xff]));
    expect(palette[10 * 4 + 0]).toBe(10);
    expect(palette[10 * 4 + 1]).toBe(245);
    expect(palette[10 * 4 + 2]).toBe(20);
    expect(palette[10 * 4 + 3]).toBe(255);
  });

  it('rotates the cycling indices among themselves and leaves the rest alone', () => {
    const palette = decodePalette(buildPaletteResource((i) => [i, i, i]));
    const group = CYCLE_GROUPS[0];
    if (!group) throw new Error('no cycle groups');
    const [first, second] = group;
    if (first === undefined || second === undefined) throw new Error('short cycle group');

    const before = palette[first * 4] ?? 0;
    const untouched = palette[100 * 4] ?? 0;
    rotateCycles(palette, 1);

    expect(palette[first * 4]).toBe(second);
    expect(palette[second * 4]).toBe(before);
    expect(palette[100 * 4]).toBe(untouched);
  });

  it('mixes toward the far palette', () => {
    const day = decodePalette(buildPaletteResource(() => [200, 200, 200]));
    const night = decodePalette(buildPaletteResource(() => [0, 0, 0]));
    expect(mixPalettes(day, night, 0)[0]).toBe(200);
    expect(mixPalettes(day, night, 1)[0]).toBe(0);
    expect(mixPalettes(day, night, 0.5)[0]).toBe(100);
  });
});

describe('extraction', () => {
  it('cuts a sheet into its states and reports what it could not find', () => {
    const spec = new Map([
      [
        TYPE_BITMAP,
        new Map([
          // One office sheet: four states across, one floor tall.
          [0x85a8, buildDIB(SEGMENT_WIDTH * 9 * 4, FLOOR_HEIGHT, (x) => Math.floor(x / (SEGMENT_WIDTH * 9)) + 1)],
        ]),
      ],
      [TYPE_PALETTE, new Map([[0x83e8, buildPaletteResource((i) => [i, i, i])]])],
    ]);

    const { sprites, problems, palette } = extract(readResources(buildNE(spec)));

    const office = sprites.get('office');
    expect(office?.frames).toHaveLength(4);
    expect(office?.frames[0]?.width).toBe(SEGMENT_WIDTH * 9);
    // Each state carries its own index, so a mis-ordered cut is visible.
    expect(office?.frames[0]?.pixels[0]).toBe(1);
    expect(office?.frames[3]?.pixels[0]).toBe(4);

    expect(palette[7 * 4]).toBe(7);
    // Everything else in the catalogue is absent from this fixture and is
    // reported rather than silently dropped.
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.some((problem) => problem.key === 'sky')).toBe(true);
  });

  it('survives a copy whose resource ids do not match the catalogue', () => {
    const spec = new Map([[TYPE_BITMAP, new Map([[0x0001, buildDIB(8, 8, () => 1)]])]]);
    const { sprites, problems } = extract(readResources(buildNE(spec)));
    expect(sprites.size).toBe(0);
    expect(problems.length).toBeGreaterThan(0);
  });
});

describe('the PNG dump', () => {
  it('writes a file an image viewer will accept', async () => {
    const { encodePNG } = await import('../scripts/png.js');
    const palette = new Uint8Array(256 * 4);
    palette.set([255, 128, 0, 255], 3 * 4);

    const png = encodePNG(4, 2, new Uint8Array(8).fill(3), palette);
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);

    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(view.getUint32(16)).toBe(4); // width, from the IHDR
    expect(view.getUint32(20)).toBe(2); // height
    expect(String.fromCharCode(...png.subarray(png.byteLength - 8, png.byteLength - 4))).toBe('IEND');
  });
});

describe('cell heights', () => {
  it('works out the cell height from the resource length', () => {
    // The real game's strips are 32 tall, which is what sent the first
    // catalogue wrong: a floor is 36, but the art on it is not.
    expect(inferCellHeight(8 * 32 * 140, SEGMENT_WIDTH)).toBe(32);
    // 36 wins when it fits, since a full-floor strip is the less surprising case.
    expect(inferCellHeight(8 * 36 * 5, SEGMENT_WIDTH)).toBe(36);
    // A prime-ish length divides by nothing sensible.
    expect(inferCellHeight(8 * 37, SEGMENT_WIDTH)).toBeUndefined();
  });

  it('unpacks a strip at an inferred height', () => {
    const strip = readCellStrip(buildCellStrip(4, SEGMENT_WIDTH, 32, (cell) => cell + 1), SEGMENT_WIDTH);
    expect(strip.height).toBe(32);
    expect(strip.width).toBe(4 * SEGMENT_WIDTH);
    expect(strip.pixels[0]).toBe(1);
    expect(strip.pixels[SEGMENT_WIDTH * 3]).toBe(4);
  });

  it('says so rather than guessing when nothing divides', () => {
    expect(() => readCellStrip(new Uint8Array(8 * 37), SEGMENT_WIDTH)).toThrow(/not a whole number/);
  });
});

describe('the corrected catalogue', () => {
  it('cuts an office sheet into nine-segment, room-height frames', () => {
    // 288x24 is what the real file holds: four states of nine segments.
    const spec = new Map([
      [TYPE_BITMAP, new Map([[0x85a8, buildDIB(288, ROOM_HEIGHT, (x) => Math.floor(x / 72) + 1)]])],
      [TYPE_PALETTE, new Map([[0x83e8, buildPaletteResource((i) => [i, i, i])]])],
    ]);

    const office = extract(readResources(buildNE(spec))).sprites.get('office');
    expect(office?.frames).toHaveLength(4);
    expect(office?.frames[0]?.width).toBe(9 * SEGMENT_WIDTH);
    expect(office?.frames[0]?.height).toBe(ROOM_HEIGHT);
    expect(office?.frames[3]?.pixels[0]).toBe(4);
  });

  it('takes condos one per resource rather than as a sheet', () => {
    const condos = new Map<number, Uint8Array>();
    for (let id = 0x8628; id <= 0x8636; id += 1) condos.set(id, buildDIB(128, ROOM_HEIGHT, () => id & 0xff));
    const spec = new Map([[TYPE_BITMAP, condos]]);

    const condo = extract(readResources(buildNE(spec))).sprites.get('condo');
    // Five states across three variants, stored as fifteen separate bitmaps.
    expect(condo?.frames).toHaveLength(15);
    expect(condo?.frames[0]?.width).toBe(16 * SEGMENT_WIDTH);
  });

  it('reads stairs as a bitmap, which is what they actually are', () => {
    // The first catalogue had these as cell strips at the same IDs, which is
    // why they came back "not found" against a real copy.
    const spec = new Map([[TYPE_BITMAP, new Map([[0x8968, buildDIB(448, ROOM_HEIGHT, () => 3)]])]]);
    const { sprites, problems } = extract(readResources(buildNE(spec)));

    expect(sprites.get('stairs')?.frames).toHaveLength(7);
    expect(sprites.get('stairs')?.frames[0]?.width).toBe(64);
    expect(problems.some((problem) => problem.key === 'stairs')).toBe(false);
  });
});

describe('drawing from a real-shaped file', () => {
  /** A stand-in with the shapes the real SIMTOWER.EXE reports. */
  function mimic(): Uint8Array {
    const bitmaps = new Map<number, Uint8Array>();
    const put = (id: number, w: number, h: number, ink: (x: number, y: number) => number) =>
      bitmaps.set(id, buildDIB(w, h, ink));

    // 0x8351 is soil, not sky, so it carries a different index: a range that
    // swallows it shows up as a sky band that is the wrong colour.
    put(0x8351, 32, 360, () => 9);
    for (let id = 0x8352; id <= 0x835b; id += 1) put(id, 32, 360, () => 60);
    for (let id = 0x85a8; id <= 0x85aa; id += 1) put(id, 288, ROOM_HEIGHT, (x) => Math.floor(x / 72) + 1);
    // The half-width sheet next door, which is not an office however much it
    // looks like one in a thumbnail.
    put(0x85ab, 144, ROOM_HEIGHT, () => 5);
    // People: a figure on a background, so the corner index is the see-through one.
    for (let id = 0x82bc; id <= 0x82bf; id += 1) put(id, 96, ROOM_HEIGHT, (x, y) => (y > 8 && x % 8 > 2 ? 200 : 77));

    const cells = new Map<number, Uint8Array>();
    for (let id = 0x89e8; id <= 0x89ea; id += 1) {
      // 140 cells, each carrying its own index so a mis-cut shows up.
      cells.set(id, buildCellStrip(140, SEGMENT_WIDTH, 32, (cell) => (cell % 200) + 1));
    }

    return buildNE(
      new Map([
        [TYPE_BITMAP, bitmaps],
        [0xff02, cells],
        [TYPE_PALETTE, new Map([[0x83e8, buildPaletteResource((i) => [i, i, i])]])],
      ]),
    );
  }

  it('cuts the town strip into single-segment frames', async () => {
    const { buildOriginalAtlas } = await import('../src/assets/original.js');
    const skyline = buildOriginalAtlas(mimic()).atlas.sprites.get('skyline');

    // One resource of 140 cells. Drawn whole at a one-segment placement, a
    // 1120px strip smears across the entire ground floor — hence the cutting.
    //
    // And one, not the three that sit together in the file: appending their
    // cells made the street run as a coherent panorama for a hundred and forty
    // segments and then turn into something else, which only showed once the
    // lot grew wider than a single strip.
    expect(skyline?.frames).toHaveLength(140);
    expect(skyline?.frames[0]?.width).toBe(SEGMENT_WIDTH);
    expect(skyline?.frames[0]?.height).toBe(32);
    // Consecutive frames are consecutive cells, so the panorama runs across.
    expect(skyline?.frames[1]?.pixels[0]).toBe(2);
  });

  it('cuts offices at nine segments, and leaves the half-width sheet alone', async () => {
    const { buildOriginalAtlas } = await import('../src/assets/original.js');
    const office = buildOriginalAtlas(mimic()).atlas.sprites.get('office');

    // Three sheets of four states. Taking in 0x85ab as a fourth sheet added
    // four frames of 36px — four and a half segments — to a facility the world
    // declares nine segments wide.
    expect(office?.frames).toHaveLength(12);
    for (const frame of office?.frames ?? []) expect(frame.width).toBe(9 * SEGMENT_WIDTH);
  });

  it('keeps the soil tile out of the sky and gives it to the ground', async () => {
    const { buildOriginalAtlas } = await import('../src/assets/original.js');
    const { sprites } = buildOriginalAtlas(mimic()).atlas;

    // Ten bands, not eleven. 0x8351 sat at the bottom of the range and painted
    // a stripe of dirt across the horizon.
    expect(sprites.get('sky')?.frames).toHaveLength(10);
    for (const frame of sprites.get('sky')?.frames ?? []) expect(frame.pixels[0]).toBe(60);

    // And it is what the basements are drawn against: `ground` is the key
    // `render/scene.ts` already tiles below the horizon.
    expect(sprites.get('ground')?.frames[0]?.pixels[0]).toBe(9);
  });

  it('takes the see-through index from the sprite rather than assuming zero', async () => {
    const { buildOriginalAtlas } = await import('../src/assets/original.js');
    const people = buildOriginalAtlas(mimic()).atlas.sprites.get('people');
    // 77 is the background these were drawn with; assuming 0 gave every person
    // a solid rectangle behind them.
    expect(people?.transparent).toBe(77);
  });

  it('reports no problems for the shapes a real copy actually has', async () => {
    const { buildOriginalAtlas } = await import('../src/assets/original.js');
    const { problems, atlas } = buildOriginalAtlas(mimic());
    // Only the entries this fixture leaves out should be missing.
    const missing = problems.map((problem) => problem.key).sort();
    expect(missing).not.toContain('office');
    expect(missing).not.toContain('skyline');
    expect(atlas.skyPalettes.length).toBeGreaterThan(1);
  });
});

describe('frame analysis', () => {
  it('finds the grid and the figure height in a sheet', async () => {
    const { analyse } = await import('../scripts/frames.js');
    // Twelve 8px frames, a 1px gutter each, figure only in the bottom half.
    const sheet = decodeDIB(
      buildDIB(96, 24, (x, y) => {
        if (x % 8 === 7) return 77;
        return y < 12 ? 77 : 9;
      }),
    );

    const report = analyse(sheet);
    expect(report.background).toBe(77);
    expect(report.inkColumns).toHaveLength(12);
    expect(report.widths[0]).toEqual({ width: 7, count: 12 });
    // The measurement that matters: a 24px sheet holding 12px figures is why
    // people looked twice the size they should.
    expect(report.inkRows[0]?.from).toBe(12);
    expect(report.inkRows[report.inkRows.length - 1]?.to).toBe(23);
  });

  it('treats a sheet with no gutters as one run', async () => {
    const { analyse } = await import('../scripts/frames.js');
    const solid = decodeDIB(buildDIB(32, 8, (x) => (x === 0 ? 5 : 6)));
    // Corner sets the background, so everything but column 0 is ink.
    expect(analyse(solid).inkColumns).toEqual([{ from: 1, to: 31 }]);
  });
});

describe('contact sheet labels', () => {
  it('writes a legible glyph and leaves the rest of the buffer alone', async () => {
    const { GLYPH_HEIGHT, GLYPH_WIDTH, drawText } = await import('../scripts/label.js');
    const width = 16;
    const height = 8;
    const pixels = new Uint8Array(width * height);

    drawText(pixels, width, height, '1', 1, 1, 9);

    // '1' is drawn in a 3x5 box at (1,1); nothing outside it may be touched.
    let ink = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const set = pixels[y * width + x] === 9;
        if (set) ink += 1;
        if (set) {
          expect(x).toBeGreaterThanOrEqual(1);
          expect(x).toBeLessThan(1 + GLYPH_WIDTH);
          expect(y).toBeGreaterThanOrEqual(1);
          expect(y).toBeLessThan(1 + GLYPH_HEIGHT);
        }
      }
    }
    expect(ink).toBeGreaterThan(4);
  });

  it('clips at the edges instead of wrapping onto the next row', async () => {
    const { drawText } = await import('../scripts/label.js');
    const width = 8;
    const pixels = new Uint8Array(width * 8);
    drawText(pixels, width, 8, '8888', 6, 0, 3);
    // The glyph's third column falls past the right edge; without the bounds
    // check it would land in column 0 of the row below.
    for (let y = 0; y < 8; y += 1) expect(pixels[y * width]).toBe(0);
  });
});

describe('resource id arguments', () => {
  it('reads a token as hex and, where it could be, as decimal too', async () => {
    const { candidates } = await import('../scripts/frames.js');
    // npm rewrites `0x82bc` to `33468` before the script sees it, so a bare
    // decimal has to be tried alongside the hex reading. Which was meant is
    // settled by looking both up in the file.
    expect(candidates('0x82bc')).toEqual([0x82bc]);
    expect(candidates('33468')).toEqual([0x33468, 33468]);
    expect(candidates('82bc')).toEqual([0x82bc]);
    expect(candidates('zz')).toEqual([]);
  });

  it('splits and trims a comma-separated list', async () => {
    const { parseIdTokens } = await import('../scripts/frames.js');
    expect(parseIdTokens(' 0x8428, 33468 ,, 89e8 ')).toEqual(['0x8428', '33468', '89e8']);
  });
});

describe('measuring how a sheet divides', () => {
  it('finds the frame width of a sheet of near-identical states', async () => {
    const { periods } = await import('../src/assets/frames.js');
    // Four 72px states of the same room: same walls and windows, differing
    // only in how much furniture is in them. That is what an office sheet is.
    const sheet = decodeDIB(
      buildDIB(288, 24, (x, y) => {
        const withinFrame = x % 72;
        const state = Math.floor(x / 72);
        if (withinFrame < 2) return 40; // the party wall, in every state
        if (y > 6 && y < 16 && withinFrame % 12 < 4) return 90; // windows
        // Desks: the only thing that changes between states.
        return y > 18 && withinFrame > 8 && withinFrame < 8 + state * 12 ? 120 : 200;
      }),
    );

    const table = periods(sheet, SEGMENT_WIDTH, SEGMENT_WIDTH * 4);
    const best = table.reduce((a, b) => (b.mismatch < a.mismatch ? b : a));
    expect(best.width).toBe(72);
    expect(best.frames).toBe(4);

    // And the wrong readings are visibly worse, not marginally so — otherwise
    // the table cannot be read with any confidence.
    for (const entry of table.filter((candidate) => candidate.width !== 72)) {
      expect(entry.mismatch).toBeGreaterThan(best.mismatch * 2);
    }
  });

  it('declines a dense sheet rather than naming its second harmonic', async () => {
    const { REPEATS_BELOW, bestPeriod, periods } = await import('../src/assets/frames.js');
    // The failure that mattered, rebuilt from the numbers it produced. Eight
    // 32px states alternating in pairs — lit, dark, lit, dark — which is how
    // the real hotel sheets are laid out. Lag 32 compares lit against dark and
    // lag 64 compares lit against lit, so twice the true width scores better
    // than the truth; the first version of this reported 64 and sounded
    // certain. The mix below lands on 78% and 60%, which is what 0x84a9 gave.
    const sheet = decodeDIB(
      buildDIB(256, 24, (x, y) => {
        const withinFrame = x % 32;
        const frame = Math.floor(x / 32);
        const bucket = (withinFrame * 31 + y * 17) % 100;
        if (bucket < 22) return ((withinFrame * 3 + y) % 90) + 1; // shared by every state
        if (bucket < 40) return frame % 2 === 0 ? 150 : 190; // the lit/dark pair
        return ((withinFrame * 7 + y * 13 + frame * 37) % 90) + 60; // this frame only
      }),
    );

    const table = periods(sheet, SEGMENT_WIDTH, SEGMENT_WIDTH * 4);
    const lowest = table.reduce((a, b) => (b.mismatch < a.mismatch ? b : a));

    // Twice the frame width still scores best; the metric cannot help that.
    // What matters is that it is nowhere near good enough to be believed.
    expect(lowest.width).toBe(64);
    expect(lowest.mismatch).toBeGreaterThan(REPEATS_BELOW);
    expect(bestPeriod(table)).toBeUndefined();
  });

  it('takes the narrowest of the readings that hold, not the very lowest', async () => {
    const { bestPeriod, periods } = await import('../src/assets/frames.js');
    // A sheet that repeats every 64px also repeats every 128 and 256. All three
    // score well and the widest can score best; the frame is still 64.
    const sheet = decodeDIB(buildDIB(256, 24, (x, y) => (((x % 64) * 5 + y * 3) % 240) + 1));

    const table = periods(sheet, SEGMENT_WIDTH, SEGMENT_WIDTH * 4);
    expect(bestPeriod(table)?.width).toBe(64);
    expect(bestPeriod(table)?.frames).toBe(4);
  });

  it('ignores rows of a single index, which agree at every lag', async () => {
    const { periods } = await import('../src/assets/frames.js');
    // Half the sheet is flat background. Counting those rows would halve every
    // score equally and drag a hopeless sheet under any threshold.
    const sheet = decodeDIB(
      buildDIB(128, 24, (x, y) => (y < 12 ? 7 : ((x * 31) % 251) + 1)),
    );

    const table = periods(sheet, SEGMENT_WIDTH, SEGMENT_WIDTH * 4);
    for (const entry of table) {
      expect(entry.mismatch).toBeGreaterThan(0.5);
      // The flat rows are still reported, just not averaged in.
      expect(entry.rows).toHaveLength(24);
      expect(entry.rows[0]).toBe(0);
    }
  });

  it('offers only divisions into whole frames of whole segments', async () => {
    const { periods } = await import('../src/assets/frames.js');
    const sheet = decodeDIB(buildDIB(288, 24, () => 1));
    const widths = periods(sheet, SEGMENT_WIDTH, SEGMENT_WIDTH * 4).map((entry) => entry.width);

    // Divisors of 288 that are a multiple of 8 and at least 32. Notably not 36:
    // it divides 288 but is not a whole number of segments.
    expect(widths).toEqual([32, 48, 72, 96, 144]);
  });

  it('says nothing divides a sheet narrower than one frame', async () => {
    const { periods } = await import('../src/assets/frames.js');
    const single = decodeDIB(buildDIB(32, 24, () => 1));
    expect(periods(single, SEGMENT_WIDTH, SEGMENT_WIDTH * 4)).toEqual([]);
  });
});

describe('the extractor\u2019s arguments', () => {
  it('finds the file when it is the only argument', async () => {
    const { parseArgs } = await import('../scripts/frames.js');
    // The regression this exists to stop: `indexOf` gives -1 for an absent
    // flag, and -1 + 1 is 0, so the check that skips a flag's value claimed
    // argument zero and the plain run could not find its own filename.
    expect(parseArgs(['SIMTOWER.EXE']).path).toBe('SIMTOWER.EXE');
    expect(parseArgs(['--all', 'SIMTOWER.EXE']).all).toBe(true);
  });

  it('does not mistake a flag\u2019s value for the file', async () => {
    const { parseArgs } = await import('../scripts/frames.js');
    const framed = parseArgs(['--frames', '0x82bc', 'SIMTOWER.EXE']);
    expect(framed.path).toBe('SIMTOWER.EXE');
    expect(framed.framesIds).toEqual(['0x82bc']);

    const windowed = parseArgs(['--window', '0,160', '--contact', '0x89e8', 'SIMTOWER.EXE']);
    expect(windowed.path).toBe('SIMTOWER.EXE');
    expect(windowed.window).toEqual({ from: 0, to: 160 });
    expect(windowed.contactIds).toEqual(['0x89e8']);
  });

  it('lets --sweep take a size or not', async () => {
    const { parseArgs } = await import('../scripts/frames.js');
    // With a size, the number is the flag's value and the file follows.
    const sized = parseArgs(['--sweep', '32', 'SIMTOWER.EXE']);
    expect(sized).toMatchObject({ sweep: true, peek: 32, path: 'SIMTOWER.EXE' });

    // Without one, the next argument is the file and the default stands.
    const bare = parseArgs(['--sweep', 'SIMTOWER.EXE']);
    expect(bare).toMatchObject({ sweep: true, peek: 40, path: 'SIMTOWER.EXE' });
  });

  it('reports no path when there is none, rather than inventing one', async () => {
    const { parseArgs } = await import('../scripts/frames.js');
    expect(parseArgs([]).path).toBeUndefined();
    expect(parseArgs(['--sweep', '32']).path).toBeUndefined();
  });
});

describe('cutting by ink', () => {
  it('finds frames of different widths that a grid would slice apart', () => {
    // Three figures, 5px, 8px and 11px wide, separated by background — the
    // shape the real people sheet turns out to have.
    const spans = [
      { from: 1, width: 5 },
      { from: 9, width: 8 },
      { from: 20, width: 11 },
    ];
    const sheet = decodeDIB(
      buildDIB(40, ROOM_HEIGHT, (x, y) =>
        y >= 4 && spans.some((span) => x >= span.from && x < span.from + span.width) ? 9 : 1,
      ),
    );

    const runs = inkColumns(sheet, 1);
    expect(runs.map((run) => run.to - run.from + 1)).toEqual([5, 8, 11]);
  });

  it('cuts the people sheet by ink rather than into equal columns', () => {
    const sheet = buildDIB(96, ROOM_HEIGHT, (x, y) => {
      // Six 5px figures then a wider clump, all on a background of 1.
      const narrow = x < 48 && x % 8 < 5;
      const clump = x >= 60 && x < 71;
      return y >= 3 && (narrow || clump) ? 9 : 1;
    });
    const spec = new Map([[TYPE_BITMAP, new Map([[0x82bc, sheet]])]]);

    const people = extract(readResources(buildNE(spec))).sprites.get('people');
    // Six narrow figures and one clump: seven frames, not twelve equal slices.
    expect(people?.frames).toHaveLength(7);
    expect(people?.frames[0]?.width).toBe(5);
    expect(people?.frames[6]?.width).toBe(11);
    // Background comes from the corner, so the figures composite cleanly.
    expect(people?.transparent).toBe(1);
  });
});

/**
 * A digit sheet in SimTower's own layout: cells of a fixed pitch, each carrying
 * furniture that every cell shares — a rule down the right edge and a band
 * across the top — with only the glyph differing. This is the shape that makes
 * an equal-cells cut wrong, so it is the shape the fixture has to have.
 */
function buildDigitSheet(cells: number, pitch: number, height: number): Uint8Array {
  return buildDIB(cells * pitch, height, (x, y) => {
    const cell = Math.floor(x / pitch);
    const within = x % pitch;
    if (within === pitch - 1) return 5; // the hairline, identical in every cell
    if (y < 2) return 6; // the slab band, identical in every cell
    // The glyph: a block whose height encodes which cell it is.
    const inGlyph = y >= 16 && y < 16 + 12 && within >= 2 && within < 2 + 10;
    return inGlyph && cell % 2 === 0 ? 9 : inGlyph ? 8 : 17;
  });
}

describe('cutting glyphs out of a sheet', () => {
  it('finds the box that differs between cells and ignores the shared furniture', () => {
    const sheet = decodeDIB(buildDigitSheet(10, 16, 36));
    const box = varyingBox(sheet, 16);
    // The rule at column 15 and the band across rows 0-1 are in every cell, so
    // neither is part of the box; the glyph block is all that is left.
    expect(box).toEqual({ x: 2, y: 16, width: 10, height: 12 });
  });

  it('refuses a sheet whose cells are all identical', () => {
    const same = decodeDIB(buildDIB(64, 36, (x) => (x % 16 === 15 ? 5 : 17)));
    expect(varyingBox(same, 16)).toBeUndefined();
    // A single cell has nothing to be compared against.
    expect(varyingBox(decodeDIB(buildDIB(16, 36, () => 1)), 16)).toBeUndefined();
  });

  it('extracts the digits trimmed, and records where they sat', () => {
    const spec = new Map([[TYPE_BITMAP, new Map([[0x87e9, buildDigitSheet(10, 16, FLOOR_HEIGHT)]])]]);
    const digits = extract(readResources(buildNE(spec))).sprites.get('digits');

    expect(digits?.frames).toHaveLength(10);
    expect(digits?.frames[0]?.width).toBe(10);
    expect(digits?.frames[0]?.height).toBe(12);
    // None of the shared furniture survives the cut.
    for (const frame of digits?.frames ?? []) {
      expect([...frame.pixels]).not.toContain(5);
      expect([...frame.pixels]).not.toContain(6);
    }
    // The origin is what lets the renderer put a trimmed glyph back where it
    // belongs on the floor, rather than guessing an offset.
    expect(digits?.origin).toEqual({ x: 2, y: 16 });
  });
});

describe('drawing into somebody else’s palette', () => {
  it('takes the nearest entry that exists, and honours the skip list', () => {
    const palette = decodePalette(
      buildPaletteResource((index) => (index === 3 ? [250, 250, 250] : index === 7 ? [200, 200, 200] : [0, 0, 0])),
    );
    expect(nearestIndex(palette, 255, 255, 255)).toBe(3);
    expect(nearestIndex(palette, 255, 255, 255, [3])).toBe(7);
  });

  it('gives the tower a lobby even though no bitmap is one', () => {
    // The catalogue has no lobby entry — every candidate in the file turned out
    // to be something else — so the atlas draws one rather than leaving the
    // ground floor as a hole the renderer fills with shaft ink.
    const spec = new Map([
      [TYPE_BITMAP, new Map([[0x85a8, buildDIB(288, ROOM_HEIGHT, () => 3)]])],
      [TYPE_PALETTE, new Map([[0x83e8, buildPaletteResource((i) => [i, i, i])]])],
    ]);
    const { atlas } = buildOriginalAtlas(buildNE(spec));

    const lobby = atlas.sprites.get('lobby');
    expect(lobby?.frames).toHaveLength(1);
    expect(lobby?.frames[0]?.width).toBe(SEGMENT_WIDTH);
    expect(lobby?.frames[0]?.height).toBe(ROOM_HEIGHT);
    // Sampled from the supplied palette, not from our own ink table, and light
    // enough to read as a concourse rather than as more shaft.
    const pixels = lobby?.frames[0]?.pixels ?? new Uint8Array();
    expect(pixels[0]).toBeGreaterThan(atlas.shaftInk);
    // The bottom row is what the scene repeats down into the slab, so it must
    // not be the skirting shadow.
    const last = pixels[pixels.length - 1] ?? 0;
    expect(last).not.toBe(atlas.shaftInk);
  });
});
