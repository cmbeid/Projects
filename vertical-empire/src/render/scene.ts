/**
 * Draws the tower.
 *
 * Everything is painted in world pixels and offset by the camera; nothing here
 * knows about CSS or devicePixelRatio. Only what intersects the viewport is
 * touched, so a hundred-storey tower costs the same to draw as a five-storey
 * one.
 */

import { lookup, type Atlas } from '../assets/atlas.js';
import { crop, type IndexedImage } from '../assets/dib.js';
import type { ExtractedSprite } from '../assets/slice.js';
import { INK } from '../assets/fallback.js';
import {
  FLOOR_HEIGHT,
  GROUND_LEVEL,
  SEGMENT_WIDTH,
  floorLabel,
  levelAtWorldY,
  levelTop,
} from '../world/grid.js';
import { facility } from '../world/facilities.js';
import { carLevel, hash } from '../world/lift.js';
import type { Tower } from '../world/tower.js';
import type { Camera } from './camera.js';
import type { Framebuffer } from './framebuffer.js';

export interface SceneClock {
  /** Fractional hour, 0 to 24. Drives the day/night palette. */
  hour: number;
  /** Milliseconds since start, for lift travel and pedestrians. */
  elapsed: number;
}

export function drawScene(
  target: Framebuffer,
  atlas: Atlas,
  tower: Tower,
  camera: Camera,
  clock: SceneClock,
): void {
  const groundY = levelTop(GROUND_LEVEL) + FLOOR_HEIGHT;

  drawBackdrop(target, atlas, camera, groundY);
  drawPlacements(target, atlas, tower, camera);
  drawLifts(target, atlas, tower, camera, clock);
  drawPeople(target, atlas, tower, camera, clock);
}

function drawBackdrop(target: Framebuffer, atlas: Atlas, camera: Camera, groundY: number): void {
  const sky = atlas.sprites.get('sky');
  const bands = sky?.frames.length ?? 0;

  if (!sky || bands === 0) {
    target.clear(INK.sky3);
  } else {
    // Sky is banded by altitude, not tiled with one image: the higher the strip
    // the deeper the blue, which is what gives a tall tower its sense of height.
    // Each band is painted as a run of whole rows so nothing repeats within it.
    const step = Math.max(1, Math.round(groundY / bands));
    for (let y = 0; y < target.height; y += 1) {
      const worldY = camera.y + y;
      if (worldY >= groundY) break;
      // Band 0 sits on the horizon and the last one is at the top of the world.
      const band = Math.min(bands - 1, Math.max(0, Math.floor((groundY - worldY) / step)));
      const image = sky.frames[band];
      if (!image) continue;
      target.fillRect(0, y, target.width, 1, image.pixels[0] ?? INK.sky3);
    }
  }

  const horizon = Math.round(groundY - camera.y);
  drawSkyline(target, atlas, camera, groundY);
  if (horizon >= target.height) return;

  const top = Math.max(0, horizon);
  const ground = lookup(atlas, 'ground');
  if (ground) {
    // Shifted left so the pattern stays put as the camera pans — and made that
    // much wider, or the rectangle stops short of the right edge by exactly the
    // shift. Nothing clears the framebuffer between frames, so those columns
    // kept whatever was last in them: on the first frame, zeroes, which the
    // palette resolves to the see-through colour.
    const phase = mod(camera.x, ground.image.width);
    target.tile(ground.image, -phase, top, target.width + phase, target.height - top);
  } else {
    target.fillRect(0, top, target.width, target.height - top, INK.ground);
  }
  // One line where the tower meets the ground, drawn once rather than by every
  // tile — a lip inside the tile would stripe the whole basement.
  if (horizon >= 0) target.fillRect(0, horizon, target.width, 1, INK.slabLip);
}

/**
 * The city at street level.
 *
 * SimTower stands its tower in a town: a long panorama of low buildings, brick
 * frontages, trees and a park runs along the ground on either side. It is
 * stored as a strip of 8px cells, so a segment of it is drawn per segment of
 * the lot, indexed by position — the panorama runs across rather than the same
 * building repeating.
 *
 * Drawn before the tower, so anything built stands in front of it.
 */
function drawSkyline(target: Framebuffer, atlas: Atlas, camera: Camera, groundY: number): void {
  const skyline = atlas.sprites.get('skyline');
  const count = skyline?.frames.length ?? 0;
  if (!skyline || count === 0) return;

  const height = skyline.frames[0]?.height ?? 0;
  const y = Math.round(groundY - camera.y) - height;
  if (y > target.height || y + height < 0) return;

  const first = Math.floor(camera.x / SEGMENT_WIDTH);
  const last = Math.ceil((camera.x + camera.viewWidth) / SEGMENT_WIDTH);
  for (let segment = first; segment <= last; segment += 1) {
    const image = skyline.frames[((segment % count) + count) % count];
    if (!image) continue;
    target.blit(image, Math.round(segment * SEGMENT_WIDTH - camera.x), y, skyline.transparent);
  }
}

