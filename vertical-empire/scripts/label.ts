/**
 * A 3x5 pixel font, just big enough to write a resource ID.
 *
 * A contact sheet with several resources on it is only useful if you can tell
 * which is which. Printing the order to the console does not survive the image
 * being pasted somewhere on its own, so the label goes in the pixels.
 */

const GLYPHS: Record<string, number[]> = {
  '0': [0b111, 0b101, 0b101, 0b101, 0b111],
  '1': [0b010, 0b110, 0b010, 0b010, 0b111],
  '2': [0b111, 0b001, 0b111, 0b100, 0b111],
  '3': [0b111, 0b001, 0b111, 0b001, 0b111],
  '4': [0b101, 0b101, 0b111, 0b001, 0b001],
  '5': [0b111, 0b100, 0b111, 0b001, 0b111],
  '6': [0b111, 0b100, 0b111, 0b101, 0b111],
  '7': [0b111, 0b001, 0b001, 0b001, 0b001],
  '8': [0b111, 0b101, 0b111, 0b101, 0b111],
  '9': [0b111, 0b101, 0b111, 0b001, 0b111],
  a: [0b111, 0b101, 0b111, 0b101, 0b101],
  b: [0b110, 0b101, 0b110, 0b101, 0b110],
  c: [0b111, 0b100, 0b100, 0b100, 0b111],
  d: [0b110, 0b101, 0b101, 0b101, 0b110],
  e: [0b111, 0b100, 0b111, 0b100, 0b111],
  f: [0b111, 0b100, 0b111, 0b100, 0b100],
  x: [0b101, 0b101, 0b010, 0b101, 0b101],
  '/': [0b001, 0b001, 0b010, 0b100, 0b100],
  ' ': [0, 0, 0, 0, 0],
};

export const GLYPH_WIDTH = 4; // three pixels and a space
export const GLYPH_HEIGHT = 5;

/** Draws `text` into an 8-bit buffer at (x, y). Unknown characters are skipped. */
export function drawText(
  pixels: Uint8Array,
  width: number,
  height: number,
  text: string,
  x: number,
  y: number,
  ink: number,
): void {
  let cursor = x;
  for (const character of text.toLowerCase()) {
    const glyph = GLYPHS[character];
    if (glyph) {
      for (let row = 0; row < GLYPH_HEIGHT; row += 1) {
        const bits = glyph[row] ?? 0;
        for (let column = 0; column < 3; column += 1) {
          if ((bits & (0b100 >> column)) === 0) continue;
          const px = cursor + column;
          const py = y + row;
          if (px < 0 || px >= width || py < 0 || py >= height) continue;
          pixels[py * width + px] = ink;
        }
      }
    }
    cursor += GLYPH_WIDTH;
  }
}
