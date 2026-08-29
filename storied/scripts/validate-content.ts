/**
 * Content gate. Run with `npm run validate` before committing content
 * changes. Exits non-zero on any integrity or reachability error, so CI can
 * gate a deploy on it — see format.md §13 for what each check means.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContentParseError, parseManifest, parseStory } from '../src/content/parse';
import { validateManifest, validateStory } from '../src/content/validate';
import type { Manifest, Story } from '../src/content/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(__dirname, '..', 'public', 'content');

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf-8')) as unknown;
}

/** Every file under `dir`, relative to `dir`, forward-slashed. */
function listFilesRecursive(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(relative(dir, full).split(sep).join('/'));
  }
  return out;
}

const errors: string[] = [];
const warnings: string[] = [];

console.log('Storied — content report');
console.log('----------------------------');

const manifestPath = join(CONTENT_DIR, 'index.json');
if (!existsSync(manifestPath)) {
  console.error(`FAILED — no manifest at ${manifestPath}`);
  process.exit(1);
}

let manifest: Manifest;
try {
  manifest = parseManifest(readJson(manifestPath), 'index.json');
} catch (error) {
  console.error(`FAILED — index.json: ${error instanceof ContentParseError ? error.message : String(error)}`);
  process.exit(1);
}

errors.push(...validateManifest(manifest).errors);

for (const entry of manifest.stories) {
  const storyPath = join(CONTENT_DIR, entry.path);
  const storyDir = dirname(storyPath);

  if (!existsSync(storyPath)) {
    errors.push(`stories[] "${entry.id}": path "${entry.path}" does not exist`);
    continue;
  }
  if (entry.cover && !existsSync(join(CONTENT_DIR, entry.cover))) {
    errors.push(`stories[] "${entry.id}": cover "${entry.cover}" does not exist`);
  }

  let story: Story;
  try {
    story = parseStory(readJson(storyPath), entry.path);
  } catch (error) {
    errors.push(error instanceof ContentParseError ? error.message : `${entry.path}: ${String(error)}`);
    continue;
  }

  if (story.id !== entry.id) {
    errors.push(`${entry.path}: id "${story.id}" does not match manifest id "${entry.id}"`);
  }

  const report = validateStory(story, {
    imageExists: (relativeSrc) => existsSync(join(storyDir, relativeSrc)),
  });
  errors.push(...report.errors.map((e) => `${entry.path} ${e}`));
  warnings.push(...report.warnings.map((w) => `${entry.path} ${w}`));

  // Warn on an image nobody's story references — the plain filesystem check
  // format.md §13 promises and validate.ts can't do without disk access.
  const referenced = new Set<string>();
  for (const node of Object.values(story.nodes)) {
    for (const block of node.blocks) if (block.type === 'image') referenced.add(block.src);
  }
  if (story.theme?.background?.image) referenced.add(story.theme.background.image);
  // The cover is referenced from the manifest, not from any node — it would
  // otherwise trip the "unreferenced image" warning on every story that has one.
  if (entry.cover) referenced.add(relative(storyDir, join(CONTENT_DIR, entry.cover)).split(sep).join('/'));
  for (const file of listFilesRecursive(join(storyDir, 'images'))) {
    const src = `images/${file}`;
    if (!referenced.has(src)) warnings.push(`${entry.path} images/${file}: not referenced by any node`);
  }

  console.log(`  ${entry.id.padEnd(20)} ${Object.keys(story.nodes).length} nodes`);
}

console.log('');
console.log(`Stories     ${manifest.stories.length}`);

if (warnings.length > 0) {
  console.log('');
  console.log(`Warnings (${warnings.length}):`);
  for (const warning of warnings.slice(0, 25)) console.log(`  · ${warning}`);
  if (warnings.length > 25) console.log(`  … and ${warnings.length - 25} more`);
}

if (errors.length > 0) {
  console.error('');
  console.error(`FAILED — ${errors.length} error(s):`);
  for (const error of errors.slice(0, 60)) console.error(`  ✗ ${error}`);
  if (errors.length > 60) console.error(`  … and ${errors.length - 60} more`);
  process.exit(1);
}

console.log('');
console.log('OK — every node is reachable and the tables are consistent.');
