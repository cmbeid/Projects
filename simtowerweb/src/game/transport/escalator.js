// Port of OT::Item::Escalator (source/Item/Escalator.h / Escalator.cpp).
// 8-frame animation; same 1.5 s Stairlike transit (no direction/speed
// difference in the C++). $100/day maintenance.

import { Stairlike } from "./stairlike.js";

export class Escalator extends Stairlike {
  init() {
    this.frameCount = 8;
    this.sprite.setTexture("simtower/escalator");
    super.init();
  }

  dailyMaintenanceCost() {
    return 100;
  }
}
