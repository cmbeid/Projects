// Experience table: same curve and demo level cap as the game (see notes/formulas.md).
export const LEVEL_CAP = 60;

const SCALING = 0.25;
const EXPONENT_SCALING = 300;
const BASE = 2 ** (1 / 7);

const table: number[] = [0];
let sum = 0;

export function xpForLevel(level: number): number {
  if (level < 1) return 0;
  for (let i = table.length; i < level; i++) {
    sum += Math.floor(i + EXPONENT_SCALING * BASE ** i);
    table.push(Math.floor(SCALING * sum));
  }
  return table[level - 1];
}

export function levelForXp(xp: number, cap = LEVEL_CAP): number {
  let level = 1;
  while (level < cap && xp >= xpForLevel(level + 1)) level++;
  return level;
}

/** Progress through the current level as 0..1 (1 at the cap). */
export function levelProgress(xp: number, cap = LEVEL_CAP): number {
  const level = levelForXp(xp, cap);
  if (level >= cap) return 1;
  const lo = xpForLevel(level);
  return (xp - lo) / (xpForLevel(level + 1) - lo);
}
