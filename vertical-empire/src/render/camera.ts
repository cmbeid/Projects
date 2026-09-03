/**
 * Where the viewport sits over the tower, and how big a pixel is.
 *
 * Scale is integer-only. A pixel-art tower at 1.7x is a blurry tower, and the
 * whole exercise here is fidelity, so the pinch gesture snaps to whole steps
 * rather than interpolating between them.
 */

import { WORLD_HEIGHT, WORLD_WIDTH } from '../world/grid.js';

export const SCALES = [1, 2, 3] as const;
export type Scale = (typeof SCALES)[number];

export class Camera {
  /** Top-left of the view, in world pixels. */
  x = 0;
  y = 0;
  scale: Scale = 2;

  /** Size of the viewport in world pixels — i.e. CSS pixels divided by scale. */
  viewWidth = 1;
  viewHeight = 1;

  resize(cssWidth: number, cssHeight: number): void {
    this.viewWidth = Math.max(1, Math.ceil(cssWidth / this.scale));
    this.viewHeight = Math.max(1, Math.ceil(cssHeight / this.scale));
    this.clamp();
  }

  /**
   * Changes zoom about a point in the viewport, so pinching keeps whatever is
   * under your fingers under your fingers.
   */
  zoomTo(scale: Scale, cssWidth: number, cssHeight: number, anchorX = 0.5, anchorY = 0.5): void {
    const worldX = this.x + this.viewWidth * anchorX;
    const worldY = this.y + this.viewHeight * anchorY;
    this.scale = scale;
    this.resize(cssWidth, cssHeight);
    this.x = worldX - this.viewWidth * anchorX;
    this.y = worldY - this.viewHeight * anchorY;
    this.clamp();
  }

  panBy(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
    this.clamp();
  }

  centreOn(worldX: number, worldY: number): void {
    this.x = worldX - this.viewWidth / 2;
    this.y = worldY - this.viewHeight / 2;
    this.clamp();
  }

  /**
   * Keeps the view over the world, and centres on the axis where the world is
   * smaller than the viewport rather than pinning it to one edge.
   */
  clamp(): void {
    this.x = this.viewWidth >= WORLD_WIDTH
      ? (WORLD_WIDTH - this.viewWidth) / 2
      : Math.min(Math.max(this.x, 0), WORLD_WIDTH - this.viewWidth);
    this.y = this.viewHeight >= WORLD_HEIGHT
      ? (WORLD_HEIGHT - this.viewHeight) / 2
      : Math.min(Math.max(this.y, 0), WORLD_HEIGHT - this.viewHeight);
    // Whole world pixels only, or the sprite grid shimmers as you drag.
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
  }

  /** Viewport CSS coordinates to world pixels. */
  toWorld(cssX: number, cssY: number): { x: number; y: number } {
    return { x: this.x + cssX / this.scale, y: this.y + cssY / this.scale };
  }

  /** The next scale up or down, stopping at the ends. */
  steppedScale(direction: number): Scale {
    const index = SCALES.indexOf(this.scale);
    const next = Math.min(SCALES.length - 1, Math.max(0, index + Math.sign(direction)));
    return SCALES[next] ?? this.scale;
  }
}
