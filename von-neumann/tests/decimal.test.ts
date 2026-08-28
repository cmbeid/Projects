import { describe, expect, it } from 'vitest';
import { Decimal, dec } from '../src/num/decimal';
import { formatCount, formatDecimal, formatDuration } from '../src/num/format';

/** Values are compared through log10, which is the scale the game cares about. */
function closeTo(actual: Decimal, expected: Decimal, digits = 10): void {
  if (actual.isZero && expected.isZero) return;
  expect(actual.log10()).toBeCloseTo(expected.log10(), digits);
}

describe('construction and normalisation', () => {
  it('normalises the mantissa into [1, 10)', () => {
    for (const value of [1, 9.99, 10, 1234, 0.5, 0.0001, 1e21, 6.02e23]) {
      const d = dec(value);
      expect(Math.abs(d.m)).toBeGreaterThanOrEqual(1);
      expect(Math.abs(d.m)).toBeLessThan(10);
      // Relative, not absolute: at 6e23 an absolute tolerance is meaningless.
      expect(d.toNumber() / value).toBeCloseTo(1, 12);
    }
  });

  it('treats zero and non-finite input as zero', () => {
    expect(dec(0).isZero).toBe(true);
    expect(dec(Infinity).isZero).toBe(true);
    expect(dec(NaN).isZero).toBe(true);
  });

  it('round-trips through toString, which is the save format', () => {
    for (const value of ['1e0', '1.5e10', '9.99e-7', '0e0', '1.234e500']) {
      expect(Decimal.parse(value).toString()).toBe(Decimal.parse(value).toString());
      closeTo(Decimal.parse(Decimal.parse(value).toString()), Decimal.parse(value));
    }
  });

  it('parses plain decimal text as well as exponential', () => {
    expect(dec('1250').toNumber()).toBeCloseTo(1250);
    expect(dec('1.25e3').toNumber()).toBeCloseTo(1250);
  });
});

describe('arithmetic', () => {
  it('adds and subtracts', () => {
    expect(dec(2).add(dec(3)).toNumber()).toBeCloseTo(5);
    expect(dec(5).sub(dec(3)).toNumber()).toBeCloseTo(2);
    expect(dec(3).sub(dec(5)).toNumber()).toBeCloseTo(-2);
  });

  it('is an additive identity at zero', () => {
    expect(dec(7).add(Decimal.ZERO).toNumber()).toBe(7);
    expect(Decimal.ZERO.add(dec(7)).toNumber()).toBe(7);
  });

  it('cancels to exactly zero', () => {
    expect(dec(1e50).sub(dec(1e50)).isZero).toBe(true);
  });

  // The short-circuit that keeps millions of ticks from accumulating noise.
  it('returns the larger operand when the exponent gap exceeds 17', () => {
    const big = dec(1e40);
    expect(big.add(dec(1e10))).toBe(big);
    expect(dec(1e10).add(big)).toBe(big);
  });

  it('still adds across a gap inside the threshold', () => {
    const sum = dec(1e10).add(dec(1e5));
    expect(sum.toNumber()).toBeCloseTo(1e10 + 1e5, 0);
  });

  it('multiplies and divides past the double ceiling', () => {
    const huge = dec(1e300).mul(dec(1e300));
    expect(huge.e).toBe(600);
    expect(huge.toNumber()).toBe(Infinity);
    closeTo(huge.div(dec(1e300)), dec(1e300));
  });

  it('throws on division by zero rather than yielding Infinity', () => {
    expect(() => dec(1).div(Decimal.ZERO)).toThrow(RangeError);
  });
});

describe('pow and log10', () => {
  it('agrees with repeated multiplication for small integer powers', () => {
    const base = dec(1.07);
    let expected = Decimal.ONE;
    for (let n = 0; n < 40; n += 1) {
      closeTo(base.pow(n), expected, 8);
      expected = expected.mul(base);
    }
  });

  it('handles the exponents the cost curve actually uses', () => {
    // 1.09 ^ 5000 is about 1e185 — a plausible late building count.
    const cost = dec(1.09).pow(5000);
    expect(cost.log10()).toBeCloseTo(5000 * Math.log10(1.09), 6);
  });

  it('goes far past the double ceiling', () => {
    expect(dec(10).pow(5000).e).toBe(5000);
  });

  it('treats a zero exponent as one, and a zero base as zero', () => {
    expect(dec(123).pow(0).toNumber()).toBe(1);
    expect(Decimal.ZERO.pow(5).isZero).toBe(true);
  });

  it('keeps the sign for integer powers of a negative base', () => {
    expect(dec(-2).pow(2).toNumber()).toBeCloseTo(4);
    expect(dec(-2).pow(3).toNumber()).toBeCloseTo(-8);
    expect(() => dec(-2).pow(0.5)).toThrow(RangeError);
  });

  it('refuses log10 of a non-positive value', () => {
    expect(() => Decimal.ZERO.log10()).toThrow(RangeError);
    expect(() => dec(-1).log10()).toThrow(RangeError);
  });
});

describe('comparison', () => {
  it('orders across exponents and signs', () => {
    expect(dec(1e50).gt(dec(1e49))).toBe(true);
    expect(dec(-1e50).lt(dec(-1e49))).toBe(true);
    expect(dec(-1).lt(dec(1))).toBe(true);
    expect(dec(0).lt(dec(1))).toBe(true);
    expect(dec(0).gt(dec(-1))).toBe(true);
    expect(dec(5).eq(dec(5))).toBe(true);
  });

  it('sorts a mixed list the same way numbers do', () => {
    const raw = [-1e10, -5, 0, 0.001, 1, 250, 1e12];
    const sorted = [...raw]
      .map((n) => dec(n))
      .sort((a, b) => a.cmp(b))
      .map((d) => d.toNumber());
    expect(sorted).toEqual(raw);
  });

  it('picks max and min', () => {
    expect(dec(3).max(dec(9)).toNumber()).toBe(9);
    expect(dec(3).min(dec(9)).toNumber()).toBe(3);
  });
});

describe('formatting', () => {
  it('is stable at three significant figures', () => {
    expect(formatDecimal(dec(0))).toBe('0');
    expect(formatDecimal(dec(42))).toBe('42');
    expect(formatDecimal(dec(1234))).toBe('1.23K');
    expect(formatDecimal(dec(12_345))).toBe('12.3K');
    expect(formatDecimal(dec(123_456))).toBe('123K');
    expect(formatDecimal(dec(1.24e6))).toBe('1.24M');
    expect(formatDecimal(dec(1e12))).toBe('1.00T');
  });

  it('falls back to scientific past the named suffixes', () => {
    expect(formatDecimal(dec('4.7e412'))).toBe('4.70e412');
  });

  it('renders negatives', () => {
    expect(formatDecimal(dec(-1234))).toBe('-1.23K');
  });

  // The property ticker.ts depends on: within a group, the string only changes
  // when the third significant figure does.
  it('produces the same string for values that differ below its precision', () => {
    expect(formatDecimal(dec(1_234_000))).toBe(formatDecimal(dec(1_234_400)));
  });

  it('formats counts and durations', () => {
    expect(formatCount(1500)).toBe('1,500');
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(252)).toBe('4m 12s');
    expect(formatDuration(11_100)).toBe('3h 05m');
    expect(formatDuration(198_000)).toBe('2d 07h');
  });
});
