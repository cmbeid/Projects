// Browser-side SimTower resource dumper.
//
// SIMTOWER.EXE is a Win16 NE executable. Its artwork is 8-bit DIB resources
// and its sounds are WAV resources. This module reads only the file the player
// selected, decodes and composes the source resources in memory (mirroring the
// canonical OpenSky C++ SimTowerLoader 1:1), and registers no files on disk
// or network. SIMTOWER.EX_ is decompressed in memory first.

import { decompressKwaj } from "../core/kwaj.js";
import { parseNEExecutable } from "../core/ne-executable.js";

const RT_BITMAP = 0x8002;
const RT_PALETTE = 0xff03;
const RT_CELL_BITMAP = 0xff02;
const RT_WAVE = 0xff0a;

export const SIMTOWER_BITMAP_SOURCES = Object.freeze({
  "simtower/office": 0x85a8,
  "simtower/condo": 0x8628,
  "simtower/single": 0x84a8,
  "simtower/double": 0x84e8,
  "simtower/suite": 0x8528,
  "simtower/fastfood": 0x86e8,
  "simtower/restaurant": 0x8568,
  "simtower/cinema/hall": 0x8868,
  "simtower/cinema/screens": 0x8c68,
  "simtower/partyhall": 0x8b28,
  "simtower/shops": 0x8673,
  "simtower/floor": 0x83e8,
  "simtower/stairs": 0x8968,
  "simtower/stairs/spiral_2": 0x8fe9,
  "simtower/stairs/spiral_3": 0x8fea,
  "simtower/escalator": 0x8aa8,
  "simtower/lobby/normal": 0x89e8,
  "simtower/lobby/sky": 0x89e9,
  "simtower/lobby/high": 0x89ea,
  "simtower/lobby/fountain": 0x89e8,
  "simtower/parking/space": 0x86a8,
  "simtower/parking/ramp": 0x8ee8,
  "simtower/metro/station": 0x8ba8,
  "simtower/metro/tracks": 0x8f28,
  "simtower/elevator/narrow": 0x87e8,
  "simtower/elevator/wide": 0x842c,
  "simtower/elevator/standard": 0x8428,
  "simtower/elevator/service": 0x842a,
  "simtower/elevator/express": 0x842b,
  "simtower/elevator/digits": 0x87e9,
  "simtower/elevator/people": 0x8468,
  "simtower/construction/grid": 0x8e28,
  "simtower/construction/solid": 0x8e29,
  "simtower/construction/worker": 0x85ea,
  "simtower/fire/large": 0x8f68,
  "simtower/fire/small": 0x8f6c,
  "simtower/fire/chopper": 0x8f6d,
  "simtower/fire/destroyed": 0x8fa8,
  "simtower/alerts/fire": 0xa714,
  "simtower/alerts/terrorist": 0xa710,
  "simtower/alerts/chopper": 0xa711,
  "simtower/alerts/vip": 0xa712,
  "simtower/alerts/treasure": 0xa713,
  "simtower/alerts/starup": 0xa716,
  "simtower/cathedral/main": 0x8b28,
  "simtower/deco/cloud/0": 0x8384,
  "simtower/deco/cloud/1": 0x8385,
  "simtower/deco/cloud/2": 0x8386,
  "simtower/deco/cloud/3": 0x8387,
  "simtower/deco/crane": 0x83ea,
  "simtower/deco/fireladder": 0x842d,
  "simtower/deco/skyline": 0x8389,
  "simtower/deco/entrances": 0x83e9,
  "simtower/deco/santa": 0x8388,
  "simtower/animpeple/office": 0x85e8,
  "simtower/animpeple/condo": 0x85e9,
  "simtower/animpeple/construction": 0x85ea,
  "simtower/animpeple/hotel": 0x85eb,
  "simtower/animpeple/restaurant": 0x85ec,
  "simtower/animpeple/event": 0x85ed,
  "simtower/animpeple/housekeeper": 0x85ee,
  "simtower/animpeple/guard": 0x8469,
  "simtower/yootcondo/empty": 0x8628,
  "simtower/yootcondo/resident": 0x85e9,
  "simtower/ui/toolbox/tools": 0x825c,
  "simtower/ui/toolbox/items": 0x812c,
  "simtower/ui/toolbox/speed": 0x8258,
  "simtower/ui/time/bg": 0x8140,
  "simtower/ui/time/rating": 0x8142,
  "simtower/ui/map/sky": 0x8160,
  "simtower/ui/map/ground": 0x8160,
  "simtower/ui/map/buttons": 0x8138,
  "simtower/ui/map/overlays": 0x8139,
  "simtower/ui/menubg": 0x8100,
  "simtower/people": 0x82bc,
  "simtower/sky": 0x8351,
  "simtower/speed": 0x8258,
  "simtower/security": 0x8768,
  "simtower/medicalcenter": 0x8728,
  "simtower/recycling": 0x88e8,
  "simtower/housekeeping": 0x87a8,
  "noroute.png": 0x825c,
});

