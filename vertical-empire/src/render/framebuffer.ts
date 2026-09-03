/**
 * An 8-bit indexed framebuffer, resolved to RGBA once per frame.
 *
 * This is the load-bearing decision of the whole renderer. SimTower animates by
 * swapping its colour table, not by redrawing: the sky moves through the day,
 * windows light up at dusk, and lift indicators blink, all without a single
 * sprite changing. Keeping the buffer indexed until the last step means we get
 * that for the cost of a lookup table, exactly as the original did.
 *
 * Draw at native art resolution. Scaling is the canvas's job, and integer-only
 * so the pixels stay square.
 */

import type { IndexedImage } from '../assets/dib.js';
import type { Palette } from '../assets/palette.js';

export class Framebuffer {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;

  constructor(width: number, height: number) {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.pixels = new Uint8Array(this.width * this.height);
  }

  clear(ink: number): void {
    this.pixels.fill(ink);
  }

  fillRect(x: number, y: number, width: number, height: number, ink: number): void {
    const left = Math.max(0, x);
    const top = Math.max(0, y);
    const right = Math.min(this.width, x + width);
    const bottom = Math.min(this.height, y + height);
    for (let row = top; row < bottom; row += 1) {
      this.pixels.fill(ink, row * this.width + left, row * this.width + right);
    }
  }

  /**
   * Draws an indexed image. `transparent`, when given, is the palette index the
   * image uses for "leave what is underneath alone".
   */
  blit(image: IndexedImage, x: number, y: number, transparent?: number): void {
    const left = Math.max(0, x);
    const top = Math.max(0, y);
    const right = Math.min(this.width, x + image.width);
    const bottom = Math.min(this.height, y + image.height);
    if (right <= left || bottom <= top) return;

    for (let row = top; row < bottom; row += 1) {
      const sourceRow = (row - y) * image.width - x;
      const targetRow = row * this.width;
      if (transparent === undefined) {
        // The common case: a solid rectangle, copied a row at a time.
        this.pixels.set(image.pixels.subarray(sourceRow + left, sourceRow + right), targetRow + left);
        continue;
      }
      for (let column = left; column < right; column += 1) {
        const ink = image.pixels[sourceRow + column] ?? 0;
        if (ink !== transparent) this.pixels[targetRow + column] = ink;
      }
    }
  }

  /** Tiles an image across a rectangle. Used for sky and ground. */
  tile(image: IndexedImage, x: number, y: number, width: number, height: number): void {
    if (image.width <= 0 || image.height <= 0) return;
    for (let row = y; row < y + height; row += image.height) {
      for (let column = x; column < x + width; column += image.width) {
        this.blit(image, column, row);
      }
    }
  }

  /**
   * Expands indices into `target` through `palette`.
   *
   * `target` is the backing store of an ImageData, so this runs once a frame
   * over every visible pixel and is the hottest loop in the program — hence the
   * flat arithmetic rather than anything tidier.
   */
  resolve(palette: Palette, target: Uint8ClampedArray): void {
    const count = this.width * this.height;
    for (let i = 0; i < count; i += 1) {
      const entry = (this.pixels[i] ?? 0) * 4;
      const at = i * 4;
      target[at] = palette[entry] ?? 0;
      target[at + 1] = palette[entry + 1] ?? 0;
      target[at + 2] = palette[entry + 2] ?? 0;
      target[at + 3] = 255;
    }
  }
}
