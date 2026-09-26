/**
 * Downloads the Pokémon artwork and cries the game uses from PokeAPI into
 * `public/sprites/` and `public/cries/`. The result is committed, so this
 * only needs re-running when the roster in `src/data/roster.ts` changes.
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
import { spriteDexes } from '../src/data/roster';

const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';
const CRIES = 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest';
/** Plenty for a cry, and half the size of 44.1 kHz. */
const CRY_RATE = 22_050;

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
  await mkdir('public/sprites', { recursive: true });
  await mkdir('public/cries', { recursive: true });
  for (const dex of spriteDexes()) {
    const sprite = await download(`${SPRITES}/${dex}.png`);
    await writeFile(`public/sprites/${dex}.png`, sprite);

    const ogg = await download(`${CRIES}/${dex}.ogg`);
    const audio = await decodeCry(ogg);
    if (audio.samplesDecoded === 0) throw new Error(`#${dex}: cry decoded to nothing`);
    const wav = encodeWav(toMono(audio.channelData, audio.sampleRate, CRY_RATE), CRY_RATE);
    await writeFile(`public/cries/${dex}.wav`, wav);

    const seconds = (audio.samplesDecoded / audio.sampleRate).toFixed(2);
    console.log(`  #${String(dex).padEnd(4)} sprite ${(sprite.length / 1024).toFixed(0)} KB, cry ${seconds} s ${(wav.length / 1024).toFixed(0)} KB`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
