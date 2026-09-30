/** The time of day as a colour laid over the farm: warm at dawn and dusk, deep blue at night. */
import { DAY_END, DAY_START } from '../game/time';

type Key = [minute: number, r: number, g: number, b: number, a: number];

const KEYS: readonly Key[] = [
  [DAY_START, 255, 170, 110, 0.22],
  [8 * 60, 255, 230, 200, 0],
  [16 * 60, 255, 230, 200, 0],
  [18 * 60, 255, 140, 60, 0.2],
  [19 * 60 + 30, 70, 50, 120, 0.4],
  [21 * 60, 16, 24, 80, 0.55],
  [DAY_END, 8, 12, 56, 0.66],
];

export function skyTint(minute: number): { r: number; g: number; b: number; a: number } {
  const m = Math.max(DAY_START, Math.min(DAY_END, minute));
  for (let i = 1; i < KEYS.length; i += 1) {
    const [m1, r1, g1, b1, a1] = KEYS[i]!;
    if (m <= m1) {
      const [m0, r0, g0, b0, a0] = KEYS[i - 1]!;
      const t = (m - m0) / (m1 - m0);
      const lerp = (a: number, b: number): number => a + (b - a) * t;
      return { r: lerp(r0, r1), g: lerp(g0, g1), b: lerp(b0, b1), a: lerp(a0, a1) };
    }
  }
  const [, r, g, b, a] = KEYS[KEYS.length - 1]!;
  return { r, g, b, a };
}

/** How dark it is, 0 by day to 1 at the dead of night: how much lamps show. */
export function darkness(minute: number): number {
  return Math.max(0, Math.min(1, (minute - 18.5 * 60) / 150));
}
