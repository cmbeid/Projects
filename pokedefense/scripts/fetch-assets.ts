/**
 * Downloads everything the game uses from PokeAPI into `public/`:
 *
 * - `sprites/` — each Pokémon's animated Black/White sprite (and its shiny),
 *   decoded from GIF, trimmed to the pixels it actually uses, and packed into
 *   one PNG sheet per Pokémon with a JSON file of frame timings. Canvas cannot
 *   step through a GIF's frames, so the game draws from the sheet instead.
 * - `cries/` — each cry, decoded by what it really is (PokeAPI's `.ogg` files
 *   are sometimes MP3s) and rewritten as a small mono WAV that plays on iOS.
 * - `items/` and `badges/` — item icons and the 24 Kanto, Johto and Hoenn badges, as they are.
 *
 * The result is committed. Files already present are skipped; pass `--force`
 * to fetch everything again.
 *
 * Pokémon, its sprites and its cries are © Nintendo / Creatures / GAME FREAK.
 * They are used here for a personal, non-commercial project.
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { OggVorbisDecoder } from '@wasm-audio-decoders/ogg-vorbis';
import { MPEGDecoder } from 'mpg123-decoder';
import { GifReader } from 'omggif';
import { PNG } from 'pngjs';
import { ITEM_ICONS } from '../src/data/items';
import { SPECIES } from '../src/data/species';

const RAW = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites';
const ANIMATED = `${RAW}/pokemon/versions/generation-v/black-white/animated`;
const STATIC = `${RAW}/pokemon/versions/generation-v/black-white`;
const CRIES = 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest';
const CRY_RATE = 16_000;
/** Trim cries longer than this; a few run on well past the part anyone hears. */
const CRY_MAX_SECONDS = 1.3;
const FORCE = process.argv.includes('--force');
/**
 * Most Black/White animations run 40–80 frames; a quarter-tile sprite does not
 * need them all. Longer ones are resampled to this many, keeping their timing.
 */
const MAX_FRAMES = 30;

