// Combines everything the phone needs into one file, data/melvor2-pocket.bundle:
// content.json plus the optional image, sound and music packs (whichever have been built).
// Layout: "M2BN" | u32 index length | index JSON { "content.json": [offset, length], ... } | file bytes.
// Like its parts, it comes from your own install and is git-ignored.
import fs from 'node:fs';
import path from 'node:path';

const PARTS = ['content.json', 'game-assets.pack', 'game-sounds.pack', 'game-music.pack'];

if (!fs.existsSync('data/content.json')) {
  console.error('data/content.json is missing. Run "npm run data" first.');
  process.exit(1);
}
const index = {};
const chunks = [];
let offset = 0;
for (const name of PARTS) {
  const file = path.join('data', name);
  if (!fs.existsSync(file)) continue;
  const buf = fs.readFileSync(file);
  index[name] = [offset, buf.length];
  chunks.push(buf);
  offset += buf.length;
}
const indexBuf = Buffer.from(JSON.stringify(index));
const head = Buffer.alloc(8);
head.write('M2BN', 0, 'latin1');
head.writeUInt32LE(indexBuf.length, 4);
const out = path.resolve('data/melvor2-pocket.bundle');
fs.writeFileSync(out, Buffer.concat([head, indexBuf, ...chunks]));
console.log(`${Object.keys(index).join(', ')} → ${out} (${(offset / 1048576).toFixed(1)} MB)`);
