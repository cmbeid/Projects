/**
 * Runs after `vite build` and writes `dist/sw-manifest.json` — the list of
 * app-shell URLs `public/sw.js` precaches, plus a version derived from their
 * actual bytes so a rebuild with no real changes doesn't force a new cache
 * (and any real change always does). Deliberately excludes `dist/content/`:
 * per offline.md, the shell precache must not bake the story catalog in
 * sight-unseen — that would defeat "no rebuild to add a story"
 * (`PLAN.md` §1). Content is cached at runtime instead, by `sw.js` itself,
 * as a visit actually fetches it.
 *
 * Reads the *built* `index.html` for its actual `<script src>`/`<link
 * href>` values rather than assuming Vite's output layout, so this keeps
 * working if that layout ever changes.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, '..', 'dist');
const INDEX_HTML = join(DIST_DIR, 'index.html');

if (!existsSync(INDEX_HTML)) {
  console.error(`FAILED — no built ${INDEX_HTML}. Run this after \`vite build\`, not instead of it.`);
  process.exit(1);
}

const html = readFileSync(INDEX_HTML, 'utf-8');

/** Every relative `src="…"`/`href="…"` in the built HTML — a same-origin, locally-served asset, not an absolute or protocol-relative URL. */
function localAssetPaths(markup: string): string[] {
  const paths = new Set<string>();
  const attrRe = /\b(?:src|href)="([^"]+)"/g;
  for (const match of markup.matchAll(attrRe)) {
    const value = match[1]!;
    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('//')) continue;
    paths.add(value.startsWith('./') ? value : `./${value.replace(/^\//, '')}`);
  }
  return [...paths];
}

const urls = ['./', './index.html', ...localAssetPaths(html)];

const hash = createHash('sha256');
hash.update(JSON.stringify(urls.slice().sort()));
for (const url of urls) {
  const relative = url === './' ? 'index.html' : url.replace(/^\.\//, '');
  const filePath = join(DIST_DIR, relative);
  if (existsSync(filePath)) hash.update(readFileSync(filePath));
}
const version = hash.digest('hex').slice(0, 12);

writeFileSync(join(DIST_DIR, 'sw-manifest.json'), JSON.stringify({ version, urls }, null, 2));
console.log(`Service worker manifest: ${urls.length} shell URL(s), version ${version}`);
