// Uploads data/content.json as the release asset 'melvor2-data' that the Pages build can bundle
// (when the repository variable MELVOR2_BUNDLE_DATA is 'true').
// Refuses to upload unless the repository is private: release assets of a public repo are public.
// Usage: npm run data:upload            (repo defaults to cmbeid/Projects; override with MELVOR2_REPO)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const REPO = process.env.MELVOR2_REPO || 'cmbeid/Projects';
const TAG = 'melvor2-data';
const FILE = 'data/content.json';
/** Optional: game images, uploaded too when it has been built (npm run assets). */
const ASSETS = 'data/game-assets.pack';

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

if (!fs.existsSync(FILE)) {
  console.error(`${FILE} is missing. Run "npm run data" first.`);
  process.exit(1);
}

const visibility = gh('repo', 'view', REPO, '--json', 'visibility', '--jq', '.visibility');
if (visibility !== 'PRIVATE') {
  console.error(`${REPO} is ${visibility.toLowerCase()}. Release assets of a public repo are public, so the game data was not uploaded.`);
  process.exit(1);
}

let exists = true;
try {
  gh('release', 'view', TAG, '--repo', REPO);
} catch {
  exists = false;
}
const files = fs.existsSync(ASSETS) ? [FILE, ASSETS] : [FILE];
if (exists) {
  gh('release', 'upload', TAG, ...files, '--repo', REPO, '--clobber');
} else {
  gh(
    'release', 'create', TAG, ...files, '--repo', REPO,
    '--title', 'Melvor 2 Pocket game data',
    '--notes', 'content.json from a local Melvor Idle 2 Demo install, for the private Pages build. Delete this release before making the repo public.',
  );
}
console.log(`Uploaded ${files.join(' and ')} to ${REPO} release ${TAG}.`);
console.log('Set the repository variable MELVOR2_BUNDLE_DATA to true to bundle it into the next Pages build.');
