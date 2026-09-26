import { SLING, WORLD_BOTTOM } from '../game/world';
import type { Vec } from '../game/sling';

/** World units of height the camera never zooms in past. */
const MIN_VISIBLE_HEIGHT = 560;
/**
 * Zoomed out any further, Pokémon are a few pixels wide. A landscape screen
 * that cannot fit the level at this scale pans instead.
 */
const READABLE_SCALE = 0.38;
/**
 * A portrait screen shows this much of the world across, and pans for the
 * rest; fitting a whole level into it would leave a sliver of playfield.
 */
const PORTRAIT_WIDTH = 560;

export type CameraMode = 'intro' | 'aim' | 'follow' | 'manual';

/**
 * Maps world to screen. The bottom of the world is pinned to the bottom of
 * the screen and only x and zoom move, which keeps the ground steady.
 */
export class Camera {
  /** World x at the left edge of the screen. */
  x = 0;
  scale = 1;
  width = 1;
  height = 1;
  mode: CameraMode = 'intro';
  /** Pinch zoom, as a multiple of the automatic scale. */
  zoom = 1;

  private levelWidth = 1000;
  private follow: Vec | null = null;
  private introTime = 0;

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }

  reset(levelWidth: number): void {
    this.levelWidth = levelWidth;
    this.zoom = 1;
    this.mode = 'intro';
    this.introTime = 0;
    this.scale = this.targetScale();
    this.x = this.maxX();
  }

  /** The scale with the whole level in view, or as close as stays readable. */
  baseScale(): number {
    const fit = Math.min(this.width / (this.levelWidth + 80), this.height / MIN_VISIBLE_HEIGHT);
    const readable = this.height > this.width ? this.width / PORTRAIT_WIDTH : READABLE_SCALE;
    return Math.max(fit, Math.min(readable, this.height / MIN_VISIBLE_HEIGHT));
  }

  targetScale(): number {
    const base = this.baseScale();
    const min = Math.min(base, this.width / (this.levelWidth + 80));
    return Math.min(Math.max(base * this.zoom, min), this.height / 300);
  }

  aim(): void {
    this.mode = 'aim';
    this.follow = null;
  }

  /** Follow a shot. Takes over from manual panning: a launch always wants watching. */
  startFollow(point: Vec): void {
    this.mode = 'follow';
    this.follow = point;
  }

  track(point: Vec): void {
    this.follow = point;
  }

  pan(dxScreen: number): void {
    this.mode = 'manual';
    this.x = this.clampX(this.x - dxScreen / this.scale);
  }

  pinch(factor: number, anchorScreenX: number): void {
    const worldX = this.x + anchorScreenX / this.scale;
    const base = this.baseScale();
    this.zoom = Math.min(Math.max(this.zoom * factor, 0.4), 2.5);
    this.scale = Math.max(Math.min(this.targetScale(), this.height / 300), 0.05);
    if (base > 0) this.x = this.clampX(worldX - anchorScreenX / this.scale);
    this.mode = 'manual';
  }

  update(dtMs: number): void {
    const k = 1 - Math.exp(-dtMs / 180);
    this.scale += (this.targetScale() - this.scale) * k;

    let target = this.x;
    if (this.mode === 'intro') {
      this.introTime += dtMs;
      // Hold on the structure for a moment, then swing back to the sling.
      target = this.introTime < 900 ? this.maxX() : this.aimX();
      if (this.introTime > 900 && Math.abs(this.x - this.aimX()) < 2) this.mode = 'aim';
      this.x += (target - this.x) * (1 - Math.exp(-dtMs / 320));
      return;
    }
    if (this.mode === 'aim') target = this.aimX();
    else if (this.mode === 'follow' && this.follow) target = this.follow.x - this.visibleWidth() * 0.45;
    else return;
    this.x += (this.clampX(target) - this.x) * k;
  }

  visibleWidth(): number {
    return this.width / this.scale;
  }

  toScreen(p: Vec): Vec {
    return { x: (p.x - this.x) * this.scale, y: this.height - (WORLD_BOTTOM - p.y) * this.scale };
  }

  toWorld(p: Vec): Vec {
    return { x: this.x + p.x / this.scale, y: WORLD_BOTTOM - (this.height - p.y) / this.scale };
  }

  private aimX(): number {
    return this.clampX(SLING.x - this.visibleWidth() * 0.18);
  }

  private minX(): number {
    return -80;
  }

  private maxX(): number {
    return Math.max(this.minX(), this.levelWidth + 40 - this.visibleWidth());
  }

  private clampX(x: number): number {
    const lo = this.minX();
    const hi = this.maxX();
    // Wider than the level: centre it rather than pinning to one side.
    if (hi <= lo) return (this.levelWidth - this.visibleWidth()) / 2;
    return Math.min(Math.max(x, lo), hi);
  }
}