function drawPlacements(target: Framebuffer, atlas: Atlas, tower: Tower, camera: Camera): void {
  // One level of slop each way so a sprite straddling the edge still draws.
  const topLevel = levelAtWorldY(camera.y) + 1;
  const bottomLevel = levelAtWorldY(camera.y + camera.viewHeight) - 1;

  for (const placement of tower.placements) {
    // Lifts are not a sprite stamped on every floor they serve — they are a
    // shaft with one car in it, drawn separately below. Letting the per-level
    // loop have them tiled a car-with-passengers all the way up the column.
    if (placement.id === 'elevator') continue;

    const highest = placement.level + placement.span - 1;
    if (highest < bottomLevel || placement.level > topLevel) continue;

    const kind = facility(placement.id);
    // A tiled facility steps through its sheet by position, so a lobby reads as
    // one continuous frontage rather than one tile stamped over and over.
    const frame = kind.tiled ? placement.segment : placement.state;
    const found = lookup(atlas, kind.sprite, frame);
    const x = Math.round(placement.segment * SEGMENT_WIDTH - camera.x);
    if (x > target.width || x + kind.width * SEGMENT_WIDTH < 0) continue;

    // Transport repeats: every floor of a stair run gets its own flight. Nothing
    // else does — a parking deck or a metro concourse is one piece of art that
    // happens to be several floors tall, and stamping it per level would draw
    // the same picture two or three times up its own span.
    const bands = kind.transport ? placement.span : 1;
    const bandHeight = kind.transport ? FLOOR_HEIGHT : placement.span * FLOOR_HEIGHT;

    for (let band = 0; band < bands; band += 1) {
      // Levels count upwards but pixels count down, so a run drawn as one band
      // starts at the top of its span.
      const level = kind.transport ? placement.level + band : highest;
      const y = Math.round(levelTop(level) - camera.y);
      if (found) {
        target.blit(found.image, x, y, found.sprite.transparent);
        // The original's facades are shorter than a floor; carry the last row
        // down so a room does not leave a strip of sky under it.
        if (found.image.height < bandHeight) {
          const width = Math.min(found.image.width, kind.width * SEGMENT_WIDTH);
          target.repeatRow(x, y + found.image.height - 1, width, bandHeight - found.image.height);
        }
      } else {
        // A key the atlas does not have still gets a solid band, so an
        // unidentified facility reads as built rather than as a hole. Drawn in
        // the atlas's own dark index: INK.wall is a fallback-palette number and
        // means nothing under the game's palette.
        target.fillRect(x, y, kind.width * SEGMENT_WIDTH, bandHeight, atlas.shaftInk);
      }
    }
  }
}

/**
 * Lift banks: a shaft, a car in it, and a motor housing at each end.
 *
 * The original draws no per-floor shaft graphic. The shaft is a flat dark
 * column with floor numbers down it, the car is a single lit box that moves,
 * and there is a distinct motor room above the top floor served and below the
 * bottom one. Painting the column rather than tiling a sprite is both closer to
 * the original and the thing that stops a car appearing on every floor.
 */
