import atlasUrl from './atlas.png';
import atlas from './atlas.json';

type Frame = [number, number, number, number];
const FRAMES = atlas.frames as unknown as Record<string, Frame>;

let image: HTMLImageElement | null = null;

export function loadAtlas(): Promise<HTMLImageElement> {
  if (image) return Promise.resolve(image);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      image = img;
      resolve(img);
    };
    img.onerror = reject;
    img.src = atlasUrl;
  });
}

export function hasSprite(name: string): boolean {
  return name in FRAMES;
}

export function frameOf(name: string): Frame {
  return FRAMES[name] ?? FRAMES['icon-coin']!;
}

/** Draws a sprite with its top-left at (x, y), scaled by an integer for crisp pixels. */
export function drawSprite(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, scale: number): void {
  if (!image) return;
  const [sx, sy, w, h] = frameOf(name);
  ctx.drawImage(image, sx, sy, w, h, Math.round(x), Math.round(y), w * scale, h * scale);
}

/** Draws a sprite centred on (x, y), rotated about a pivot given in sprite pixels. */
export function drawSpriteRotated(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  scale: number,
  angle: number,
  pivotX: number,
  pivotY: number,
): void {
  if (!image) return;
  const [sx, sy, w, h] = frameOf(name);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(angle);
  ctx.drawImage(image, sx, sy, w, h, -pivotX * scale, -pivotY * scale, w * scale, h * scale);
  ctx.restore();
}

/**
 * The same sprite as an inline element for the DOM panels: a background
 * window onto the atlas, scaled by CSS with pixelated sampling.
 */
export function iconHtml(name: string, scale = 2, extraClass = ''): string {
  const [x, y, w, h] = frameOf(name);
  const style =
    `width:${w * scale}px;height:${h * scale}px;` +
    `background-image:url(${atlasUrl});` +
    `background-size:${atlas.width * scale}px ${atlas.height * scale}px;` +
    `background-position:-${x * scale}px -${y * scale}px`;
  return `<span class="spr ${extraClass}" style="${style}" aria-hidden="true"></span>`;
}
