// Builds data/content.json from the MelvorDemo.json package inside your local Steam install.
// Fails if any object reference points at an id that does not exist.
import fs from 'node:fs';
import path from 'node:path';
import { openPack } from './extract-pck.mjs';

const NS = 'MelvorBase:';
// Keys whose values name code-defined things (components, statistics), not data objects.
const CODE_REF_KEYS = new Set(['Type', 'Id', 'StatsType', 'Statistic', 'Component']);

const pack = openPack();
const entry = pack.entries.find((e) => e.path.endsWith('Data/Packages/MelvorDemo.json'));
if (!entry) throw new Error('MelvorDemo.json not found in pack');
const pkg = JSON.parse(pack.read(entry).toString('utf8').replace(/^﻿/, ''));
pack.close();

// EventBus is an entity defined in game code rather than in the package.
const ids = new Set([...Object.keys(pkg.EntityConfig), `${NS}EventBus`]);
for (const list of Object.values(pkg.Objects)) for (const o of list) ids.add(NS + o.Id);

const dangling = new Map();
function walk(node, key) {
  if (Array.isArray(node)) for (const v of node) walk(v, key);
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, k);
  else if (typeof node === 'string' && node.startsWith(NS) && !CODE_REF_KEYS.has(key) && !ids.has(node)) {
    dangling.set(node, key);
  }
}
walk(pkg.Objects);
walk(pkg.EntityConfig);

const counts = Object.fromEntries(
  Object.entries(pkg.Objects).filter(([, v]) => v.length).map(([k, v]) => [k, v.length]),
);
const skills = Object.keys(pkg.EntityConfig).map((k) => k.slice(NS.length));
console.log(`objects: ${ids.size} ids across ${Object.keys(counts).length} types`);
console.log(`entity configs (${skills.length}): ${skills.join(', ')}`);

if (dangling.size) {
  for (const [id, key] of dangling) console.error(`dangling reference ${id} (key ${key})`);
  process.exit(1);
}

const outDir = path.resolve('data');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'content.json'), JSON.stringify(pkg));
fs.writeFileSync(path.join(outDir, 'counts.json'), JSON.stringify(counts, null, 2));
console.log(`wrote ${path.join(outDir, 'content.json')}`);
