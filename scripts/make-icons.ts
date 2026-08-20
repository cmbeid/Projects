/**
 * Renders the PWA icon set from a single SVG.
 *
 * Android's install prompt wants real PNGs at 192 and 512, plus a maskable
 * variant with enough padding that a circular or squircle mask does not clip
 * the artwork. Generating them keeps one source of truth in `assets/icon.svg`.
 *
 * Run with `npm run icons` after editing the SVG.
 */
import { mkdir, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const source = resolve(root, 'assets/icon.svg');
const outDir = resolve(root, 'public/icons');

/** Fraction of the canvas the artwork occupies on a maskable icon. */
const MASKABLE_SCALE = 0.72;
const BACKGROUND = '#0d1220';

await mkdir(outDir, { recursive: true });

for (const size of [192, 512]) {
  await sharp(source, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(resolve(outDir, `icon-${size}.png`));
}

// Maskable: the same art inset inside the safe zone on a solid background, so
// launchers can crop to any shape without cutting into the flask.
const inner = Math.round(512 * MASKABLE_SCALE);
const artwork = await sharp(source, { density: 384 }).resize(inner, inner).png().toBuffer();

await sharp({
  create: {
    width: 512,
    height: 512,
    channels: 4,
    background: BACKGROUND,
  },
})
  .composite([{ input: artwork, gravity: 'centre' }])
  .png()
  .toFile(resolve(outDir, 'icon-maskable-512.png'));

await sharp(source, { density: 384 })
  .resize(180, 180)
  .png()
  .toFile(resolve(outDir, 'apple-touch-icon.png'));

await copyFile(source, resolve(outDir, 'favicon.svg'));

console.log(`Wrote icons to ${outDir}`);
