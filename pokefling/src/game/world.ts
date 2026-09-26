/**
 * World-space constants shared by the simulation, the level data and the
 * renderer. Units are world pixels; y grows downward, as on a canvas.
 */

/** Top of the ground. Everything rests on this. */
export const GROUND_Y = 600;
/** Bottom of the drawn world. The camera never shows below it. */
export const WORLD_BOTTOM = 680;

/** Where the pouch rests, and where every launch starts. */
export const SLING = { x: 180, y: 490 } as const;
/** How far the pouch can be pulled back, in world pixels. */
export const MAX_PULL = 100;
/** Launch speed at full pull, in pixels per 1/60 s. */
export const MAX_SPEED = 22;
/** A pull shorter than this is treated as a cancelled shot. */
export const MIN_PULL = 18;

/** Matter's default gravity, expressed per 1/60 s step: 0.001 px/ms² × (1000/60 ms)². */
export const GRAVITY_PER_STEP = 0.001 * (1000 / 60) ** 2;

/** Bodies past these are gone for good. */
export const KILL_MARGIN = 400;
