/**
 * The measurements the whole game hangs off.
 *
 * A SimTower segment is eight pixels wide and a floor is thirty-six tall. That
 * ratio — wide, short, drawn flat in elevation — is most of what makes the
 * original recognisable, so it is fixed here and everything else adapts to it.
 */

export const SEGMENT_WIDTH = 8;
export const FLOOR_HEIGHT = 36;

/** Nine basements and a hundred storeys, as the original. */
export const BASEMENT_LEVELS = 9;
export const TOWER_LEVELS = 100;
export const LEVEL_COUNT = BASEMENT_LEVELS + TOWER_LEVELS;

/**
 * The original lot is 375 segments wide. On a phone held upright you can see
 * about two dozen of them at a readable scale, so a lot that wide would be a
 * map you never see the edges of.
 *
 * Ninety-six is the working answer: four screens across at 2x, wide enough for
 * six offices side by side, narrow enough to grasp. Whether it is the *right*
 * answer is the question this spike exists to settle — change it, reload, look.
 */
export const LOT_SEGMENTS = 96;

export const WORLD_WIDTH = LOT_SEGMENTS * SEGMENT_WIDTH;
export const WORLD_HEIGHT = LEVEL_COUNT * FLOOR_HEIGHT;

/**
 * Levels are a dense 0-based index so they can address an array; floors are
 * what the player sees, and skip zero the way buildings do.
 *
 * Level 0 is the deepest basement, level 8 is B1, level 9 is floor 1.
 */
export const GROUND_LEVEL = BASEMENT_LEVELS;

export function levelToFloor(level: number): number {
  return level >= GROUND_LEVEL ? level - GROUND_LEVEL + 1 : level - GROUND_LEVEL;
}

export function floorToLevel(floor: number): number {
  return floor > 0 ? floor + GROUND_LEVEL - 1 : floor + GROUND_LEVEL;
}

export function floorLabel(level: number): string {
  const floor = levelToFloor(level);
  return floor < 0 ? `B${-floor}` : `${floor}`;
}

/** Top edge of a level in world pixels, y increasing downward. */
export function levelTop(level: number): number {
  return (LEVEL_COUNT - 1 - level) * FLOOR_HEIGHT;
}

export function levelAtWorldY(y: number): number {
  return LEVEL_COUNT - 1 - Math.floor(y / FLOOR_HEIGHT);
}

export function segmentAtWorldX(x: number): number {
  return Math.floor(x / SEGMENT_WIDTH);
}

export function isInsideLot(segment: number, width: number): boolean {
  return segment >= 0 && segment + width <= LOT_SEGMENTS;
}

export function isValidLevel(level: number): boolean {
  return level >= 0 && level < LEVEL_COUNT;
}
