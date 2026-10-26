// Builds the optional sound packs from your own Melvor Idle 2 Demo install:
//   data/game-sounds.pack  skill action sounds, combat hits, level-up jingles, interface clicks (small)
//   data/game-music.pack   the music tracks (large; only with --music)
// Godot keeps Ogg Vorbis as packet lists (rebuilt here into standard .ogg files) and WAVs as QOA streams (kept as
// QOA; the app decodes it). Pack layout: "M2SP" | u32 index length | index JSON
// { "res://...": [offset, length, "ogg" | "qoa" | "wav"] } | data. For your own devices only; git-ignored.
import fs from 'node:fs';
import path from 'node:path';
import { openPack } from './extract-pck.mjs';
import { readResource } from './godot-resource.mjs';
import { decodeQoa, encodeQoa } from '../src/audio/qoa.ts';

const withMusic = process.argv.includes('--music');
/** Music is downmixed to mono at this rate and re-encoded as QOA: about a quarter of the size, fine on a phone. */
const MUSIC_RATE = 24000;
const musicTracks = new Set(
  JSON.parse(fs.readFileSync('data/content.json', 'utf8')).Objects.MusicTrack.map((t) => t.AudioStream),
);

/** Mono, half-rate copy of a QOA track (averaging channels and sample pairs). */
function shrinkMusic(qoa) {
  const a = decodeQoa(new Uint8Array(qoa.buffer, qoa.byteOffset, qoa.byteLength));
  const step = Math.max(1, Math.round(a.sampleRate / MUSIC_RATE));
  const n = Math.floor(a.samples / step);
  const mono = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let k = 0; k < step; k++) for (let c = 0; c < a.channels; c++) sum += a.data[c][i * step + k];
    mono[i] = Math.round(sum / (step * a.channels));
  }
  return Buffer.from(encodeQoa({ channels: 1, sampleRate: Math.round(a.sampleRate / step), samples: n, data: [mono] }));
}

// ---- Ogg pages from Godot's OggPacketSequence -------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let j = 0; j < 8; j++) r = r & 0x80000000 ? ((r << 1) ^ 0x04c11db7) >>> 0 : (r << 1) >>> 0;
    t[i] = r >>> 0;
  }
  return t;
})();

function oggCrc(buf) {
  let crc = 0;
  for (const b of buf) crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) & 0xff) ^ b]) >>> 0;
  return crc;
}

/** One logical Ogg stream: Godot's pages of packets, re-laced (splitting pages that exceed 255 segments). */
function buildOgg(pages, granules) {
  const serial = 0x4d324f47; // "M2OG"
  const out = [];
  let seq = 0;
  const writePage = (segments, body, granule, flags) => {
    const head = Buffer.alloc(27 + segments.length);
    head.write('OggS', 0, 'latin1');
    head[4] = 0;
    head[5] = flags;
    head.writeBigInt64LE(BigInt(granule), 6);
    head.writeUInt32LE(serial, 14);
    head.writeUInt32LE(seq++, 18);
    head[26] = segments.length;
    segments.forEach((s, i) => (head[27 + i] = s));
    const page = Buffer.concat([head, body]);
    page.writeUInt32LE(oggCrc(page), 22);
    out.push(page);
  };
  pages.forEach((packets, pi) => {
    const last = pi === pages.length - 1;
    // Lace every packet: runs of 255, then a final segment < 255 (0 if the length is a multiple of 255).
    const segs = [];
    const bodies = [];
    for (const p of packets) {
      let left = p.length;
      while (left >= 255) {
        segs.push(255);
        left -= 255;
      }
      segs.push(left);
      bodies.push(p);
    }
    const body = Buffer.concat(bodies);
    let offset = 0;
    let continued = false;
    for (let i = 0; i < segs.length; i += 255) {
      const chunk = segs.slice(i, i + 255);
      const size = chunk.reduce((s, x) => s + x, 0);
      const finalChunk = i + 255 >= segs.length;
      let flags = continued ? 1 : 0;
      if (pi === 0 && i === 0) flags |= 2;
      if (last && finalChunk) flags |= 4;
      // A page where no packet ends carries granule -1.
      writePage(chunk, body.subarray(offset, offset + size), finalChunk ? granules[pi] : -1n, flags);
      offset += size;
      continued = chunk[chunk.length - 1] === 255;
    }
  });
  return Buffer.concat(out);
}

