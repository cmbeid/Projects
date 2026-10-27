// Builds data/game-assets.pack from your own Melvor Idle 2 Demo install: the images the game data refers to
// (item icons, recipe art, monster sprites), as the WebP images Godot stores inside its .ctex textures. Page backgrounds
// (each skill/page's Day, Sunset and Night scene) are scaled down and re-encoded so the pack stays phone-sized; other
// large scenes are left out.
// Pack layout: "M2AP" | u32 index length | index JSON { "res://path.png": [offset, length] } | WebP bytes.
// Like data/content.json, it's for your own devices only and is git-ignored.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
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

// Page backgrounds: the desktop shows them full-window (mostly blurred), so a smaller copy loses little.
const backgrounds = new Set([
  ...content.Objects.EntityPage.flatMap((p) => (p.TimeOfDayBackgrounds ?? []).map((b) => b.Texture)),
  // Combat's page entry names an image this build doesn't have; fights are drawn over the area's centre scene instead.
  ...content.Objects.CombatAreaBackground.flatMap((b) => b.Textures.map((t) => t.Value.Center)),
]);
const BG_WIDTH = 1280;
const BG_QUALITY = 60;

const index = {};
const chunks = [];
let offset = 0;
let missing = 0;
let skipped = 0;
let bgBytes = 0;
const MAX_IMAGE_BYTES = 64 * 1024;
/** Monster and tree art is bigger, and the combat screen and tree cards show it. */
const MAX_MONSTER_BYTES = 192 * 1024;
/** Size oversized monster/tree art is scaled down to (the combat screen shows it at most ~300 px). */
const ART_WIDTH = 512;
let shrunk = 0;
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
  if (backgrounds.has(res)) {
    const small = await sharp(webp).resize({ width: BG_WIDTH, withoutEnlargement: true }).webp({ quality: BG_QUALITY }).toBuffer();
    index[res] = [offset, small.length];
    chunks.push(small);
    offset += small.length;
    bgBytes += small.length;
    continue;
  }
  // Icon-sized art only: other backgrounds and full scenes are large and the mobile UI doesn't use them.
  const big = res.includes("/Monsters/") || res.includes("/Skills/Woodcutting/");
  let img = webp;
  // Oversized monster and tree art is shrunk to fit rather than dropped (the Archery Target is ~370 KB).
  if (big && img.length > MAX_MONSTER_BYTES) {
    img = await sharp(webp).resize({ width: ART_WIDTH, height: ART_WIDTH, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    shrunk++;
  }
  if (img.length > (big ? MAX_MONSTER_BYTES : MAX_IMAGE_BYTES) || /^res:\/\/Assets\/(Backgrounds|Quests|Shop)\//.test(res)) {
    skipped++;
    continue;
  }
  index[res] = [offset, img.length];
  chunks.push(img);
  offset += img.length;
}
pack.close();

const indexBuf = Buffer.from(JSON.stringify(index));
const head = Buffer.alloc(8);
head.write('M2AP', 0, 'latin1');
head.writeUInt32LE(indexBuf.length, 4);
const out = path.resolve('data/game-assets.pack');
fs.writeFileSync(out, Buffer.concat([head, indexBuf, ...chunks]));
console.log(`${Object.keys(index).length} images (${(offset / 1048576).toFixed(1)} MB, backgrounds ${(bgBytes / 1048576).toFixed(1)} MB), ${shrunk} large monsters/trees shrunk, ${skipped} large scenes skipped, ${missing} not found; wrote ${out}`);
