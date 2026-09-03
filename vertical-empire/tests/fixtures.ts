/**
 * Synthetic stand-ins for the real thing.
 *
 * The extractor has to be tested against an executable, and the only
 * executable that matters is one we cannot put in a public repository. So the
 * tests build their own: a minimal but structurally honest NE file, and
 * bitmaps in the same layouts SimTower uses. If the parser can read these it is
 * reading the format, not a particular file.
 */

const ALIGN_SHIFT = 4;
const ALIGN = 1 << ALIGN_SHIFT;
const MZ_SIZE = 64;
const NE_SIZE = 64;

export type ResourceSpec = Map<number, Map<number, Uint8Array>>;

function alignUp(value: number): number {
  return Math.ceil(value / ALIGN) * ALIGN;
}

/** Assembles a 16-bit Windows executable holding exactly these resources. */
export function buildNE(resources: ResourceSpec): Uint8Array {
  const types = [...resources.entries()];
  const tableSize =
    2 + types.reduce((total, [, byId]) => total + 8 + byId.size * 12, 0) + 2;

  const neOffset = MZ_SIZE;
  const tableOffset = neOffset + NE_SIZE;
  let dataAt = alignUp(tableOffset + tableSize);

  // Place every resource first, so the table can point at it.
  const placements: { start: number; length: number; data: Uint8Array }[] = [];
  for (const [, byId] of types) {
    for (const data of byId.values()) {
      const length = alignUp(data.byteLength);
      placements.push({ start: dataAt, length, data });
      dataAt += length;
    }
  }

  const bytes = new Uint8Array(dataAt);
  const view = new DataView(bytes.buffer);

  view.setUint16(0, 0x5a4d, true); // 'MZ'
  view.setUint32(0x3c, neOffset, true);
  view.setUint16(neOffset, 0x454e, true); // 'NE'
  view.setUint16(neOffset + 0x24, tableOffset - neOffset, true);

  let cursor = tableOffset;
  view.setUint16(cursor, ALIGN_SHIFT, true);
  cursor += 2;

  let placement = 0;
  for (const [typeId, byId] of types) {
    view.setUint16(cursor, typeId, true);
    view.setUint16(cursor + 2, byId.size, true);
    cursor += 8; // type, count, four reserved

    for (const id of byId.keys()) {
      const entry = placements[placement];
      placement += 1;
      if (!entry) throw new Error('fixture: placement ran out');

      view.setUint16(cursor, entry.start >> ALIGN_SHIFT, true);
      view.setUint16(cursor + 2, entry.length >> ALIGN_SHIFT, true);
      view.setUint16(cursor + 4, 0, true); // flags
      view.setUint16(cursor + 6, id, true);
      cursor += 12;
      bytes.set(entry.data, entry.start);
    }
  }
  view.setUint16(cursor, 0, true); // end of table

  return bytes;
}

/**
 * An 8-bit DIB with the file header stripped, which is how a bitmap is stored
 * inside an executable. Rows are written bottom-up and padded to four bytes,
 * exactly as Windows does.
 */
export function buildDIB(width: number, height: number, pixel: (x: number, y: number) => number): Uint8Array {
  const stride = (width + 3) & ~3;
  const tableBytes = 256 * 4;
  const bytes = new Uint8Array(40 + tableBytes + stride * height);
  const view = new DataView(bytes.buffer);

  view.setUint32(0, 40, true);
  view.setInt32(4, width, true);
  view.setInt32(8, height, true); // positive: bottom-up
  view.setUint16(12, 1, true); // planes
  view.setUint16(14, 8, true); // bits per pixel
  view.setUint32(16, 0, true); // no compression
  view.setUint32(32, 256, true); // colours used

  // A recognisable ramp, so a mangled palette is obvious in a failure message.
  for (let i = 0; i < 256; i += 1) {
    bytes[40 + i * 4 + 0] = i; // blue
    bytes[40 + i * 4 + 1] = 255 - i; // green
    bytes[40 + i * 4 + 2] = (i * 3) & 0xff; // red
  }

  const pixelsAt = 40 + tableBytes;
  for (let y = 0; y < height; y += 1) {
    const row = pixelsAt + (height - 1 - y) * stride;
    for (let x = 0; x < width; x += 1) bytes[row + x] = pixel(x, y) & 0xff;
  }
  return bytes;
}

/** Bare pixels for `cells` cells, stored as one 8-wide bottom-up column. */
export function buildCellStrip(
  cells: number,
  cellWidth: number,
  cellHeight: number,
  pixel: (cell: number, x: number, y: number) => number,
): Uint8Array {
  const bytes = new Uint8Array(cells * cellWidth * cellHeight);
  for (let cell = 0; cell < cells; cell += 1) {
    for (let y = 0; y < cellHeight; y += 1) {
      for (let x = 0; x < cellWidth; x += 1) {
        // Bottom-up within the cell, cells stacked top to bottom.
        const row = cell * cellHeight + (cellHeight - 1 - y);
        bytes[row * cellWidth + x] = pixel(cell, x, y) & 0xff;
      }
    }
  }
  return bytes;
}

/** A palette resource: eight bytes an entry, channels at +2, +4 and +6. */
export function buildPaletteResource(colour: (index: number) => [number, number, number]): Uint8Array {
  const bytes = new Uint8Array(256 * 8);
  for (let i = 0; i < 256; i += 1) {
    const [r, g, b] = colour(i);
    bytes[i * 8 + 2] = r;
    bytes[i * 8 + 3] = r;
    bytes[i * 8 + 4] = g;
    bytes[i * 8 + 5] = g;
    bytes[i * 8 + 6] = b;
    bytes[i * 8 + 7] = b;
  }
  return bytes;
}
