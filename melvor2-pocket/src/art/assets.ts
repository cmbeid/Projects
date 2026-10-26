// Optional game art: images from the player's own install (game-assets.pack, built by tools/build-assets.mjs).
// When it's loaded, icons come from it; anything missing, or everything when it isn't loaded, uses the generated art.
const MAGIC = 'M2AP';

let packBlob: Blob | null = null;
let index: Record<string, [number, number]> = {};
const urls = new Map<string, string>();

/** Throws if the file isn't an asset pack. Returns the number of images. */
export async function loadAssetPack(blob: Blob): Promise<number> {
  const head = new DataView(await blob.slice(0, 8).arrayBuffer());
  const magic = String.fromCharCode(head.getUint8(0), head.getUint8(1), head.getUint8(2), head.getUint8(3));
  if (magic !== MAGIC) throw new Error("That isn't a game-assets.pack. Build it with `npm run assets` on your PC.");
  const len = head.getUint32(4, true);
  const parsed = JSON.parse(await blob.slice(8, 8 + len).text()) as Record<string, [number, number]>;
  for (const u of urls.values()) URL.revokeObjectURL(u);
  urls.clear();
  index = {};
  for (const [k, [o, l]] of Object.entries(parsed)) index[k] = [8 + len + o, l];
  packBlob = blob;
  return Object.keys(index).length;
}

export function clearAssetPack(): void {
  for (const u of urls.values()) URL.revokeObjectURL(u);
  urls.clear();
  index = {};
  packBlob = null;
}

export const hasAssetPack = () => packBlob !== null;

/** Object URL for a res:// image path from the game data, if the pack has it. */
export function assetUrl(resPath: string | null | undefined): string | undefined {
  if (!packBlob || !resPath) return undefined;
  let url = urls.get(resPath);
  if (url) return url;
  const entry = index[resPath];
  if (!entry) return undefined;
  url = URL.createObjectURL(new Blob([packBlob.slice(entry[0], entry[0] + entry[1])], { type: 'image/webp' }));
  urls.set(resPath, url);
  return url;
}
