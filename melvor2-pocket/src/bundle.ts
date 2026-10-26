// One-file setup: melvor2-pocket.bundle (built by tools/build-bundle.mjs) holds content.json plus the optional
// image, sound and music packs. Unpacking stores each part in this browser exactly as if it had been loaded alone.
import { validateContent } from './engine/content';
import { storeAssets, storeBlob, storeContent } from './save';

const MAGIC = 'M2BN';

export async function isBundle(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return String.fromCharCode(...head) === MAGIC;
}

/** Store every part of a bundle. Returns the names of the parts it contained. */
export async function unpackBundle(file: Blob): Promise<string[]> {
  const len = new DataView(await file.slice(4, 8).arrayBuffer()).getUint32(0, true);
  const index = JSON.parse(await file.slice(8, 8 + len).text()) as Record<string, [number, number]>;
  const part = (name: string) => {
    const e = index[name];
    return e ? file.slice(8 + len + e[0], 8 + len + e[0] + e[1]) : null;
  };
  const content = part('content.json');
  if (!content) throw new Error('This bundle has no game data in it.');
  await storeContent(validateContent(JSON.parse(await content.text())));
  // Store real copies, not slices of the picked file, so they outlive it.
  const copy = async (b: Blob) => new Blob([await b.arrayBuffer()]);
  const assets = part('game-assets.pack');
  if (assets) await storeAssets(await copy(assets));
  const sounds = part('game-sounds.pack');
  if (sounds) await storeBlob('sounds', await copy(sounds));
  const music = part('game-music.pack');
  if (music) await storeBlob('music', await copy(music));
  return Object.keys(index);
}