async function download(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

interface Decoded {
  channelData: Float32Array[];
  samplesDecoded: number;
  sampleRate: number;
}

/** Decode by content, not by file name. A fresh decoder each time, so no state carries over. */
async function decodeCry(bytes: Uint8Array): Promise<Decoded> {
  const isOgg = bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53; // "OggS"
  if (isOgg) {
    const decoder = new OggVorbisDecoder();
    await decoder.ready;
    const audio = await decoder.decodeFile(bytes);
    decoder.free();
    return audio;
  }
  const decoder = new MPEGDecoder();
  await decoder.ready;
  const audio = decoder.decode(bytes);
  decoder.free();
  return audio;
}

/** Average the channels, then resample linearly to `rate`. */
function toMono(channels: Float32Array[], from: number, rate: number): Float32Array {
  const length = channels[0]?.length ?? 0;
  const mono = new Float32Array(length);
  for (const channel of channels) for (let i = 0; i < length; i += 1) mono[i]! += channel[i]! / channels.length;
  const out = new Float32Array(Math.floor((length * rate) / from));
  for (let i = 0; i < out.length; i += 1) {
    const at = (i * from) / rate;
    const lo = Math.floor(at);
    const hi = Math.min(lo + 1, length - 1);
    out[i] = mono[lo]! + (mono[hi]! - mono[lo]!) * (at - lo);
  }
  return out;
}


export interface Sheet {
  /** One frame's size, after trimming. */
  w: number;
  h: number;
  cols: number;
  /** Milliseconds each frame is shown. */
  delays: number[];
}

/** Every frame of a GIF, composited as a browser would show it, as full-size RGBA. */
function gifFrames(bytes: Uint8Array): { width: number; height: number; frames: Uint8Array[]; delays: number[] } {
  const gif = new GifReader(bytes);
  const { width, height } = gif;
  const canvas = new Uint8Array(width * height * 4);
  const frames: Uint8Array[] = [];
  const delays: number[] = [];
  let previous: Uint8Array | null = null;
  for (let i = 0; i < gif.numFrames(); i += 1) {
    const info = gif.frameInfo(i);
    if (info.disposal === 3) previous = canvas.slice();
    gif.decodeAndBlitFrameRGBA(i, canvas);
    frames.push(canvas.slice());
    delays.push(Math.max(20, (info.delay || 10) * 10));
    if (info.disposal === 2) {
      for (let y = info.y; y < info.y + info.height; y += 1) {
        canvas.fill(0, (y * width + info.x) * 4, (y * width + info.x + info.width) * 4);
      }
    } else if (info.disposal === 3 && previous) {
      canvas.set(previous);
    }
  }
  return { width, height, frames, delays };
}

function sameFrame(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/** Trim to the pixels any frame uses, merge repeated frames, and lay them out in a grid. */
function packSheet(width: number, height: number, frames: Uint8Array[], delays: number[]): { png: Buffer; sheet: Sheet } {
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (const f of frames) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (f[(y * width + x) * 4 + 3]! > 0) {
          x0 = Math.min(x0, x); x1 = Math.max(x1, x);
          y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
      }
    }
  }
  if (x1 < 0) throw new Error('empty sprite');
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;

  const kept: Uint8Array[] = [];
  const keptDelays: number[] = [];
  frames.forEach((f, i) => {
    if (kept.length && sameFrame(kept[kept.length - 1]!, f)) keptDelays[keptDelays.length - 1]! += delays[i]!;
    else {
      kept.push(f);
      keptDelays.push(delays[i]!);
    }
  });

  if (kept.length > MAX_FRAMES) {
    const total = keptDelays.reduce((a, b) => a + b, 0);
    const starts: number[] = [];
    keptDelays.reduce((t, d) => (starts.push(t), t + d), 0);
    const picked: Uint8Array[] = [];
    for (let i = 0; i < MAX_FRAMES; i += 1) {
      const at = (i * total) / MAX_FRAMES;
      let j = starts.length - 1;
      while (j > 0 && starts[j]! > at) j -= 1;
      picked.push(kept[j]!);
    }
    kept.splice(0, kept.length, ...picked);
    keptDelays.splice(0, keptDelays.length, ...picked.map(() => Math.round(total / MAX_FRAMES)));
  }

  const cols = Math.ceil(Math.sqrt(kept.length));
  const rows = Math.ceil(kept.length / cols);
  const out = new PNG({ width: cols * w, height: rows * h });
  kept.forEach((f, i) => {
    const ox = (i % cols) * w;
    const oy = Math.floor(i / cols) * h;
    for (let y = 0; y < h; y += 1) {
      const src = ((y + y0) * width + x0) * 4;
      const dst = ((oy + y) * out.width + ox) * 4;
      out.data.set(f.subarray(src, src + w * 4), dst);
    }
  });
  return { png: encodePng(out.width, out.height, out.data), sheet: { w, h, cols, delays: keptDelays } };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  out.set(data, 8);
  let crc = 0xffffffff;
  for (let i = 4; i < 8 + data.length; i += 1) crc = CRC_TABLE[(crc ^ out[i]!) & 0xff]! ^ (crc >>> 8);
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 8 + data.length);
  return out;
}

/**
 * RGBA to PNG — as an 8-bit palette image when it has 256 colours or fewer,
 * which the sprites always do. That is several times smaller than pngjs's
 * true-colour output.
 */
function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const index = new Map<number, number>([[0, 0]]);
  const pixels = new Uint8Array(width * height);
  for (let i = 0; i < pixels.length; i += 1) {
    const a = rgba[i * 4 + 3]!;
    const key = a === 0 ? 0 : ((rgba[i * 4]! << 24) | (rgba[i * 4 + 1]! << 16) | (rgba[i * 4 + 2]! << 8) | a) >>> 0;
    let v = index.get(key);
    if (v === undefined) {
      v = index.size;
      index.set(key, v);
    }
    pixels[i] = v;
  }
  if (index.size > 256) {
    const png = new PNG({ width, height });
    png.data.set(rgba);
    return PNG.sync.write(png, { colorType: 6 });
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 3; // palette
  const plte = new Uint8Array(index.size * 3);
  const trns = new Uint8Array(index.size);
  for (const [key, i] of index) {
    plte[i * 3] = key >>> 24;
    plte[i * 3 + 1] = (key >>> 16) & 0xff;
    plte[i * 3 + 2] = (key >>> 8) & 0xff;
    trns[i] = key & 0xff;
  }
  const raw = new Uint8Array((width + 1) * height);
  for (let y = 0; y < height; y += 1) raw.set(pixels.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('PLTE', plte), chunk('tRNS', trns),
    chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', new Uint8Array(0)),
  ]);
}

