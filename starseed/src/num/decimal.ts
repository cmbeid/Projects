/**
 * A number as `m * 10^e`, normalised so that `1 <= |m| < 10` (or `m === 0`).
 *
 * Doubles stop at ~1.8e308. This game does not: two prestige layers stack
 * multipliers on multipliers on an already exponential building count, and that
 * product breaches the ceiling long before the ending. Rather than design every
 * curve around a hard wall, the whole engine runs on this instead.
 *
 * Immutable — every operation returns a new instance — which makes the type
 * trivially safe to share and lets tests compare by value.
 */

/**
 * Beyond this exponent gap the smaller operand is below the larger one's
 * floating-point epsilon, so adding it is a no-op. Short-circuiting is not just
 * an optimisation: without it, millions of ticks accumulate rounding noise into
 * visible drift.
 */
const MAX_GAP = 17;

export class Decimal {
  readonly m: number;
  readonly e: number;

  private constructor(m: number, e: number) {
    this.m = m;
    this.e = e;
  }

  // --- Construction --------------------------------------------------------

  static readonly ZERO = new Decimal(0, 0);
  static readonly ONE = new Decimal(1, 0);

  /** Builds from an unnormalised mantissa/exponent pair. */
  private static make(m: number, e: number): Decimal {
    if (m === 0 || !Number.isFinite(m)) return Decimal.ZERO;
    let mantissa = m;
    let exponent = e;

    // A single log10 lands within one step of normal; the loops below close the
    // remaining gap and cost nothing when it is already right.
    const shift = Math.floor(Math.log10(Math.abs(mantissa)));
    if (shift !== 0 && Number.isFinite(shift)) {
      mantissa /= 10 ** shift;
      exponent += shift;
    }
    while (Math.abs(mantissa) >= 10) {
      mantissa /= 10;
      exponent += 1;
    }
    while (Math.abs(mantissa) < 1) {
      mantissa *= 10;
      exponent -= 1;
    }
    return new Decimal(mantissa, exponent);
  }

  static from(value: number | string | Decimal): Decimal {
    if (value instanceof Decimal) return value;
    if (typeof value === 'number') {
      if (value === 0 || !Number.isFinite(value)) return Decimal.ZERO;
      // Going through the exponential form avoids the precision loss of
      // dividing by a computed power of ten.
      const [mantissa, exponent] = value.toExponential().split('e') as [string, string];
      return Decimal.make(Number(mantissa), Number(exponent));
    }
    return Decimal.parse(value);
  }

  /** Reads back `toString`'s output, and plain decimal text besides. */
  static parse(text: string): Decimal {
    const trimmed = text.trim();
    if (trimmed === '') return Decimal.ZERO;
    const at = trimmed.indexOf('e');
    if (at === -1) return Decimal.from(Number(trimmed));
    const mantissa = Number(trimmed.slice(0, at));
    const exponent = Number(trimmed.slice(at + 1));
    if (!Number.isFinite(mantissa) || !Number.isFinite(exponent)) return Decimal.ZERO;
    return Decimal.make(mantissa, exponent);
  }

  // --- Arithmetic ----------------------------------------------------------

  add(other: Decimal): Decimal {
    if (this.m === 0) return other;
    if (other.m === 0) return this;

    const thisIsBigger = this.e >= other.e;
    const big = thisIsBigger ? this : other;
    const small = thisIsBigger ? other : this;
    const gap = big.e - small.e;
    if (gap > MAX_GAP) return big;

    return Decimal.make(big.m + small.m / 10 ** gap, big.e);
  }

  sub(other: Decimal): Decimal {
    return this.add(other.neg());
  }

  neg(): Decimal {
    return this.m === 0 ? Decimal.ZERO : new Decimal(-this.m, this.e);
  }

  mul(other: Decimal): Decimal {
    if (this.m === 0 || other.m === 0) return Decimal.ZERO;
    return Decimal.make(this.m * other.m, this.e + other.e);
  }

  div(other: Decimal): Decimal {
    if (other.m === 0) throw new RangeError('Decimal: division by zero');
    if (this.m === 0) return Decimal.ZERO;
    return Decimal.make(this.m / other.m, this.e - other.e);
  }

  /** Convenience for the common case of scaling by a plain number. */
  mulNumber(factor: number): Decimal {
    return this.mul(Decimal.from(factor));
  }

