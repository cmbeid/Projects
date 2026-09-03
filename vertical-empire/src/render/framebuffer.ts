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

  /**
   * Copies the row at `fromY` downward over the rows beneath it.
   *
   * Facility art is 24 pixels tall where a floor is 36, the missing twelve
   * being slab and ceiling the game draws as structure. Rather than invent that
   * structure, extend the facade's own bottom row into it: at this scale a
   * skirting board repeated a dozen rows reads as a floor, and it cannot
   * clash with a palette we did not choose.
   */
  repeatRow(x: number, fromY: number, width: number, height: number): void {
    if (fromY < 0 || fromY >= this.height) return;
    const left = Math.max(0, x);
    const right = Math.min(this.width, x + width);
    if (right <= left) return;

    const source = this.pixels.subarray(fromY * this.width + left, fromY * this.width + right);
    const bottom = Math.min(this.height, fromY + 1 + height);
    for (let row = fromY + 1; row < bottom; row += 1) {
      this.pixels.set(source, row * this.width + left);
    }
  }

  /** Tiles an image across a rectangle. Used for sky and ground. */
  /**
   * Repeats an image across a rectangle, clipped to it.
   *
   * The clipping is the point. Tiling by repeated `blit` overflows whenever the
   * image does not divide the rectangle, which goes unnoticed for sky and
   * ground because they cover the screen anyway — and then paints a 128px-wide
   * shaft interior straight through the rooms either side of a 32px lift.
   */
  tile(image: IndexedImage, x: number, y: number, width: number, height: number): void {
    if (image.width <= 0 || image.height <= 0) return;

    const left = Math.max(0, x);
    const top = Math.max(0, y);
    const right = Math.min(this.width, x + width);
    const bottom = Math.min(this.height, y + height);
    if (right <= left || bottom <= top) return;

    // Where in the source the first drawn pixel comes from, for a rectangle
    // whose corner may be off-screen or at a negative world position.
    const firstX = mod(left - x, image.width);
    let sourceY = mod(top - y, image.height);

    for (let row = top; row < bottom; row += 1) {
      const sourceRow = sourceY * image.width;
      const targetRow = row * this.width;
      let sourceX = firstX;
      for (let column = left; column < right; column += 1) {
        this.pixels[targetRow + column] = image.pixels[sourceRow + sourceX] ?? 0;
        sourceX += 1;
        if (sourceX === image.width) sourceX = 0;
      }
      sourceY += 1;
      if (sourceY === image.height) sourceY = 0;
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

/** Positive remainder, so a negative camera position still indexes the source. */
function mod(value: number, by: number): number {
  return ((value % by) + by) % by;
}
