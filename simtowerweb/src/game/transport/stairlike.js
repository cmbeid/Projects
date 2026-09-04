// Port of OT::Item::Stairlike (source/Item/Stairlike.h / Stairlike.cpp).
// Common base for Stairs and Escalator: 1.5 sim-second transit per person,
// frame animation while occupied, endpoint-only floor connection, and a
// hit-test that uses the actual (narrow) sprite bounds instead of the full
// 8-tile footprint.

import { Item } from "../items/item.js";
import { Sprite } from "../sprite.js";
import { K_BASE_SPEED } from "../../core/time.js";

// Stairlike.cpp:8 — transit time in speed-scaled (sim) seconds.
export const K_TRANSITION_TIME = 1.5;

export class Stairlike extends Item {
  constructor(game, prototype) {
    super(game, prototype);
    this.sprite = new Sprite();
    this.animation = 0;
    this.frame = 0;
    this.frameCount = 1;
    this.layer = 1;
    this.transitionTimes = new Map(); // Person -> elapsed sim-seconds
  }

  init() {
    this.animation = 0;
    this.frame = 0;
    this.layer = 1;
    this.addSprite(this.sprite);
    this.updateSprite();
  }

  advance(dt) {
    const dta = this.game.time.dta / K_BASE_SPEED;

    // Advance each person's transit timer; at 1.5 sim-seconds the person is
    // delivered to the next route node (Stairlike.cpp:23-33). Iterate a
    // snapshot: journey.next() removes the person from this item.
    let activeProgress = 0;
    let activeDirection = 1; // 1 = up, -1 = down
    let hasPeople = false;

    for (const p of [...this.people]) {
      const t = (this.transitionTimes.get(p) ?? 0) + dta;
      this.transitionTimes.set(p, t);
      if (t >= K_TRANSITION_TIME) {
        this.transitionTimes.delete(p);
        p.journey.next();
      } else {
        hasPeople = true;
        const progress = Math.min(1.0, Math.max(0.0, t / K_TRANSITION_TIME));
        if (progress >= activeProgress) {
          activeProgress = progress;
          // Determine direction: moving up vs down
          const toFloor = p.journey?.toFloor ?? (this.position.y + 1);
          activeDirection = toFloor >= this.position.y + Math.max(1, this.size.y - 1) ? 1 : -1;
        }
      }
    }

    if (hasPeople) {
      let newFrame = 1;
      if (this.frameCount === 14) {
        // Straight stairs: Frame 0 empty, frames 1..6 UP, frames 7..13 DOWN
        if (activeDirection >= 0) {
          const step = Math.min(5, Math.floor(activeProgress * 6));
          newFrame = 1 + step;
        } else {
          const step = Math.min(6, Math.floor(activeProgress * 7));
          newFrame = 7 + step;
        }
      } else {
        // Escalator (8 frames: 0 empty, 1..7 moving) or Spiral (11 frames: 0 empty, 1..10 moving)
        const movingFrames = this.frameCount - 1;
        const step = Math.min(movingFrames - 1, Math.floor(activeProgress * movingFrames));
        newFrame = 1 + step;
      }
      if (this.frame !== newFrame) {
        this.frame = newFrame;
        this.updateSprite();
      }
    } else {
      this.transitionTimes.clear();
      if (this.frame !== 0) {
        this.frame = 0;
        this.updateSprite();
      }
    }
  }

  renderPeople(draw, statusTint, tinted) {
    // Pre-rendered in the stair and escalator sprite frames; suppress external person overlay.
    return;
  }

  // Texture size via the optional bitmap registry; null when headless.
  textureSize() {
    const bitmaps = this.game.app && this.game.app.bitmaps;
    if (bitmaps && bitmaps.getSize) return bitmaps.getSize(this.sprite.texture);
    return null;
  }

  updateSprite() {
    const tex = this.textureSize();
    const w = tex ? Math.floor(tex.x / this.frameCount) : this.size.x * 8;
    const h = tex ? tex.y : (this.size.y - 1) * 36;

    this.sprite
      .setOrigin(0, h)
      .setTextureRect({ x: w * this.frame, y: 0, w, h })
      .setPosition(this.position.x * 8, -this.position.y * 36);
  }

  canHaulPeople() {
    return true;
  }

  isStairlike() {
    return true;
  }

  // Endpoints only (Stairlike.cpp:66-69) — spiral stairs skip intermediates.
  connectsFloor(floor) {
    return this.position.y === floor || this.position.y + this.size.y - 1 === floor;
  }

  // World-space (y up) bounds of the rendered sprite, or null when the sprite
  // has no texture rect yet.
  spriteBounds() {
    const r = this.sprite.textureRect;
    if (!r) return null;
    const x = this.sprite.position.x - this.sprite.origin.x;
    const topRender = this.sprite.position.y - this.sprite.origin.y; // y down
    return { x, y: -(topRender + r.h), w: r.w, h: r.h };
  }

  // Hit-test against the actual sprite bounds (a narrow strip at the left
  // edge of the tile footprint) — clicks outside pass to the tenant behind
  // (Stairlike.cpp:71-81).
  containsPoint(pt) {
    const r = this.spriteBounds();
    if (!r) return false;
    return pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h;
  }

  addPerson(p) {
    this.transitionTimes.set(p, 0);
    super.addPerson(p);
  }

  removePerson(p) {
    this.transitionTimes.delete(p);
    super.removePerson(p);
  }
}
