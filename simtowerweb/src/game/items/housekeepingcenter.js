// Housekeeping Center (SIMTOWER.EXE bitmap resource 0x87A8).
// The native 120×24 artwork fills a 15-tile room and must be drawn directly;
// it is not a generic service-office interior.

import { Item } from "./item.js";
import { Sprite } from "../sprite.js";

export class HousekeepingCenter extends Item {
  constructor(game, prototype) {
    super(game, prototype);
    this.sprite = new Sprite();
  }

  init() {
    this.evaluation = 80;
    this.sprite
      .setTexture("simtower/housekeeping")
      .setOrigin(0, 24)
      .setPosition(this.position.x * 8, -this.position.y * 36);
    this.addSprite(this.sprite);
  }

  dailyMaintenanceCost() {
    return 200;
  }
}