async function fetchSprite(dex: number, shiny: boolean): Promise<void> {
  const name = shiny ? `${dex}-shiny` : `${dex}`;
  if (!FORCE && existsSync(`public/sprites/${name}.json`)) return;
  const dir = shiny ? '/shiny' : '';
  let packed: { png: Buffer; sheet: Sheet };
  try {
    const { width, height, frames, delays } = gifFrames(await download(`${ANIMATED}${dir}/${dex}.gif`));
    packed = packSheet(width, height, frames, delays);
  } catch {
    // No animation (or an unreadable one): the still sprite, as a one-frame sheet.
    const png = PNG.sync.read(Buffer.from(await download(`${STATIC}${dir}/${dex}.png`)));
    packed = packSheet(png.width, png.height, [new Uint8Array(png.data)], [1000]);
  }
  await writeFile(`public/sprites/${name}.png`, packed.png);
  await writeFile(`public/sprites/${name}.json`, JSON.stringify(packed.sheet));
  console.log(`  sprite ${name.padEnd(10)} ${packed.sheet.delays.length} frames ${packed.sheet.w}×${packed.sheet.h}  ${(packed.png.length / 1024).toFixed(0)} KB`);
}

/** 16-bit PCM mono WAV. */
function encodeWav(samples: Float32Array, rate: number): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string): void => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(at + i, s.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); // bytes per second
  view.setUint16(32, 2, true); // bytes per frame
  view.setUint16(34, 16, true); // bits per sample
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, s)) * 32767), true));
  return bytes;
}

async function fetchCry(dex: number): Promise<void> {
  if (!FORCE && existsSync(`public/cries/${dex}.wav`)) return;
  const audio = await decodeCry(await download(`${CRIES}/${dex}.ogg`));
  if (audio.samplesDecoded === 0) throw new Error(`#${dex}: cry decoded to nothing`);
  let mono = toMono(audio.channelData, audio.sampleRate, CRY_RATE);
  const max = Math.round(CRY_MAX_SECONDS * CRY_RATE);
  if (mono.length > max) {
    mono = mono.slice(0, max);
    const fade = Math.round(0.15 * CRY_RATE);
    for (let i = 0; i < fade; i += 1) mono[max - fade + i]! *= 1 - i / fade;
  }
  const wav = encodeWav(mono, CRY_RATE);
  await writeFile(`public/cries/${dex}.wav`, wav);
  console.log(`  cry    #${String(dex).padEnd(8)} ${(mono.length / CRY_RATE).toFixed(2)} s, ${(wav.length / 1024).toFixed(0)} KB`);
}

async function fetchFile(url: string, path: string): Promise<void> {
  if (!FORCE && existsSync(path)) return;
  await writeFile(path, await download(url));
}

async function main(): Promise<void> {
  for (const dir of ['public/sprites', 'public/cries', 'public/items', 'public/badges']) await mkdir(dir, { recursive: true });
  const dexes = [...SPECIES.keys()].sort((a, b) => a - b);
  for (const dex of dexes) {
    await fetchSprite(dex, false);
    await fetchSprite(dex, true);
  }
  for (const dex of dexes) await fetchCry(dex);
  for (const icon of ITEM_ICONS) await fetchFile(`${RAW}/items/${icon}.png`, `public/items/${icon}.png`);
  console.log(`  items  ${ITEM_ICONS.length}`);
  for (let badge = 1; badge <= 24; badge += 1) await fetchFile(`${RAW}/badges/${badge}.png`, `public/badges/${badge}.png`);
  console.log('  badges 1–24');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
