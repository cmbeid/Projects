/**
 * Downloads the Pokémon artwork, cries and item icons the game uses from
 * PokeAPI into `public/sprites/`, `public/cries/` and `public/items/`. The
 * result is committed, so this only needs re-running when the roster in
 * `src/data/roster.ts` changes.
 *
 * The official artwork is 475 px square — far more than a Pokémon ever covers
 * on screen — so each is box-filtered down to 192 px, a fifth of the bytes.
 *
 * The cries are served as `.ogg`, which older iOS Safari cannot play — and a
 * few, Pikachu's among them, are really MP3s under that name. Each is decoded
 * here according to what it actually is and rewritten as a small mono WAV,
 * which plays everywhere.
 *
 * Pokémon, its artwork and its cries are © Nintendo / Creatures / GAME FREAK.
 * They are used here for a personal, non-commercial project.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { OggVorbisDecoder } from '@wasm-audio-decoders/ogg-vorbis';
import { MPEGDecoder } from 'mpg123-decoder';
import { PNG } from 'pngjs';
import { cryDexes, ITEM_ICONS, spriteArts } from '../src/data/roster';

const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';
const ITEMS = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items';
const CRIES = 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest';
/** Plenty for a cry, and half the size of 44.1 kHz. */
const CRY_RATE = 22_050;
/** Sprite edge in pixels: a boss at full zoom on a 3× screen, and no more. */
const SPRITE_SIZE = 192;

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

/**
 * Shrink a square RGBA image to `size` × `size` by averaging each output
 * pixel's source area, weighting colour by alpha so transparent edges do not
 * bleed dark fringes into the outline.
 */
function downscale(png: PNG, size: number): Uint8Array {
  const out = new PNG({ width: size, height: size });
  const sx = png.width / size;
  const sy = png.height / size;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = Math.floor(y * sy); yy < Math.min(png.height, Math.ceil((y + 1) * sy)); yy += 1) {
        for (let xx = Math.floor(x * sx); xx < Math.min(png.width, Math.ceil((x + 1) * sx)); xx += 1) {
          const i = (yy * png.width + xx) * 4;
          const alpha = png.data[i + 3]!;
          r += png.data[i]! * alpha;
          g += png.data[i + 1]! * alpha;
          b += png.data[i + 2]! * alpha;
          a += alpha;
          n += 1;
        }
      }
      const o = (y * size + x) * 4;
      out.data[o] = a ? Math.round(r / a) : 0;
      out.data[o + 1] = a ? Math.round(g / a) : 0;
      out.data[o + 2] = a ? Math.round(b / a) : 0;
      out.data[o + 3] = n ? Math.round(a / n) : 0;
    }
  }
  return PNG.sync.write(out, { colorType: 6 });
}

function spriteSource(art: string): string {
  const [dex, variant] = art.split('-');
  return variant === 'shiny' ? `${SPRITES}/shiny/${dex}.png` : `${SPRITES}/${dex}.png`;
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

async function main(): Promise<void> {
  for (const dir of ['public/sprites', 'public/cries', 'public/items']) await mkdir(dir, { recursive: true });

  for (const art of spriteArts()) {
    const png = PNG.sync.read(Buffer.from(await download(spriteSource(art))));
    const small = downscale(png, SPRITE_SIZE);
    await writeFile(`public/sprites/${art}.png`, small);
    console.log(`  sprite ${art.padEnd(10)} ${(small.length / 1024).toFixed(0)} KB`);
  }

  for (const dex of cryDexes()) {
    const audio = await decodeCry(await download(`${CRIES}/${dex}.ogg`));
    if (audio.samplesDecoded === 0) throw new Error(`#${dex}: cry decoded to nothing`);
    const wav = encodeWav(toMono(audio.channelData, audio.sampleRate, CRY_RATE), CRY_RATE);
    await writeFile(`public/cries/${dex}.wav`, wav);
    const seconds = (audio.samplesDecoded / audio.sampleRate).toFixed(2);
    console.log(`  cry    #${String(dex).padEnd(8)} ${seconds} s, ${(wav.length / 1024).toFixed(0)} KB`);
  }

  // Item icons are 30 px pixel art already; kept exactly as they are.
  for (const icon of ITEM_ICONS) {
    await writeFile(`public/items/${icon}.png`, await download(`${ITEMS}/${icon}.png`));
  }
  console.log(`  items  ${ITEM_ICONS.join(', ')}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
