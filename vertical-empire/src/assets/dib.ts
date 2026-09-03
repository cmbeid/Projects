/**
 * Turns SimTower's two flavours of bitmap resource into indexed images.
 *
 * Neither flavour is a file you could open. `0x8002` resources are Windows
 * DIBs with the 14-byte file header stripped — that header is what a `.bmp`
 * adds, and the loader that reads them from an executable does not need it.
 * `0xFF02` resources have no header at all: they are bare 8-bit pixels in a
 * layout only the game knows, handled by `readCellStrip` below.
 *
 * Everything here returns palette indices, never RGB. See `palette.ts`.
 */

import { PALETTE_ENTRIES, paletteFromRGBQuads, type Palette } from './palette.js';

export interface IndexedImage {
  width: number;
  height: number;
  /** One byte per pixel, top-down, row-major. */
  pixels: Uint8Array;
  /** Present only when the resource carried its own colour table. */
  palette?: Palette;
}

export class BitmapFormatError extends Error {}

const HEADER_SIZE = 40; // BITMAPINFOHEADER

/**
 * Decodes a headerless `0x8002` DIB.
 *
 * Only the 8-bit uncompressed case is handled, which is every bitmap SimTower
 * ships. Rows arrive bottom-up and padded to four bytes, both of which are
 * undone here so the caller gets a plain top-down buffer.
 */
export function decodeDIB(data: Uint8Array): IndexedImage {
  if (data.byteLength < HEADER_SIZE) {
    throw new BitmapFormatError('Resource is too short to hold a bitmap header.');
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const headerSize = view.getUint32(0, true);
  if (headerSize !== HEADER_SIZE) {
    throw new BitmapFormatError(`Unsupported bitmap header size ${headerSize}; expected 40.`);
  }

  const width = view.getInt32(4, true);
  // A negative height means the rows are already top-down.
  const rawHeight = view.getInt32(8, true);
  const height = Math.abs(rawHeight);
  const topDown = rawHeight < 0;
  const bitCount = view.getUint16(14, true);
  const compression = view.getUint32(16, true);
  let paletteCount = view.getUint32(32, true);

  if (bitCount !== 8) throw new BitmapFormatError(`Unsupported colour depth ${bitCount}; expected 8.`);
  if (compression !== 0) throw new BitmapFormatError(`Unsupported compression ${compression}; expected none.`);
  if (width <= 0 || height <= 0) throw new BitmapFormatError(`Nonsensical bitmap size ${width}x${height}.`);

  // Zero means "as many as the depth allows", which for 8-bit is all 256.
  if (paletteCount === 0) paletteCount = PALETTE_ENTRIES;

  const tableBytes = paletteCount * 4;
  const pixelsAt = HEADER_SIZE + tableBytes;
  // Rows are padded out to a four-byte boundary.
  const stride = (width + 3) & ~3;
  if (pixelsAt + stride * height > data.byteLength) {
    throw new BitmapFormatError(
      `Bitmap claims ${width}x${height} but the resource holds only ${data.byteLength} bytes.`,
    );
  }

  const palette = paletteFromRGBQuads(data.subarray(HEADER_SIZE, HEADER_SIZE + tableBytes), paletteCount);
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const sourceRow = topDown ? y : height - 1 - y;
    const from = pixelsAt + sourceRow * stride;
    pixels.set(data.subarray(from, from + width), y * width);
  }

  return { width, height, pixels, palette };
}

/**
 * Reads a `0xFF02` resource: bare pixels for a run of cells.
 *
 * The game stores these as a single column eight pixels wide — one cell's 36
 * rows, then the next cell's 36 rows, and so on down. On screen those cells sit
 * side by side, so unpacking means cutting the column into `cellHeight` chunks
 * and laying them out left to right. Rows within a cell are bottom-up, like any
 * other Windows bitmap of the era.
 *
 * That 8x36 cell is the whole reason SimTower looks the way it does, so the
 * dimensions are parameters rather than constants only in the sense that the
 * tests can vary them; the game itself never does.
 */
export function readCellStrip(data: Uint8Array, cellWidth: number, cellHeight: number): IndexedImage {
  const cellPixels = cellWidth * cellHeight;
  if (cellPixels <= 0) throw new BitmapFormatError('Cell dimensions must be positive.');

  const cells = Math.floor(data.byteLength / cellPixels);
  if (cells === 0) {
    throw new BitmapFormatError(
      `Resource holds ${data.byteLength} bytes, less than one ${cellWidth}x${cellHeight} cell.`,
    );
  }

  const width = cells * cellWidth;
  const pixels = new Uint8Array(width * cellHeight);

  for (let i = 0; i < cells * cellPixels; i += 1) {
    const sourceX = i % cellWidth;
    const sourceY = Math.floor(i / cellWidth);
    const cell = Math.floor(sourceY / cellHeight);
    const x = cell * cellWidth + sourceX;
    const y = cellHeight - 1 - (sourceY % cellHeight);
    pixels[y * width + x] = data[i] ?? 0;
  }

  return { width, height: cellHeight, pixels };
}

/** Copies a rectangle out of an indexed image. Out-of-bounds reads come back as 0. */
export function crop(
  image: IndexedImage,
  x: number,
  y: number,
  width: number,
  height: number,
): IndexedImage {
  const pixels = new Uint8Array(width * height);
  for (let row = 0; row < height; row += 1) {
    const sourceY = y + row;
    if (sourceY < 0 || sourceY >= image.height) continue;
    for (let column = 0; column < width; column += 1) {
      const sourceX = x + column;
      if (sourceX < 0 || sourceX >= image.width) continue;
      pixels[row * width + column] = image.pixels[sourceY * image.width + sourceX] ?? 0;
    }
  }
  return { width, height, pixels };
}
