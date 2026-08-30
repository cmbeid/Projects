/**
 * Checks a single portable story file (format.md §14) — the CLI equivalent
 * of the shelf's own "Import a story…" button, for an author iterating on
 * one outside `public/content/` who wants a fast, scriptable feedback loop
 * instead of the browser's import error as the only signal. Reuses the
 * exact `parseStory`/`validateStory` pair and the same "every image must be
 * a data: URI" rule the browser importer enforces — see offline.md.
 */
import { readFileSync } from 'node:fs';
import { ContentParseError, parseStory } from '../src/content/parse';
import { validateStory } from '../src/content/validate';
import { findNonEmbeddedAsset } from '../src/state/localStories';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: npm run validate:portable -- <path-to-story.json>');
  process.exit(1);
}

let raw: string;
try {
  raw = readFileSync(filePath, 'utf-8');
} catch (error) {
  console.error(`Could not read ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

let parsed: unknown;
try {
  parsed = JSON.parse(raw);
} catch (error) {
  console.error(`FAILED — not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

let story;
try {
  story = parseStory(parsed);
} catch (error) {
  console.error(`FAILED — ${error instanceof ContentParseError ? error.message : String(error)}`);
  process.exit(1);
}

console.log(`Portable story check — ${filePath}`);
console.log('----------------------------');
console.log(`  ${story.id.padEnd(20)} ${Object.keys(story.nodes).length} nodes`);
console.log('');

const report = validateStory(story);
if (report.warnings.length > 0) {
  console.log(`Warnings (${report.warnings.length}):`);
  for (const warning of report.warnings) console.log(`  · ${warning}`);
  console.log('');
}

const errors = [...report.errors];
const offendingAsset = findNonEmbeddedAsset(story);
if (offendingAsset) {
  errors.push(
    `${offendingAsset}: needs to be a data: URI to import locally (format.md §14) — there's no folder here to resolve a relative path against, same as in the browser`,
  );
}

if (errors.length > 0) {
  console.error(`FAILED — ${errors.length} error(s):`);
  for (const error of errors) console.error(`  ✗ ${error}`);
  process.exit(1);
}

console.log('OK — this file will import cleanly.');