export const SIMTOWER_SOUND_SOURCES = Object.freeze({
  "simtower/construction/normal": 0x9b58,
  "simtower/construction/flexible": 0x9b59,
  "simtower/construction/impossible": 0x9b5a,
  "simtower/bulldozer": 0x9b5b,
  "simtower/restaurant": 0x8568,
  "simtower/office": 0x85a8,
  "simtower/metro": 0x8ba8,
  "simtower/partyhall": 0x8b28,
  "simtower/fastfood/0": 0x8569,
  "simtower/fastfood/1": 0x9f40,
  "simtower/fastfood/2": 0x8668,
  "simtower/car/departing": 0x86a8,
  "simtower/car/arriving": 0x86a9,
  "simtower/doorbell": 0x8628,
  "simtower/hover": 0x88e8,
  "simtower/toilet": 0x8629,
  "simtower/birds/morning": 0x9388,
  "simtower/cock": 0x9389,
  "simtower/birds/evening": 0x938a,
  "simtower/rain": 0x938b,
  "simtower/bells": 0x938c,
  "simtower/thunder": 0x938d,
  "simtower/crickets": 0xa71b,
  "simtower/birds/day": 0xa71c,
  "simtower/rating/increased": 0xa710,
  "simtower/rating/tower": 0xa718,
  "simtower/applause": 0xa711,
  "simtower/santa": 0xa712,
  "simtower/cash": 0xa71d,
  "simtower/wind": 0xa715,
  "simtower/splashscreen": 0xce20,
  "simtower/elevator/arriving": 0x9771,
  "simtower/elevator/departing": 0x9772,
  ...Object.fromEntries(Array.from({ length: 15 }, (_, index) => [
    `simtower/cinema/movie${index}`, 0xa329 + index,
  ])),
});

function asBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  throw new TypeError("Expected executable bytes");
}

