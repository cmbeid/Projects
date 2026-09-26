import { itemUrl, spriteUrl, type Facing } from '../data/roster';

/** Loaded images by URL. A URL that failed stays absent, and draws a fallback. */
const images = new Map<string, HTMLImageElement>();
const pending = new Map<string, Promise<void>>();

function loadImage(url: string): Promise<void> {
  const known = pending.get(url);
  if (known) return known;
  const promise = new Promise<void>((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      images.set(url, img);
      resolve();
    };
    // A missing image falls back to a coloured disc; not worth failing over.
    img.onerror = () => resolve();
    img.src = url;
  });
  pending.set(url, promise);
  return promise;
}

/** Load these sprites (by `art`), once each. Resolves when all have loaded or failed. */
export function loadSprites(arts: readonly string[]): Promise<void> {
  return Promise.all(arts.map((art) => loadImage(spriteUrl(art)))).then(() => undefined);
}

export function loadItemIcons(icons: readonly string[]): Promise<void> {
  return Promise.all(icons.map((icon) => loadImage(itemUrl(icon)))).then(() => undefined);
}

/** Draw a pixel-art item icon centred on (x, y), `size` wide, kept crisp. */
export function drawItemIcon(ctx: CanvasRenderingContext2D, icon: string, x: number, y: number, size: number): void {
  const img = images.get(itemUrl(icon));
  if (!img) return;
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
  ctx.imageSmoothingEnabled = smoothing;
}

/**
 * The official artwork leaves a margin around each Pokémon, so it is drawn
 * larger than the collision circle to make the visible body match it.
 */
export const SPRITE_OVERSIZE = 3.1;

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  art: string,
  x: number,
  y: number,
  radius: number,
  angle: number,
  fallback: string,
  /** Which way the artwork looks, and which way it should look on screen. */
  facing: Facing,
  face: 'left' | 'right',
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const img = images.get(spriteUrl(art));
  if (img) {
    const size = radius * SPRITE_OVERSIZE;
    if (facing !== 'front' && facing !== face) ctx.scale(-1, 1);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
  } else {
    ctx.fillStyle = fallback;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}
