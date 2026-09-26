/**
 * Animated sprite sheets from `public/sprites/` (see `scripts/fetch-assets.ts`)
 * and item icons from `public/items/`. Loaded on demand; until a sheet
 * arrives, nothing is drawn for it.
 */
import { sheetUrl, spriteUrl } from '../data/species';
import { itemIconUrl } from '../data/items';

interface SheetInfo {
  w: number;
  h: number;
  cols: number;
  delays: number[];
}

interface Sheet extends SheetInfo {
  image: HTMLImageElement;
  /** Cumulative end time of each frame, ms. */
  ends: number[];
  total: number;
}

const sheets = new Map<string, Sheet | null>();
const images = new Map<string, HTMLImageElement | null>();

function key(dex: number, shiny: boolean): string {
  return shiny ? `${dex}-shiny` : `${dex}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const pending = new Map<string, Promise<void>>();

/** Load a sheet; every caller gets the same promise, resolved once it is ready. */
export function loadSheet(dex: number, shiny = false): Promise<void> {
  const k = key(dex, shiny);
  const existing = pending.get(k);
  if (existing) return existing;
  sheets.set(k, null);
  const promise = Promise.all([fetch(sheetUrl(dex, shiny)).then((r) => r.json() as Promise<SheetInfo>), loadImage(spriteUrl(dex, shiny))])
    .then(([info, image]) => {
      const ends: number[] = [];
      let t = 0;
      for (const d of info.delays) ends.push((t += d));
      sheets.set(k, { ...info, image, ends, total: t });
    })
    .catch(() => undefined);
  pending.set(k, promise);
  return promise;
}

export function loadSheets(dexes: Iterable<number>, shiny = false): Promise<void> {
  return Promise.all([...dexes].map((d) => loadSheet(d, shiny))).then(() => undefined);
}

export function sheetSize(dex: number, shiny = false): { w: number; h: number } | null {
  const s = sheets.get(key(dex, shiny)) ?? sheets.get(key(dex, false));
  return s ? { w: s.w, h: s.h } : null;
}

/**
 * Draw a Pokémon standing on (x, y) — its feet at y — `scale` screen pixels
 * per sprite pixel. `time` in ms picks the frame; `phase` desyncs neighbours.
 */
export function drawPokemon(
  ctx: CanvasRenderingContext2D,
  dex: number,
  x: number,
  y: number,
  scale: number,
  opts: { time: number; shiny?: boolean; flip?: boolean; alpha?: number; phase?: number; tint?: string | null; frozen?: boolean } = { time: 0 },
): boolean {
  let s = sheets.get(key(dex, Boolean(opts.shiny)));
  if (!s && opts.shiny) {
    void loadSheet(dex, true);
    s = sheets.get(key(dex, false));
  }
  if (!s) {
    void loadSheet(dex, false);
    return false;
  }
  const t = opts.frozen ? 0 : (opts.time + (opts.phase ?? 0)) % s.total;
  let frame = 0;
  while (frame < s.ends.length - 1 && s.ends[frame]! <= t) frame += 1;
  const sx = (frame % s.cols) * s.w;
  const sy = Math.floor(frame / s.cols) * s.h;
  const w = s.w * scale;
  const h = s.h * scale;
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  ctx.translate(Math.round(x), Math.round(y));
  // Black/White sprites face left; flip to face right.
  if (opts.flip) ctx.scale(-1, 1);
  ctx.drawImage(s.image, sx, sy, s.w, s.h, Math.round(-w / 2), Math.round(-h), Math.round(w), Math.round(h));
  if (opts.tint) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = opts.tint;
    ctx.fillRect(Math.round(-w / 2), Math.round(-h), Math.round(w), Math.round(h));
  }
  ctx.restore();
  return true;
}

/**
 * A tinted copy of a sprite frame can't be made with `source-atop` on the main
 * canvas (it would tint everything under it too), so tints go through this
 * small scratch canvas.
 */
const scratch = typeof document !== 'undefined' ? document.createElement('canvas') : null;

export function drawPokemonTinted(
  ctx: CanvasRenderingContext2D,
  dex: number,
  x: number,
  y: number,
  scale: number,
  tint: string,
  opts: { time: number; shiny?: boolean; flip?: boolean; alpha?: number; phase?: number; frozen?: boolean },
): void {
  const size = sheetSize(dex, opts.shiny);
  if (!scratch || !size) {
    drawPokemon(ctx, dex, x, y, scale, opts);
    return;
  }
  const w = Math.ceil(size.w * scale) + 2;
  const h = Math.ceil(size.h * scale) + 2;
  if (scratch.width < w) scratch.width = w;
  if (scratch.height < h) scratch.height = h;
  const sc = scratch.getContext('2d')!;
  sc.clearRect(0, 0, scratch.width, scratch.height);
  sc.imageSmoothingEnabled = false;
  drawPokemon(sc, dex, w / 2, h - 1, scale, { ...opts, alpha: 1, tint });
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  ctx.drawImage(scratch, 0, 0, w, h, Math.round(x - w / 2), Math.round(y - h + 1), w, h);
  ctx.restore();
}

export function loadIcon(key: string): HTMLImageElement | null {
  const cached = images.get(key);
  if (cached !== undefined) return cached;
  images.set(key, null);
  loadImage(itemIconUrl(key)).then((img) => images.set(key, img), () => undefined);
  return null;
}

export function drawIcon(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, size: number): void {
  const img = loadIcon(key);
  if (img) ctx.drawImage(img, Math.round(x - size / 2), Math.round(y - size / 2), Math.round(size), Math.round(size));
}
