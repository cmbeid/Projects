/**
 * Turns a palette-indexed sprite into something the DOM can show.
 *
 * The tower is drawn into one indexed framebuffer and resolved through the
 * palette once a frame, which is what makes the day/night cycle free. The HUD
 * is ordinary HTML and cannot share that, so the few pieces of the original's
 * chrome we borrow get a little canvas each — repainted when the palette moves,
 * so a gold star at dusk is the same gold as the tower behind it.
 *
 * Split into make-once and repaint-often on purpose: building DOM elements
 * every frame to recolour a 16px star would cost more than the tower does.
 */

import type { IndexedImage } from '../assets/dib.js';
import type { Palette } from '../assets/palette.js';

/** An empty canvas for an icon. Sizing happens when something is painted into it. */
export function makeIcon(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.className = 'icon';
  return canvas;
}

/**
 * Paints a sprite into a canvas from `makeIcon`, resolving indices as it goes.
 *
 * Sized in art pixels and laid out in CSS pixels, so the art stays square
 * whatever the screen density — the same bargain the stage canvas makes. The
 * size is set here rather than at creation because a lit star and an unlit one
 * need not be the same shape, and the canvas has to follow whichever it holds.
 */
export function paintIcon(
  canvas: HTMLCanvasElement,
  image: IndexedImage,
  palette: Palette,
  scale: number,
  transparent?: number,
): void {
  const context = canvas.getContext('2d');
  if (!context) return;

  if (canvas.width !== image.width || canvas.height !== image.height) {
    canvas.width = image.width;
    canvas.height = image.height;
  }
  canvas.style.width = `${image.width * scale}px`;
  canvas.style.height = `${image.height * scale}px`;

  const target = context.createImageData(image.width, image.height);
  for (let i = 0; i < image.width * image.height; i += 1) {
    const index = image.pixels[i] ?? 0;
    const at = i * 4;
    if (index === transparent) {
      target.data[at + 3] = 0;
      continue;
    }
    target.data[at] = palette[index * 4] ?? 0;
    target.data[at + 1] = palette[index * 4 + 1] ?? 0;
    target.data[at + 2] = palette[index * 4 + 2] ?? 0;
    target.data[at + 3] = 255;
  }
  context.putImageData(target, 0, 0);
}
