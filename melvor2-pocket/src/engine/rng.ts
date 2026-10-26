// Seeded, serialisable RNG (mulberry32) so online and offline runs are reproducible.
export class Rng {
  constructor(public state: number) {}

  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  chance(p: number): boolean {
    return p > 0 && this.next() < p;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  intInclusive(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  weighted<T extends { Weight: number }>(list: T[]): T {
    const total = list.reduce((s, x) => s + x.Weight, 0);
    let roll = this.next() * total;
    for (const x of list) {
      roll -= x.Weight;
      if (roll < 0) return x;
    }
    return list[list.length - 1];
  }
}