// ---- extraction -------------------------------------------------------------------------------

function decodeAudio(buf) {
  let res;
  try {
    res = readResource(buf);
  } catch {
    return null; // e.g. the one MP3 stream, or a compressed resource
  }
  if (res.type === 'AudioStreamOggVorbis') {
    const seq = res.resources.find((r) => r.type === 'OggPacketSequence').props;
    return { kind: 'ogg', data: buildOgg(seq.packet_data, seq.granule_positions.map(BigInt)) };
  }
  if (res.type === 'AudioStreamWAV') {
    const p = res.resources.find((r) => r.type === 'AudioStreamWAV').props;
    if (p.format === 3) return { kind: 'qoa', data: p.data }; // a complete QOA stream ("qoaf")
    if (p.format === 1 || p.format === 0) return { kind: 'wav', data: wavFile(p) };
    return null; // IMA ADPCM isn't used by the demo
  }
  return null;
}

function wavFile(p) {
  const bits = p.format === 1 ? 16 : 8;
  const ch = p.stereo ? 2 : 1;
  const rate = p.mix_rate ?? 44100;
  const pcm = bits === 8 ? Buffer.from(p.data.map((b) => (b + 128) & 0xff)) : p.data; // Godot 8-bit is signed
  const h = Buffer.alloc(44);
  h.write('RIFF', 0, 'latin1');
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVEfmt ', 8, 'latin1');
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(ch, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE((rate * ch * bits) / 8, 28);
  h.writeUInt16LE((ch * bits) / 8, 32);
  h.writeUInt16LE(bits, 34);
  h.write('data', 36, 'latin1');
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

function writePack(file, items) {
  const index = {};
  const chunks = [];
  let offset = 0;
  for (const [res, { kind, data }] of items) {
    index[res] = [offset, data.length, kind];
    chunks.push(data);
    offset += data.length;
  }
  const indexBuf = Buffer.from(JSON.stringify(index));
  const head = Buffer.alloc(8);
  head.write('M2SP', 0, 'latin1');
  head.writeUInt32LE(indexBuf.length, 4);
  fs.writeFileSync(file, Buffer.concat([head, indexBuf, ...chunks]));
  console.log(`${path.basename(file)}: ${items.length} sounds, ${(offset / 1048576).toFixed(1)} MB`);
}

const pack = openPack();
const byPath = new Map(pack.entries.map((e) => [e.path, e]));
const sounds = [];
const music = [];
let skipped = 0;
for (const e of pack.entries) {
  const m = /^(Assets\/Audio\/.+)\.import$/.exec(e.path);
  if (!m) continue;
  const res = `res://${m[1]}`;
  const isMusic = res.includes('/Audio/Music/');
  // Weather loops are long and not used by the mobile UI.
  if (res.includes('/Audio/Weather/') || (isMusic && (!withMusic || !musicTracks.has(res)))) continue;
  const target = /path="res:\/\/(.+?)"/.exec(pack.read(e).toString('utf8'))?.[1];
  const stream = target && byPath.get(target);
  const decoded = stream && decodeAudio(pack.read(stream));
  if (!decoded) {
    skipped++;
    continue;
  }
  if (isMusic && decoded.kind === 'qoa') {
    decoded.data = shrinkMusic(decoded.data);
    process.stdout.write('.');
  }
  (isMusic ? music : sounds).push([res, decoded]);
}
pack.close();
if (withMusic) console.log('');
writePack(path.resolve('data/game-sounds.pack'), sounds);
if (withMusic) writePack(path.resolve('data/game-music.pack'), music);
if (skipped) console.log(`${skipped} files in formats the app doesn't use were skipped.`);
