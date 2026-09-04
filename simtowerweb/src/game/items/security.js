// Port of OT::Item::Security (source/Item/Security.h / Security.cpp).
// Security office with nighttime guard dispatch & patrol mechanics.
// Counted by JudgeSystem (required for 3 stars, +3 evaluation to offices/condos).

import { Item } from "./item.js";
import { Sprite } from "../sprite.js";
import { Person, K_SECURITY, KWANDERING } from "../person.js";

export class SecurityGuard extends Person {
  constructor(item) {
    super(item.game, K_SECURITY);
    this.securityOffice = item;
    this.patrolDir = 1;
    this.offsetWalk = 0;
  }
}

export class Security extends Item {
  constructor(game, prototype) {
    super(game, prototype);
    this.variant = 0; // pinned (C++ reads uninitialized memory)
    this.sprite = new Sprite();
    this.spriteNeedsUpdate = false;
    this.guards = new Set();
  }

  init() {
    this.sprite
      .setTexture("simtower/security")
      .setOrigin(0, 24)
      .setPosition(this.position.x * 8, -this.position.y * 36);
    this.addSprite(this.sprite);
    this.spriteNeedsUpdate = false;
    this.updateSprite();

    // Spawn security guard
    const guard = new SecurityGuard(this);
    guard.state = KWANDERING;
    guard.at = this;
    this.guards.add(guard);
    this.addPerson(guard);
  }

  advance(dt) {
    super.advance(dt);
    const hour = this.game.time.hour;
    // Guards patrol actively between 21:00 and 06:00
    const isNight = hour >= 21.0 || hour < 6.0;

    for (const guard of this.guards) {
      if (isNight) {
        guard.offsetWalk += guard.patrolDir * dt * 4;
        if (guard.offsetWalk > this.size.x * 8 - 16) {
          guard.offsetWalk = this.size.x * 8 - 16;
          guard.patrolDir = -1;
        } else if (guard.offsetWalk < 0) {
          guard.offsetWalk = 0;
          guard.patrolDir = 1;
        }
      }
    }
  }

  isCoveringFloor(floor) {
    // Effective security patrol radius: 15 floors above or below
    return Math.abs(this.position.y - floor) <= 15;
  }

  updateSprite() {
    this.spriteNeedsUpdate = false;
    const index = 0;
    this.sprite.setTextureRect({ x: index * 128, y: this.variant * 24, w: 128, h: 24 });
  }

  dailyMaintenanceCost() {
    return 1000;
  }
}