function drawLifts(
  target: Framebuffer,
  atlas: Atlas,
  tower: Tower,
  camera: Camera,
  clock: SceneClock,
): void {
  const shaftInk = atlas.shaftInk;
  /** Depth of the motor room above and below the served floors. */
  const HOUSING = 14;
  /** How far the housing is inset, so it reads as a cap and not more shaft. */
  const HOUSING_INSET = 2;

  const car = lookup(atlas, 'car');
  // The original's own shaft interior, where the player supplied their art.
  // The fallback atlas has no such bitmap and keeps the painted column, so
  // both paths draw a continuous shaft rather than one sprite per floor.
  const shaft = lookup(atlas, 'shaft');

  tower.placements.forEach((placement, index) => {
    if (placement.id !== 'elevator') return;

    const width = facility(placement.id).width * SEGMENT_WIDTH;
    const x = Math.round(placement.segment * SEGMENT_WIDTH - camera.x);
    if (x > target.width || x + width < 0) return;

    const highest = placement.level + placement.span - 1;
    const top = Math.round(levelTop(highest) - camera.y);
    const bottom = Math.round(levelTop(placement.level) + FLOOR_HEIGHT - camera.y);

    if (shaft) {
      target.tile(shaft.image, x, top, width, bottom - top);
    } else {
      target.fillRect(x, top, width, bottom - top, shaftInk);
    }
    // Machine rooms, top and bottom. Inset, so the silhouette steps in at each
    // end the way the original's does. Still painted rather than drawn from
    // 0x88e8-0x88ed: which of those six is the motor room and which are landing
    // doors has not been measured, and a wrong guess here is a visible one.
    target.fillRect(x + HOUSING_INSET, top - HOUSING, width - HOUSING_INSET * 2, HOUSING, shaftInk);
    target.fillRect(x + HOUSING_INSET, bottom, width - HOUSING_INSET * 2, HOUSING, shaftInk);

    drawFloorNumbers(target, atlas, camera, placement.level, highest, x, width);

    if (!car || placement.span < 2) return;

    // Where the car is now. Shared with the arrival detector in `main.ts`
    // rather than derived twice — a chime that plays where the car visibly is
    // not would be worse than no chime. `levelTop` is plain arithmetic, so a
    // fractional level puts the car between floors rather than snapping it.
    const level = carLevel(placement, index, clock.elapsed);
    const y = Math.round(levelTop(level) - camera.y) + 2;
    if (y < -FLOOR_HEIGHT || y > target.height) return;

    target.blit(car.image, x, y, car.sprite.transparent);
  });
}

/**
 * The floor number written down a lift shaft.
 *
 * This is the most recognisable thing about a SimTower lift bank and it was
 * missing from the first frame drawn, because there was no digit source. There
 * is now: 0x87e9 is ten sixteen-pixel cells holding 0 to 9, trimmed to the
 * glyph by `varyingBox` so none of the shared slab furniture comes with them.
 *
 * A label is *composed*, not indexed whole. `floorLabel` in `world/grid.ts`
 * already knows that level 9 is floor 1 and level 6 is B3, so the renderer asks
 * it for the text and picks a glyph per character rather than keeping a second,
 * subtly different idea of what floor it is on.
 *
 * A label is spelled from *one* sheet, never mixed across two. 0x87ea holds a
 * `B` and the digits one to nine — everything a basement needs and nothing
 * else, since there is no B0 and no B10 — so `B3` comes entirely from there and
 * its two glyphs share a trim box, and therefore line up with each other by
 * construction rather than by a fudge factor. Above ground, 0x87e9's ten digits
 * do the same job. An alphabet that cannot spell a label is passed over; a
 * label no alphabet can spell is not drawn, which is how this behaved for the
 * basements before 0x87ea was read and how it will behave for anything else
 * `floorLabel` learns to say.
 */
function drawFloorNumbers(
  target: Framebuffer,
  atlas: Atlas,
  camera: Camera,
  from: number,
  to: number,
  x: number,
  width: number,
): void {
  const alphabets = ALPHABETS.map((alphabet) => ({
    order: alphabet.order,
    sprite: atlas.sprites.get(alphabet.key),
  })).filter((entry): entry is { order: string; sprite: ExtractedSprite } => entry.sprite !== undefined);
  if (alphabets.length === 0) return;

  for (let level = from; level <= to; level += 1) {
    const text = floorLabel(level);
    const spelled = alphabets.map((entry) => spell(entry, text)).find((found) => found !== undefined);
    if (!spelled) continue;

    // Trimmed glyphs have lost their place on the floor; the cut recorded it.
    const y = Math.round(levelTop(level) - camera.y) + (spelled.sprite.origin?.y ?? 0);
    if (y > target.height || y + (spelled.glyphs[0]?.height ?? 0) < 0) continue;

    // Centred in the shaft. Two glyphs sit inside a four-segment lift with room
    // to spare; a hundredth floor needs three and does not, so each is clipped
    // to the shaft rather than allowed to overhang into whatever is next door.
    const textWidth = spelled.glyphs.reduce((total, glyph) => total + glyph.width, 0);
    let cursor = x + Math.round((width - textWidth) / 2);
    for (const glyph of spelled.glyphs) {
      blitClipped(target, glyph, cursor, y, x, x + width, spelled.sprite.transparent);
      cursor += glyph.width;
    }
  }
}

/**
 * The sheets a floor label can be spelled from, tried in order.
 *
 * `order` maps frame index to character; a space means "this frame is not a
 * character we can use". 0x87ea's first two cells are a small `B` raised over a
 * 1 and a 2 — not needed to spell anything, and unexplained, so they are named
 * as unusable rather than guessed at.
 */
