// Port of Yoot Tower Restroom / Toilet (doc/yoottower/itemtype-catalog.md:IOTK/LIOT).
// Restroom facility that satisfies tenant sanitation needs and prevents dissatisfaction penalties.

import { Item } from "./item.js";

export class Restroom extends Item {
  constructor(game, prototype) {
    super(game, prototype);
  }

  init() {
    this.evaluation = 85;
  }

  dailyMaintenanceCost() {
    return 50;
  }

  render(draw) {
    super.render(draw);
    if (this.underConstruction) return;

    const game = this.game;
    const px = this.position.x * 8;
    const py = -this.position.y * 36;
    const w = this.size.x * 8;
    const h = 36;

    // Ceramic tile wall backdrop
    const wallColor = game.lighting.compose({ r: 215, g: 230, b: 240, a: 255 });
    draw.rect(px, py - h, w, h, { fill: wallColor });

    // Restroom doors (Men & Women)
    const doorColor = game.lighting.compose({ r: 120, g: 150, b: 180, a: 255 });
    draw.rect(px + 4, py - 28, 10, 26, { fill: doorColor });
    draw.rect(px + 18, py - 28, 10, 26, { fill: doorColor });

    // Restroom signs (Blue / Pink indicators)
    draw.rect(px + 7, py - 24, 4, 4, { fill: { r: 50, g: 100, b: 220, a: 255 } });
    draw.rect(px + 21, py - 24, 4, 4, { fill: { r: 230, g: 70, b: 120, a: 255 } });

    game.drawnSprites += 5;
  }
}