  /**
   * Raises to a real power, via logarithms rather than repeated multiplication
   * — the exponent here is routinely in the millions.
   */
  pow(exponent: number): Decimal {
    if (exponent === 0) return Decimal.ONE;
    if (this.m === 0) return Decimal.ZERO;
    if (exponent === 1) return this;

    if (this.m < 0) {
      if (!Number.isInteger(exponent)) {
        throw new RangeError('Decimal: fractional power of a negative number');
      }
      const magnitude = this.neg().pow(exponent);
      return exponent % 2 === 0 ? magnitude : magnitude.neg();
    }

    const log = this.log10() * exponent;
    const whole = Math.floor(log);
    return Decimal.make(10 ** (log - whole), whole);
  }

  /**
   * Discards the fractional part.
   *
   * Above 1e15 a double has no fractional part left to discard, so the value is
   * already whole and is returned untouched rather than round-tripped through
   * `toNumber`, which would lose precision or overflow to Infinity.
   */
  floor(): Decimal {
    if (this.m === 0 || this.e > 15) return this;
    return Decimal.from(Math.floor(this.toNumber()));
  }

  /**
   * Rounds to the nearest whole number.
   *
   * Counting currencies — Schematics, and Insight in phase 7 — are whole by
   * construction, but a chain of adds and subtracts leaves float noise behind:
   * 100 − 1 − 4 lands on 94.99999999999999. That reads correctly at three
   * significant figures and then refuses to buy the 95-Schematic perk the
   * player has clearly earned, so the noise is cleared where it is made rather
   * than tolerated everywhere it could surface.
   */
  round(): Decimal {
    if (this.m === 0 || this.e > 15) return this;
    return Decimal.from(Math.round(this.toNumber()));
  }

  /** Base-10 logarithm. Undefined for zero and negatives, as usual. */
  log10(): number {
    if (this.m <= 0) throw new RangeError('Decimal: log10 of a non-positive number');
    return this.e + Math.log10(this.m);
  }

  // --- Comparison ----------------------------------------------------------

  cmp(other: Decimal): -1 | 0 | 1 {
    if (this.m === 0 && other.m === 0) return 0;
    if (this.m === 0) return other.m > 0 ? -1 : 1;
    if (other.m === 0) return this.m > 0 ? 1 : -1;

    const thisSign = Math.sign(this.m);
    const otherSign = Math.sign(other.m);
    if (thisSign !== otherSign) return thisSign < otherSign ? -1 : 1;

    if (this.e !== other.e) {
      const thisIsSmaller = this.e < other.e;
      // For negative values a larger exponent means a smaller number.
      return thisIsSmaller === thisSign > 0 ? -1 : 1;
    }
    if (this.m === other.m) return 0;
    return this.m < other.m ? -1 : 1;
  }

  eq(other: Decimal): boolean { return this.cmp(other) === 0; }
  gt(other: Decimal): boolean { return this.cmp(other) === 1; }
  gte(other: Decimal): boolean { return this.cmp(other) >= 0; }
  lt(other: Decimal): boolean { return this.cmp(other) === -1; }
  lte(other: Decimal): boolean { return this.cmp(other) <= 0; }

  max(other: Decimal): Decimal { return this.gte(other) ? this : other; }
  min(other: Decimal): Decimal { return this.lte(other) ? this : other; }

  get isZero(): boolean { return this.m === 0; }
  get isPositive(): boolean { return this.m > 0; }

  // --- Conversion ----------------------------------------------------------

  /**
   * Collapses to a double. Anything past the double range comes back as
   * Infinity, so callers must only use this where the value is known to be
   * small — counts, ratios, percentages.
   */
  toNumber(): number {
    if (this.m === 0) return 0;
    if (this.e > 308) return this.m > 0 ? Infinity : -Infinity;
    if (this.e < -308) return 0;
    return this.m * 10 ** this.e;
  }

  /** Round-trips through `Decimal.parse`. This is the save-file format. */
  toString(): string {
    return this.m === 0 ? '0e0' : `${this.m}e${this.e}`;
  }

  toJSON(): string {
    return this.toString();
  }
}

/** Shorthand for the many literal conversions in the content tables. */
export function dec(value: number | string | Decimal): Decimal {
  return Decimal.from(value);
}