const ALPHABETS: readonly { key: string; order: string }[] = [
  { key: 'digits', order: '0123456789' },
  { key: 'digits-basement', order: '  B123456789' },
];

/** One glyph per character from a single sheet, or nothing if it cannot spell it. */
function spell(
  entry: { order: string; sprite: ExtractedSprite },
  text: string,
): { sprite: ExtractedSprite; glyphs: IndexedImage[] } | undefined {
  const glyphs: IndexedImage[] = [];
  for (const character of text) {
    const at = entry.order.indexOf(character);
    const glyph = at >= 0 ? entry.sprite.frames[at] : undefined;
    if (!glyph) return undefined;
    glyphs.push(glyph);
  }
  return glyphs.length > 0 ? { sprite: entry.sprite, glyphs } : undefined;
}

/** Blits an image cropped to a horizontal window, in target coordinates. */
function blitClipped(
  target: Framebuffer,
  image: IndexedImage,
  x: number,
  y: number,
  left: number,
  right: number,
  transparent?: number,
): void {
  const from = Math.max(0, left - x);
  const to = Math.min(image.width, right - x);
  if (to <= from) return;
  const piece = from === 0 && to === image.width ? image : crop(image, from, 0, to - from, image.height);
  target.blit(piece, x + from, y, transparent);
}

/**
 * Pedestrians: two-by-four-pixel dots walking the floor line.
 *
 * They are ornament, not agents — but they are the ornament that makes a tower
 * look inhabited, and their colour is how the original told you the lifts were
 * too slow, so the angry tint is here from the start.
 */
function drawPeople(
  target: Framebuffer,
  atlas: Atlas,
  tower: Tower,
  camera: Camera,
  clock: SceneClock,
): void {
  const people = atlas.sprites.get('people');
  if (!people || people.frames.length === 0) return;

  const topLevel = levelAtWorldY(camera.y);
  const bottomLevel = levelAtWorldY(camera.y + camera.viewHeight);
  // Fewer people about at night, which the palette alone cannot tell you.
  const busy = clock.hour > 7 && clock.hour < 21 ? 1 : 0.25;

  /**
   * The original's room art already has its occupants painted in — a desk with
   * someone at it, a bed with someone asleep in it — so walking our own figures
   * through it doubles them up. There, people belong on the concourse only.
   * Our placeholder rooms are empty, so they keep their walkers.
   */
  const roomWalkers = atlas.source === 'fallback';

  tower.placements.forEach((placement, index) => {
    const kind = facility(placement.id);
    if (kind.transport) return;
    if (!kind.tiled && !roomWalkers) return;
    if (placement.level < bottomLevel - 1 || placement.level > topLevel + 1) return;

    // Stand them on the floor of the room they are in, which is the bottom of
    // the facility's own art — 24 pixels down for the original's facades, a
    // full 36 for ours. Anchoring to the floor band instead put everyone in
    // the slab below the room.
    const facade = lookup(atlas, kind.sprite, kind.tiled ? placement.segment : placement.state);
    // No room, no occupants. A facility whose art the atlas lacks is drawn as a
    // flat band, and populating that puts a scatter of figures on a bare
    // rectangle — which is what the unidentified lobby looked like: confetti on
    // a black strip.
    if (!facade) return;
    const floorLine = Math.min(facade.image.height, FLOOR_HEIGHT);
    const baseY = Math.round(levelTop(placement.level) + floorLine - camera.y);
    if (baseY < 0 || baseY > target.height) return;

    const walkers = Math.round(hash(index) * 3 * busy);
    const runWidth = kind.width * SEGMENT_WIDTH;

    for (let i = 0; i < walkers; i += 1) {
      const seed = index * 31 + i;
      // The last frame is the angry tint; a few of them always are.
      const frame = hash(seed + 11) > 0.85
        ? people.frames.length - 1
        : Math.floor(hash(seed + 5) * (people.frames.length - 1));
      const image = people.frames[frame];
      if (!image) continue;

      // Pace back and forth rather than wrapping. Wrapping made everyone
      // teleport from one side of the room to the other on every lap.
      const span = Math.max(1, runWidth - image.width);
      const speed = 0.006 + hash(seed) * 0.008;
      const phase = mod(hash(seed + 3) + clock.elapsed * speed / span, 2);
      const along = (phase < 1 ? phase : 2 - phase) * span;

      const x = Math.round(placement.segment * SEGMENT_WIDTH + along - camera.x);
      // Feet on the floor line, however tall this particular sprite is.
      target.blit(image, x, baseY - image.height, people.transparent);
    }
  });
}

function mod(value: number, by: number): number {
  return ((value % by) + by) % by;
}
