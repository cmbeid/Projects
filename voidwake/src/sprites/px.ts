/**
 * A tiny raster for drawing pixel art in code. Shapes are filled with flat
 * colours and given hard one-pixel edges; there is no anti-aliasing and no
 * blending, so everything drawn here stays crisp at any integer scale.
 */
export class Px {
  readonly px: (string | null)[];

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.px = new Array<string | null>(w * h).fill(null);
  }

  set(x: number, y: number, c: string | null): this {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c;
    return this;
  }

  get(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.px[y * this.w + x] ?? null;
  }

  rect(x: number, y: number, w: number, h: number, c: string): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  }

  hline(x: number, y: number, w: number, c: string): this {
    return this.rect(x, y, w, 1, c);
  }

  vline(x: number, y: number, h: number, c: string): this {
    return this.rect(x, y, 1, h, c);
  }

  /** A filled box with a one-pixel edge. */
  box(x: number, y: number, w: number, h: number, fill: string, edge: string): this {
    this.rect(x, y, w, h, edge);
    if (w > 2 && h > 2) this.rect(x + 1, y + 1, w - 2, h - 2, fill);
    return this;
  }

  /** A wall: lit on the left, shaded on the right, with an outline. */
  wall(x: number, y: number, w: number, h: number, pal: readonly [string, string, string], edge: string): this {
    this.box(x, y, w, h, pal[1], edge);
    if (w > 3 && h > 2) {
      this.vline(x + 1, y + 1, h - 2, pal[2]);
      this.vline(x + w - 2, y + 1, h - 2, pal[0]);
    }
    return this;
  }

  /** A triangle roof from (x, base) to (x + w, base), peaking `rise` above. */
  gable(x: number, base: number, w: number, rise: number, pal: readonly [string, string, string], edge: string): this {
    for (let j = 0; j <= rise; j++) {
      const t = j / Math.max(1, rise);
      const half = (w / 2) * t;
      const cx = x + w / 2;
      const y = base - rise + j;
      const x0 = Math.round(cx - half);
      const x1 = Math.round(cx + half) - 1;
      for (let i = x0; i <= x1; i++) this.set(i, y, i < cx ? pal[2] : pal[1]);
      this.set(x0, y, edge);
      this.set(x1, y, edge);
    }
    this.hline(x, base, w, edge);
    return this;
  }

  /** A half-disc dome sitting on (cx, base). */
  dome(cx: number, base: number, r: number, pal: readonly [string, string, string], edge: string): this {
    for (let j = 0; j <= r; j++) {
      const half = Math.round(Math.sqrt(Math.max(0, r * r - (r - j) * (r - j))));
      const y = base - r + j;
      for (let i = -half; i <= half; i++) this.set(cx + i, y, i < 0 ? pal[2] : i > half / 2 ? pal[0] : pal[1]);
      this.set(cx - half, y, edge);
      this.set(cx + half, y, edge);
    }
    this.set(cx, base - r, edge);
    return this;
  }

  /** A full disc. */
  disc(cx: number, cy: number, r: number, fill: string, edge?: string): this {
    for (let j = -r; j <= r; j++) {
      for (let i = -r; i <= r; i++) {
        const d = i * i + j * j;
        if (d <= r * r) this.set(cx + i, cy + j, edge && d > (r - 1) * (r - 1) ? edge : fill);
      }
    }
    return this;
  }

  /** A grid of windows inside a rectangle: every `gx` across, every `gy` down. */
  windows(x: number, y: number, w: number, h: number, gx: number, gy: number, c: string, lit?: string, seed = 1): this {
    let k = seed;
    for (let j = y; j < y + h; j += gy) {
      for (let i = x; i < x + w; i += gx) {
        k = (k * 1103515245 + 12345) & 0x7fffffff;
        this.set(i, j, lit && k % 5 === 0 ? lit : c);
      }
    }
    return this;
  }

  line(x0: number, y0: number, x1: number, y1: number, c: string): this {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) this.set(x0 + ((x1 - x0) * i) / Math.max(1, n), y0 + ((y1 - y0) * i) / Math.max(1, n), c);
    return this;
  }

  /** Paints another raster on top, skipping its transparent pixels. */
  stamp(other: Px, ox: number, oy: number): this {
    for (let j = 0; j < other.h; j++) for (let i = 0; i < other.w; i++) {
      const c = other.get(i, j);
      if (c) this.set(ox + i, oy + j, c);
    }
    return this;
  }

  /** Character-grid art: one character a pixel, '.' transparent. */
  static from(rows: readonly string[], pal: Record<string, string>): Px {
    const p = new Px(rows[0]!.length, rows.length);
    rows.forEach((row, y) => {
      if (row.length !== p.w) throw new Error(`row "${row}" is ${row.length} wide, expected ${p.w}`);
      [...row].forEach((ch, x) => {
        if (ch === '.') return;
        const c = pal[ch];
        if (!c) throw new Error(`no colour for '${ch}'`);
        p.set(x, y, c);
      });
    });
    return p;
  }
}
