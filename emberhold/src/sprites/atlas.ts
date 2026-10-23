import atlasUrl from './atlas.png';
import atlas from './atlas.json';

type Frame = [number, number, number, number];
const FRAMES = atlas.frames as unknown as Record<string, Frame>;

export function hasSprite(name: string): boolean {
  return name in FRAMES;
}

export function frameOf(name: string): Frame {
  return FRAMES[name] ?? FRAMES['ui.star']!;
}

/** Waits for the atlas so the first screen doesn't flash empty boxes. */
export function loadAtlas(): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = atlasUrl;
  });
}

/**
 * A sprite as an inline element: a background window onto the atlas,
 * scaled by CSS with pixelated sampling.
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
