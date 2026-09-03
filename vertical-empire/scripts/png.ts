/**
 * A minimal PNG writer, so the extractor can dump what it found without
 * pulling in an image library for a job this small.
 *
 * Node only — the game itself never needs PNG, because it draws from indices.
 */
import { deflateSync } from 'node:zlib';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.byteLength);
  const view = new DataView(out.buffer);
  view.setUint32(0, body.byteLength);
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  view.setUint32(8 + body.byteLength, crc32(out.subarray(4, 8 + body.byteLength)));
  return out;
}

/** Encodes 8-bit indices plus an RGBA palette as a truecolour PNG. */
export function encodePNG(
  width: number,
  height: number,
  indices: Uint8Array,
  palette: Uint8Array,
): Uint8Array {
  // One filter byte per row, then RGB triples. Filter 0 throughout: these are
  // tiny images and the deflate does the work.
  const raw = new Uint8Array(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    const rowAt = y * (1 + width * 3);
    raw[rowAt] = 0;
    for (let x = 0; x < width; x += 1) {
      const entry = (indices[y * width + x] ?? 0) * 4;
      const at = rowAt + 1 + x * 3;
      raw[at] = palette[entry] ?? 0;
      raw[at + 1] = palette[entry + 1] ?? 0;
      raw[at + 2] = palette[entry + 2] ?? 0;
    }
  }

  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolour
  // 10, 11, 12: deflate, adaptive filtering, no interlacing — all zero.

  const parts = [
    Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', new Uint8Array(deflateSync(raw))),
    chunk('IEND', new Uint8Array(0)),
  ];

  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const png = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    png.set(part, at);
    at += part.byteLength;
  }
  return png;
}
