// No bundler: the page is four static files, kept that way so index.html
// also works opened straight from disk. Building is copying them to dist/.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist);
for (const file of ['index.html', 'editor.js', 'items.js', 'recipes.js']) {
  fs.copyFileSync(path.join(root, file), path.join(dist, file));
}
console.log('Built dist/');
