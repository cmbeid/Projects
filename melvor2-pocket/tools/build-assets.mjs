// Builds data/game-assets.pack from your own Melvor Idle 2 Demo install: the images the game data refers to
// (item icons, recipe art, monster sprites; large backgrounds and scenes are left out), as the WebP images Godot stores inside its .ctex textures.
// Pack layout: "M2AP" | u32 index length | index JSON { "res://path.png": [offset, length] } | WebP bytes.
// Like data/content.json, it's for your own devices only and is git-ignored.
import fs from 'node:fs';
import path from 'node:path';
import { openPack } from './extract-pck.mjs';

const pack = openPack();
const byPath = new Map(pack.entries.map((e) => [e.path, e]));
const content = JSON.parse(fs.readFileSync('data/content.json', 'utf8'));

// Every res://...png the content mentions.
const wanted = new Set();
(function walk(node) {
  if (Array.isArray(node)) node.forEach(walk);
  else if (node && typeof node === 'object') Object.values(node).forEach(walk);
  else if (typeof node === 'string' && node.startsWith('res://Assets/') && node.endsWith('.png')) wanted.add(node);
})(content);

/** WebP inside a GST2 .ctex (non-VRAM textures only): header, then data format 2 = WebP, then the first mip. */
function webpFromCtex(buf) {
  if (buf.toString('latin1', 0, 4) !== 'GST2') return null;
  const dataFormat = buf.readUInt32LE(36);
  if (dataFormat !== 2) return null; // 1 = PNG is possible too, but the demo uses WebP
  const size = buf.readUInt32LE(52);
  const img = buf.subarray(56, 56 + size);
  return img.toString('latin1', 0, 4) === 'RIFF' ? img : null;
}

const index = {};
const chunks = [];
let offset = 0;
let missing = 0;
let skipped = 0;
const MAX_IMAGE_BYTES = 64 * 1024;
/** Monster and tree art is bigger, and the combat screen and tree cards show it. */
const MAX_MONSTER_BYTES = 192 * 1024;
for (const res of wanted) {
  const rel = res.replace('res://', '');
  const imp = byPath.get(`${rel}.import`);
  const target = imp && /path="res:\/\/(.+?\.ctex)"/.exec(pack.read(imp).toString('utf8'))?.[1];
  const ctex = target && byPath.get(target);
  const webp = ctex && webpFromCtex(pack.read(ctex));
  if (!webp) {
    missing++;
    continue;
  }
  // Icon-sized art only: backgrounds and full scenes are large and the mobile UI doesn't use them.
  const limit = res.includes("/Monsters/") || res.includes("/Skills/Woodcutting/") ? MAX_MONSTER_BYTES : MAX_IMAGE_BYTES;
  if (webp.length > limit || /^res:\/\/Assets\/(Backgrounds|Quests|Shop)\//.test(res)) {
    skipped++;
    continue;
  }
  index[res] = [offset, webp.length];
  chunks.push(webp);
  offset += webp.length;
}
pack.close();

const indexBuf = Buffer.from(JSON.stringify(index));
const head = Buffer.alloc(8);
head.write('M2AP', 0, 'latin1');
head.writeUInt32LE(indexBuf.length, 4);
const out = path.resolve('data/game-assets.pack');
fs.writeFileSync(out, Buffer.concat([head, indexBuf, ...chunks]));
console.log(`${Object.keys(index).length} images (${(offset / 1048576).toFixed(1)} MB), ${skipped} large scenes skipped, ${missing} not found; wrote ${out}`);
