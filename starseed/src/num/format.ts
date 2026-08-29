import { Decimal } from './decimal';

/**
 * Short-scale suffixes. Past the end of this list the formatter falls back to
 * scientific notation, which is both honest and shorter than inventing names
 * nobody recognises.
 */
const SUFFIXES = [
  '', 'K', 'M', 'B', 'T',
  'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No',
  'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc',
  'Vg',
] as const;

const MAX_SUFFIX_EXPONENT = (SUFFIXES.length - 1) * 3;

/**
 * Renders a value for display, at **three significant figures**.
 *
 * The precision is deliberately low and deliberately fixed. `ticker.ts` decides
 * whether to touch the DOM by comparing this function's output to the last
 * string it wrote, so a value climbing exponentially still only changes its
 * rendered form a few times a second. Widening the precision here would quietly
 * turn that optimisation off.
 */
export function formatDecimal(value: Decimal): string {
  if (value.isZero) return '0';
  if (!value.isPositive) return `-${formatDecimal(value.neg())}`;

  // Below a thousand there is no suffix to pick, and small numbers are where
  // the player is doing arithmetic in their head, so show a little more.
  if (value.e < 3) return formatSmall(value.toNumber());

  if (value.e > MAX_SUFFIX_EXPONENT) {
    return `${value.m.toFixed(2)}e${value.e}`;
  }

  const group = Math.floor(value.e / 3);
  const scaled = value.m * 10 ** (value.e - group * 3);
  return `${threeSigFigs(scaled)}${SUFFIXES[group] ?? ''}`;
}

/** Rates, which need a little more resolution than stocks at the low end. */
export function formatRate(perSecond: Decimal): string {
  return `${formatDecimal(perSecond)}/s`;
}

/** Whole counts — building tallies and the like. Never abbreviated below 1e5. */
export function formatCount(count: number): string {
  if (count < 100_000) return Math.floor(count).toLocaleString('en-US');
  return formatDecimal(Decimal.from(count));
}

/** `93s`, `4m 12s`, `3h 05m`, `2d 07h`. Used by the offline summary later. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  if (total < 60) return `${total}s`;
  if (total < 3600) return `${Math.floor(total / 60)}m ${pad(total % 60)}s`;
  if (total < 86_400) return `${Math.floor(total / 3600)}h ${pad(Math.floor(total / 60) % 60)}m`;
  return `${Math.floor(total / 86_400)}d ${pad(Math.floor(total / 3600) % 24)}h`;
}

function formatSmall(value: number): string {
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return trimZeros(value.toFixed(1));
  if (value >= 1) return trimZeros(value.toFixed(2));
  if (value >= 0.01) return trimZeros(value.toFixed(2));
  return value.toExponential(1);
}

function threeSigFigs(value: number): string {
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function trimZeros(text: string): string {
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}
