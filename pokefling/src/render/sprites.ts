import { spriteDexes, spriteUrl, type Facing } from '../data/roster';

const images = new Map<number, HTMLImageElement>();

/** Start every sprite loading. Resolves when each has loaded or failed. */
export function loadSprites(): Promise<void> {
  return Promise.all(
    spriteDexes().map(
      (dex) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.decoding = 'async';
          img.onload = () => {
            images.set(dex, img);
            resolve();
          };
          // A missing sprite falls back to a coloured disc; not worth failing over.
          img.onerror = () => resolve();
          img.src = spriteUrl(dex);
        }),
    ),
  ).then(() => undefined);
}

export function spriteImage(dex: number): HTMLImageElement | undefined {
  return images.get(dex);
}

/**
 * The official artwork leaves a margin around each Pokémon, so it is drawn
 * larger than the collision circle to make the visible body match it.
 */
export const SPRITE_OVERSIZE = 3.1;

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  dex: number,
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
  const img = images.get(dex);
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
