/**
 * Draws the tower.
 *
 * Everything is painted in world pixels and offset by the camera; nothing here
 * knows about CSS or devicePixelRatio. Only what intersects the viewport is
 * touched, so a hundred-storey tower costs the same to draw as a five-storey
 * one.
 */

import { lookup, type Atlas } from '../assets/atlas.js';
import { INK } from '../assets/fallback.js';
import { FLOOR_HEIGHT, GROUND_LEVEL, SEGMENT_WIDTH, levelAtWorldY, levelTop } from '../world/grid.js';
import { facility } from '../world/facilities.js';
import type { Tower } from '../world/tower.js';
import type { Camera } from './camera.js';
import type { Framebuffer } from './framebuffer.js';

export interface SceneClock {
  /** Fractional hour, 0 to 24. Drives the day/night palette. */
  hour: number;
  /** Milliseconds since start, for lift travel and pedestrians. */
  elapsed: number;
}

/**
 * Cheap deterministic noise. Pedestrians and lift timings need to look
 * unplanned without needing to *be* simulated, and a hash keeps the scene
 * reproducible from frame to frame and screenshot to screenshot.
 */
function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 0x1_0000_0000;
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
  drawCars(target, atlas, tower, camera, clock);
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
  if (horizon >= target.height) return;

  const top = Math.max(0, horizon);
  const ground = lookup(atlas, 'ground');
  if (ground) {
    target.tile(ground.image, -mod(camera.x, ground.image.width), top, target.width, target.height - top);
  } else {
    target.fillRect(0, top, target.width, target.height - top, INK.ground);
  }
  // One line where the tower meets the ground, drawn once rather than by every
  // tile — a lip inside the tile would stripe the whole basement.
  if (horizon >= 0) target.fillRect(0, horizon, target.width, 1, INK.slabLip);
}

function drawPlacements(target: Framebuffer, atlas: Atlas, tower: Tower, camera: Camera): void {
  // One level of slop each way so a sprite straddling the edge still draws.
  const topLevel = levelAtWorldY(camera.y) + 1;
  const bottomLevel = levelAtWorldY(camera.y + camera.viewHeight) - 1;

  for (const placement of tower.placements) {
    const highest = placement.level + placement.span - 1;
    if (highest < bottomLevel || placement.level > topLevel) continue;

    const kind = facility(placement.id);
    const found = lookup(atlas, kind.sprite, placement.state);
    const x = Math.round(placement.segment * SEGMENT_WIDTH - camera.x);
    if (x > target.width || x + kind.width * SEGMENT_WIDTH < 0) continue;

    for (let level = placement.level; level <= highest; level += 1) {
      const y = Math.round(levelTop(level) - camera.y);
      if (found) {
        target.blit(found.image, x, y, found.sprite.transparent);
      } else {
        // An atlas missing this key still gets a solid block, so a mis-mapped
        // resource shows up as a wrong-looking tower rather than an empty one.
        target.fillRect(x, y, kind.width * SEGMENT_WIDTH, FLOOR_HEIGHT, INK.wall);
      }
    }
  }
}

/** Lifts running their shafts. The one piece of motion that reads at a glance. */
function drawCars(
  target: Framebuffer,
  atlas: Atlas,
  tower: Tower,
  camera: Camera,
  clock: SceneClock,
): void {
  const car = lookup(atlas, 'car') ?? lookup(atlas, 'elevator');
  if (!car) return;

  tower.placements.forEach((placement, index) => {
    if (placement.id !== 'elevator' || placement.span < 2) return;

    // A slow triangle wave up and down the shaft, offset per bank so no two
    // are ever in step.
    const period = 9_000 + hash(index) * 6_000;
    const phase = ((clock.elapsed + hash(index + 7) * period) % period) / period;
    const travel = 1 - Math.abs(1 - phase * 2);

    // `levelTop` is plain arithmetic, so a fractional level gives the car a
    // position between floors rather than snapping it to one.
    const level = placement.level + travel * (placement.span - 1);
    const x = Math.round(placement.segment * SEGMENT_WIDTH - camera.x);
    const y = Math.round(levelTop(level) - camera.y) + 2;
    if (y < -FLOOR_HEIGHT || y > target.height) return;

    target.blit(car.image, x, y, car.sprite.transparent);
  });
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

  tower.placements.forEach((placement, index) => {
    const kind = facility(placement.id);
    if (kind.transport) return;
    if (placement.level < bottomLevel - 1 || placement.level > topLevel + 1) return;

    const walkers = Math.round(hash(index) * 3 * busy);
    const floorY = Math.round(levelTop(placement.level) + FLOOR_HEIGHT - camera.y) - 5;
    if (floorY < 0 || floorY > target.height) return;

    const runWidth = kind.width * SEGMENT_WIDTH;
    for (let i = 0; i < walkers; i += 1) {
      const seed = index * 31 + i;
      const speed = 0.008 + hash(seed) * 0.012;
      const along = mod(hash(seed + 3) * runWidth + clock.elapsed * speed, runWidth);
      const x = Math.round(placement.segment * SEGMENT_WIDTH + along - camera.x);
      // The last frame is the angry tint; a few of them always are.
      const frame = hash(seed + 11) > 0.85 ? people.frames.length - 1 : Math.floor(hash(seed + 5) * (people.frames.length - 1));
      const image = people.frames[frame];
      if (image) target.blit(image, x, floorY, people.transparent);
    }
  });
}

function mod(value: number, by: number): number {
  return ((value % by) + by) % by;
}
