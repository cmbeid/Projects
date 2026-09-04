/**
 * SimTower's colour tables, and the trick they exist to enable.
 *
 * The game is 8-bit indexed throughout: a sprite stores palette *indices*, and
 * the palette is swapped underneath it to animate. Dawn to dusk is one colour
 * table sliding into another across the whole screen at once, and a handful of
 * indices rotate on a short loop for lit signage and elevator indicators.
 * Reproducing that is why nothing in this pipeline flattens to RGB until the
 * last possible moment — see `render/framebuffer.ts`.
 */

/** 256 entries, RGBA, alpha always 255. Transparency is a per-sprite index. */
export type Palette = Uint8Array;

export const PALETTE_ENTRIES = 256;

/**
 * Indices SimTower rotates among themselves to animate a sprite without
 * redrawing it. Each inner array is one independent cycle.
 */
export const CYCLE_GROUPS: readonly (readonly number[])[] = [
  [197, 198],
  [199, 200],
  [201, 202, 203],
];

/**
 * Index 184 is present twice in SimTower's tables. Whichever copy is live, a
 * palette-swapping effect that touches it produces a visible seam, so effects
 * leave it alone.
 */
export const DUPLICATED_INDEX = 184;

/** Bytes per entry in a `0xFF03` palette resource. */
const ENTRY_SIZE = 8;

/**
 * Decodes a `0xFF03` palette resource.
 *
 * Each entry is eight bytes holding three 16-bit channels; we take one byte of
 * each. Red, green and blue sit at +2, +4 and +6, which leaves the first field
 * as flags — the same shape as a Windows PALETTEENTRY, widened.
 */
export function decodePalette(data: Uint8Array): Palette {
  const palette = new Uint8Array(PALETTE_ENTRIES * 4);
  const available = Math.min(PALETTE_ENTRIES, Math.floor(data.byteLength / ENTRY_SIZE));

  for (let i = 0; i < available; i += 1) {
    const at = i * ENTRY_SIZE;
    palette[i * 4 + 0] = data[at + 2] ?? 0;
    palette[i * 4 + 1] = data[at + 4] ?? 0;
    palette[i * 4 + 2] = data[at + 6] ?? 0;
    palette[i * 4 + 3] = 255;
  }
  // Entries past the end of a short resource stay black rather than undefined,
  // so a partial palette still renders something you can look at.
  for (let i = available; i < PALETTE_ENTRIES; i += 1) palette[i * 4 + 3] = 255;

  return palette;
}

/** A palette built from BMP `RGBQUAD`s (blue, green, red, reserved). */
export function paletteFromRGBQuads(data: Uint8Array, count: number): Palette {
  const palette = new Uint8Array(PALETTE_ENTRIES * 4);
  for (let i = 0; i < PALETTE_ENTRIES; i += 1) {
    if (i < count) {
      palette[i * 4 + 0] = data[i * 4 + 2] ?? 0;
      palette[i * 4 + 1] = data[i * 4 + 1] ?? 0;
      palette[i * 4 + 2] = data[i * 4 + 0] ?? 0;
    }
    palette[i * 4 + 3] = 255;
  }
  return palette;
}

export function clonePalette(palette: Palette): Palette {
  return palette.slice();
}

/**
 * Advances the cycling indices by `step` positions within each group.
 *
 * Mutates in place: the render loop keeps one working palette and rotates it
 * every few frames rather than allocating a new table per tick.
 */
export function rotateCycles(palette: Palette, step: number): void {
  for (const group of CYCLE_GROUPS) {
    const size = group.length;
    if (size < 2) continue;
    const before = group.map((index) => palette.slice(index * 4, index * 4 + 4));
    for (let i = 0; i < size; i += 1) {
      const from = before[(i + step % size + size) % size];
      const target = group[i];
      if (!from || target === undefined) continue;
      palette.set(from, target * 4);
    }
  }
}

/**
 * Blends two palettes, `t` from 0 (all `from`) to 1 (all `to`).
 *
 * This is the day/night cycle: SimTower ships a sky table per hour band, and
 * crossfading between neighbours turns eleven steps into a smooth day. The
 * duplicated index is copied straight through rather than mixed.
 */
export function mixPalettes(from: Palette, to: Palette, t: number): Palette {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  const out = new Uint8Array(PALETTE_ENTRIES * 4);
  for (let i = 0; i < PALETTE_ENTRIES; i += 1) {
    const source = i === DUPLICATED_INDEX ? from : null;
    for (let c = 0; c < 4; c += 1) {
      const at = i * 4 + c;
      if (source) {
        out[at] = source[at] ?? 0;
      } else {
        const a = from[at] ?? 0;
        const b = to[at] ?? 0;
        out[at] = Math.round(a + (b - a) * clamped);
      }
    }
  }
  return out;
}

/**
 * The darkest entry in a palette, by perceived brightness.
 *
 * Used for the inside of a lift shaft, which the original draws as a flat
 * near-black column rather than from a bitmap. Finding it rather than
 * hardcoding an index means the same code works against the game's palette and
 * against ours, and keeps working as the day/night tables slide underneath.
 */
export function darkestIndex(palette: Palette, skip: readonly number[] = []): number {
  let best = 0;
  let bestLuma = Number.POSITIVE_INFINITY;
  for (let i = 0; i < PALETTE_ENTRIES; i += 1) {
    if (skip.includes(i)) continue;
    // Rec. 601 weights: green carries most of the apparent brightness.
    const luma =
      (palette[i * 4] ?? 0) * 0.299 + (palette[i * 4 + 1] ?? 0) * 0.587 + (palette[i * 4 + 2] ?? 0) * 0.114;
    if (luma < bestLuma) {
      bestLuma = luma;
      best = i;
    }
  }
  return best;
}

/**
 * The entry closest to a colour we want, by squared distance in RGB.
 *
 * For drawing our own art into somebody else's palette. We cannot add entries —
 * the framebuffer is indexed and the table belongs to the game — so anything
 * generated has to be expressed in colours that are already there. Asking for
 * "a warm off-white" and taking what the palette actually has keeps our art
 * inside the game's own range, and keeps it cycling correctly when the
 * day/night tables slide underneath.
 */
export function nearestIndex(
  palette: Palette,
  red: number,
  green: number,
  blue: number,
  skip: readonly number[] = [],
): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < PALETTE_ENTRIES; i += 1) {
    if (skip.includes(i)) continue;
    const dr = (palette[i * 4] ?? 0) - red;
    const dg = (palette[i * 4 + 1] ?? 0) - green;
    const db = (palette[i * 4 + 2] ?? 0) - blue;
    const distance = dr * dr + dg * dg + db * db;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}
