import { describe, expect, it } from 'vitest';

import { NotAnExecutableError, readResources } from '../src/assets/ne.js';
import { BitmapFormatError, crop, decodeDIB, inferCellHeight, readCellStrip } from '../src/assets/dib.js';
import { CYCLE_GROUPS, decodePalette, mixPalettes, rotateCycles } from '../src/assets/palette.js';
import { FLOOR_HEIGHT, ROOM_HEIGHT, SEGMENT_WIDTH, TYPE_BITMAP, TYPE_PALETTE, extract } from '../src/assets/slice.js';
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

    for (let id = 0x8351; id <= 0x835b; id += 1) put(id, 32, 360, () => 60);
    for (let id = 0x85a8; id <= 0x85aa; id += 1) put(id, 288, ROOM_HEIGHT, (x) => Math.floor(x / 72) + 1);
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

  it('cuts a lobby strip into single-segment frames', async () => {
    const { buildOriginalAtlas } = await import('../src/assets/original.js');
    const lobby = buildOriginalAtlas(mimic()).atlas.sprites.get('lobby');

    // Three resources of 140 cells each. Drawn whole at a one-segment
    // placement, a 1120px strip smears across the entire ground floor.
    expect(lobby?.frames).toHaveLength(3 * 140);
    expect(lobby?.frames[0]?.width).toBe(SEGMENT_WIDTH);
    expect(lobby?.frames[0]?.height).toBe(32);
    // Consecutive frames are consecutive cells, so a lobby reads as a frontage.
    expect(lobby?.frames[1]?.pixels[0]).toBe(2);
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
    expect(missing).not.toContain('lobby');
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
