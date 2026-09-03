import { describe, expect, it } from 'vitest';

import { NotAnExecutableError, readResources } from '../src/assets/ne.js';
import { BitmapFormatError, crop, decodeDIB, readCellStrip } from '../src/assets/dib.js';
import { CYCLE_GROUPS, decodePalette, mixPalettes, rotateCycles } from '../src/assets/palette.js';
import { FLOOR_HEIGHT, SEGMENT_WIDTH, TYPE_BITMAP, TYPE_PALETTE, extract } from '../src/assets/slice.js';
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
