const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc'];

/**
 * Three significant figures with a short-scale suffix: 999, 1.23K, 45.6M.
 * Past the suffixes it falls back to scientific notation rather than invent
 * names nobody recognises.
 */
export function fmt(value: number): string {
  if (!Number.isFinite(value)) return '∞';
  if (value < 0) return `-${fmt(-value)}`;
  if (value < 1000) {
    if (value === 0 || value >= 100 || Number.isInteger(value)) return String(Math.floor(value));
    return value >= 10 ? value.toFixed(1).replace(/\.0$/, '') : value.toFixed(2).replace(/\.?0+$/, '');
  }
  const group = Math.floor(Math.log10(value) / 3);
  if (group >= SUFFIXES.length) {
    const e = Math.floor(Math.log10(value));
    return `${(value / 10 ** e).toFixed(2)}e${e}`;
  }
  const scaled = value / 1000 ** group;
  // Rounding can carry 999.5 up to "1000"; step into the next suffix instead.
  if (scaled >= 999.5) return group + 1 < SUFFIXES.length ? `1${SUFFIXES[group + 1]}` : fmt(value * 1.0001);
  const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  return `${scaled.toFixed(digits)}${SUFFIXES[group]}`;
}

/** Whole numbers only, for counts of things. */
export function fmtInt(value: number): string {
  return value < 1000 ? String(Math.floor(value)) : fmt(value);
}

export function fmtTime(seconds: number): string {
  if (seconds > 0 && seconds < 9.95) return `${seconds.toFixed(1).replace(/\.0$/, '')}s`;
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
