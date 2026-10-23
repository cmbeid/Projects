/**
 * The classic curve: each level needs about 10% more than the last, so 92
 * is half-way to 99 in XP.
 */
export const MAX_LEVEL = 99;

const TABLE: number[] = [0, 0];
{
  let points = 0;
  for (let lvl = 1; lvl <= 120; lvl++) {
    points += Math.floor(lvl + 300 * 2 ** (lvl / 7));
    TABLE.push(Math.floor(points / 4));
  }
}

/** XP needed to reach a level. */
export function xpFor(level: number): number {
  return TABLE[Math.max(1, Math.min(level, 121))]!;
}

export function levelFor(xp: number, cap = MAX_LEVEL): number {
  let lo = 1;
  let hi = cap;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (xpFor(mid) <= xp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** 0..1 through the current level. */
export function levelProgress(xp: number, cap = MAX_LEVEL): number {
  const lvl = levelFor(xp, cap);
  if (lvl >= cap) return 1;
  const a = xpFor(lvl);
  const b = xpFor(lvl + 1);
  return Math.min(1, (xp - a) / (b - a));
}
