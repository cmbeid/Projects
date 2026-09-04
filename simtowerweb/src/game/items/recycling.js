// Port of OT::Item::Recycling (source/Item/Recycling.h / Recycling.cpp).
// Subterranean recycling center processing building waste into city rebates.
// Counted by JudgeSystem, maintains tower cleanliness rating.

import { Item } from "./item.js";
import { Sprite } from "../sprite.js";

export class Recycling extends Item {
  constructor(game, prototype) {
    super(game, prototype);
    this.variant = 0; // pinned (C++ reads uninitialized memory)
    this.sprite = new Sprite();
    this.spriteNeedsUpdate = false;
    this.wasteStored = 0;
    this.maxCapacity = 500;
    this.lastTruckDay = -1;
  }

  init() {
    this.sprite
      .setTexture("simtower/recycling")
      .setOrigin(0, 60)
      .setPosition(this.position.x * 8, -this.position.y * 36);
    this.addSprite(this.sprite);
    this.spriteNeedsUpdate = false;

    this.updateSprite();
  }

  depositWaste(units) {
    const accepted = Math.min(units, Math.max(0, this.maxCapacity - this.wasteStored));
    this.wasteStored += accepted;
    return accepted;
  }

  advance(dt) {
    super.advance(dt);
    const hour = this.game.time.hour;
    const day = this.game.time.day;

    // Daily collection truck arrives at 04:00
    if (hour >= 4.0 && hour < 5.0 && this.lastTruckDay !== day) {
      this.lastTruckDay = day;
      if (this.wasteStored > 0) {
        const rebate = this.wasteStored * 5; // $5 per waste unit
        this.game.transferFunds?.(rebate, "commercial", "Recycling rebate");
        this.game.ui?.showMessage?.("Trash collected: $" + rebate + " recycling rebate earned");
        this.wasteStored = 0;
      }
    }
  }

  updateSprite() {
    this.spriteNeedsUpdate = false;
    const index = 0;
    this.sprite.setTextureRect({ x: index * 200, y: this.variant * 60, w: 200, h: 60 });
  }

  dailyMaintenanceCost() {
    return 1000;
  }
}
