// Seeded PRNG replacing C's rand(). The C++ game never called srand(), making it
// deterministic per run; we make determinism explicit with a stored seed.
// Implements glibc-style LCG (TYPE_3 additive is overkill; the simple LCG used by
// musl/glibc for rand() without srand is a 32-bit LCG: seed = seed*1103515245+12345).
export class Rand {
  constructor(seed = 1) {
    this.seed = seed >>> 0;
  }

  // equivalent of C rand(): returns 0..RAND_MAX (2147483647)
  next() {
    this.seed = (Math.imul(this.seed, 1103515245) + 12345) >>> 0;
    return (this.seed >>> 16) & 0x7fff;
  }

  rand() {
    return this.next() / 0x8000;
  }

  // inclusive integer range
  randi(min, max) {
    return (this.next() % (max - min + 1)) + min;
  }

  randd(min, max) {
    return this.rand() * (max - min) + min;
  }
}

// module-level convenience mirroring C's bare rand() usage; wired to Game.rand at boot
let GLOBAL = new Rand(1);
export function setGlobalRand(r) {
  GLOBAL = r;
}
export function rand() {
  return GLOBAL.next();
}
export function randi(min, max) {
  return GLOBAL.randi(min, max);
}
export function randd(min, max) {
  return GLOBAL.randd(min, max);
}