function putU32(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

// In-memory 2D pixel buffer for synchronous, zero-copy sprite composition.
export class Surface {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  copy(source, dx, dy, sx = 0, sy = 0, sw = source.width, sh = source.height) {
    for (let y = 0; y < sh; y++) {
      const srcY = sy + y;
      const dstY = dy + y;
      if (srcY < 0 || srcY >= source.height || dstY < 0 || dstY >= this.height) continue;
      for (let x = 0; x < sw; x++) {
        const srcX = sx + x;
        const dstX = dx + x;
        if (srcX < 0 || srcX >= source.width || dstX < 0 || dstX >= this.width) continue;
        const srcIdx = (srcY * source.width + srcX) * 4;
        const dstIdx = (dstY * this.width + dstX) * 4;
        this.data[dstIdx] = source.data[srcIdx];
        this.data[dstIdx + 1] = source.data[srcIdx + 1];
        this.data[dstIdx + 2] = source.data[srcIdx + 2];
        this.data[dstIdx + 3] = source.data[srcIdx + 3];
      }
    }
    return this;
  }

  mask(colors) {
    for (let i = 0; i < this.data.length; i += 4) {
      const r = this.data[i];
      const g = this.data[i + 1];
      const b = this.data[i + 2];
      for (const [mr, mg, mb] of colors) {
        if (r === mr && g === mg && b === mb) {
          this.data[i + 3] = 0;
          break;
        }
      }
    }
    return this;
  }

  toCanvas() {
    if (typeof document !== "undefined" && typeof document.createElement === "function") {
      const canvas = document.createElement("canvas");
      canvas.width = this.width;
      canvas.height = this.height;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      const imgData = new ImageData(this.data, this.width, this.height);
      ctx.putImageData(imgData, 0, 0);
      return canvas;
    }
    return this;
  }
}

// Pure synchronous 8-bit BMP decoder into an in-memory Surface.
export function decodeBmp(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const pixelOffset = view.getUint32(10, true);
  const headerSize = view.getUint32(14, true);
  const width = view.getInt32(18, true);
  const height = Math.abs(view.getInt32(22, true));
  const paletteOffset = 14 + headerSize;
  const palette = new Uint8Array(bytes.buffer, bytes.byteOffset + paletteOffset, 256 * 4);
  const rowStride = (width + 3) & ~3;
  const surf = new Surface(width, height);

  for (let y = 0; y < height; y++) {
    const srcY = height - 1 - y; // BMP scans are bottom-up
    const srcRow = bytes.byteOffset + pixelOffset + srcY * rowStride;
    const dstRow = y * width * 4;
    for (let x = 0; x < width; x++) {
      const idx = bytes[srcRow + x];
      const p = idx * 4;
      const out = dstRow + x * 4;
      surf.data[out] = palette[p + 2];     // Red
      surf.data[out + 1] = palette[p + 1]; // Green
      surf.data[out + 2] = palette[p];     // Blue
      surf.data[out + 3] = 255;            // Alpha
    }
  }
  return surf;
}

// The DIBs stored under RT_BITMAP omit the 14-byte BMP file header.
export function wrapDibAsBmp(dib) {
  const source = asBytes(dib);
  if (source.length < 40) throw new Error("Truncated SimTower bitmap resource");
  const bytes = new Uint8Array(source.length + 14);
  bytes.set([0x42, 0x4d], 0); // BM
  putU32(bytes, 2, bytes.length);
  // 40-byte BITMAPINFOHEADER + 256 4-byte palette entries.
  putU32(bytes, 10, 14 + 40 + 256 * 4);
  bytes.set(source, 14);
  return bytes;
}

// The 0xFF02 resources are bare 8-pixel-wide cell streams. Rebuild the
// same 8-bit DIB used by SimTowerLoader before decoding it in the browser.
function wrapCellResourceAsBmp(resource, palette) {
  const cells = asBytes(resource);
  const rawPalette = asBytes(palette);
  if (rawPalette.length < 256 * 8) throw new Error("Missing SimTower cell-bitmap palette");
  const cellPixels = 8 * 36;
  const cellsInResource = Math.floor(cells.length / cellPixels);
  const width = cellsInResource * 8;
  const headerSize = 14 + 40 + 256 * 4;
  const bytes = new Uint8Array(headerSize + width * 36);
  bytes.set([0x42, 0x4d], 0);
  putU32(bytes, 2, bytes.length);
  putU32(bytes, 10, headerSize);
  putU32(bytes, 14, 40);
  putU32(bytes, 18, width);
  putU32(bytes, 22, 36);
  bytes[26] = 1;
  bytes[28] = 8;
  putU32(bytes, 34, width * 36);
  putU32(bytes, 46, 256);
  putU32(bytes, 50, 256);
  for (let index = 0; index < 256; index++) {
    const target = 54 + index * 4;
    const source = index * 8;
    bytes[target] = rawPalette[source + 6];
    bytes[target + 1] = rawPalette[source + 4];
    bytes[target + 2] = rawPalette[source + 2];
  }
  for (let index = 0; index < width * 36; index++) {
    const sourceX = index % 8;
    const sourceY = Math.floor(index / 8);
    const targetX = sourceX + Math.floor(sourceY / 36) * 8;
    const targetY = 35 - (sourceY % 36);
    bytes[headerSize + targetX + targetY * width] = cells[index];
  }
  return bytes;
}

export function dumpSimTowerResources(executableBytes) {
  const exe = parseNEExecutable(executableBytes);
  const palette = exe.getResource(RT_PALETTE, 0x83e8);
  const bitmaps = new Map();
  for (const [id, dib] of exe.getResources(RT_BITMAP)) bitmaps.set(id, wrapDibAsBmp(dib));
  for (const [id, cells] of exe.getResources(RT_CELL_BITMAP)) {
    bitmaps.set(id, wrapCellResourceAsBmp(cells, palette));
  }
  const palettes = new Map();
  for (const [id, pal] of exe.getResources(RT_PALETTE)) palettes.set(id, pal);
  const sounds = new Map();
  for (const [id, wav] of exe.getResources(RT_WAVE)) sounds.set(id, wav.slice());
  return { bitmaps, palettes, sounds };
}

function applyReplacementPalette(paletteId, rawBmp, palettes) {
  if (!paletteId) return rawBmp;
  const rct = palettes.get(paletteId);
  if (!rct) return rawBmp;
  const copy = new Uint8Array(rawBmp);
  for (let n = 0; n < 256; n++) {
    const ridx = n >= 184 ? (n + 1) % 256 : n;
    for (let t = 0; t < 4; t++) {
      copy[54 + n * 4 + 3 - t] = rct[ridx * 8 + t * 2];
    }
  }
  return copy;
}

function loadAnimated(id, dumped) {
  const bmp = new Uint8Array(dumped.bitmaps.get(id));
  const frames = [];
  for (let i = 0; i < 3; i++) {
    for (let n = 0; n < 4; n++) {
      const o = 54 + 4 * 197 + n;
      let temp = bmp[o + 4]; bmp[o + 4] = bmp[o]; bmp[o] = temp;
      temp = bmp[o + 12]; bmp[o + 12] = bmp[o + 8]; bmp[o + 8] = temp;
      temp = bmp[o + 24]; bmp[o + 24] = bmp[o + 20]; bmp[o + 20] = bmp[o + 16]; bmp[o + 16] = temp;
    }
    frames.push(decodeBmp(bmp));
  }
  return frames;
}

function mergeSurfaces(surfaces, direction) {
  const width = direction === "x"
    ? surfaces.reduce((sum, s) => sum + s.width, 0)
    : Math.max(...surfaces.map((s) => s.width));
  const height = direction === "y"
    ? surfaces.reduce((sum, s) => sum + s.height, 0)
    : Math.max(...surfaces.map((s) => s.height));
  const result = new Surface(width, height);
  let offset = 0;
  for (const s of surfaces) {
    result.copy(s, direction === "x" ? offset : 0, direction === "y" ? offset : 0);
    offset += direction === "x" ? s.width : s.height;
  }
  return result;
}

export async function loadSimTowerMedia(file, kind) {
  let executable = asBytes(await file.arrayBuffer());
  if (kind === "compressed") executable = decompressKwaj(executable);
  const dumped = dumpSimTowerResources(executable);

  const decodeId = (id) => {
    const raw = dumped.bitmaps.get(id);
    if (!raw) throw new Error(`SIMTOWER bitmap resource 0x${id.toString(16)} is missing`);
    return decodeBmp(raw);
  };
  const merged = (ids, direction) => mergeSurfaces(ids.map(decodeId), direction);

  const bitmaps = {};

  // Condo & YootCondo empty
  const condos = new Surface(640, 72);
  const yootCondoEmpty = new Surface(128, 15 * 24);
  for (let variant = 0; variant < 3; variant++) {
    for (let state = 0; state < 5; state++) {
      const idx = variant * 5 + state;
      const s = decodeId(0x8628 + idx).mask([[0x66, 0x99, 0xcc], [0x0c, 0x0c, 0x0c]]);
      condos.copy(s, state * 128, variant * 24);
      yootCondoEmpty.copy(s, 0, idx * 24);
    }
  }
  bitmaps["simtower/condo"] = condos;
  bitmaps["simtower/yootcondo/empty"] = yootCondoEmpty;

  // Office (7 slices of 144x24 stacked vertically into 144x168)
  const offices = new Surface(144, 168);
  let offY = 0;
  for (let id = 0x85a8; id <= 0x85ab; id++) {
    const s = decodeId(id).mask([[0x8c, 0xd6, 0xff], [0x42, 0xc6, 0xff]]);
    const slices = Math.floor(s.width / 144);
    for (let slice = 0; slice < slices && offY < 168; slice++) {
      offices.copy(s, 0, offY, slice * 144, 0, 144, 24);
      offY += 24;
    }
  }
  bitmaps["simtower/office"] = offices;

  // Fastfood, Restaurant, Single, Double, Suite
  const composeFood = (startId, rows, width, masks = null) => {
    const result = new Surface(width, rows * 24);
    for (let row = 0; row < rows; row++) {
      let s = merged([startId + row * 2, startId + row * 2 + 1], "x");
      if (masks) s.mask(masks);
      result.copy(s, 0, row * 24);
    }
    return result;
  };
  bitmaps["simtower/fastfood"] = composeFood(0x86e8, 5, 512);
  bitmaps["simtower/restaurant"] = composeFood(0x8568, 4, 768);
  bitmaps["simtower/single"] = composeFood(0x84a8, 2, 288, [[0x8c, 0xd6, 0xff], [0x4a, 0xb4, 0xff]]);
  bitmaps["simtower/double"] = composeFood(0x84e8, 4, 432, [[0x8c, 0xd6, 0xff], [0x4a, 0xb4, 0xff]]);
  bitmaps["simtower/suite"] = mergeSurfaces([
    merged([0x8528, 0x8529], "x"),
    merged([0x852a, 0x852b], "x"),
  ], "y").mask([[0x8c, 0xd6, 0xff], [0x4a, 0xb4, 0xff]]);

  // Stairs & Escalator
  const s0 = merged([0x8968, 0x89a8], "y");
  const s1 = merged([0x8969, 0x89a9], "y");
  bitmaps["simtower/stairs"] = mergeSurfaces([s0, s1], "x").mask([[0xff, 0xff, 0xff]]);
  bitmaps["simtower/escalator"] = merged([0x8aa8, 0x8ae8], "y").mask([[0xff, 0xff, 0xff]]);

  // Multi-story Spiral Stairs (704x72 for 2-story, 704x108 for 3-story)
  const raw2 = decodeId(0x8fe9);
  const spiral2 = new Surface(64 * 11, 36 * 2);
  for (let n = 0; n < 11; n++) {
    spiral2.copy(raw2, n * 64, 0, (22 + n) * 64, 0, 64, 36);
    spiral2.copy(raw2, n * 64, 36, (11 + n) * 64, 0, 64, 36);
  }
  bitmaps["simtower/stairs/spiral_2"] = spiral2.mask([[0xff, 0xff, 0xff]]);

  const raw3 = decodeId(0x8fea);
  const spiral3 = new Surface(64 * 11, 36 * 3);
  for (let n = 0; n < 11; n++) {
    spiral3.copy(raw3, n * 64, 0, (11 + n) * 64, 0, 64, 36);
    spiral3.copy(raw3, n * 64, 36, (22 + n) * 64, 0, 64, 36);
    spiral3.copy(raw3, n * 64, 72, (33 + n) * 64, 0, 64, 36);
  }
  bitmaps["simtower/stairs/spiral_3"] = spiral3.mask([[0xff, 0xff, 0xff]]);

  // Partyhall & Cathedral
  const partyhall = merged([0x8b28, 0x8b68], "y").mask([[0x8c, 0xd6, 0xff], [0x4a, 0xb4, 0xff]]);
  bitmaps["simtower/partyhall"] = partyhall;
  bitmaps["simtower/cathedral/main"] = partyhall;

  // Parking
  bitmaps["simtower/parking/ramp"] = merged([0x8ee8, 0x8ee9, 0x8eea], "x");
  bitmaps["simtower/parking/space"] = merged([0x86a8, 0x86a9], "x");

  // Recycling Center (1400x60)
  const rec0 = merged([0x88e9, 0x88ea, 0x88eb, 0x88ec, 0x88ed], "x");
  const rec1 = merged([0x8929, 0x892a, 0x892b, 0x892c, 0x892d], "x");
  const recLoad = mergeSurfaces([rec0, rec1], "y");
  const recEmpty = decodeId(0x88e8);
  const recCar = decodeId(0x892e);
  const recEmptying = new Surface(recEmpty.width, recEmpty.height);
  recEmptying.copy(recEmpty, 0, 0);
  recEmptying.copy(recCar, 0, 24);
  bitmaps["simtower/recycling"] = mergeSurfaces([recEmpty, recLoad, recEmptying], "x");

  // Metro (720x96) & Tracks (32x36)
  const m = [];
  for (let i = 0; i < 3; i++) m.push(merged([i * 0x40 + 0x8ba9, i * 0x40 + 0x8ba8], "x"));
  bitmaps["simtower/metro/station"] = mergeSurfaces(m, "y");
  bitmaps["simtower/metro/tracks"] = decodeId(0x8f28);

  // Cinema Screens (1008x60) & Hall (960x60)
  const cs = [];
  for (let i = 0; i < 2; i++) cs.push(merged([0x8c68 + i, 0x8ca8 + i], "y"));
  bitmaps["simtower/cinema/screens"] = mergeSurfaces(cs, "x");

  const cinUpper = loadAnimated(0x8868, dumped);
  const cinLower = decodeId(0x88a8);
  const cinHall = new Surface(192 * 5, 60);
  cinHall.copy(cinUpper[1], 192, 0);
  cinHall.copy(cinUpper[0], 0, 0);
  cinHall.copy(cinLower, 192, 24);
  cinHall.copy(cinLower, 0, 24);
  bitmaps["simtower/cinema/hall"] = cinHall;

  // Security (384x24)
  const sec = loadAnimated(0x8768, dumped);
  bitmaps["simtower/security"] = mergeSurfaces(sec, "x");

  // Shops (288x288, 13 storefront variants)
  const shops0 = merged([0x8673, 0x8674], "x");
  const shops1 = merged([0x8668, 0x8669, 0x866a, 0x866b, 0x866c, 0x866d, 0x866e, 0x866f, 0x8670, 0x8671, 0x8672], "y");
  bitmaps["simtower/shops"] = mergeSurfaces([shops0, shops1], "y");

  // Medical Center (624x24)
  bitmaps["simtower/medicalcenter"] = merged([0x8728, 0x8729, 0x872a], "x");

  // People (96x120, 5 stress rows)
  const rawPeople = decodeId(0x82bc).mask([[0xe6, 0xe6, 0xe6]]);
  const people = new Surface(96, 120);
  people.copy(rawPeople, 0, 0);
  const personTints = [
    [0xff, 0x99, 0x99],
    [0xff, 0x00, 0x00],
    [0x00, 0x00, 0xff],
    [0xff, 0xff, 0x00],
  ];
  for (let row = 0; row < 4; row++) {
    const [tr, tg, tb] = personTints[row];
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 96; x++) {
        const srcIdx = (y * 96 + x) * 4;
        const dstIdx = ((row + 1) * 24 * 96 + y * 96 + x) * 4;
        if (rawPeople.data[srcIdx + 3] > 0) {
          people.data[dstIdx] = tr;
          people.data[dstIdx + 1] = tg;
          people.data[dstIdx + 2] = tb;
          people.data[dstIdx + 3] = 255;
        }
      }
    }
  }
  bitmaps["simtower/people"] = people;

  // Elevators (Cars, Shafts, Digits, Queue Crowd)
  const stdCar = decodeId(0x8428);
  const stdCombinedRaw = loadAnimated(0x8429, dumped);
  const expCombined = loadAnimated(0x842b, dumped);
  const srvCar = decodeId(0x842a);

  const stdCombined = stdCombinedRaw.map((r) => mergeSurfaces([stdCar, r], "x"));
  const stdFull = new Surface(32 * 5, 36);
  stdFull.copy(stdCombined[0], 0, 0);
  const expFull = new Surface(48 * 5, 36);
  expFull.copy(expCombined[0], 0, 0);

  const cutCar = (src, cellW) => {
    const carW = cellW - 4;
    const res = new Surface(carW * 5, 30);
    for (let i = 0; i < 5; i++) {
      res.copy(src, i * carW, 0, i * cellW + 2, 5, carW, 30);
    }
    return res.mask([[0, 0, 0], [25, 25, 25]]);
  };
  bitmaps["simtower/elevator/standard"] = cutCar(stdFull, 32);
  bitmaps["simtower/elevator/service"] = cutCar(srvCar, 32);
  bitmaps["simtower/elevator/express"] = cutCar(expFull, 48);

  const shaftNarrow = new Surface(32 * 7, 36);
  const shaftWide = new Surface(48 * 7, 36);
  for (let i = 0; i < 3; i++) {
    shaftNarrow.copy(stdCombined[i], i * 64 + 32, 0, 5 * 32, 0, 64, 36);
    shaftWide.copy(expCombined[i], i * 96 + 48, 0, 5 * 48, 0, 96, 36);
  }
  const shaftBase = decodeId(0x87e8);
  const shaftExt = decodeId(0x842c);
  shaftNarrow.copy(shaftBase, 0, 0, 0, 0, 32, 36);
  shaftWide.copy(shaftBase, 8, 0, 0, 0, 32, 36);
  shaftWide.copy(shaftExt, 0, 0, 0, 0, 8, 36);
  shaftWide.copy(shaftExt, 40, 0, 8, 0, 8, 36);
  bitmaps["simtower/elevator/narrow"] = shaftNarrow;
  bitmaps["simtower/elevator/wide"] = shaftWide;

  // Shaft floor digits (132x34)
  const digits = new Surface(11 * 12, 2 * 17);
  const rawDig = [decodeId(0x87e9), decodeId(0x87ec)];
  const rawDig1 = [decodeId(0x87ea), decodeId(0x87ed)];
  for (let i = 0; i < 10; i++) {
    for (let n = 0; n < 2; n++) {
      digits.copy(rawDig[n], i * 11, n * 17, 1 + 16 * i, 16, 11, 17);
    }
  }
  for (let n = 0; n < 2; n++) {
    digits.copy(rawDig1[n], 110, n * 17, 36, 16, 11, 17);
  }
  bitmaps["simtower/elevator/digits"] = digits.mask([[25, 25, 25]]);

  // Elevator Queue Crowd (288x72)
  const eqNorm = decodeId(0x8468);
  const elevQueue = new Surface(288, 72);
  for (let i = 0; i < elevQueue.data.length; i += 4) {
    elevQueue.data[i] = 255; elevQueue.data[i + 1] = 255; elevQueue.data[i + 2] = 255; elevQueue.data[i + 3] = 255;
  }
  for (let i = 0; i < 8; i++) {
    for (let n = 0; n < 3; n++) {
      elevQueue.copy(eqNorm, i * 32 + 16, 0, i * 80, 12, 16, 24);
      elevQueue.copy(eqNorm, i * 32, 0, i * 80 + 64, 12, 16, 24);
      elevQueue.copy(eqNorm, i * 32 + 16, 24, i * 80 + 16, 12, 24, 24);
      elevQueue.copy(eqNorm, i * 32 + 8, 24, i * 80 + 56, 12, 8, 24);
      elevQueue.copy(eqNorm, i * 32 + 16, 48, i * 80 + 24, 12, 16, 24);
      elevQueue.copy(eqNorm, i * 32, 48, i * 80 + 40, 12, 16, 24);
    }
  }
  elevQueue.mask([[255, 255, 255]]);
  for (let i = 0; i < elevQueue.data.length; i += 4) {
    if (elevQueue.data[i + 3] > 0) {
      elevQueue.data[i] = 255 - elevQueue.data[i];
      elevQueue.data[i + 1] = 255 - elevQueue.data[i + 1];
      elevQueue.data[i + 2] = 255 - elevQueue.data[i + 2];
    }
  }
  bitmaps["simtower/elevator/people"] = elevQueue;

  // Sky (2112x360, 11 sky variants x 6 weather states)
  const skies = [];
  for (let skyIdx = 0; skyIdx < 11; skyIdx++) {
    const skyId = 0x8351 + skyIdx;
    const rawBmp = dumped.bitmaps.get(skyId);
    const skyCol = new Surface(32 * 6, 360);

    const cbright = new Uint8Array(rawBmp.slice(54 + 4 * 213, 54 + 4 * 213 + 24));

    for (let i = 0; i < 6; i++) {
      const rct = i === 1 ? 0x83E9 : i === 2 ? 0x83EA : i === 3 ? 0x83EB : 0;
      const modified = applyReplacementPalette(rct, rawBmp, dumped.palettes);
      const psky = modified.slice(54 + 4 * 188, 54 + 4 * 188 + 24);
      if (i < 4) {
        modified.set(psky, 54 + 4 * 207);
        modified.set(psky, 54 + 4 * 213);
      } else if (i === 4) {
        modified.set(cbright, 54 + 4 * 207);
      } else if (i === 5) {
        modified.set(psky, 54 + 4 * 207);
        modified.set(cbright, 54 + 4 * 213);
      }
      const colSurf = decodeBmp(modified);
      skyCol.copy(colSurf, i * 32, 0);
    }
    skies.push(skyCol);
  }
  bitmaps["simtower/sky"] = mergeSurfaces(skies, "x");

  // Clouds (4 clouds x 4 weather states)
  for (let n = 0; n < 4; n++) {
    const rawBmp = dumped.bitmaps.get(0x8384 + n);
    const baseSurf = decodeBmp(rawBmp);
    const cloud = new Surface(baseSurf.width, baseSurf.height * 4);
    for (let i = 0; i < 4; i++) {
      const rct = i === 1 ? 0x83E9 : i === 2 ? 0x83EA : i === 3 ? 0x83EB : 0;
      const modified = applyReplacementPalette(rct, rawBmp, dumped.palettes);
      const rowSurf = decodeBmp(modified);
      cloud.copy(rowSurf, 0, i * baseSurf.height);
    }
    bitmaps[`simtower/deco/cloud/${n}`] = cloud.mask([[255, 255, 255]]);
  }

  // Lobbies (Normal 312x108, Sky 312x108, High 312x324)
  const lobNorm = new Surface(312, 108);
  const lobSky = new Surface(312, 108);
  const lobHigh = new Surface(312, 324);
  const segments = [lobNorm, lobSky, lobHigh];
  for (let i = 0; i < 3; i++) {
    const raw = decodeId(0x89e8 + i);
    for (let n = 0; n < 3; n++) {
      const dstY = n < 2 ? i * 36 : i * 108 + 72;
      segments[n].copy(raw, 56, dstY, n * 328, 0, 256, 36);
      segments[n].copy(raw, 0, dstY, (n + 1) * 328 - 56, 0, 56, 36);
    }
  }
  lobSky.mask([[0x8c, 0xd6, 0xff]]);
  for (let i = 0; i < 3; i++) {
    const middle = decodeId(0x8a28 + i);
    const top = decodeId(0x8a68 + i);
    const vseg = [top, middle];
    for (let n = 0; n < 2; n++) {
      const xoff = n === 1 ? 328 : 0;
      lobHigh.copy(vseg[n], 56, i * 108 + n * 36, xoff, 0, 256, 36);
      lobHigh.copy(vseg[n], 0, i * 108 + n * 36, xoff + 328 - 56, 0, 56, 36);
    }
  }
  bitmaps["simtower/lobby/normal"] = lobNorm;
  bitmaps["simtower/lobby/sky"] = lobSky;
  bitmaps["simtower/lobby/high"] = lobHigh;

  // High Lobby 2-Frame Animated Fountain Overlay (624x36)
  const fountain = new Surface(624, 36);
  for (let f = 0; f < 2; f++) {
    const ox = f * 312;
    const col = f === 0 ? [51, 102, 153] : [80, 140, 200];
    for (let x = 17; x <= 26; x++) {
      for (let y = 32; y < 36; y++) {
        const idx = (y * 624 + ox + x) * 4;
        fountain.data[idx] = col[0];
        fountain.data[idx + 1] = col[1];
        fountain.data[idx + 2] = col[2];
        fountain.data[idx + 3] = 255;
      }
    }
  }
  bitmaps["simtower/lobby/fountain"] = fountain;

  // Floor (8x36)
  const floorSrc = decodeId(0x83e8);
  const floor = new Surface(8, 36);
  for (let x = 0; x < 8; x += 2) floor.copy(floorSrc, x, 0, 16, 0, 2, 36);
  bitmaps["simtower/floor"] = floor;

  // UI sheets
  bitmaps["simtower/ui/toolbox/tools"] = merged([0x825c, 0x825d, 0x825e], "x");
  bitmaps["simtower/ui/toolbox/speed"] = merged([0x8258, 0x8259, 0x825a, 0x825b], "x");
  bitmaps["simtower/speed"] = bitmaps["simtower/ui/toolbox/speed"];

  const tbItems = new Surface(832, 96);
  for (let row = 0; row < 3; row++) {
    const src = decodeId(0x812c + row);
    for (let st = 0; st < 4; st++) {
      tbItems.copy(src, st * 256, row * 32, 0, st * 32, 256, 32);
    }
  }
  bitmaps["simtower/ui/toolbox/items"] = tbItems;

  bitmaps["simtower/ui/time/bg"] = decodeId(0x8140);
  const rating = new Surface(108, 132);
  const stars = [decodeId(0x8142), decodeId(0x8143)];
  const starTower = decodeId(0x8147);
  for (let i = 0; i < 5; i++) {
    for (let n = 0; n < 5; n++) {
      const si = n <= i ? 0 : 1;
      rating.copy(stars[si], n * 21 + 1, i * 22 + 1);
    }
  }
  rating.copy(starTower, 0, 22 * 5);
  bitmaps["simtower/ui/time/rating"] = rating.mask([[0x99, 0x99, 0x99], [255, 255, 255]]);

  const mapRaw = dumped.bitmaps.get(0x8160);
  const mapSky = new Surface(200 * 4, 264);
  for (let i = 0; i < 4; i++) {
    const rct = i === 1 ? 0x83E9 : i === 2 ? 0x83EA : i === 3 ? 0x83EB : 0;
    const mod = applyReplacementPalette(rct, mapRaw, dumped.palettes);
    mapSky.copy(decodeBmp(mod), i * 200, 0);
  }
  bitmaps["simtower/ui/map/sky"] = mapSky;
  const mapBase = decodeBmp(mapRaw);
  const mapGround = new Surface(200, 24);
  mapGround.copy(mapBase, 0, 0, 0, 264, 200, 24);
  bitmaps["simtower/ui/map/ground"] = mapGround;
  bitmaps["simtower/ui/map/buttons"] = merged([0x8138, 0x8136, 0x8137], "y");
  bitmaps["simtower/ui/map/overlays"] = merged([0x8139, 0x813a, 0x813b], "y");
  bitmaps["simtower/ui/menubg"] = decodeId(0x8100);

  // Named masked / direct bitmaps
  const named = [
    { id: 0x8e28, key: "simtower/construction/grid", mask: [[255, 255, 255]] },
    { id: 0x8e29, key: "simtower/construction/solid" },
    { id: 0x85ea, key: "simtower/construction/worker", mask: [[255, 255, 255]] },
    { id: 0x85e8, key: "simtower/animpeple/office", mask: [[255, 255, 255]] },
    { id: 0x85e9, key: "simtower/animpeple/condo", mask: [[255, 255, 255]] },
    { id: 0x85ea, key: "simtower/animpeple/construction", mask: [[255, 255, 255]] },
    { id: 0x85eb, key: "simtower/animpeple/hotel", mask: [[255, 255, 255]] },
    { id: 0x85ec, key: "simtower/animpeple/restaurant", mask: [[255, 255, 255]] },
    { id: 0x85ed, key: "simtower/animpeple/event", mask: [[255, 255, 255]] },
    { id: 0x85ee, key: "simtower/animpeple/housekeeper", mask: [[255, 255, 255]] },
    { id: 0x8469, key: "simtower/animpeple/guard", mask: [[255, 255, 255]] },
    { id: 0x87a8, key: "simtower/housekeeping" },
    { id: 0x8f6c, key: "simtower/fire/small" },
    { id: 0x8f6d, key: "simtower/fire/chopper" },
    { id: 0x8fa8, key: "simtower/fire/destroyed" },
    { id: 0x8388, key: "simtower/deco/santa", mask: [[255, 255, 255]] },
    { id: 0x8389, key: "simtower/deco/skyline", mask: [[0x8a, 0xd4, 0xff]] },
    { id: 0x83e9, key: "simtower/deco/entrances", mask: [[255, 255, 255]] },
    { id: 0x83ea, key: "simtower/deco/crane", mask: [[255, 255, 255]] },
    { id: 0x842d, key: "simtower/deco/fireladder", mask: [[255, 255, 255]] },
    { id: 0xa710, key: "simtower/alerts/terrorist", mask: [[255, 255, 255]] },
    { id: 0xa711, key: "simtower/alerts/chopper", mask: [[0xcc, 0xcc, 0xcc]] },
    { id: 0xa712, key: "simtower/alerts/vip", mask: [[255, 255, 255]] },
    { id: 0xa713, key: "simtower/alerts/treasure", mask: [[255, 255, 255]] },
    { id: 0xa714, key: "simtower/alerts/fire", mask: [[255, 255, 255]] },
    { id: 0xa716, key: "simtower/alerts/starup", mask: [[0xcc, 0xcc, 0xcc]] },
  ];
  for (const item of named) {
    let s = decodeId(item.id);
    if (item.mask) s.mask(item.mask);
    bitmaps[item.key] = s;
  }
  bitmaps["simtower/fire/large"] = merged([0x8f68, 0x8f69, 0x8f6a, 0x8f6b], "x");
  bitmaps["simtower/yootcondo/resident"] = bitmaps["simtower/animpeple/condo"];

  // Loose noroute.png (36x36 exclamation badge)
  const noroute = new Surface(36, 36);
  for (let y = 11; y <= 26; y++) {
    const rowW = y <= 18 ? (y - 10) * 2 - 1 : (27 - y) * 2;
    const startX = 18 - Math.floor(rowW / 2);
    for (let x = 0; x < rowW; x++) {
      const idx = (y * 36 + startX + x) * 4;
      noroute.data[idx] = 220; noroute.data[idx + 1] = 40; noroute.data[idx + 2] = 40; noroute.data[idx + 3] = 255;
    }
  }
  bitmaps["noroute.png"] = noroute;

  // Convert all surfaces to canvas elements in a browser
  const canvases = {};
  for (const [key, surf] of Object.entries(bitmaps)) {
    canvases[key] = surf.toCanvas();
  }

  const soundUrls = {};
  for (const [key, id] of Object.entries(SIMTOWER_SOUND_SOURCES)) {
    const wav = dumped.sounds.get(id);
    if (wav && typeof Blob !== "undefined" && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
      soundUrls[key] = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
    }
  }

  return {
    bitmaps: canvases,
    soundUrls,
    dispose() {
      if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
        for (const url of Object.values(soundUrls)) URL.revokeObjectURL(url);
      }
    },
  };
}
